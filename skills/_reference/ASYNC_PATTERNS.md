# Async Apex Patterns -- Reference

> Source: https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_async_overview.htm
> Also: https://architect.salesforce.com/decision-guides/async-processing
> Last verified: API v66.0, Spring '26 (2026-03-28)

## Pattern Summary

| Pattern | Interface / Annotation | Entry Point | Returns |
|---|---|---|---|
| **Future** | `@future` / `@future(callout=true)` | `MyClass.myMethod(args)` | `void` (no job ID) |
| **Queueable** | `Queueable` (+optional `Database.AllowsCallouts`) | `System.enqueueJob(new MyJob())` | `Id` (AsyncApexJob ID) |
| **Batch** | `Database.Batchable<SObject>` (+optional `Database.Stateful`, `Database.AllowsCallouts`) | `Database.executeBatch(new MyBatch(), scopeSize)` | `Id` (AsyncApexJob ID) |
| **Schedulable** | `Schedulable` | `System.schedule(name, cron, new MyJob())` | `Id` (CronTrigger ID) |

## Method Signatures

**@future** -- `@future public static void doWork(List<Id> ids) { }` / `@future(callout=true) public static void doCallout(String url) { }`
- Must be `static`. Return: `void` only. Params: **primitives and collections of primitives only** (no SObjects).

**Queueable** -- `public class MyJob implements Queueable { public void execute(QueueableContext ctx) { } }`
- Invoke: `Id jobId = System.enqueueJob(new MyJob());`

**Batch** -- `implements Database.Batchable<SObject>`
- `Database.QueryLocator start(Database.BatchableContext bc)` -- up to **50M rows**
- `Iterable<SObject> start(Database.BatchableContext bc)` -- alternative, 50K row limit
- `void execute(Database.BatchableContext bc, List<SObject> scope)` -- scope 1-2000, default 200
- `void finish(Database.BatchableContext bc)`
- Invoke: `Database.executeBatch(new MyBatch(), 200);`
- Must be **outer class**. Add `Database.Stateful` to retain state across `execute()` calls.

**Schedulable** -- `public class MyJob implements Schedulable { public void execute(SchedulableContext ctx) { } }`
- Invoke: `System.schedule('Daily 5AM', '0 0 5 * * ?', new MyJob());`
- CRON format: `Seconds Minutes Hours Day Month DayOfWeek OptionalYear`

## Concurrency and Chaining Limits

| Constraint | Limit |
|---|---|
| `@future` calls per sync transaction | 50 |
| `@future` from async context | **Not allowed** (cannot call future from future/batch) |
| Queueable jobs per sync transaction | 50 |
| Queueable jobs from async context | 1 (chaining) |
| Queueable chain depth (Dev/Trial orgs) | 5 |
| Queueable chain depth (Enterprise+) | Unlimited (configurable via `AsyncOptions`) |
| Concurrent active Batch jobs | 5 |
| Batch jobs in flex queue | 100 |
| Scheduled jobs per org | 100 |
| Daily async method executions | max(250,000, user_licenses x 200) |

## Queueable Advanced Features (API v50.0+)

**AsyncOptions** -- pass as second arg to `System.enqueueJob(job, opts)`:
- `opts.MinimumQueueableDelayInMinutes` -- 0-10 minutes
- `opts.MaximumQueueableStackDepth` -- cap chain depth
- `opts.DuplicateSignature` -- `new QueueableDuplicateSignature.Builder().addId(id).build()`

**AsyncInfo** -- runtime introspection:
- `AsyncInfo.getCurrentQueueableStackDepth()`, `.getMaximumQueueableStackDepth()`, `.hasMaxStackDepth()`

**Transaction Finalizers** -- `implements Finalizer` with `void execute(FinalizerContext ctx)`:
- Attach inside Queueable: `System.attachFinalizer(new MyFinalizer());`
- `ctx.getResult()` returns `SUCCESS` or `UNHANDLED_EXCEPTION`; `ctx.getAsyncApexJobId()` returns parent job ID.
- Runs after Queueable completes (success **or** failure). Can catch `System.LimitException` (normally uncatchable).
- Can enqueue a new Queueable for retry (max 5 consecutive retries recommended).

## Governor Limit Differences (Sync vs Async)

See `GOVERNOR_LIMITS.md` for full table. Key elevated limits in async context:

| Resource | Synchronous | Async (@future / Queueable / Batch) |
|---|---|---|
| SOQL queries | 100 | 200 |
| CPU time | 10,000 ms | 60,000 ms |
| Heap size | 6 MB | 12 MB |

DML, callouts, and SOQL row limits remain **unchanged** between sync and async.

## Decision Matrix

| Criterion | @future | Queueable | Batch | Schedulable |
|---|---|---|---|---|
| **Record volume** | Small | Small-Medium | Large (up to 50M) | N/A (delegates) |
| **Complex types as input** | No (primitives only) | Yes | Yes | N/A |
| **Job monitoring** | No | Yes (job ID) | Yes (job ID) | Yes (cron ID) |
| **Chaining** | No | Yes (1 per async) | No | No |
| **Callouts** | `@future(callout=true)` | `Database.AllowsCallouts` | `Database.AllowsCallouts` | No (sync context) |
| **Error recovery** | None | Transaction Finalizers | `finish()` method | None |
| **Execution timing** | ASAP, no SLA | ASAP + optional delay (0-10 min) | Queued, off-peak | Cron schedule |
| **Typical use case** | Simple fire-and-forget | Callouts, chained steps | Data cleansing, migration | Daily/weekly maintenance |

**Default recommendation (Spring '26):** Use **Queueable** unless you need Batch's 50M-row capacity or Schedulable's cron timing. `@future` is legacy; Queueable supersedes it in all scenarios.

## Error Recovery Patterns

### Transaction Finalizer Retry

Finalizers run after a Queueable completes — even on `System.LimitException`. Use for retry with backoff.

```apex
public class RetryableJob implements Queueable {
    private Integer attempt;
    public RetryableJob(Integer attempt) { this.attempt = attempt; }

    public void execute(QueueableContext ctx) {
        System.attachFinalizer(new RetryFinalizer(attempt));
        // ... main work ...
    }
}

public class RetryFinalizer implements Finalizer {
    private Integer attempt;
    public RetryFinalizer(Integer attempt) { this.attempt = attempt; }

    public void execute(FinalizerContext ctx) {
        if (ctx.getResult() == ParentJobResult.UNHANDLED_EXCEPTION && attempt < 3) {
            System.enqueueJob(new RetryableJob(attempt + 1));
        }
    }
}
```

### Platform Event Partial Publish Handling

`EventBus.publish()` returns a list of `Database.SaveResult`. Check each for failures.

```apex
List<Order_Event__e> events = new List<Order_Event__e>{ /* ... */ };
List<Database.SaveResult> results = EventBus.publish(events);
for (Integer i = 0; i < results.size(); i++) {
    if (!results[i].isSuccess()) {
        for (Database.Error err : results[i].getErrors()) {
            Logger.error('Event publish failed at index ' + i + ': ' + err.getMessage());
        }
    }
}
```

### EventBus.RetryableException in Subscribers

Throw `EventBus.RetryableException` in an event trigger subscriber to request platform retry (up to 9 retries over 24 hours).

```apex
trigger OrderEventTrigger on Order_Event__e (after insert) {
    for (Order_Event__e evt : Trigger.New) {
        try {
            OrderProcessor.process(evt);
        } catch (CalloutException e) {
            // Transient error — request retry
            throw new EventBus.RetryableException(e.getMessage());
        }
    }
}
```

The platform automatically sets the replay pointer back and re-delivers the event batch. Do NOT throw `RetryableException` for permanent failures (bad data, missing config) — those will retry forever until the 24-hour window expires.
