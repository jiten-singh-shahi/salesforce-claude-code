---
name: sf-apex-async-patterns
description: "Async Apex patterns — @future, Queueable, Batch, Schedulable, Platform Events, chaining. Use when choosing or implementing async processing. Do NOT use for synchronous Apex or constraint enforcement."
origin: SCC
user-invocable: false
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---

# Apex Async Patterns

Implementation guidance for asynchronous Apex. Covers when to use each pattern and how to implement it correctly. Governor limit numbers and hard rules live in the referenced files and `sf-apex-constraints`.

Reference: @../_reference/ASYNC_PATTERNS.md

---

## When to Use

- When synchronous Apex hits governor limits and needs a separate transaction
- When making HTTP callouts from trigger contexts
- When processing millions of records that exceed single-transaction limits
- When scheduling recurring Apex jobs on a cron-like schedule
- When decoupling event publishers from subscribers using Platform Events
- When deciding between `@future`, Queueable, Batch, Schedulable, or Platform Events

---

## Choosing the Right Pattern

| Requirement | Pattern |
|---|---|
| Simple async with no sObject params | `@future` |
| Need to pass sObjects or collections | `Queueable` |
| Need callouts from trigger context | `@future(callout=true)` |
| Need callouts with complex state | `Queueable + Database.AllowsCallouts` |
| Processing millions of records | `Batch Apex` |
| Need state across batches | `Batch Apex + Database.Stateful` |
| Run on a schedule | `Schedulable` (wraps Batch or Queueable) |
| Decouple publisher from subscriber | `Platform Events` |
| Chain jobs with delay | `Queueable + AsyncOptions` |

---

## @future Methods

The simplest async mechanism. Runs in a separate transaction with its own governor limits.

```apex
public class ExternalDataSync {

    @future(callout=true)
    public static void syncAccountToERP(Id accountId) {
        Account acc = [
            SELECT Id, Name, BillingCity, AnnualRevenue
            FROM Account WHERE Id = :accountId LIMIT 1
        ];

        HttpRequest req = new HttpRequest();
        req.setEndpoint('callout:ERP_System/accounts');
        req.setMethod('POST');
        req.setHeader('Content-Type', 'application/json');
        req.setBody(JSON.serialize(new ERPAccountPayload(acc)));

        HttpResponse res = new Http().send(req);
        if (res.getStatusCode() != 200) {
            logSyncError(accountId, res.getStatusCode(), res.getBody());
        }
    }
}
```

### @future Constraints

- **No sObject parameters** — pass primitive types (Id, String) or serialized JSON. sObjects may change between enqueue and execution.
- **No chaining** — calling `@future` from another `@future` throws a runtime exception.
- **50 per transaction** — governor limit on future method invocations.
- **No return value** — fire-and-forget only.
- **Execution order not guaranteed**.

---

## Queueable Apex

More powerful than `@future`. Supports sObject parameters, chaining, and monitoring via `AsyncApexJob`.

### Basic Queueable

```apex
public class AccountEnrichmentJob implements Queueable {

    private final List<Account> accounts;

    public AccountEnrichmentJob(List<Account> accounts) {
        this.accounts = accounts;
    }

    public void execute(QueueableContext context) {
        List<Account> toUpdate = new List<Account>();
        for (Account acc : accounts) {
            if (acc.AnnualRevenue != null && acc.NumberOfEmployees != null
                    && acc.NumberOfEmployees > 0) {
                toUpdate.add(new Account(
                    Id = acc.Id,
                    Revenue_Per_Employee__c = acc.AnnualRevenue / acc.NumberOfEmployees
                ));
            }
        }
        if (!toUpdate.isEmpty()) update toUpdate;
    }
}

// Enqueue
System.enqueueJob(new AccountEnrichmentJob(accounts));
```

### Queueable with Callouts

Implement `Database.AllowsCallouts` alongside `Queueable`.

```apex
public class ContactDataEnrichmentJob implements Queueable, Database.AllowsCallouts {
    private final Set<Id> contactIds;

    public ContactDataEnrichmentJob(Set<Id> contactIds) {
        this.contactIds = contactIds;
    }

    public void execute(QueueableContext context) {
        // Query, callout, update pattern
    }
}
```

### Chaining Queueable Jobs

Use chaining to process large data sets across multiple transactions. Use WHERE clauses to naturally shrink the result set instead of OFFSET (which has a 2,000-row hard limit).

```apex
public class DataMigrationChainJob implements Queueable {

    private static final Integer BATCH_SIZE = 200;

    public void execute(QueueableContext context) {
        List<Legacy_Record__c> batch = [
            SELECT Id, Legacy_Field__c
            FROM Legacy_Record__c
            WHERE Migrated__c = false
            ORDER BY CreatedDate
            LIMIT :BATCH_SIZE
        ];

        if (batch.isEmpty()) return; // Migration complete

        processBatch(batch);

        // Chain next job — WHERE Migrated__c = false naturally shrinks each iteration
        System.enqueueJob(new DataMigrationChainJob());
    }
}
```

### AsyncOptions

```apex
// Delay execution by 5 minutes
System.AsyncOptions opts = new System.AsyncOptions();
opts.minimumQueueableDelayInMinutes = 5;
System.enqueueJob(new MyQueueableJob(data), opts);

// Duplicate prevention with a unique key
System.AsyncOptions opts2 = new System.AsyncOptions();
opts2.duplicateSignature = 'account-sync-' + accountId;
System.enqueueJob(new AccountSyncJob(accountId), opts2);
```

---

## Batch Apex

For processing large data volumes (millions of records) that exceed single-transaction limits.

### Basic Batch

```apex
public class AccountAnnualReviewBatch
        implements Database.Batchable<SObject>, Database.Stateful {

    private Integer processedCount = 0;
    private List<String> errors    = new List<String>();

    public Database.QueryLocator start(Database.BatchableContext bc) {
        return Database.getQueryLocator([
            SELECT Id, Name, AnnualRevenue, Last_Annual_Review__c, OwnerId
            FROM Account
            WHERE Type = 'Customer'
              AND (Last_Annual_Review__c = null
                   OR Last_Annual_Review__c < LAST_N_DAYS:365)
        ]);
    }

    public void execute(Database.BatchableContext bc, List<Account> scope) {
        // Process scope — each execute() is its own transaction
        // Default scope = 200 records
    }

    public void finish(Database.BatchableContext bc) {
        // Cleanup and notifications
    }
}

// Execute (default scope of 200)
Database.executeBatch(new AccountAnnualReviewBatch());

// Custom scope (smaller for complex processing or callouts)
Database.executeBatch(new AccountAnnualReviewBatch(), 50);
```

### Batch with Callouts

Implement `Database.AllowsCallouts` and set scope = 1 when each callout is per-record (each execute() is limited to 100 callouts).

```apex
public class SingleRecordCalloutBatch
        implements Database.Batchable<SObject>, Database.AllowsCallouts {
    // scope = 1 in executeBatch call
}
Database.executeBatch(new SingleRecordCalloutBatch(), 1);
```

---

## Schedulable Apex

Runs Apex on a schedule. Best practice: schedulable should only coordinate, not do heavy work.

```apex
public class WeeklyReportScheduler implements Schedulable {
    public void execute(SchedulableContext sc) {
        Database.executeBatch(new WeeklyReportBatch(), 200);
    }
}

// Schedule
String cronExp = '0 0 6 ? * MON'; // Every Monday at 6:00 AM
System.schedule('Weekly Report - Monday 6AM', cronExp, new WeeklyReportScheduler());
```

### Cron Expression Reference

```
0 0 2 * * ?        — Daily at 2:00 AM
0 0 9 ? * MON-FRI  — Weekdays at 9:00 AM
0 0 0 1 * ? *      — First day of every month at midnight
0 30 8 ? * SAT     — Every Saturday at 8:30 AM
```

---

## Platform Events

Decouple publishers from subscribers. Subscribers run in their own transaction.

### Publishing

```apex
List<Order_Status_Change__e> events = new List<Order_Status_Change__e>();
for (Order__c order : orders) {
    events.add(new Order_Status_Change__e(
        Order_Id__c   = order.Id,
        New_Status__c = newStatus,
        Changed_By__c = UserInfo.getUserId(),
        Timestamp__c  = Datetime.now()
    ));
}
List<Database.SaveResult> results = EventBus.publish(events);
```

> By default, high-volume platform events use "publish after commit" behavior. To publish immediately regardless of transaction outcome, configure the event's Publish Behavior to "Publish Immediately" in Setup.

### Subscribing via Trigger

```apex
trigger OrderStatusChangeTrigger on Order_Status_Change__e (after insert) {
    for (Order_Status_Change__e event : Trigger.new) {
        // Process event — runs in its own transaction
    }
}
```

### High-Volume Events and ReplayId

```apex
trigger HighVolumeEventTrigger on Analytics_Event__e (after insert) {
    // Set resume checkpoint for retry-after-failure
    EventBus.TriggerContext.currentContext().setResumeCheckpoint(
        Trigger.new[Trigger.new.size() - 1].ReplayId
    );
}
```

---

## Testing Async Apex

`Test.startTest()` / `Test.stopTest()` forces @future, Queueable, and Batch jobs to execute synchronously. Platform events are also delivered synchronously within the test boundary.

```apex
@isTest
static void testBatchUpdatesReviewDate() {
    // Insert test data
    Test.startTest();
    Database.executeBatch(new AccountAnnualReviewBatch(), 200);
    Test.stopTest(); // All batch methods run synchronously
    // Assert results
}
```

---

## Related

- **Agents**: `sf-apex-reviewer`, `sf-performance-optimizer` — For interactive guidance

### Guardrails

- `sf-apex-constraints` — Governs limits, bulkification rules, and naming conventions for all Apex code including async
