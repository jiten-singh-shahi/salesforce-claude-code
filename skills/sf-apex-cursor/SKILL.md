---
name: sf-apex-cursor
description: "Apex Cursor API for paginating large SOQL results (up to 50M records) — cursor navigation, Queueable chaining, LWC pagination. Use when paginating queries or migrating from OFFSET. Do NOT use for small result sets."
origin: SCC
user-invocable: false
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---

# Apex Cursor

The `Cursor` class (GA Spring '26) enables efficient pagination through up to 50 million SOQL rows without the 2,000-row OFFSET limit. Use it for large dataset processing that previously required chunked OFFSET patterns or raw Batch Apex.

Reference: @../_reference/APEX_CURSOR.md

---

## When to Use

- When implementing paginated queries over large datasets using the Apex Cursor API
- When OFFSET-based pagination hits governor limits or performance issues on large result sets
- When building `@AuraEnabled` methods with server-side cursor pagination for LWC components
- When migrating legacy OFFSET queries to cursor-based iteration for scalability beyond 2,000 rows

---

## Cursor vs. OFFSET vs. Batch Apex

| Approach | Max Records | Heap Impact | Best For |
|----------|------------|-------------|----------|
| SOQL `OFFSET` | 2,000 | Full result set in heap | Small UI pagination |
| Batch Apex | Unlimited | Per-execute governor reset | Background mass processing |
| `Cursor` class | 50,000,000 | Per-page only | Large paginated reports, async chaining, LWC infinite scroll |

### Performance Comparison

| Record Count | Best Approach | Why |
|-------------|--------------|-----|
| < 200 | Standard SOQL with `LIMIT` | Simple, no overhead |
| 200 - 2,000 | `OFFSET` pagination | Adequate performance, simpler code |
| 2,000 - 50,000 | `Cursor` | OFFSET degrades above 2K; Cursor maintains constant performance |
| 50,000+ | `Cursor` + Queueable chaining | Single cursor handles up to 50M records |
| Batch processing | `Database.QueryLocator` | Full governor reset per execute chunk |

**Key insight:** OFFSET forces the database to skip N rows on every request. At 10,000 OFFSET, the DB scans and discards 10K rows. Cursor maintains a server-side pointer with no scanning overhead regardless of position.

---

## Cursor Class API

```apex
// Open a cursor — returns a server-side pointer, not the data
Database.Cursor cursor = Database.getCursor('SELECT Id, Name FROM Account ORDER BY Id');

// Fetch a page of records starting at offset
List<SObject> page = cursor.fetch(offset, pageSize);

// Total number of records the cursor can return
Integer total = cursor.getNumRecords();

// Serialize the cursor for use across transactions (Queueable chaining)
String cursorId = cursor.getId();

// Re-open a serialized cursor in a new transaction
Database.Cursor resumed = Database.getCursor(cursorId);

// Always close when done to release server-side resources
cursor.close();
```

---

## Basic Cursor Pagination

Process data page-by-page without loading everything into heap. Do not accumulate all rows in memory.

```apex
public class LargeAccountAuditor {

    public static AuditSummary auditAccounts() {
        Database.Cursor cursor = Database.getCursor(
            'SELECT Id, Name, AnnualRevenue, Industry FROM Account ORDER BY Name'
        );

        Integer pageSize = 2000;
        Integer offset = 0;
        Decimal totalRevenue = 0;
        Integer totalCount = 0;
        List<Audit_Log__c> logsToInsert = new List<Audit_Log__c>();

        try {
            while (offset < cursor.getNumRecords()) {
                List<Account> page = cursor.fetch(offset, pageSize);

                for (Account acc : page) {
                    totalRevenue += acc.AnnualRevenue != null ? acc.AnnualRevenue : 0;
                    totalCount++;

                    if (acc.AnnualRevenue == null || acc.AnnualRevenue == 0) {
                        logsToInsert.add(new Audit_Log__c(
                            Record_Id__c = acc.Id,
                            Finding__c   = 'Missing AnnualRevenue'
                        ));
                    }
                }
                // page goes out of scope — GC-eligible, heap stays flat

                if (logsToInsert.size() >= 5000) {
                    insert logsToInsert;
                    logsToInsert.clear();
                }

                offset += pageSize;
            }

            if (!logsToInsert.isEmpty()) insert logsToInsert;
        } finally {
            cursor.close();
        }

        return new AuditSummary(totalCount, totalRevenue);
    }
}
```

---

## Async Cursor Chaining with Queueable

Serialize a Cursor by ID and pass it across Queueable jobs to process 50M records across chained async transactions.

```apex
public class LargeLeadProcessorQueueable implements Queueable {

    private String  cursorId;
    private Integer offset;
    private static final Integer PAGE_SIZE = 2000;

    // First call — no cursor yet
    public LargeLeadProcessorQueueable() {
        Database.Cursor cursor = Database.getCursor(
            'SELECT Id, Status, LeadSource FROM Lead WHERE IsConverted = false ORDER BY Id'
        );
        this.cursorId = cursor.getId();
        this.offset   = 0;
        cursor.close(); // Close handle; cursor remains alive on server
    }

    // Subsequent calls — resume from cursor
    public LargeLeadProcessorQueueable(String cursorId, Integer offset) {
        this.cursorId = cursorId;
        this.offset   = offset;
    }

    public void execute(QueueableContext ctx) {
        Database.Cursor cursor = Database.getCursor(this.cursorId);

        if (this.offset >= cursor.getNumRecords()) {
            cursor.close();
            return;
        }

        List<Lead> page = cursor.fetch(this.offset, PAGE_SIZE);
        processLeads(page);

        Integer nextOffset = this.offset + page.size();

        if (nextOffset < cursor.getNumRecords()) {
            cursor.close();
            System.enqueueJob(new LargeLeadProcessorQueueable(this.cursorId, nextOffset));
        } else {
            cursor.close();
        }
    }
}
```

---

## PaginationCursor for LWC / @AuraEnabled

For user-facing pagination (LWC infinite scroll, Screen Flows), use `Database.PaginationCursor`. It is `@AuraEnabled` compatible.

```apex
public with sharing class AccountPaginationController {

    private static final Integer DEFAULT_PAGE_SIZE = 20;

    @AuraEnabled(cacheable=false)
    public static PageResult getAccounts(String cursorId, Integer pageSize) {
        if (pageSize == null || pageSize <= 0) pageSize = DEFAULT_PAGE_SIZE;

        Database.PaginationCursor cursor;
        if (String.isBlank(cursorId)) {
            cursor = Database.getPaginationCursor(
                'SELECT Id, Name, Industry, AnnualRevenue FROM Account ORDER BY Name'
            );
        } else {
            cursor = Database.getPaginationCursor(cursorId);
        }

        List<Account> page = cursor.fetch(pageSize);

        PageResult result = new PageResult();
        result.records    = page;
        result.cursorId   = cursor.getId();
        result.hasMore    = cursor.hasMore();
        result.totalCount = cursor.getNumRecords();
        return result;
    }

    public class PageResult {
        @AuraEnabled public List<Account> records;
        @AuraEnabled public String cursorId;
        @AuraEnabled public Boolean hasMore;
        @AuraEnabled public Integer totalCount;
    }
}
```

### LWC Integration

```javascript
import { LightningElement } from 'lwc';
import getAccounts from '@salesforce/apex/AccountPaginationController.getAccounts';

export default class AccountInfiniteList extends LightningElement {
    accounts = [];
    cursorId = null;
    hasMore = true;
    isLoading = false;

    connectedCallback() { this.loadPage(); }

    async loadPage() {
        if (this.isLoading || !this.hasMore) return;
        this.isLoading = true;
        try {
            const result = await getAccounts({ cursorId: this.cursorId, pageSize: 20 });
            this.accounts = [...this.accounts, ...result.records];
            this.cursorId = result.cursorId;
            this.hasMore  = result.hasMore;
        } catch (error) {
            console.error('Pagination error:', error);
        } finally {
            this.isLoading = false;
        }
    }

    handleLoadMore() { this.loadPage(); }
}
```

---

## Cursor Limits

| Constraint | Detail |
|-----------|--------|
| Max records per cursor | 50,000,000 |
| Cursor lifetime (sync) | 10 minutes |
| Cursor lifetime (async) | 60 minutes |
| `fetch()` max page size | 2,000 rows per call |
| Max open cursors | 10 per transaction |
| `PaginationCursor` @AuraEnabled | Fully supported |

### Error Handling

Always close cursors in a `try/finally` block.

```apex
Database.Cursor cursor = Database.getCursor('SELECT Id FROM Lead');
try {
    List<Lead> leads = cursor.fetch(0, 100);
    processLeads(leads);
} catch (System.CursorException e) {
    // Cursor expired or already closed
    System.debug(LoggingLevel.WARN, 'Cursor error: ' + e.getMessage());
    throw;
} finally {
    try { cursor.close(); } catch (Exception ignored) {}
}
```

| Error | Cause | Fix |
|-------|-------|-----|
| `Cursor has been closed` | `fetch()` after `close()` | Check cursor state before fetching |
| `Cursor has expired` | > 10 min sync / 60 min async | Process faster or use Queueable chaining |
| `Maximum cursors exceeded` | > 10 open cursors | Close cursors in `finally` blocks |
| `Non-selective query` | WHERE clause not indexed | Add custom index or narrow query |

---

## Testing Cursor Code

```apex
@IsTest
private class CursorPaginationTest {

    @TestSetup
    static void makeData() {
        List<Account> accounts = new List<Account>();
        for (Integer i = 0; i < 500; i++) {
            accounts.add(new Account(Name = 'Cursor Test ' + String.valueOf(i).leftPad(3, '0')));
        }
        insert accounts;
    }

    @IsTest
    static void shouldPaginateThroughAllRecords() {
        Test.startTest();
        Database.Cursor cursor = Database.getCursor(
            'SELECT Id, Name FROM Account WHERE Name LIKE \'Cursor Test%\' ORDER BY Name'
        );
        Integer totalFetched = 0;
        try {
            while (totalFetched < cursor.getNumRecords()) {
                List<Account> page = (List<Account>) cursor.fetch(totalFetched, 200);
                totalFetched += page.size();
            }
        } finally {
            cursor.close();
        }
        Test.stopTest();
        System.assertEquals(500, totalFetched, 'Should fetch all 500 records');
    }
}
```

---

## Related

- **Skills**: `sf-apex-async-patterns` — For Queueable chaining patterns

### Guardrails

- `sf-apex-constraints` — Governs SOQL and DML usage in cursor-processing code
- `sf-soql-constraints` — Governs query structure and selectivity requirements
