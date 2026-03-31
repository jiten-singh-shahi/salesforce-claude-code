# Governor Limits — Salesforce Reference

> Last verified: API v66.0 (Spring '26)
> Source: https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_gov_limits.htm

Salesforce governor limits prevent any single Apex transaction from monopolizing shared infrastructure. Hitting a limit throws `System.LimitException`, which **cannot be caught** — it terminates the transaction immediately.

## Per-Transaction Limits

| Resource | Synchronous | @future / Queueable | Batch execute() | Batch start/finish |
|---|---|---|---|---|
| **SOQL queries** | 100 | 200 | 200 | 200 |
| **SOQL rows returned** | 50,000 | 50,000 | 50,000 | 50,000 |
| **SOQL rows for `FOR UPDATE`** | 200 | 200 | 200 | 200 |
| **DML statements** | 150 | 150 | 150 | 150 |
| **DML rows** | 10,000 | 10,000 | 10,000 | 10,000 |
| **CPU time (ms)** | 10,000 | 60,000 | 60,000 | 60,000 |
| **Heap size** | 6 MB | 12 MB | 12 MB | 12 MB |
| **Callouts** | 100 | 100 | 100 | 100 |
| **Total callout time (s)** | 120 | 120 | 120 | 120 |
| **Response size per callout** | 12 MB | 12 MB | 12 MB | 12 MB |
| **Email invocations** | 10 | 10 | 10 | 10 |
| **@future calls** | 50 | 0 (can't chain) | 50 | 50 |
| **Queueable jobs** | 50 | 1 (chain in prod) | 1 | 1 |
| **Push notifications** | 10 | 10 | 10 | 10 |
| **Query cursor timeout (s)** | 600 | 600 | 600 | 600 |
| **QueryLocator rows (Batch)** | N/A | N/A | 50M | N/A |

## SOQL Cursor Limits (Spring '26+, API v66.0)

| Constraint | Value |
|---|---|
| Max records per cursor | 50,000,000 |
| Cursor lifetime (sync) | 10 minutes |
| Cursor lifetime (async / Queueable) | 60 minutes |
| `fetch()` max page size | 2,000 rows per call |
| Max open cursors per transaction | 10 |

## Org-Wide Limits (Not Per-Transaction)

| Resource | Limit |
|---|---|
| Scheduled Apex jobs | 100 jobs scheduled at once |
| Concurrent long-running requests (>5s) | 10 |
| Batch jobs active (executing) | 5 concurrent; up to 100 in flex queue |
| Platform event publishes per hour | 250,000 |

## Limits Class — Programmatic Checking

| Method | Returns |
|---|---|
| `Limits.getQueries()` / `Limits.getLimitQueries()` | SOQL queries used / limit |
| `Limits.getQueryRows()` / `Limits.getLimitQueryRows()` | SOQL rows used / limit |
| `Limits.getDmlStatements()` / `Limits.getLimitDmlStatements()` | DML statements used / limit |
| `Limits.getDmlRows()` / `Limits.getLimitDmlRows()` | DML rows used / limit |
| `Limits.getCpuTime()` / `Limits.getLimitCpuTime()` | CPU ms used / limit |
| `Limits.getHeapSize()` / `Limits.getLimitHeapSize()` | Heap bytes used / limit |
| `Limits.getCallouts()` / `Limits.getLimitCallouts()` | Callouts used / limit |
| `Limits.getFutureCalls()` / `Limits.getLimitFutureCalls()` | @future calls used / limit |
| `Limits.getEmailInvocations()` / `Limits.getLimitEmailInvocations()` | Emails used / limit |
| `Limits.getQueueableJobs()` / `Limits.getLimitQueueableJobs()` | Queueable jobs used / limit |

## Key Anti-Patterns

| Anti-Pattern | Governor Impact | Correct Pattern |
|---|---|---|
| SOQL inside a loop | Exceeds 100 SOQL limit | Query once, store in Map |
| DML inside a loop | Exceeds 150 DML limit | Collect records, single DML after loop |
| Loading all fields when only ID needed | Heap exhaustion | SELECT only required fields |
| Nested loops for matching | CPU time exhaustion | Map/Set lookup (O(1) vs O(n)) |
| String concatenation in loops | Heap growth + CPU | List<String> + String.join() |

## Test.startTest() / Test.stopTest()

`Test.startTest()` resets all governor limit counters. Code between `startTest()` and `stopTest()` gets a fresh limit budget. Async work enqueued inside this block runs synchronously at `stopTest()`.

Always test triggers with 200 records (the standard trigger batch size) to validate bulk safety.
