# Trigger Patterns -- Reference

> Source: <https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_triggers.htm>
> Source: <https://github.com/kevinohara80/sfdc-trigger-framework>
> Source: <https://github.com/apex-enterprise-patterns/fflib-apex-common>
> Last verified: API v66.0, Spring '26 (2026-03-28)

## Order of Execution (Record Save)

| Step | Phase |
|------|-------|
| 1 | Load original record from DB (or init new) |
| 2 | Overwrite field values from request |
| 3 | System validation (layout rules, field types, max length) |
| 4 | Before-save record-triggered flows |
| 5 | **Before triggers** execute |
| 6 | Custom validation rules |
| 7 | Duplicate rules |
| 8 | Record saved to DB (not committed) |
| 9 | **After triggers** execute |
| 10 | Assignment rules |
| 11 | Auto-response rules |
| 12 | Workflow rules evaluate; field updates execute |
| 13 | If workflow field update fired: re-runs before/after update triggers **once more** (custom validation skipped) |
| 14 | Escalation rules |
| 15 | After-save record-triggered flows |
| 16 | Entitlement rules |
| 17 | Roll-up summary fields on parent; parent goes through own save cycle |
| 18 | Criteria-based sharing recalculated |
| 19 | DML committed; post-commit logic (async jobs, emails, platform events) |

Multiple triggers on the same object + event have **no guaranteed execution order**.

## Trigger Context Variables

| Variable | Type | Available |
|----------|------|-----------|
| `Trigger.isExecuting` | `Boolean` | All contexts |
| `Trigger.isBefore` | `Boolean` | All contexts |
| `Trigger.isAfter` | `Boolean` | All contexts |
| `Trigger.isInsert` | `Boolean` | All contexts |
| `Trigger.isUpdate` | `Boolean` | All contexts |
| `Trigger.isDelete` | `Boolean` | All contexts |
| `Trigger.isUndelete` | `Boolean` | All contexts |
| `Trigger.new` | `List<sObject>` | insert, update, undelete |
| `Trigger.old` | `List<sObject>` | update, delete |
| `Trigger.newMap` | `Map<Id, sObject>` | after insert, before/after update, after undelete |
| `Trigger.oldMap` | `Map<Id, sObject>` | update, delete |
| `Trigger.operationType` | `System.TriggerOperation` | All contexts |
| `Trigger.size` | `Integer` | All contexts |

`Trigger.new` is mutable only in **before** triggers. `Trigger.old` is always read-only.

## Framework Comparison

| Aspect | Kevin O'Hara TriggerHandler | FFLIB Domain Layer (fflib_SObjectDomain) |
|--------|----------------------------|------------------------------------------|
| **Complexity** | Low -- single base class | High -- domain + selector + UoW |
| **Trigger body** | `new Handler().run();` | `fflib_SObjectDomain.triggerHandler(Domain.class);` |
| **Handler methods** | `beforeInsert()`, `afterInsert()`, `beforeUpdate()`, `afterUpdate()`, `beforeDelete()`, `afterDelete()`, `afterUndelete()` | `onBeforeInsert()`, `onAfterInsert()`, `onBeforeUpdate()`, `onAfterUpdate()`, `onBeforeDelete()`, `onAfterDelete()`, `onAfterUndelete()`, plus `onApplyDefaults()`, `onValidate()` |
| **Bypass** | `TriggerHandler.bypass('HandlerName')` / `.clearBypass()` / `.clearAllBypasses()` | `fflib_SObjectDomain.getTriggerEvent(Type).disableAll()` |
| **Recursion guard** | `setMaxLoopCount(n)` -- throws exception on exceed | Manual via static flags or `fflib_SObjectDomain` configuration |
| **Testability** | Standard Apex DML | Supports DI/mocking via Application factory |
| **Best for** | Small-to-medium orgs, straightforward logic | Enterprise orgs, complex multi-object transactions |

## One-Trigger-Per-Object Pattern

Every sObject gets exactly **one** trigger that delegates to a handler class.

```apex
trigger AccountTrigger on Account (
    before insert, before update, before delete,
    after insert, after update, after delete, after undelete
) {
    new AccountTriggerHandler().run();
}
```

## Recursion Prevention Patterns

| Pattern | Mechanism | Trade-off |
|---------|-----------|-----------|
| Static `Boolean` flag | `if (hasRun) return; hasRun = true;` | Blocks all re-entry including legitimate workflow re-fire |
| Static `Set<Id>` processed | Skip IDs already in set | Allows first pass per record; handles partial batches correctly |
| `setMaxLoopCount(n)` | TriggerHandler throws exception after n invocations | Configurable; exception must be handled or allowed to surface |
| Static counter | Increment on entry, check threshold | Flexible but manual |

Recommended: **`Set<Id>`-based** for most cases -- prevents true recursion while allowing workflow-triggered re-entry for records not yet processed.

## Bypass Mechanisms

```apex
// Kevin O'Hara pattern
TriggerHandler.bypass('AccountTriggerHandler');
update accounts;                                  // handler skipped
TriggerHandler.clearBypass('AccountTriggerHandler');

// Custom Metadata bypass (org-configurable, no deploy)
Trigger_Setting__mdt setting = Trigger_Setting__mdt.getInstance('Account');
if (setting != null && setting.Is_Active__c == false) return;

// Hierarchy Custom Setting bypass (per-user/profile)
Trigger_Config__c config = Trigger_Config__c.getInstance();
if (config != null && config.Disable_Account_Trigger__c) return;
```

## Key Rules

- Triggers fire on DML, not on formula/roll-up recalculation.
- Bulk triggers receive up to **200 records per batch** (`Trigger.size` max per chunk in Data Loader = 200).
- `addError()` on `Trigger.new` records prevents save (before triggers) or rolls back (after triggers).
- Callouts in triggers require `@future(callout=true)` or `Queueable` -- direct callouts are blocked.
- `before delete` and `after delete` do not fire on `merge` for the losing records (they get delete triggers).
- Undelete triggers: only `after undelete` exists; there is no `before undelete`.
