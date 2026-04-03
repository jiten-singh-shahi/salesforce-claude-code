# Data Migration Patterns — Salesforce Reference

> Last verified: API v66.0, Spring '26 (2026-03-28)
> Source: <https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_batch_interface.htm>
> Source: <https://developer.salesforce.com/docs/atlas.en-us.api_asynch.meta/api_asynch/bulk_api_2_0.htm>

## Migration Pattern Decision Matrix

| Volume | Complexity | Pattern | Agent |
|---|---|---|---|
| < 200 records | Simple field update | Anonymous Apex or Data Loader | sf-apex-agent |
| 200 - 10,000 | Field transformation, backfill | Batch Apex (scope 200) | sf-apex-agent |
| 10K - 500K | Multi-object, conditional logic | Batch Apex (scope 200, `Database.Stateful`) | sf-apex-agent |
| 500K - 50M | Large data volume, simple transform | Bulk API 2.0 via Data Loader or sf CLI | sf-admin-agent |
| 50M+ | Massive volume | Bulk API 2.0 + external ETL | sf-integration-agent |
| Any + external system sync | Data needs to sync to/from external | Queueable chain with callouts | sf-integration-agent |

## Batch Migration Template

```apex
public class MigrateEquipmentStatusBatch implements Database.Batchable<SObject>, Database.Stateful {
    private Integer successCount = 0;
    private Integer errorCount = 0;
    private List<String> errors = new List<String>();

    public Database.QueryLocator start(Database.BatchableContext bc) {
        return Database.getQueryLocator([
            SELECT Id, Legacy_Status__c, Status__c
            FROM Equipment__c
            WHERE Status__c = null AND Legacy_Status__c != null
        ]);
    }

    public void execute(Database.BatchableContext bc, List<Equipment__c> scope) {
        for (Equipment__c eq : scope) {
            eq.Status__c = mapLegacyStatus(eq.Legacy_Status__c);
        }
        List<Database.SaveResult> results = Database.update(scope, false);
        for (Integer i = 0; i < results.size(); i++) {
            if (results[i].isSuccess()) {
                successCount++;
            } else {
                errorCount++;
                errors.add(scope[i].Id + ': ' + results[i].getErrors()[0].getMessage());
            }
        }
    }

    public void finish(Database.BatchableContext bc) {
        // Log results, send notification
    }

    private String mapLegacyStatus(String legacy) {
        Map<String, String> statusMap = new Map<String, String>{
            'A' => 'Active', 'I' => 'Inactive', 'R' => 'Retired'
        };
        return statusMap.containsKey(legacy) ? statusMap.get(legacy) : 'Unknown';
    }
}
```

## Pre-Migration Checklist

| Check | Command / Action |
|---|---|
| Backup affected records | `sf data export bulk --query "SELECT Id, ... FROM Object__c" --output-file backup.csv` |
| Verify record count | `SELECT COUNT() FROM Object__c WHERE [migration criteria]` |
| Check for triggers/flows that will fire | Scan automation on affected objects — consider bypass |
| Verify field types match | Source field type compatible with target |
| Check governor limits | Scope size × operations per record < limits |
| Create rollback plan | Backup CSV + restore script |
| Test in sandbox first | Always run full migration in sandbox before production |

## Bypass Automation During Migration

Use Custom Metadata toggle to disable triggers/flows during bulk data operations:

```apex
// In trigger handler — check bypass before executing
Trigger_Setting__mdt setting = Trigger_Setting__mdt.getInstance('Equipment');
if (setting != null && !setting.Is_Active__c) {
    return; // Bypass during migration
}
```

## Validation After Migration

| Check | Query |
|---|---|
| Record count matches | `SELECT COUNT() FROM Object__c WHERE [migrated criteria]` |
| No null values in required fields | `SELECT COUNT() FROM Object__c WHERE Required_Field__c = null` |
| Mapped values are valid | `SELECT Status__c, COUNT(Id) FROM Object__c GROUP BY Status__c` |
| No orphaned records | `SELECT COUNT() FROM Child__c WHERE Parent__c = null` |
| Error count is acceptable | Check Batch job `NumberOfErrors` in AsyncApexJob |

## Rollback Strategies

| Scenario | Strategy |
|---|---|
| Field value update (reversible) | Restore from backup CSV via Data Loader upsert on Id |
| New records created (additive) | Delete via `DELETE FROM Object__c WHERE CreatedDate = TODAY AND CreatedById = [migration user]` |
| Field deleted (irreversible) | Cannot rollback — this is why backups are mandatory |
| Relationship changes | Restore original lookup values from backup |

## Governor Limit Considerations

| Concern | Mitigation |
|---|---|
| 50M records max per QueryLocator | Use `Database.getQueryLocator` (not `Iterable`) |
| 200 scope size default | Keep at 200 unless callouts needed (then reduce) |
| Triggers fire on DML | Bypass via Custom Metadata toggle |
| Sharing recalculation | Schedule during off-hours for objects with complex sharing |
| 10,000 DML rows per transaction | Scope 200 × 1 DML = 200 rows (safe) |
| CPU time 60,000ms (async) | Keep transformation logic simple per record |

## Testing Migrations

```apex
@IsTest
static void testMigrateEquipmentStatus_bulk200() {
    List<Equipment__c> records = new List<Equipment__c>();
    for (Integer i = 0; i < 200; i++) {
        records.add(new Equipment__c(
            Legacy_Status__c = 'A',
            Account__c = testAccount.Id
        ));
    }
    insert records;

    Test.startTest();
    Database.executeBatch(new MigrateEquipmentStatusBatch(), 200);
    Test.stopTest();

    List<Equipment__c> migrated = [
        SELECT Status__c FROM Equipment__c WHERE Id IN :records
    ];
    for (Equipment__c eq : migrated) {
        Assert.areEqual('Active', eq.Status__c, 'Legacy status A should map to Active');
    }
}
```

## Key Principles

1. **Always backup before migrating** — no exceptions
2. **Always test in sandbox first** — with production-like data volume
3. **Use partial success DML** — `Database.update(scope, false)` to not fail entire batch on one bad record
4. **Log errors per record** — use `Database.Stateful` to accumulate errors across batches
5. **Bypass automation** — disable triggers/flows via Custom Metadata during bulk operations
6. **Validate after migration** — count records, check field values, verify relationships
7. **Schedule during off-hours** — sharing recalculation on large objects is expensive
