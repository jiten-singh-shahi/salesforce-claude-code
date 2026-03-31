---
name: sf-data-modeling
description: >-
  Use when designing Salesforce custom objects, relationships, Custom Metadata, or sharing models for scalable org architecture. Do NOT use for SOQL optimization or Apex patterns.
---

# Salesforce Data Modeling

@../_reference/DATA_MODELING.md

## When to Use

- Designing new custom objects, fields, or relationships
- Deciding between lookup vs master-detail relationships
- Planning record types, page layouts, or sharing model architecture
- Architecting for large data volumes (LDV) requiring index-aware field design
- Reviewing or refactoring an existing data model
- Evaluating external objects, custom metadata types, or hierarchical settings

## Object Design Principles

### Extend Standard Objects When Possible

| Business Need | Use Standard Object | Not Custom |
|---|---|---|
| Customer companies | Account | Company__c |
| Individual contacts | Contact | Person__c |
| Sales deals | Opportunity | Deal__c |
| Support tickets | Case | Ticket__c |
| Events/meetings | Event | Meeting__c |
| Tasks/to-dos | Task | Todo__c |
| Products/pricing | Product2, PricebookEntry | Product__c |
| Orders | Order, OrderItem | PurchaseOrder__c |

Standard objects come with built-in reports, process automations, and integrations.

### Custom Object Naming

```
API Name:    ProjectTask__c           (PascalCase + __c)
Label:       Project Task             (human-readable)
Plural:      Project Tasks
Relationship Name: ProjectTasks       (plural for child relationship)
```

---

## Relationship Types

| Relationship | Cascade Delete | Roll-Up Summary | Required | Sharing Inherited |
|---|---|---|---|---|
| Lookup | No (configurable) | No | No | No |
| Master-Detail | Yes | Yes | Yes | Yes |
| Many-to-Many (Junction) | Both sides | From junction | Both | From primary master |
| Hierarchical | No | No | No | No |
| External Lookup | No | No | No | No |

*Master-Detail can be reparented if "Allow Reparenting" is enabled.

### When to Use Lookup

- Child can exist independently (Contact without Account)
- No roll-up summaries needed
- Child needs its own sharing settings
- Multiple lookups, none is primary

### When to Use Master-Detail

- Child has no meaning without parent (Order Line Item without Order)
- Roll-up summary fields needed on parent
- Child deleted when parent deleted
- Child sharing inherits from parent

```xml
<!-- Master-Detail field metadata -->
<fields>
    <fullName>Project__c</fullName>
    <label>Project</label>
    <type>MasterDetail</type>
    <referenceTo>Project__c</referenceTo>
    <relationshipLabel>Project Tasks</relationshipLabel>
    <relationshipName>ProjectTasks</relationshipName>
    <relationshipOrder>0</relationshipOrder>
    <reparentableMasterDetail>false</reparentableMasterDetail>
</fields>
```

---

## Field Type Guide

| Field Type | Use When | Avoid When |
|---|---|---|
| Text (255) | Short single-line text | Long descriptions |
| Long Text Area | Up to 131,072 chars | Need to filter/search on it |
| Rich Text Area | HTML-formatted content | Need to query/filter by content |
| Number | Integers, no currency | Financial values (use Currency) |
| Currency | Monetary values | Non-financial numbers |
| Date | Date without time | Need time zone info |
| DateTime | Timestamps, audit trails | Simple date records |
| Checkbox | Boolean yes/no | Optional boolean (use Picklist) |
| Picklist (single) | Controlled vocabulary | Many values (use Lookup) |
| Picklist (multi) | Multiple selections | Filtering/reporting (anti-pattern) |
| Formula | Calculated, read-only | Values needing DML update |
| Roll-Up Summary | Aggregate child data | 25 per object (default limit) |
| External ID | Upsert key from external system | - |

### Multi-Select Picklist Warning

```apex
// Limited SOQL support — can use INCLUDES/EXCLUDES but not = or IN
List<Case> cases = [
    SELECT Id FROM Case
    WHERE Tag_List__c INCLUDES ('Billing', 'Technical')
];
// Cannot use in GROUP BY, ORDER BY, or most aggregates
// Consider Lookup to a Tags junction object for complex tagging
```

---

## Custom Metadata Types vs Custom Settings vs Custom Labels

| Feature | Custom Metadata | Custom Settings | Custom Labels |
|---|---|---|---|
| Deployable | Yes | No (hierarchy)/Yes (list) | Yes |
| Per-user/profile values | No | Yes (hierarchy) | No |
| Governor limit on reads | No (cached) | Yes (SOQL equivalent) | No |
| Best for | Config deployed with code | User/profile-specific settings | Translatable strings |

```apex
// Custom Metadata — no SOQL limits, deployable
String endpoint = Service_Config__mdt.getInstance('Production').Endpoint_URL__c;

// Custom Setting — profile-specific
Boolean isEnabled = Integration_Settings__c.getInstance().Is_Enabled__c;

// Custom Label — translatable
String welcomeMsg = System.Label.Welcome_Message;
```

---

## Record Types

### When to Use

- Different page layouts per user group
- Different picklist values per business process
- Different automation processes per record type

### When NOT to Use

- Simple field-level differences (use conditional visibility)
- Access control (use sharing rules or permission sets)
- Fundamentally different data structures (use separate objects)

```apex
Id caseRecordTypeId = Schema.SObjectType.Case.getRecordTypeInfosByDeveloperName()
    .get('Internal_Support').getRecordTypeId();

List<Case> internalCases = [
    SELECT Id, Subject FROM Case
    WHERE RecordTypeId = :caseRecordTypeId WITH USER_MODE
];
```

---

## Sharing Model Design

### Object-Wide Defaults (OWD)

| OWD Setting | Other Users | Best For |
|---|---|---|
| Public Read/Write | Read + Write | Reference/config data |
| Public Read Only | Read only | Products, pricebooks |
| Private | None | Accounts, Opportunities |
| Controlled by Parent | Inherits | Master-Detail children |

Start with Private OWD for sensitive objects and open up with sharing rules.

### Apex Managed Sharing

```apex
public with sharing class ProjectSharingService {
    public static void shareProjectWithUser(Id projectId, Id userId, String accessLevel) {
        Project__Share shareRecord = new Project__Share(
            ParentId = projectId,
            UserOrGroupId = userId,
            AccessLevel = accessLevel,
            RowCause = Schema.Project__Share.RowCause.Manual
        );
        Database.SaveResult result = Database.insert(shareRecord, false);
        if (!result.isSuccess() &&
            result.getErrors()[0].getStatusCode() != StatusCode.FIELD_FILTER_VALIDATION_EXCEPTION) {
            throw new SharingException('Failed to share: ' + result.getErrors()[0].getMessage());
        }
    }
    public class SharingException extends Exception {}
}
```

---

## Large Data Volume (LDV) Considerations

Objects with >100,000 records require special attention.

**Schema design:**
- Add external ID fields on objects queried by non-Id values
- Request custom indexes on fields used in WHERE clauses
- Consider skinny tables for frequently-accessed field subsets
- Avoid Roll-Up Summary fields on LDV child objects (use batch triggers instead)

```apex
// Good — uses indexed fields, selective
List<Order__c> orders = [
    SELECT Id, Status__c FROM Order__c
    WHERE AccountId = :accountId
      AND CreatedDate >= :thirtyDaysAgo
    LIMIT 200
];
```

**Archiving:** Move old records to BigObjects or external archive. Use batch jobs for archive-and-delete.

---

## Junction Object Patterns

```
Account <-- AccountContactRelation --> Contact
             + Role (picklist)
             + IsPrimary (checkbox)
             + StartDate (date)
```

- Junction objects with Master-Detail on both sides inherit sharing from BOTH parents
- Add meaningful fields to the junction (Role, Start Date, Status)
- Use `AccountContactRelation` (standard) before creating custom junctions for Account-Contact

---

## External Object Patterns

| Adapter | Use When |
|---|---|
| OData 2.0/4.0 | External REST API with OData support |
| Custom Adapter | Proprietary API or database |
| Cross-Org | Another Salesforce org |

External Objects have no triggers, Flows, or Validation Rules. Use Apex callouts for write operations.

---

## Anti-Patterns

| Anti-Pattern | Fix |
|---|---|
| Polymorphic lookup abuse | Use explicit lookup fields per related object |
| Over-normalization | Flatten into fields unless multiple addresses per record |
| Too many custom fields (800 limit) | Split into related child objects |
| Circular Master-Detail | Break the circle with a Lookup on one side |
| Text instead of Lookup | Use Lookup fields for referential integrity |
| Ignoring LDV on 100K+ objects | Request custom indexes, use skinny tables |

---

## Related

- **Agent**: `sf-data-architect` — For interactive, in-depth guidance
- **Constraints**: `sf-apex-constraints` — Governor limits and Apex safety rules
