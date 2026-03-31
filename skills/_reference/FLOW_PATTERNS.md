# Flow Patterns — Reference

> Source: https://architect.salesforce.com/docs/architect/decision-guides/guide/record-triggered
> Source: https://help.salesforce.com/s/articleView?id=platform.flow_considerations_limit_transaction.htm
> Source: https://help.salesforce.com/s/articleView?id=platform.flow_concepts_bulkification.htm
> Last verified: API v66.0, Spring '26 (2026-03-28)

## Flow Types

| Type | Trigger | Context | Key Constraints |
|---|---|---|---|
| **Screen Flow** | User interaction | Runs in user context | Pauses transaction at each screen element |
| **Record-Triggered (Before-Save)** | Record create/update | Same transaction, before commit | Assignment, Decision, Get Records, Loop only; no DML elements |
| **Record-Triggered (After-Save)** | Record create/update/delete | Same transaction, after commit | Full element set; shares governor limits with before-save |
| **Record-Triggered (Async)** | Record create/update | Separate transaction | Runs outside original transaction; own governor limits |
| **Record-Triggered (Scheduled Path)** | Record field date/time | Separate transaction (batched) | Evaluates hours/days/minutes offset from a date field |
| **Schedule-Triggered** | Cron schedule | Automated Process User | Runs as system; batch-processes matched records |
| **Platform Event-Triggered** | Platform Event message | Automated Process User | Subscribes to event channel; own transaction per batch |
| **Autolaunched (No Trigger)** | Apex, REST API, Process, button | Caller's context | Shares caller's transaction and governor limits |

## Per-Transaction Limits (Shared with Apex)

Flows execute under standard Apex governor limits. These are **per-transaction**, shared across all Flows and Apex in the same transaction.

| Resource | Limit |
|---|---|
| SOQL queries | 100 (sync) / 200 (async) |
| Records retrieved by SOQL | 50,000 |
| DML statements | 150 |
| Records processed by DML | 10,000 |
| CPU time | 10,000 ms (sync) / 60,000 ms (async) |
| Heap size | 6 MB (sync) / 12 MB (async) |
| Callouts | 100 |
| Executed flow elements per interview | No limit (API v57.0+); 2,000 (API v56.0 and earlier) |
| Duplicate updates to same record in one batch | 12 |

## General Org Limits

| Resource | Limit |
|---|---|
| Flow versions per flow | 50 |
| Active flows (Professional/Essentials editions) | 5 |
| Paused flow interviews per org | 50,000 (removed in Winter '24+) |

## Transaction Boundaries

Flows break into a **new transaction** at these elements (resetting governor limits):

- Screen elements
- Scheduled Paths
- Wait (Conditions / Amount of Time / Until Date)
- Run Asynchronously path

## Bulkification Rules

Record-triggered flows auto-bulkify: when a batch of records fires the trigger, the runtime groups interviews and consolidates SOQL/DML where possible. Manual best practices:

| Rule | Detail |
|---|---|
| **Never put SOQL inside a loop** | Get Records in a loop consumes 1 SOQL query per iteration; hits 100-query limit fast |
| **Never put DML inside a loop** | Create/Update/Delete Records in a loop consumes 1 DML per iteration; hits 150-DML limit fast |
| **Use collection variables** | Accumulate records in a collection inside the loop; perform single DML after the loop |
| **Filter early** | Apply entry conditions and Get Records filters to minimize records processed |
| **Before-save for same-record updates** | Avoids a second DML operation; most performant path for field updates on triggering record |

## Error Handling Patterns

| Pattern | How |
|---|---|
| **Fault path (per element)** | Connect a Fault Connector from any DML/callout element to a custom error handler |
| **Fault email** | Configure fault paths to send admin email with `{!$Flow.FaultMessage}` and `{!$Flow.CurrentDateTime}` |
| **Default fault behavior** | Without explicit fault path: rolls back transaction, shows unhandled-fault email to admin |
| **Screen flow fault** | Display `{!$Flow.FaultMessage}` on a Screen element so the user sees the error |
| **Rollback scope** | A fault on any after-save DML rolls back the entire transaction including before-save changes |

## Flow vs Apex — Decision Matrix

Based on Salesforce Architect decision guide using **automation density** as the heuristic.

| Density | Automations per Object | Batch Size | Downstream DML Ops | Recommended |
|---|---|---|---|---|
| **Low** | < 15 | 1–200 records | 0–1 | Record-Triggered Flow |
| **Medium** | 15–30 | Moderate batch | 2–4 | Hybrid: Flow + Invocable Apex |
| **High** | > 30 | 2,000–10,000+ | 5+ | Apex Trigger Framework |

### Use Flow When

- Simple to moderate field updates, notifications, record creation
- Scheduled processing relative to a date field (unique Flow strength)
- Email alerts on record changes
- Admin-maintainable logic without developer dependency

### Use Apex When

- Large data volumes or high-performance bulk processing
- Complex data structures (Maps, Sets, nested collections)
- Transaction control (savepoints, partial-success DML via `Database.update(records, false)`)
- After-undelete context (not supported in Flow)
- Recursive or self-referencing logic

### Hybrid Pattern (Invocable Apex)

- Flow handles entry criteria, routing, and orchestration
- `@InvocableMethod` Apex handles compute-heavy operations
- Invocable Apex only available in **after-save** context (not before-save)
- Maintains visibility in Flow Trigger Explorer

## Key Principles

1. **One automation entry point per object** — avoid mixing Flow triggers and Apex triggers on the same object.
2. **Before-save for same-record changes** — avoids extra DML, most performant path.
3. **Avoid mega-flows** — split into focused, well-conditioned flows rather than one monolith.
4. **Cascading automation shares limits** — Apex calling Flow (or vice versa) shares the same transaction governor limits.
