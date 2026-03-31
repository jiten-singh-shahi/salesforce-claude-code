---
name: sf-soql-optimization
description: >-
  SOQL optimization — selective queries, index strategy, query plans, relationship efficiency, large data volumes. Use when queries hit limits or designing for 100K+ records. Do NOT use for general Apex, LWC, or Flow.
---

# SOQL Optimization

Poorly written SOQL is the most common cause of governor limit exceptions and slow page loads in Salesforce. This skill covers optimization procedures, query plan analysis, and index strategy.

@../_reference/SOQL_PATTERNS.md
@../_reference/GOVERNOR_LIMITS.md

## When to Use

- SOQL queries hitting governor limits (100-query limit, CPU time, or heap size)
- Investigating slow page loads, timeout errors, or CPU violations in Apex code
- Adding new SOQL queries to triggers, batch jobs, or service classes
- Auditing code for SOQL-in-loops anti-patterns during code review
- Designing queries for large data sets (100K+ records) requiring selective filters
- Troubleshooting `System.LimitException: Too many SOQL queries` errors

## Selectivity Fundamentals

The query optimizer decides whether to use an index or perform a full table scan based on **selectivity** — the percentage of records a query expects to return. See @../_reference/SOQL_PATTERNS.md for threshold tables.

```apex
// Potentially NOT selective — if more than 10% of Contacts have Status = 'Active'
List<Contact> contacts = [SELECT Id FROM Contact WHERE Status__c = 'Active'];

// Selective — CreatedDate is indexed, LAST_N_DAYS:30 likely returns < 10%
List<Contact> recentContacts = [
    SELECT Id FROM Contact
    WHERE CreatedDate = LAST_N_DAYS:30
];
```

> Use the Query Plan Tool in Developer Console to verify actual query plans. These thresholds are guidelines; the optimizer considers data distribution, available indexes, and org-specific factors.

---

## SOQL in Loops — The Fix

Every iteration of a loop containing a SOQL query multiplies the query count toward the 100/200 limit.

### The Fix — Query Once, Store in Map

```apex
// Collect all IDs first
List<Account> accounts = [SELECT Id, OwnerId FROM Account WHERE Type = 'Customer'];

Set<Id> ownerIds = new Set<Id>();
for (Account acc : accounts) {
    ownerIds.add(acc.OwnerId);
}

// Single query for all related records
Map<Id, User> ownerMap = new Map<Id, User>(
    [SELECT Id, Name, Email FROM User WHERE Id IN :ownerIds]
);

// Now iterate — zero SOQL queries in this loop
for (Account acc : accounts) {
    User owner = ownerMap.get(acc.OwnerId);
    if (owner != null) {
        sendWelcomeEmail(acc, owner);
    }
}
```

### Trigger Context Pattern

```apex
trigger OpportunityTrigger on Opportunity (after update) {
    Set<Id> oppIds = Trigger.newMap.keySet();

    Map<Id, List<OpportunityLineItem>> itemsByOppId = new Map<Id, List<OpportunityLineItem>>();
    for (OpportunityLineItem item : [
        SELECT Id, OpportunityId, Quantity, UnitPrice
        FROM OpportunityLineItem
        WHERE OpportunityId IN :oppIds
    ]) {
        if (!itemsByOppId.containsKey(item.OpportunityId)) {
            itemsByOppId.put(item.OpportunityId, new List<OpportunityLineItem>());
        }
        itemsByOppId.get(item.OpportunityId).add(item);
    }

    for (Opportunity opp : Trigger.new) {
        List<OpportunityLineItem> items = itemsByOppId.get(opp.Id);
        if (items == null) items = new List<OpportunityLineItem>();
        // Process items...
    }
}
```

---

## Query Optimization Checklist

### Use Indexed Fields in WHERE Clause

```apex
// Filter on RecordTypeId (indexed) rather than custom non-indexed fields
[SELECT Id FROM Account WHERE RecordTypeId = :RETAIL_RECORD_TYPE_ID]

// Combine indexed + non-indexed for compound selectivity
[SELECT Id FROM Account
 WHERE Type = 'Customer'
   AND Custom_Category__c = 'Retail']
```

### Select Only Fields You Need

```apex
// Select only what the calling code actually uses
List<Account> accounts = [SELECT Id, Name FROM Account WHERE Id IN :accountIds];
```

### Use LIMIT When Possible

```apex
Account acc = [SELECT Id, Name FROM Account WHERE Name = 'Acme' LIMIT 1];

List<Account> recentAccounts = [
    SELECT Id, Name, CreatedDate
    FROM Account
    ORDER BY CreatedDate DESC
    LIMIT 50
];
```

### Avoid LIKE with % Prefix

```apex
// Trailing wildcard CAN use the index
[SELECT Id FROM Account WHERE Name LIKE 'Acme%']

// For full-text search — use SOSL instead
List<List<SObject>> results = [FIND 'Corp' IN NAME FIELDS RETURNING Account(Id, Name)];
```

### Use Bind Variables

```apex
// Bind variables are safe and performant
List<Account> accounts = [SELECT Id FROM Account WHERE Name = :accountName];

// For dynamic SOQL — use Database.queryWithBinds
Map<String, Object> bindVars = new Map<String, Object>{
    'accountName' => accountName,
    'minRevenue'  => minimumRevenue
};
String safeQuery = 'SELECT Id, Name FROM Account WHERE Name = :accountName AND AnnualRevenue >= :minRevenue';
List<Account> accounts2 = Database.queryWithBinds(safeQuery, bindVars, AccessLevel.USER_MODE);
```

---

## Relationship Queries

### Parent-to-Child (Subquery)

```apex
List<Account> accounts = [
    SELECT Id, Name,
           (SELECT Id, FirstName, LastName, Email
            FROM Contacts
            WHERE Email != null
            ORDER BY LastName)
    FROM Account
    WHERE Type = 'Customer'
    WITH USER_MODE
];
```

**Limits:** Max 1 level of subquery depth. Child subqueries do NOT count as separate SOQL queries. Max 20 subqueries per query.

### Child-to-Parent (Dot Notation)

```apex
List<Contact> contacts = [
    SELECT Id, FirstName, LastName,
           Account.Name,
           Account.Owner.Name,
           Account.Owner.Email
    FROM Contact
    WHERE AccountId != null
    WITH USER_MODE
];
```

**Limits:** Max 5 levels of parent traversal. Max 35 relationship traversals total per query.

---

## Aggregate Queries

```apex
// Use COUNT() instead of loading records to count
Integer customerCount = [SELECT COUNT() FROM Account WHERE Type = 'Customer'];

// AggregateResult for grouped/summed data
List<AggregateResult> results = [
    SELECT Type, COUNT(Id) recordCount, SUM(AnnualRevenue) totalRevenue
    FROM Account
    WHERE Type != null
    GROUP BY Type
    HAVING COUNT(Id) > 5
    ORDER BY COUNT(Id) DESC
];
```

---

## Dynamic SOQL — Safe Pattern

```apex
public List<SObject> buildDynamicQuery(
    String objectName, List<String> fields,
    String whereClause, Integer maxRecords
) {
    Schema.DescribeSObjectResult describe =
        Schema.getGlobalDescribe().get(objectName)?.getDescribe();
    if (describe == null) {
        throw new InvalidQueryException('Unknown object: ' + objectName);
    }

    Map<String, Schema.SObjectField> fieldMap = describe.fields.getMap();
    List<String> validatedFields = new List<String>();
    for (String field : fields) {
        if (fieldMap.containsKey(field.toLowerCase())) {
            validatedFields.add(field);
        }
    }
    if (validatedFields.isEmpty()) validatedFields.add('Id');

    String soql = 'SELECT ' + String.join(validatedFields, ', ') +
                  ' FROM ' + objectName;
    if (String.isNotBlank(whereClause)) {
        soql += ' WHERE ' + whereClause;
    }
    soql += ' LIMIT ' + Math.min(maxRecords, 2000);

    return Database.queryWithBinds(soql, new Map<String, Object>(), AccessLevel.USER_MODE);
}
```

---

## Large Data Volume Patterns

### Custom Indexes

For heavily-queried fields not indexed by default, request a custom index from Salesforce Support. Provide object name, field API name, and typical query pattern.

### Skinny Tables

For objects with >10 million records, Salesforce Support can create a skinny table — a narrow copy with only the most-queried fields.

### Batch Apex for LDV Processing

```apex
public class LargeDataProcessingBatch implements Database.Batchable<SObject> {
    public Database.QueryLocator start(Database.BatchableContext bc) {
        return Database.getQueryLocator([
            SELECT Id, Status__c FROM Account
            WHERE CreatedDate < :Date.today().addYears(-5)
              AND Status__c = 'Active'
        ]);
    }
    public void execute(Database.BatchableContext bc, List<Account> scope) { /* ... */ }
    public void finish(Database.BatchableContext bc) {}
}
```

### SOSL for Full-Text Search

```apex
String searchTerm = 'Acme Holdings';
List<List<SObject>> searchResults = [
    FIND :searchTerm
    IN ALL FIELDS
    RETURNING
        Account(Id, Name, Type WHERE Type = 'Customer'),
        Contact(Id, FirstName, LastName, AccountId)
    LIMIT 50
];
```

---

## Modern SOQL Features

### TYPEOF for Polymorphic Lookups

```apex
List<Task> tasks = [
    SELECT Id, Subject,
        TYPEOF What
            WHEN Account THEN Name, Phone
            WHEN Opportunity THEN Amount, StageName
        END
    FROM Task
    WHERE OwnerId = :userId
    WITH USER_MODE
];
```

Use when querying objects with polymorphic lookups (Task.WhoId, Task.WhatId, Event.WhoId, Event.WhatId) to avoid multiple queries or instanceof checks.

### Semi-Join and Anti-Join Subqueries

```soql
-- Semi-join: accounts that have contacts with emails
SELECT Id, Name FROM Account
WHERE Id IN (SELECT AccountId FROM Contact WHERE Email != null)

-- Anti-join: accounts with no closed opportunities
SELECT Id, Name FROM Account
WHERE Id NOT IN (SELECT AccountId FROM Opportunity WHERE IsClosed = true)
```

Inner subquery can only return one field. Max one level of nesting. More efficient than querying both objects and filtering in Apex.

---

## Query Plan Tool

Use the Developer Console Query Plan to understand query execution before deploying.

1. Open Developer Console > Query Editor
2. Enable Query Plan: Help menu > Preferences > Enable Query Plan
3. Write query and click "Query Plan" instead of "Execute"

| Result | Meaning |
|---|---|
| `TableScan` | Full table scan — potentially slow on large objects |
| `Index` | Index used — fast and selective |
| `Cost` | Estimated relative cost — lower is better |

If you see `TableScan` on a large object:
1. Add a more selective condition using an indexed field
2. Request a custom index from Salesforce Support
3. Restructure the query to use SOSL

---

## Related

- **Agent**: `sf-soql-optimizer` — For interactive, in-depth guidance
- **Constraints**: `sf-soql-constraints` — Hard rules for SOQL safety and compliance
