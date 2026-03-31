<!-- Source: https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_class_System_Cursor.htm -->
<!-- Last verified: API v66.0 — 2026-03-29 -->
<!-- WARNING: Web fetch of canonical URL failed (JS-rendered page). Facts extracted from SCC skill sf-apex-cursor. Verify against official docs before relying on limits. -->

# Apex Cursor Reference

## Classes

| Class | Purpose | AuraEnabled |
|-------|---------|-------------|
| `Database.Cursor` | Server-side pointer for paginated SOQL iteration | No (use PaginationCursor) |
| `Database.PaginationCursor` | UI-oriented cursor for LWC / `@AuraEnabled` methods | Yes |

## Database.Cursor Methods

| Method | Return Type | Description |
|--------|-------------|-------------|
| `Database.getCursor(String soql)` | `Database.Cursor` | Open a new cursor from a SOQL query |
| `Database.getCursor(String cursorId)` | `Database.Cursor` | Re-open a serialized cursor in a new transaction |
| `cursor.fetch(Integer offset, Integer pageSize)` | `List<SObject>` | Fetch a page of records starting at offset |
| `cursor.getNumRecords()` | `Integer` | Total row count the cursor can return |
| `cursor.getId()` | `String` | Serialize cursor ID for cross-transaction use |
| `cursor.close()` | `void` | Release server-side resources |

## Database.PaginationCursor Methods

| Method | Return Type | Description |
|--------|-------------|-------------|
| `Database.getPaginationCursor(String soql)` | `Database.PaginationCursor` | Open a new pagination cursor |
| `Database.getPaginationCursor(String cursorId)` | `Database.PaginationCursor` | Resume from a client-provided cursor ID |
| `cursor.fetch(Integer pageSize)` | `List<SObject>` | Fetch next page (auto-advances position) |
| `cursor.hasMore()` | `Boolean` | Whether more pages remain |
| `cursor.getNumRecords()` | `Integer` | Total row count |
| `cursor.getId()` | `String` | Cursor ID safe to return to LWC client |

## Governor Limits

| Constraint | Value |
|------------|-------|
| Max records per cursor | 50,000,000 |
| Cursor lifetime (sync transaction) | 10 minutes |
| Cursor lifetime (async / Queueable) | 60 minutes |
| Max page size per `fetch()` call | 2,000 rows |
| Max open cursors per transaction | 10 |

## Availability

| Detail | Value |
|--------|-------|
| GA release | Spring '26 |
| Minimum API version | 66.0 |

## Exception Types

| Exception | Cause |
|-----------|-------|
| `System.CursorException: Cursor has been closed` | Called `fetch()` after `close()` |
| `System.CursorException: Cursor has expired` | Exceeded 10 min (sync) or 60 min (async) |
| `System.CursorException: Maximum cursors exceeded` | More than 10 open cursors in one transaction |
| `System.QueryException: Non-selective query` | WHERE clause not indexed on large table |

## Cursor vs OFFSET vs Batch Apex

| Approach | Max Records | Heap Impact | Best For |
|----------|-------------|-------------|----------|
| SOQL `OFFSET` | 2,000 | Full result set in heap | Small UI pagination |
| Batch Apex (`QueryLocator`) | Unlimited | Per-execute governor reset | Background mass processing |
| `Cursor` class | 50,000,000 | Per-page only | Large paginated reports, async chaining, LWC infinite scroll |

## Performance Guidance

| Record Count | Recommended Approach |
|-------------|----------------------|
| < 200 | Standard SOQL with `LIMIT` |
| 200 - 2,000 | `OFFSET` pagination |
| 2,000 - 50,000 | `Cursor` |
| 50,000+ | `Cursor` + Queueable chaining |
| Batch processing | `Database.QueryLocator` |

## Key Rules

- Always close cursors in a `finally` block to prevent server-side resource leaks.
- `Cursor` is read-only; collect IDs separately for DML.
- Cursor ID is serializable; pass it across Queueable jobs for async chaining.
- OFFSET forces the DB to skip N rows per request; Cursor maintains a server-side pointer with no scanning overhead.

## Error Recovery Patterns

### try/finally Cursor Cleanup

Always close cursors in `finally` to prevent resource leaks, even on exceptions.

```apex
Database.Cursor cursor = Database.getCursor('SELECT Id, Name FROM Account');
try {
    Integer total = cursor.getNumRecords();
    for (Integer offset = 0; offset < total; offset += 200) {
        List<Account> page = (List<Account>) cursor.fetch(offset, 200);
        // process page...
    }
} finally {
    cursor.close();
}
```

### Expired Cursor Recovery

If a cursor expires mid-pagination (10 min sync, 60 min async), catch the exception and re-open from the last known offset.

```apex
public static void processLargeDataset(String soql) {
    Database.Cursor cursor = Database.getCursor(soql);
    Integer offset = 0;
    try {
        Integer total = cursor.getNumRecords();
        while (offset < total) {
            try {
                List<SObject> page = cursor.fetch(offset, 2000);
                processBatch(page);
                offset += page.size();
            } catch (System.CursorException e) {
                if (e.getMessage().contains('expired')) {
                    cursor = Database.getCursor(soql); // re-open
                    continue; // retry from same offset
                }
                throw e;
            }
        }
    } finally {
        cursor.close();
    }
}
```

### PaginationCursor — LWC @AuraEnabled Pattern

Return cursor ID to client; handle expiry by issuing a fresh cursor.

```apex
@AuraEnabled
public static Map<String, Object> getPage(String cursorId, String soql) {
    Database.PaginationCursor cursor;
    try {
        cursor = (cursorId != null)
            ? Database.getPaginationCursor(cursorId)
            : Database.getPaginationCursor(soql);
    } catch (System.CursorException e) {
        // Cursor expired — start fresh
        cursor = Database.getPaginationCursor(soql);
    }
    List<SObject> records = cursor.fetch(200);
    return new Map<String, Object>{
        'records' => records,
        'cursorId' => cursor.getId(),
        'hasMore' => cursor.hasMore(),
        'totalCount' => cursor.getNumRecords()
    };
}
```
