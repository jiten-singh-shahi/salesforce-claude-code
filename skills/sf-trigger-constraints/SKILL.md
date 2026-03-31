---
name: sf-trigger-constraints
description: "Enforce one-trigger-per-object, handler delegation, bulkification, and recursion prevention. Use when writing or reviewing ANY Apex trigger or handler. Do NOT use for non-trigger Apex, LWC, or Flow."
origin: SCC
user-invocable: false
allowed-tools: Read, Grep, Glob
---

# Trigger Constraints

## When to Use

This skill auto-activates when writing, reviewing, or modifying any Apex trigger or trigger handler. It enforces one-trigger-per-object, handler delegation, bulkification, and recursion prevention rules for all trigger artifacts.

Hard rules that every Apex trigger and trigger handler must satisfy. Violations are blockers -- flag them before any other review feedback.

Reference: @../_reference/TRIGGER_PATTERNS.md (order of execution, context variables, framework comparison).

---

## Never Rules

These are absolute prohibitions. Any occurrence is a defect.

| ID | Rule | Why |
|----|------|-----|
| N1 | **No logic in the trigger body** | Trigger files contain only the handler invocation (`new Handler().run()` or `fflib_SObjectDomain.triggerHandler(Domain.class)`). Zero conditionals, zero loops, zero DML. |
| N2 | **No multiple triggers per object** | Multiple triggers on the same sObject have no guaranteed execution order (see @../_reference/TRIGGER_PATTERNS.md, Step 5/9). Consolidate into one trigger file per object. |
| N3 | **No DML inside loops** | `insert`/`update`/`delete`/`upsert`/`Database.*` calls inside `for` loops hit governor limits. Collect records first, DML once outside the loop. |
| N4 | **No SOQL inside loops** | Queries inside `for` loops risk the per-transaction SOQL limit (see @../_reference/GOVERNOR_LIMITS.md). Query before the loop, store results in a `Map<Id, SObject>`. |
| N5 | **No hardcoded IDs** | Record IDs, profile IDs, or record-type IDs must never appear as string literals. Use `Schema.SObjectType.*.getRecordTypeInfosByDeveloperName()`, Custom Metadata, or Custom Labels. |
| N6 | **No direct callouts** | Apex triggers cannot make HTTP callouts synchronously. Use `@future(callout=true)` or `Queueable` with `Database.AllowsCallouts`. |
| N7 | **No `Trigger.new` modification in after triggers** | `Trigger.new` is read-only in after contexts. Field updates in after triggers must go through a separate DML statement on queried/cloned records. |

---

## Always Rules

Every trigger implementation must include these elements.

| ID | Rule | How |
|----|------|-----|
| A1 | **Delegate to a handler class** | Trigger body calls handler: `new AccountTriggerHandler().run();`. All logic lives in the handler or in service classes the handler calls. |
| A2 | **Bulkify all logic** | Every method must handle `List<SObject>` (up to 200 records per chunk). No assumption of single-record input. Iterate `Trigger.new` / `Trigger.old`, never index `[0]` alone. |
| A3 | **Use a recursion guard** | Prevent infinite re-entry. Recommended: static `Set<Id>` of processed IDs (allows workflow re-fire for unprocessed records while blocking true recursion). Alternatives: depth counter in base class, `setMaxLoopCount()`. See @../_reference/TRIGGER_PATTERNS.md recursion patterns. |
| A4 | **Use `Trigger.newMap` / `Trigger.oldMap` for comparisons** | When detecting field changes in update triggers, compare `Trigger.newMap.get(id).Field__c` against `Trigger.oldMap.get(id).Field__c`. Never rely on list index alignment. |
| A5 | **Register all events in one trigger** | The single trigger file should subscribe to all seven events (`before insert, before update, before delete, after insert, after update, after delete, after undelete`) even if the handler only overrides a subset today. This prevents needing a trigger file redeploy when new events are handled later. |
| A6 | **Include a bypass mechanism** | Support disabling the handler without a code deploy. Use `TriggerHandler.bypass()` / `.clearBypass()`, Custom Metadata (`Trigger_Setting__mdt`), or Hierarchy Custom Settings. Always reset bypass state in a `finally` block. |
| A7 | **Keep handler methods focused** | Each `onBeforeInsert()`, `onAfterUpdate()`, etc. should call named service methods. If a handler method exceeds ~30 lines, extract to a service class. |

---

## Anti-Pattern Table

| Anti-Pattern | Example | Correct Alternative |
|---|---|---|
| Logic in trigger body | `trigger T on Account (before insert) { for (Account a : Trigger.new) { a.Name = 'X'; } }` | `trigger T on Account (...) { new AccountTriggerHandler().run(); }` with logic in handler |
| Two triggers on same object | `AccountTrigger.trigger` + `AccountOwnerTrigger.trigger` | Single `AccountTrigger.trigger` delegating to one handler |
| DML in loop | `for (Account a : accts) { update a; }` | `update accts;` outside loop |
| SOQL in loop | `for (Account a : accts) { Contact c = [SELECT ...]; }` | `Map<Id, Contact> cMap = new Map<Id, Contact>([SELECT ...]); // before loop` |
| Hardcoded ID | `if (acc.RecordTypeId == '012000000000001')` | `Schema.SObjectType.Account.getRecordTypeInfosByDeveloperName().get('Customer').getRecordTypeId()` |
| No recursion guard | After-update handler updates same records with no static check | `private static Set<Id> processedIds = new Set<Id>();` -- skip IDs already in set |
| Boolean recursion flag | `static Boolean hasRun = false; if (hasRun) return;` | `Set<Id>` -- boolean flag blocks legitimate workflow re-fire for unprocessed records |
| Modifying `Trigger.new` in after context | `for (Account a : Trigger.new) { a.Status__c = 'Done'; }` in `onAfterInsert` | Query records, update separately: `update [SELECT Id FROM Account WHERE Id IN :newMap.keySet()]` |

---

## Quick Checklist

Use when writing or reviewing a trigger PR:

- [ ] Exactly one `.trigger` file per sObject
- [ ] Trigger body is a single handler call (no logic)
- [ ] Handler extends `TriggerHandler` (or FFLIB `fflib_SObjectDomain`)
- [ ] All seven events registered in trigger definition
- [ ] Every loop processes `List<SObject>`, not a single record
- [ ] Zero SOQL or DML inside any loop
- [ ] No hardcoded IDs anywhere
- [ ] Recursion guard present (prefer `Set<Id>` pattern)
- [ ] Bypass mechanism available
- [ ] No `Trigger.new` mutation in after-trigger methods
- [ ] No synchronous callouts

---

## Related

- **Skill**: `sf-trigger-frameworks` -- Framework patterns, base class code, migration guide
- **Reference**: @../_reference/TRIGGER_PATTERNS.md -- Order of execution, context variables, framework comparison
- **Agent**: `sf-trigger-architect` -- Interactive trigger design guidance
