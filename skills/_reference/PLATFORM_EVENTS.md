# Platform Events & CDC — Reference

> Source: https://developer.salesforce.com/docs/atlas.en-us.platform_events.meta/platform_events/platform_event_limits.htm
> Source: https://developer.salesforce.com/docs/atlas.en-us.change_data_capture.meta/change_data_capture/cdc_allocations.htm
> Last verified: API v66.0, Spring '26 (2026-03-28)

## Platform Event Definitions

| Allocation | DE | EE / PE+API | UE / Perf |
|---|---|---|---|
| Max event definitions per org | 5 | 50 | 100 |
| Max event message size | 1 MB | 1 MB | 1 MB |
| Max concurrent CometD clients (all event types) | 20 | 1,000 | 2,000 |
| Max flows/processes subscribing to a PE | 4,000 | 4,000 | 4,000 |
| Max **active** flows/processes subscribing | 2,000 | 2,000 | 2,000 |
| Custom channels (PE, excl. RTEM) | 100 | 100 | 100 |
| Custom channels (CDC) | 100 | 100 | 100 |
| Distinct PE per channel | 5 | 50 | 50 |

## Publishing Allocations (per hour, rolling)

| Allocation | DE | EE / PE+API | UE / Perf |
|---|---|---|---|
| Event publishing (all methods) | 50,000 | 250,000 | 250,000 |
| With add-on license | +25,000 | +25,000 | +25,000 |

Applies to: Apex `EventBus.publish()`, Pub/Sub API, REST/SOAP API, Bulk API, Flows, Process Builder. Exceeding returns `LIMIT_EXCEEDED`.

## Delivery Allocations (per 24h, rolling)

| Allocation | DE | EE / PE+API | UE / Perf |
|---|---|---|---|
| Event delivery (shared PE + CDC) | 10,000 | 25,000 | 50,000 |
| With add-on license | +100,000/day (3M/month entitlement) | same | same |

Applies to: Pub/Sub API, CometD, empApi LWC, Event Relays. **Does NOT apply to**: Apex triggers, Flows, Process Builder -- these have no delivery cap.

## Event Retention

| Event Type | Retention |
|---|---|
| High-volume platform events (default since Spring '19) | **72 hours** |
| Legacy standard-volume events (API v44.0 and earlier) | 24 hours (retiring Summer '27) |
| Change Data Capture events | **72 hours** |

Subscribers replay missed events via Replay ID within the retention window. Replay IDs are not guaranteed contiguous. After org migration or sandbox refresh, pre-activity Replay IDs are invalid.

## EventBus.publish() Behavior

| Publish Behavior Setting | Transaction | Rollback | Governor Limit |
|---|---|---|---|
| **Publish Immediately** (default) | Independent of DML transaction | Cannot roll back | 150 `EventBus.publish()` calls (separate limit) |
| **Publish After Commit** | Honors transaction boundary | Supports `Database.setSavepoint()` / `rollback()` | Counts as DML statement (against 150 DML limit) |

- Publishing is **asynchronous** -- `Database.SaveResult.isSuccess()` = true means enqueued, not delivered.
- Status code `OPERATION_ENQUEUED` returned on success.
- Publish behavior setting does **not** apply to Pub/Sub API publishes.
- `allOrNone` header is ignored for Publish Immediately; respected for initial enqueue of Publish After Commit.

## Apex Publish Callbacks

- Implement `EventBus.EventPublishFailureCallback` and/or `EventBus.EventPublishSuccessCallback`.
- Pass callback instance as second arg: `EventBus.publish(eventList, callbackInstance)`.
- Callback runs under **Automated Process** user.
- Limit: 5 MB cumulative callback usage in last 30 minutes; max 10 callback invocations per publish.

## Pub/Sub API Allocations

| Allocation | Value |
|---|---|
| Max event message size | 1 MB |
| Max PublishRequest payload | 4 MB (recommend < 3 MB) |
| Recommended events per publish request | 200 |
| Max events per FetchRequest | 100 |
| Max managed subscriptions per org | 200 |
| Max concurrent gRPC streams per channel | 1,000 |

## Change Data Capture (CDC)

### CDC Entity Selection Limits

| Allocation | DE | EE | UE / Perf |
|---|---|---|---|
| Max selected entities (all channels combined) | 5 | 5 | 5 |
| With add-on license | No limit | No limit | No limit |
| Max custom channels | 100 | 100 | 100 |

CDC is available for **all custom objects** and a **subset of standard objects** (Account, Contact, Lead, Opportunity, Case, Task, Event, User, Order, Product2, Pricebook2, PricebookEntry, and others -- see Object Reference for full list).

### CDC Event Types

| changeType | Meaning |
|---|---|
| `CREATE`, `UPDATE`, `DELETE`, `UNDELETE` | Normal change events with full field data |
| `GAP_CREATE`, `GAP_UPDATE`, `GAP_DELETE`, `GAP_UNDELETE` | Header only, no field data -- retrieve record via ID |
| `GAP_OVERFLOW` | Single transaction exceeded 100,000 changes; one overflow event per entity type |

Gap events are caused by: event > 1 MB, field type conversions, internal errors, or database-level changes outside app server transactions.

### Overflow Threshold

First 100,000 changes in a single transaction produce normal change events. Beyond that, one overflow event per entity type. Each field change in an update counts separately toward the 100K threshold.

## Testing Patterns

| Method | Purpose |
|---|---|
| `Test.getEventBus().deliver()` | Deliver queued test events to subscribers (triggers, flows) |
| `Test.getEventBus().fail()` | Simulate publish failure -- invokes `onFailure()` callback |
| `Test.enableChangeDataCapture()` | Enable CDC in test context for all entities |
| `Test.startTest()` / `Test.stopTest()` | Events delivered after `stopTest()` |

- Test event bus is **separate** from production event bus.
- Test publish limit: **500 events per test method**.
- Replay IDs reset to 0 in test context.
- `EventBusSubscriber.Position` and `.Tip` reset to 0 in test context.
- Apex triggers, flows, processes fire in test context; CometD/Pub/Sub API subscribers do **not**.

## Apex Trigger Batch Size
Platform event and CDC triggers receive up to **2,000 records per batch** (vs. 200 for standard DML triggers). Use `EventBus.TriggerContext.currentContext().setResumeCheckpoint(replayId)` to checkpoint and resume on failure. Throw `EventBus.RetryableException` to retry from last checkpoint.
