---
name: sf-governor-limits
description: >-
  Use when hitting Salesforce governor limits in Apex — SOQL, DML, heap,
  CPU optimization, async offloading, bulk processing strategies.
  Do NOT use for general Apex or LWC patterns.
origin: SCC
user-invocable: true
---

# Governor Limits — Working Within Limits

Salesforce governor limits prevent any single transaction from monopolizing shared infrastructure. Hitting a limit throws `System.LimitException`, which cannot be caught. This skill covers strategies and optimization procedures. See @../_reference/GOVERNOR_LIMITS.md for the complete limits reference table.

@../_reference/GOVERNOR_LIMITS.md

## When to Use

- A transaction throws `System.LimitException` in production or tests
- Reviewing Apex code for SOQL/DML-in-loop anti-patterns before deployment
- Batch or trigger jobs intermittently hitting CPU or heap limits
- Profiling a large data operation processing 200+ records
- Optimizing a slow trigger handler or service class for bulk safety
- Preparing for an ISV security review that checks governor limit compliance

## Checking Limits Programmatically

The `Limits` class provides real-time limit consumption. Use it defensively before expensive operations.

```apex
public class LimitAwareProcessor {
    public void processIfSafe(List<Account> accounts) {
        Integer soqlRemaining = Limits.getLimitQueries() - Limits.getQueries();
        if (soqlRemaining < 5) {
            System.debug(LoggingLevel.WARN,
                'Low SOQL budget: ' + Limits.getQueries() + '/' +
                Limits.getLimitQueries() + '. Deferring to async.');
            if (Limits.getQueueableJobs() < Limits.getLimitQueueableJobs()
                && !System.isBatch() && !System.isFuture()) {
                System.enqueueJob(new AccountProcessorJob(extractIds(accounts)));
            }
            return;
        }

        Integer dmlRemaining = Limits.getLimitDmlStatements() - Limits.getDmlStatements();
        if (dmlRemaining < 3) {
            throw new LimitSafetyException(
                'Insufficient DML budget. ' +
                Limits.getDmlStatements() + '/' + Limits.getLimitDmlStatements() + ' used.'
            );
        }

        Integer heapUsed = Limits.getHeapSize();
        Integer heapLimit = Limits.getLimitHeapSize();
        if (heapUsed > heapLimit * 0.75) {
            System.debug(LoggingLevel.WARN, 'Heap at 75% — skipping optional enrichment.');
        }

        processInternal(accounts);
    }

    public class LimitSafetyException extends Exception {}
}
```

---

## SOQL Limit Strategies

### Query Once, Store in Map

The most impactful single optimization in Salesforce development.

```apex
public void processAccounts(List<Account> accounts) {
    Set<Id> accountIds = new Set<Id>();
    for (Account acc : accounts) accountIds.add(acc.Id);

    Map<Id, List<Contact>> contactsByAccountId = new Map<Id, List<Contact>>();
    for (Contact con : [SELECT Id, Email, AccountId FROM Contact WHERE AccountId IN :accountIds]) {
        if (!contactsByAccountId.containsKey(con.AccountId)) {
            contactsByAccountId.put(con.AccountId, new List<Contact>());
        }
        contactsByAccountId.get(con.AccountId).add(con);
    }

    for (Account acc : accounts) {
        List<Contact> contacts = contactsByAccountId.get(acc.Id);
        if (contacts != null) sendEmailsToContacts(contacts);
    }
}
```

### Use Aggregate Queries

```apex
// 1 query instead of 3
Map<String, Integer> countsByType = new Map<String, Integer>();
for (AggregateResult ar : [
    SELECT Type, COUNT(Id) cnt FROM Account WHERE Type != null GROUP BY Type
]) {
    countsByType.put((String) ar.get('Type'), (Integer) ar.get('cnt'));
}
```

---

## DML Limit Strategies

### Collect Records, Single DML After Loop

```apex
public void setDefaultTitle(List<Contact> contacts) {
    List<Contact> toUpdate = new List<Contact>();
    for (Contact con : contacts) {
        if (String.isBlank(con.Title)) {
            toUpdate.add(new Contact(Id = con.Id, Title = 'Business Contact'));
        }
    }
    if (!toUpdate.isEmpty()) {
        update toUpdate; // 1 DML regardless of list size
    }
}
```

### Partial Success DML

```apex
List<Database.SaveResult> results = Database.insert(accounts, false);
List<String> errors = new List<String>();
for (Integer i = 0; i < results.size(); i++) {
    if (!results[i].isSuccess()) {
        for (Database.Error err : results[i].getErrors()) {
            errors.add(accounts[i].Name + ': ' + err.getMessage());
        }
    }
}
if (!errors.isEmpty()) ErrorLogger.log(errors);
```

### Unit of Work Pattern

For complex transactions creating related records across multiple objects, collect all records and commit once to minimize DML statements.

```apex
SimpleUnitOfWork uow = new SimpleUnitOfWork();
Account acc = new Account(Name = 'New Customer');
uow.registerNew(acc);
Contact primary = new Contact(LastName = 'Primary');
uow.registerNew(primary, Contact.AccountId, acc);
uow.commitWork(); // Minimal DML: inserts parent first, resolves IDs, then children
```

---

## Heap Limit Strategies

### Select Minimal Fields

```apex
// Use aggregate for count — do not load full sObjects just to count
Integer count = [SELECT COUNT() FROM Account];

// Select only fields the calling code needs
List<Account> accounts = [SELECT Id, Name FROM Account WHERE Id IN :accountIds];
```

### Use Maps Instead of Parallel Lists

```apex
// Single data structure instead of two synchronized lists
Map<Id, String> accountNameById = new Map<Id, String>();
for (Account acc : accounts) {
    accountNameById.put(acc.Id, acc.Name);
}
```

### Nullify Large References When Done

```apex
List<SObject> largeDataSet = loadLargeDataSet();
List<String> results = extractResults(largeDataSet);
largeDataSet = null; // Eligible for garbage collection
saveResults(results);
```

---

## CPU Time Strategies

### Use Maps Instead of Nested Loops

```apex
// O(n) using Set lookup instead of O(n^2) nested loop
Set<Id> validAccountIds = new Set<Id>(new Map<Id, Account>(validAccounts).keySet());
List<Contact> orphaned = new List<Contact>();
for (Contact con : contacts) {
    if (!validAccountIds.contains(con.AccountId)) {
        orphaned.add(con);
    }
}
```

### Use String.join Instead of Concatenation in Loops

```apex
List<String> names = new List<String>();
for (Account acc : accounts) names.add(acc.Name);
String output = String.join(names, ', '); // One allocation
```

### Offload to Async When CPU Is High

```apex
if (Limits.getCpuTime() > 8000) { // 8 of 10 seconds used
    System.enqueueJob(new AccountProcessorJob(
        new List<Id>(new Map<Id, Account>(accounts).keySet())
    ));
    return;
}
performExpensiveProcessing(accounts);
```

---

## Callout Limit Strategies

### @future(callout=true) from Triggers

Triggers cannot make synchronous callouts. Use @future to defer.

```apex
public class AccountERPSyncService {
    @future(callout=true)
    public static void syncToERP(List<Id> accountIds) {
        List<Account> accounts = [
            SELECT Id, Name, External_Id__c FROM Account WHERE Id IN :accountIds
        ];
        for (Account acc : accounts) ERPClient.syncAccount(acc);
    }
}
```

### Queueable for Callout Chains

```apex
public class SequentialCalloutJob implements Queueable, Database.AllowsCallouts {
    private final List<Id> accountIds;
    private final Integer currentIndex;

    public SequentialCalloutJob(List<Id> accountIds) { this(accountIds, 0); }
    private SequentialCalloutJob(List<Id> accountIds, Integer startIndex) {
        this.accountIds = accountIds;
        this.currentIndex = startIndex;
    }

    public void execute(QueueableContext ctx) {
        final Integer CALLOUTS_PER_JOB = 90;
        Integer end = Math.min(currentIndex + CALLOUTS_PER_JOB, accountIds.size());
        for (Integer i = currentIndex; i < end; i++) {
            ERPClient.syncAccount(accountIds[i]);
        }
        if (end < accountIds.size()) {
            System.enqueueJob(new SequentialCalloutJob(accountIds, end));
        }
    }
}
```

---

## Async Decision Tree

```
User action that can complete in < 5s?     → Synchronous
Processing > 200 records?                   → Batch Apex
Callouts from a trigger?                    → @future(callout=true) or Queueable
CPU exceeding 8000ms regularly?             → Profile first; then Queueable
Recurring scheduled operation?              → Schedulable wrapping Batch/Queueable
```

---

## Testing at Limits

```apex
@isTest
static void testTrigger_200RecordBulkInsert_noLimitException() {
    List<Account> accounts = new List<Account>();
    for (Integer i = 0; i < 200; i++) {
        accounts.add(new Account(Name = 'Bulk Test ' + i, Type = 'Customer'));
    }

    Test.startTest(); // Resets governor limit counters
    insert accounts;
    Test.stopTest();

    System.assertEquals(200,
        [SELECT COUNT() FROM Account WHERE Type = 'Customer'],
        'All 200 accounts should be inserted');
}

@isTest
static void testService_queriesStayWithinLimits() {
    List<Account> accounts = TestDataFactory.createAccounts(50);

    Test.startTest();
    Integer queriesBefore = Limits.getQueries();
    AccountService.processAll(new Map<Id, Account>(accounts).keySet());
    Integer queriesUsed = Limits.getQueries() - queriesBefore;
    Test.stopTest();

    System.assert(queriesUsed <= 5,
        'processAll() should use at most 5 SOQL queries. Actual: ' + queriesUsed);
}
```

---

## Related

- **Agent**: `sf-performance-optimizer` — For interactive, in-depth guidance
- **Constraints**: `sf-apex-constraints` — Hard rules for Apex governor compliance
