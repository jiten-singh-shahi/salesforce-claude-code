# Platform Events with Change Data Capture

Implementing Platform Events for real-time event-driven architecture and subscribing to Change Data Capture events in LWC.

## When to Use This Pattern

- Building real-time notifications between Salesforce components or external systems
- Reacting to record changes across the org without triggers on every object
- Decoupling publishers from subscribers for loosely coupled integrations
- Streaming data changes to Lightning components for live UI updates

## Structure

```text
force-app/main/default/
  objects/
    Order_Status_Event__e/
      Order_Status_Event__e.object-meta.xml    # Platform Event definition
      fields/
        Order_Id__c.field-meta.xml
        Status__c.field-meta.xml
        Message__c.field-meta.xml
  classes/
    OrderEventPublisher.cls                     # Publishes events from Apex
    OrderEventPublisher_Test.cls
    OrderEventSubscriber.cls                    # Trigger subscriber
    OrderEventSubscriber_Test.cls
  triggers/
    OrderStatusEventTrigger.trigger             # Event trigger
  lwc/
    orderStatusMonitor/                         # LWC subscriber via empApi
```

## Platform Event Definition

```xml
<!-- Order_Status_Event__e.object-meta.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
    <deploymentStatus>Deployed</deploymentStatus>
    <description>Published when an order status changes. Subscribers include
    UI components and integration middleware.</description>
    <eventType>HighVolume</eventType>
    <label>Order Status Event</label>
    <pluralLabel>Order Status Events</pluralLabel>
    <publishBehavior>PublishAfterCommit</publishBehavior>
</CustomObject>
```

```xml
<!-- Order_Id__c.field-meta.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<CustomField xmlns="http://soap.sforce.com/2006/04/metadata">
    <fullName>Order_Id__c</fullName>
    <label>Order ID</label>
    <length>18</length>
    <type>Text</type>
    <required>true</required>
    <description>The Salesforce ID of the order that changed status</description>
</CustomField>
```

## Publishing Events from Apex

```apex
public with sharing class OrderEventPublisher {

    /**
     * Publishes order status change events. Uses PublishAfterCommit so events
     * are only delivered if the enclosing transaction succeeds.
     */
    public static void publishStatusChange(Id orderId, String newStatus, String message) {
        Order_Status_Event__e event = new Order_Status_Event__e(
            Order_Id__c = orderId,
            Status__c = newStatus,
            Message__c = message
        );

        Database.SaveResult result = EventBus.publish(event);

        if (!result.isSuccess()) {
            for (Database.Error err : result.getErrors()) {
                System.debug(LoggingLevel.ERROR,
                    'Order event publish failed: ' + err.getStatusCode() + ' - ' + err.getMessage()
                );
            }
        }
    }

    /**
     * Bulk publish for batch processes. Publishes up to 10,000 events per call.
     */
    public static List<Database.SaveResult> publishBulkStatusChanges(
        List<Order_Status_Event__e> events
    ) {
        return EventBus.publish(events);
    }
}
```

## Subscribing via Apex Trigger

```apex
// OrderStatusEventTrigger.trigger
trigger OrderStatusEventTrigger on Order_Status_Event__e (after insert) {
    OrderEventSubscriber.handleEvents(Trigger.new);
}
```

```apex
public with sharing class OrderEventSubscriber {

    /**
     * Processes incoming order status events. Updates related records and
     * creates tasks for critical status changes. Uses
     * EventBus.TriggerContext.currentContext().setResumeCheckpoint to
     * handle large event volumes gracefully.
     */
    public static void handleEvents(List<Order_Status_Event__e> events) {
        Set<String> orderIdStrings = new Set<String>();
        Map<String, Order_Status_Event__e> latestByOrder = new Map<String, Order_Status_Event__e>();

        for (Order_Status_Event__e evt : events) {
            orderIdStrings.add(evt.Order_Id__c);
            // Keep only the latest event per order (events arrive in order)
            latestByOrder.put(evt.Order_Id__c, evt);
        }

        // Query orders to validate IDs exist — Order_Id__c is Text, so we must
        // verify the referenced records are real before using them as WhatId
        Map<Id, Order> ordersById = new Map<Id, Order>(
            [SELECT Id FROM Order WHERE Id IN :orderIdStrings]
        );

        // Create follow-up tasks for failed orders
        List<Task> tasks = new List<Task>();
        for (Order_Status_Event__e evt : latestByOrder.values()) {
            if (evt.Status__c == 'Failed') {
                // Safely convert Text to Id — skip if the value is invalid
                Id orderId;
                try {
                    orderId = Id.valueOf(evt.Order_Id__c);
                } catch (StringException e) {
                    System.debug(LoggingLevel.ERROR,
                        'Invalid Order ID in event: ' + evt.Order_Id__c);
                    continue;
                }

                if (ordersById.containsKey(orderId)) {
                    tasks.add(new Task(
                        Subject = 'Order Failed: ' + evt.Order_Id__c,
                        Description = evt.Message__c,
                        WhatId = orderId,
                        Priority = 'High',
                        Status = 'Not Started',
                        ActivityDate = Date.today().addDays(1)
                    ));
                }
            }
        }

        if (!tasks.isEmpty()) {
            insert tasks;
        }

        // Set checkpoint for replay on large batches
        EventBus.TriggerContext.currentContext().setResumeCheckpoint(
            events[events.size() - 1].ReplayId
        );
    }
}
```

## Subscribing in LWC via empApi

```html
<!-- orderStatusMonitor.html -->
<template>
    <lightning-card title="Order Status Monitor" icon-name="standard:orders">
        <div class="slds-p-around_small">
            <template if:true={isSubscribed}>
                <lightning-badge label="Live" class="slds-m-bottom_small slds-theme_success"></lightning-badge>
            </template>
            <template if:false={isSubscribed}>
                <lightning-badge label="Disconnected" class="slds-m-bottom_small"></lightning-badge>
                <lightning-button label="Connect" onclick={handleSubscribe} variant="brand" class="slds-m-left_small"></lightning-button>
            </template>
        </div>

        <template if:true={hasEvents}>
            <lightning-datatable
                key-field="replayId"
                data={events}
                columns={columns}
                hide-checkbox-column>
            </lightning-datatable>
        </template>

        <template if:false={hasEvents}>
            <div class="slds-p-around_medium slds-text-align_center slds-text-color_weak">
                Waiting for order status events...
            </div>
        </template>
    </lightning-card>
</template>
```

```javascript
// orderStatusMonitor.js
import { LightningElement } from 'lwc';
import {
    subscribe,
    unsubscribe,
    onError,
    setDebugFlag,
    isEmpEnabled
} from 'lightning/empApi';

const CHANNEL = '/event/Order_Status_Event__e';
const MAX_EVENTS = 50;

const COLUMNS = [
    { label: 'Order ID', fieldName: 'orderId', type: 'text' },
    { label: 'Status', fieldName: 'status', type: 'text' },
    { label: 'Message', fieldName: 'message', type: 'text' },
    { label: 'Time', fieldName: 'timestamp', type: 'text' }
];

export default class OrderStatusMonitor extends LightningElement {
    subscription = null;
    events = [];
    columns = COLUMNS;

    get isSubscribed() {
        return this.subscription != null;
    }

    get hasEvents() {
        return this.events.length > 0;
    }

    connectedCallback() {
        this.registerErrorListener();
        this.handleSubscribe();
    }

    disconnectedCallback() {
        this.handleUnsubscribe();
    }

    handleSubscribe() {
        // Subscribe with replay -1 (new events only) or -2 (all retained events)
        const replayId = -1;

        subscribe(CHANNEL, replayId, (response) => {
            this.handleEvent(response);
        }).then((sub) => {
            this.subscription = sub;
            console.log('Subscribed to ' + CHANNEL);
        });
    }

    handleUnsubscribe() {
        if (this.subscription) {
            unsubscribe(this.subscription, () => {
                this.subscription = null;
                console.log('Unsubscribed from ' + CHANNEL);
            });
        }
    }

    handleEvent(response) {
        const payload = response.data.payload;
        const newEvent = {
            replayId: response.data.event.replayId,
            orderId: payload.Order_Id__c,
            status: payload.Status__c,
            message: payload.Message__c,
            timestamp: new Date(payload.CreatedDate).toLocaleString()
        };

        // Prepend new event; keep only the most recent MAX_EVENTS
        this.events = [newEvent, ...this.events].slice(0, MAX_EVENTS);
    }

    registerErrorListener() {
        onError((error) => {
            console.error('empApi error: ', JSON.stringify(error));
            // Reset subscription state so user can reconnect
            this.subscription = null;
        });
    }
}
```

## Change Data Capture Subscription

Change Data Capture (CDC) publishes events automatically when records are created, updated, deleted, or undeleted. No custom event definition is needed.

```javascript
// accountChangeMonitor.js
import { LightningElement } from 'lwc';
import { subscribe, unsubscribe, onError } from 'lightning/empApi';

// CDC channel format: /data/<ObjectName>ChangeEvent
const CDC_CHANNEL = '/data/AccountChangeEvent';

export default class AccountChangeMonitor extends LightningElement {
    subscription = null;
    changes = [];

    connectedCallback() {
        this.registerErrorListener();
        subscribe(CDC_CHANNEL, -1, (response) => {
            this.handleChangeEvent(response);
        }).then((sub) => {
            this.subscription = sub;
        });
    }

    disconnectedCallback() {
        if (this.subscription) {
            unsubscribe(this.subscription, () => {
                this.subscription = null;
            });
        }
    }

    handleChangeEvent(response) {
        const header = response.data.payload.ChangeEventHeader;
        const change = {
            id: Date.now(),
            recordIds: header.recordIds.join(', '),
            changeType: header.changeType,       // CREATE, UPDATE, DELETE, UNDELETE
            changedFields: header.changedFields.join(', '),
            commitUser: header.commitUser,
            timestamp: new Date(header.commitTimestamp).toLocaleString()
        };

        this.changes = [change, ...this.changes].slice(0, 100);
    }

    registerErrorListener() {
        onError((error) => {
            console.error('CDC error: ', JSON.stringify(error));
            this.subscription = null;
        });
    }
}
```

## Error Handling and Replay

```apex
// Handling publish failures with retry
public with sharing class EventPublishHelper {

    private static final Integer MAX_RETRIES = 3;

    public static void publishWithRetry(List<Order_Status_Event__e> events) {
        Integer attempts = 0;
        List<Order_Status_Event__e> failedEvents = new List<Order_Status_Event__e>(events);

        while (!failedEvents.isEmpty() && attempts < MAX_RETRIES) {
            attempts++;
            List<Database.SaveResult> results = EventBus.publish(failedEvents);
            failedEvents = new List<Order_Status_Event__e>();

            for (Integer i = 0; i < results.size(); i++) {
                if (!results[i].isSuccess()) {
                    failedEvents.add(events[i]);
                    for (Database.Error err : results[i].getErrors()) {
                        System.debug(LoggingLevel.WARN,
                            'Publish attempt ' + attempts + ' failed for event ' + i
                            + ': ' + err.getMessage()
                        );
                    }
                }
            }
        }

        if (!failedEvents.isEmpty()) {
            System.debug(LoggingLevel.ERROR,
                failedEvents.size() + ' events failed after ' + MAX_RETRIES + ' attempts'
            );
            // Log to a custom object or send an alert
        }
    }
}
```

## Test Class

```apex
@IsTest
private class OrderEventPublisher_Test {

    @IsTest
    static void testPublishSingleEvent() {
        Test.startTest();
        OrderEventPublisher.publishStatusChange(
            '801xx000000001AAA',
            'Shipped',
            'Order has been shipped via FedEx'
        );
        Test.stopTest();

        // Verify event was published (query the event bus in test context)
        // Platform Events published in tests are immediately available after Test.stopTest()
    }

    @IsTest
    static void testPublishBulkEvents() {
        List<Order_Status_Event__e> events = new List<Order_Status_Event__e>();
        for (Integer i = 0; i < 200; i++) {
            events.add(new Order_Status_Event__e(
                Order_Id__c = '801xx00000000' + String.valueOf(i).leftPad(4, '0'),
                Status__c = 'Processing',
                Message__c = 'Bulk event ' + i
            ));
        }

        Test.startTest();
        List<Database.SaveResult> results = OrderEventPublisher.publishBulkStatusChanges(events);
        Test.stopTest();

        for (Database.SaveResult result : results) {
            System.assert(result.isSuccess(), 'Event publish should succeed');
        }
    }

    @IsTest
    static void testSubscriberCreatesTasksForFailedOrders() {
        // Create a real Order so the subscriber can validate the ID via SOQL
        Account acc = new Account(Name = 'Test Account');
        insert acc;
        Order ord = new Order(
            AccountId = acc.Id,
            EffectiveDate = Date.today(),
            Status = 'Draft'
        );
        insert ord;

        List<Order_Status_Event__e> events = new List<Order_Status_Event__e>{
            new Order_Status_Event__e(
                Order_Id__c = ord.Id,
                Status__c = 'Failed',
                Message__c = 'Payment declined'
            ),
            new Order_Status_Event__e(
                Order_Id__c = ord.Id,
                Status__c = 'Shipped',
                Message__c = 'Shipped successfully'
            )
        };

        Test.startTest();
        OrderEventSubscriber.handleEvents(events);
        Test.stopTest();

        List<Task> tasks = [SELECT Subject, Priority, WhatId FROM Task WHERE Subject LIKE 'Order Failed%'];
        System.assertEquals(1, tasks.size(), 'Should create task only for failed order');
        System.assertEquals('High', tasks[0].Priority);
        System.assertEquals(ord.Id, tasks[0].WhatId, 'Task should be linked to the Order');
    }
}
```

## Key Principles

- Use `PublishAfterCommit` to ensure events are only delivered when the transaction succeeds
- Use `PublishImmediately` only when events must fire regardless of transaction outcome
- Set resume checkpoints in event triggers to handle large event volumes without hitting limits
- Subscribe with replay ID `-1` for new events only, or `-2` to replay all retained events (up to 72 hours)
- Keep event payloads small: include IDs and status, not full record data
- CDC events are automatically generated; use them instead of custom events when you only need record change notifications

## Common Pitfalls

- Publishing events inside a loop instead of collecting and bulk-publishing
- Forgetting that `PublishAfterCommit` events are lost if the transaction rolls back (this is the intended behavior)
- Not handling the `onError` callback in empApi, which causes silent subscription failures
- Exceeding the daily Platform Event allocation (check org limits)
- Assuming event delivery order is guaranteed across different event types
- Not calling `unsubscribe` in `disconnectedCallback`, which leaks subscriptions

## SCC Skills

- `sf-platform-events-cdc` -- review Platform Event and CDC implementations
- `sf-apex-best-practices` -- review publisher and subscriber Apex code
- `sf-lwc-development` -- review the empApi subscription component
- `sf-governor-limits` -- check event publish limits and bulk compliance
