<!-- Source: https://developer.salesforce.com/docs/atlas.en-us.object_reference.meta/object_reference/sforce_api_objects_custom_objects.htm -->
<!-- Last verified: API v66.0 — 2026-03-29 -->

# Data Modeling — Salesforce Reference

## Custom Object Limits by Edition

| Edition | Max Custom Objects | Max Custom Fields per Object |
|---|---|---|
| Contact Manager | 5 | 25 |
| Group / Professional | 50 | 100 |
| Enterprise / Developer | 200 / 400 | 500 |
| Unlimited / Performance | 2,000 | 800 |

Hard ceiling: 800 custom fields on any single object (Unlimited/Performance).

## Field Types

| Field Type | Max Length / Size | Indexable | Filterable in SOQL |
|---|---|---|---|
| Text | 255 chars | Yes | Yes |
| Text Area | 255 chars | No | Yes (limited) |
| Long Text Area | 131,072 chars | No | No (not selective) |
| Rich Text Area | 131,072 chars | No | No |
| Number | 18 digits | Yes | Yes |
| Currency | 18 digits (multi-currency aware) | Yes | Yes |
| Percent | 18 digits (stored as decimal) | Yes | Yes |
| Date | Date only | Yes | Yes |
| DateTime | Date + time (UTC) | Yes | Yes |
| Checkbox | Boolean | Yes | Yes |
| Picklist (single) | Controlled vocabulary | Yes (restricted) | Yes |
| Picklist (multi-select) | Multiple values | No | INCLUDES/EXCLUDES only |
| Formula | Calculated, read-only | No (derived) | Yes |
| Roll-Up Summary | Aggregate (SUM, COUNT, MIN, MAX) | N/A | N/A |
| Lookup | Reference to another record | Yes (auto-indexed) | Yes |
| External ID | Upsert key from external system | Yes (auto-indexed) | Yes |

## Relationship Types

| Relationship | Cascade Delete | Roll-Up Summary | Required | Reparent | Sharing Inherited |
|---|---|---|---|---|---|
| Lookup | No (configurable) | No | No | Yes | No |
| Master-Detail | Yes | Yes | Yes | No (unless enabled) | Yes |
| Many-to-Many (junction) | Both sides | From junction | Both | No | From primary master |
| Hierarchical (self-lookup) | No | No | No | Yes | No |
| External Lookup | No | No | No | Yes | No |
| Indirect Lookup | No | No | No | Yes | No |

Max relationships per object: **40** (lookup + master-detail combined).
Max master-detail per object: **2**.

## Automatically Indexed Fields

| Field | Notes |
|---|---|
| `Id` | Primary key |
| `Name` | Standard name field |
| `OwnerId` | Record owner |
| `CreatedDate` | Audit field |
| `SystemModstamp` | Audit field |
| `RecordTypeId` | Record type discriminator |
| All External ID fields | Auto-indexed on creation |
| All Lookup / Master-Detail fields | Auto-indexed on creation |

## Custom Index Selectivity Thresholds

| Index Type | Threshold (first 1M records) | Threshold (remaining records) | Max Rows Returned |
|---|---|---|---|
| Standard index | < 30% | < 15% | 1,000,000 |
| Custom index | < 10% | < 5% | 333,333 |

Max custom indexes per object: **25** (soft limit; shared with External ID + unique fields).

## Roll-Up Summary & Formula Limits

| Limit | Default | Max (via Support) |
|---|---|---|
| Roll-Up Summary fields per object | 25 | 40 |
| Formula fields per object | 40 | -- |
| External ID fields per object | 25 | Soft limit, can request increase |

## Custom Metadata vs Custom Settings vs Custom Labels

| Feature | Custom Metadata (`__mdt`) | Custom Settings | Custom Labels |
|---|---|---|---|
| Deployable via metadata | Yes | No (hierarchy) / Yes (list) | Yes |
| Available in Flows | Yes (Get Records) | Yes (formula) | Yes |
| Available in Formulas | Yes | Yes | Yes |
| Available in SOQL | Yes | Yes (limits apply) | No |
| Per-user/profile values | No | Yes (hierarchy) | No (language only) |
| Packageable | Yes | Limited | Yes |
| Governor limit on reads | No (cached) | Yes (SOQL equivalent) | No |
| Max records | 10 million | 10 MB total cached | Unlimited |
| Best for | Config deployed with code | User/profile-specific settings | Translatable strings |

## Object-Wide Defaults (OWD)

| OWD Setting | Record Owner | Other Users | Best For |
|---|---|---|---|
| Public Read/Write | Full | Read + Write | Reference/config data |
| Public Read Only | Full | Read only | Products, pricebooks |
| Private | Full | None | Accounts, Opportunities |
| Controlled by Parent | Inherits | Inherits | Child (Master-Detail) |

## External Object Adapters

| Adapter | Use Case | Notes |
|---|---|---|
| OData 2.0 / 4.0 | External REST API with OData | Network latency dependent |
| Custom Adapter | Proprietary API or database | Apex-based |
| Cross-Org | Another Salesforce org | Salesforce Connect |

Limitations: No triggers, no Flows, no Validation Rules on External Objects.

## Anti-Patterns

| Anti-Pattern | Problem | Fix |
|---|---|---|
| Polymorphic lookup abuse | Hard to query/maintain | Explicit lookup fields per related object |
| Over-normalization | Too many objects for simple data | Flatten into fields unless multi-value needed |
| Too many custom fields | Approaching 800-field limit | Split into child objects or Custom Metadata |
| Circular Master-Detail | Deletion/sharing cascades | Break circle with Lookup on one side |
| Text instead of Lookup | No referential integrity | Use Lookup fields |
| Ignoring LDV (>100K records) | Non-selective full table scans | Custom indexes, skinny tables |
