---
name: sf-platform-events-cdc
description: >-
  Salesforce Platform Events and CDC — Apex publish/subscribe, event replay, testing patterns. Use when designing event-driven integrations or data sync.
---

# Platform Events & Change Data Capture

Procedures for building event-driven integrations using Platform Events and CDC. Allocation limits, retention windows, publish behavior details, and testing API specifics live in the reference file.

@../_reference/PLATFORM_EVENTS.md

## When to Use

- Designing event-driven architecture within Salesforce or with external systems
- Implementing real-time data synchronization using Change Data Capture
- Building decoupled integrations with retry and replay capabilities
- Replacing polling-based integrations with push-based event notifications
- Implementing audit trails or data replication to external data stores

---

## Publishing Platform Events

### From Apex

```apex
public class OrderEventPublisher {
    public static void publishOrderCompleted(List<Order> orders) {
        List<Order_Completed__e> events = new List<Order_Completed__e>();

        for (Order ord : orders) {
            events.add(new Order_Completed__e(
                Order_Id__c = ord.Id,
                Total_Amount__c = ord.TotalAmount,
                Customer_Id__c = ord.AccountId,
                Fulfillment_Status__c = 'Pending'
            ));
        }

        List<Database.SaveResult> results = EventBus.publish(events);

        for (Integer i = 0; i < results.size(); i++) {
            if (!results[i].isSuccess()) {
                for (Database.Error err : results[i].getErrors()) {
                    System.debug(LoggingLevel.ERROR,
                        'Event publish failed: ' + err.getStatusCode() +
                        ' - ' + err.getMessage());
                }
            }
        }
    }
}
```

### Publish After Commit vs Publish Immediately

- **Publish After Commit** (default): Events are lost if the transaction rolls back. Use for business events.
- **Publish Immediately** (set in event definition in Setup): Events publish even if the transaction fails. Use for audit/error logging. Configured at the event level, not via code parameters.

---

## Subscribing to Platform Events

### Apex Trigger Subscriber

```apex
trigger OrderCompletedTrigger on Order_Completed__e (after insert) {
    List<Task> followUpTasks = new List<Task>();

    for (Order_Completed__e event : Trigger.new) {
        followUpTasks.add(new Task(
            Subject = 'Follow up on Order ' + event.Order_Id__c,
            Description = 'Amount: ' + event.Total_Amount__c,
            WhatId = Id.valueOf(event.Order_Id__c),
            Status = 'Not Started',
            Priority = event.Total_Amount__c > 100000 ? 'High' : 'Normal'
        ));
    }

    if (!followUpTasks.isEmpty()) {
        insert followUpTasks;
    }
}
```

**Trigger subscriber behavior:**

- Runs in its own transaction (separate from publisher)
- High-volume events: automatic retry up to 9 times over 24 hours
- Standard volume events: no automatic retries
- Batch size: up to 2,000 per batch for high-volume events

### Retry and Checkpoint Pattern

```apex
trigger OrderCompletedTrigger on Order_Completed__e (after insert) {
    if (EventBus.TriggerContext.currentContext().retries > 9) {
        List<Error_Log__c> errorLogs = new List<Error_Log__c>();
        for (Order_Completed__e event : Trigger.new) {
            errorLogs.add(new Error_Log__c(
                Source__c = 'OrderCompletedTrigger',
                Message__c = 'Max retries for order: ' + event.Order_Id__c
            ));
        }
        insert errorLogs;
        return;
    }

    try {
        // Process events with checkpointing to avoid poison-pill blocking.
        // processOrder() MUST be idempotent — on retry, it runs again for
        // events between last checkpoint and failure point.
        for (Order_Completed__e event : Trigger.new) {
            processOrder(event);
            EventBus.TriggerContext.currentContext()
                .setResumeCheckpoint(event.ReplayId);
        }
    } catch (Exception e) {
        throw new EventBus.RetryableException(
            'Transient failure: ' + e.getMessage());
    }
}
```

### Flow Subscriber

```
Flow Type: Platform Event-Triggered Flow
Object: Order_Completed__e
Trigger: When a platform event message is received

Elements:
  1. Get Records: Find matching Order by Order_Id__c
  2. Decision: Check if order needs fulfillment
  3. Update Records: Set Order.Status to 'Processing'
  4. Create Records: Create Shipment__c record
```

### External Subscribers

| Protocol | Use Case |
|----------|----------|
| CometD (Streaming API) | Legacy, browser-based (long polling) |
| Pub/Sub API (gRPC) | Modern, server-to-server (higher throughput) |

---

## Replay Mechanism

Every published event receives a **ReplayId** -- a monotonically increasing sequence number.

```
Replay Options:
  -1 -> Tip of stream (new events only)
  -2 -> Earliest available (all retained events)
  <specific-id> -> From that ReplayId forward
```

### Managing ReplayId in Apex

```apex
public class EventReplayManager {
    public static void updateReplayId(String eventType, String replayId) {
        Event_Replay_Checkpoint__c checkpoint =
            Event_Replay_Checkpoint__c.getInstance(eventType);
        if (checkpoint == null) {
            checkpoint = new Event_Replay_Checkpoint__c(
                Name = eventType,
                Last_Replay_Id__c = replayId
            );
        } else {
            checkpoint.Last_Replay_Id__c = replayId;
        }
        upsert checkpoint;
    }
}
```

Concurrency note: Multiple subscribers may read the same checkpoint and reprocess overlapping events. Use ReplayId for deduplication.

---

## Change Data Capture (CDC)

CDC automatically publishes change events when records are created, updated, deleted, or undeleted.

### Enabling CDC

Enable per object in Setup > Change Data Capture.

```
Channel format:
  Standard objects: /data/AccountChangeEvent
  Custom objects:   /data/MyObject__ChangeEvent
```

### Handling CDC in Apex

```apex
trigger AccountChangeEventTrigger on AccountChangeEvent (after insert) {
    for (AccountChangeEvent event : Trigger.new) {
        EventBus.ChangeEventHeader header = event.ChangeEventHeader;

        if (header.changedFields.contains('BillingCity')) {
            System.debug('BillingCity changed to: ' + event.BillingCity);
        }

        switch on header.changeType {
            when 'CREATE' { handleCreate(event); }
            when 'UPDATE' { handleUpdate(event, header.changedFields); }
            when 'DELETE' { handleDelete(header.recordIds); }
            when 'UNDELETE' { handleUndelete(header.recordIds); }
        }
    }
}
```

### Gap and Overflow Events

Gap events indicate missed events -- trigger a full sync.

```apex
if (header.changeType == 'GAP_CREATE' || header.changeType == 'GAP_UPDATE'
    || header.changeType == 'GAP_DELETE' || header.changeType == 'GAP_UNDELETE'
    || header.changeType == 'GAP_OVERFLOW') {
    initiateFullSync(header.entityName);
}
```

Overflow events occur when a single transaction modifies >100,000 records.

---

## Event-Driven Architecture Patterns

### Decoupled Integration

```
Salesforce (Publisher) ---> Platform Event ---> External System (Subscriber)
```

Publisher does not know or care who subscribes. New subscribers added without modifying publisher code.

### Saga Pattern (Multi-Step Transaction)

```
Order Created     -> PE: Order_Created__e
Inventory Reserved -> PE: Inventory_Reserved__e
Payment Processed -> PE: Payment_Processed__e
Order Fulfilled   -> PE: Order_Fulfilled__e
If any step fails -> PE: Order_Compensation__e (rollback)
```

Each step is an independent transaction. Compensation events handle rollback.

### CDC for Real-Time Sync

```
Salesforce -> CDC Events -> Data Lake / Warehouse
             (AccountChangeEvent, ContactChangeEvent, etc.)
```

---

## Testing Platform Events

### Testing Event Publishing

```apex
@isTest
static void testOrderEventPublishing() {
    Order testOrder = new Order(
        AccountId = testAccountId,
        TotalAmount = 50000,
        Status = 'Draft'
    );
    insert testOrder;

    Test.startTest();
    OrderEventPublisher.publishOrderCompleted(new List<Order>{ testOrder });
    Test.stopTest();

    // Verify via SaveResult
    List<Order_Completed__e> events = new List<Order_Completed__e>();
    events.add(new Order_Completed__e(
        Order_Id__c = testOrder.Id,
        Total_Amount__c = testOrder.TotalAmount
    ));
    List<Database.SaveResult> results = EventBus.publish(events);
    Test.getEventBus().deliver();

    Assert.isTrue(results[0].isSuccess());
}
```

### Testing Event Subscribers

```apex
@isTest
static void testOrderCompletedSubscriber() {
    Account testAccount = new Account(Name = 'Test Account');
    insert testAccount;

    Order_Completed__e event = new Order_Completed__e(
        Order_Id__c = 'ORD-001',
        Total_Amount__c = 75000,
        Customer_Id__c = testAccount.Id,
        Fulfillment_Status__c = 'Pending'
    );

    Test.startTest();
    EventBus.publish(event);
    Test.getEventBus().deliver();
    Test.stopTest();

    List<Task> tasks = [SELECT Id, Priority FROM Task
        WHERE Subject LIKE '%ORD-001%'];
    System.assertEquals(1, tasks.size());
    System.assertEquals('Normal', tasks[0].Priority);
}
```

### Testing CDC Triggers

```apex
@isTest
static void testAccountChangeEventTrigger() {
    Account acc = new Account(Name = 'Original Name');
    insert acc;

    Test.startTest();
    acc.Name = 'Updated Name';
    acc.BillingCity = 'San Francisco';
    update acc;
    Test.getEventBus().deliver();
    Test.stopTest();

    // Assert on whatever side-effects your trigger produces
}
```

---

## Monitoring and Troubleshooting

### EventBusSubscriber Query

```apex
List<EventBusSubscriber> subscribers = [
    SELECT Name, Position, Retries, LastError, Status, Topic
    FROM EventBusSubscriber
    WHERE Topic = '/event/Order_Completed__e'
];
```

### Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Events not received | Subscriber suspended after max retries | Check EventBusSubscriber.Status, resume |
| Events out of order | Parallel processing | Use sequenceNumber to reorder |
| Missing events | Retention period exceeded | Implement checkpoint, reduce lag |
| Gap events received | System overload | Implement full-sync fallback |
| LIMIT_EXCEEDED on publish | Exceeded daily allocation | Batch publishes, check edition limits |

---

## Related

- Constraints: sf-apex-constraints
- Reference: @../_reference/PLATFORM_EVENTS.md, @../_reference/INTEGRATION_PATTERNS.md
