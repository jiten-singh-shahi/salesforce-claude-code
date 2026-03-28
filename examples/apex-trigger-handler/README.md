# Apex Trigger Handler Pattern

Enterprise-grade trigger handler pattern with one trigger per object.

## Structure

```text
force-app/main/default/
  classes/
    TriggerHandler.cls           # Base handler class
    AccountTriggerHandler.cls    # Account-specific handler
    AccountTriggerHandler_Test.cls
  triggers/
    AccountTrigger.trigger       # Thin trigger — delegates to handler
```

## Base Handler

```apex
public virtual class TriggerHandler {

    @TestVisible private Boolean isTriggerExecuting;
    @TestVisible private Integer batchSize;

    public TriggerHandler() {
        this.isTriggerExecuting = Trigger.isExecuting;
        this.batchSize = Trigger.size;
    }

    public void run() {
        if (!validateRun()) return;

        switch on Trigger.operationType {
            when BEFORE_INSERT  { beforeInsert(Trigger.new); }
            when BEFORE_UPDATE  { beforeUpdate(Trigger.new, Trigger.oldMap); }
            when BEFORE_DELETE  { beforeDelete(Trigger.old, Trigger.oldMap); }
            when AFTER_INSERT   { afterInsert(Trigger.new, Trigger.newMap); }
            when AFTER_UPDATE   { afterUpdate(Trigger.new, Trigger.oldMap, Trigger.newMap); }
            when AFTER_DELETE   { afterDelete(Trigger.old, Trigger.oldMap); }
            when AFTER_UNDELETE { afterUndelete(Trigger.new, Trigger.newMap); }
        }
    }

    @TestVisible
    protected virtual Boolean validateRun() {
        if (!this.isTriggerExecuting) {
            throw new TriggerHandlerException('Trigger handler called outside of trigger execution');
        }
        return true;
    }

    // Override these in subclasses
    protected virtual void beforeInsert(List<SObject> newRecords) {}
    protected virtual void beforeUpdate(List<SObject> newRecords, Map<Id, SObject> oldMap) {}
    protected virtual void beforeDelete(List<SObject> oldRecords, Map<Id, SObject> oldMap) {}
    protected virtual void afterInsert(List<SObject> newRecords, Map<Id, SObject> newMap) {}
    protected virtual void afterUpdate(List<SObject> newRecords, Map<Id, SObject> oldMap, Map<Id, SObject> newMap) {}
    protected virtual void afterDelete(List<SObject> oldRecords, Map<Id, SObject> oldMap) {}
    protected virtual void afterUndelete(List<SObject> newRecords, Map<Id, SObject> newMap) {}

    public class TriggerHandlerException extends Exception {}
}
```

## Trigger (Thin)

```apex
trigger AccountTrigger on Account (
    before insert, before update, before delete,
    after insert, after update, after delete, after undelete
) {
    new AccountTriggerHandler().run();
}
```

## Handler Implementation

```apex
public class AccountTriggerHandler extends TriggerHandler {

    protected override void beforeInsert(List<SObject> newRecords) {
        List<Account> accounts = (List<Account>) newRecords;
        for (Account acc : accounts) {
            if (String.isBlank(acc.Industry)) {
                acc.Industry = 'Other';
            }
        }
    }

    protected override void afterUpdate(List<SObject> newRecords, Map<Id, SObject> oldMap, Map<Id, SObject> newMap) {
        List<Account> accounts = (List<Account>) newRecords;
        List<Account> changedAccounts = new List<Account>();

        for (Account acc : accounts) {
            Account oldAcc = (Account) oldMap.get(acc.Id);
            if (acc.OwnerId != oldAcc.OwnerId) {
                changedAccounts.add(acc);
            }
        }

        if (!changedAccounts.isEmpty()) {
            AccountService.handleOwnerChanges(changedAccounts);
        }
    }
}
```

## Key Principles

- One trigger per object
- Trigger delegates to handler — no logic in the trigger itself
- Handler methods receive proper context (newRecords, oldMap, etc.)
- All operations are bulkified (iterate over collections)
- Business logic extracted to Service classes
