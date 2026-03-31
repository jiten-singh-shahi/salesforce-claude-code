# Sharing Model — Reference

> Source: https://architect.salesforce.com/fundamentals/platform-sharing-architecture
> Last verified: API v66.0, Spring '26 (2026-03-28)

## Apex Sharing Keywords

| Keyword | Enforcement | Behavior |
|---|---|---|
| `with sharing` | User mode | Enforces OWD, role hierarchy, sharing rules, manual shares for running user |
| `without sharing` | System mode | Ignores all sharing rules; returns all records the user has object-level access to |
| `inherited sharing` | Caller's mode | Inherits sharing context of the calling class; defaults to `with sharing` if entry point |
| _(omitted)_ | Varies | Runs as `without sharing` **unless** called from a `with sharing` class (then inherits) |

**Special contexts:**

| Context | Default Sharing Mode |
|---|---|
| Triggers | `without sharing` (system mode); call `with sharing` class to enforce |
| Anonymous Apex | `with sharing` enforced by default |
| Inner classes | Do **not** inherit outer class keyword; must declare their own |
| Visualforce controllers | Standard controller: `with sharing`; custom controller: depends on keyword |

## Organization-Wide Defaults (OWD)

OWD sets the **most restrictive** baseline. Additional mechanisms only open access further.

| Level | Visibility | Edit | Transfer |
|---|---|---|---|
| **Private** | Owner + hierarchy above | Owner + hierarchy above | Owner |
| **Public Read Only** | All users | Owner + hierarchy above | Owner |
| **Public Read/Write** | All users | All users | Owner |
| **Public Read/Write/Transfer** | All users | All users | All users |
| **Controlled by Parent** | Inherited from parent record | Inherited from parent record | N/A |

### Object-Specific OWD Options

| Object | Available OWD Levels |
|---|---|
| Account | Private, Public Read Only, Public Read/Write |
| Contact | Controlled by Parent, Private, Public Read Only, Public Read/Write |
| Opportunity | Private, Public Read Only, Public Read/Write |
| Case | Private, Public Read Only, Public Read/Write, Public Read/Write/Transfer |
| Lead | Private, Public Read Only, Public Read/Write, Public Read/Write/Transfer |
| Campaign | Private, Public Read Only, Public Full Access |
| Price Book | No Access, View Only, Use |
| Custom Objects | Private, Public Read Only, Public Read/Write |

- **External OWD:** Separate baseline for portal/community users; must be equal to or more restrictive than internal OWD.
- **Grant Access Using Hierarchies:** Checkbox on custom objects (default on); when disabled, role hierarchy does not auto-grant access.

## Record Access Mechanisms (Evaluation Order)

| # | Mechanism | Description |
|---|---|---|
| 1 | **OWD** | Baseline for all users |
| 2 | **Role Hierarchy** | Managers inherit subordinate record access (unless disabled for custom objects) |
| 3 | **Owner-Based Sharing Rules** | Share records owned by role/group A with role/group B |
| 4 | **Criteria-Based Sharing Rules** | Share records matching field criteria with role/group |
| 5 | **Teams** | Account Teams, Opportunity Teams, Case Teams |
| 6 | **Territory Management** | Access based on territory assignment |
| 7 | **Manual Sharing** | Ad-hoc grant by record owner or admin; **removed on owner change** |
| 8 | **Apex Managed Sharing** | Programmatic share rows with custom RowCause; **survives owner change** |
| 9 | **Restriction Rules** | Filters that further **limit** visibility (2-5 per object) |

## Sharing Rule Types

| Type | Shares Based On | Access Granted | Limit |
|---|---|---|---|
| **Owner-Based** | Record owner (role, group, territory, queue) | Read Only or Read/Write | 300 per object |
| **Criteria-Based** | Field values on record | Read Only or Read/Write | 50 per object |
| **Guest User** | Field values (criteria-based) | Read Only **only** | Included in criteria limit |

## Implicit Sharing (Non-Configurable)

| Type | Behavior |
|---|---|
| **Parent Implicit** | Access to child (Contact, Opp, Case) grants read-only on parent Account |
| **Child Implicit** | Account owner gets access to child records per role-level settings |

## Share Object (`__Share`) Structure — `MyObject__Share` (custom) / `AccountShare` (standard)

| Field | Description | Values |
|---|---|---|
| `ParentId` | ID of the record being shared | Record ID |
| `UserOrGroupId` | User, Group, or Queue receiving access | User/Group ID |
| `AccessLevel` | Level of access granted | `Read`, `Edit`, `All` |
| `RowCause` | Reason for the share row | See table below |

### RowCause Values

| RowCause | Description |
|---|---|
| `Owner` | Record owner (system-managed) |
| `Manual` | Manual sharing or Apex sharing on standard objects |
| `Rule` | Sharing rule |
| `ImplicitChild` | Child implicit sharing |
| `ImplicitParent` | Parent implicit sharing |
| `Team` | Team member sharing |
| `TerritoryRule` | Territory-based sharing |
| `Territory2Forecast` | Enterprise territory forecast sharing |
| _(Custom reason)_ | Apex sharing reason (custom objects only) |

- Custom `RowCause` values require Setup > Object > Apex Sharing Reasons
- Only available on **custom objects**; standard objects must use `Manual`
- `Manual` shares are **deleted on owner change**; custom reasons **survive** owner change
- Insert/delete `__Share` rows in `without sharing` context
- Sharing recalculation: implement `Database.Batchable` to rebuild shares at scale

## Limits

| Limit | Value |
|---|---|
| Roles (internal / external) | 25,000 / 100,000 |
| Role hierarchy branch depth | 10 levels recommended |
| Public groups / nesting depth | 100,000 / 5 levels |
| Owner-based sharing rules per object | 300 |
| Criteria-based sharing rules per object | 50 |
| Restriction rules per object | 2-5 (edition-dependent) |
| Ownership skew threshold | 10,000 records per user |
