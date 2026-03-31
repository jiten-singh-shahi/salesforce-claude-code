---
name: sf-soql-constraints
description: "Enforce SOQL/SOSL safety rules, selectivity, and governor limit compliance. Use when writing or reviewing ANY SOQL query, SOSL search, or database operations. Do NOT use for Apex structure, LWC, or Flow."
origin: SCC
user-invocable: false
allowed-tools: Read, Grep, Glob
---

# SOQL Constraints

## When to Use

This skill auto-activates when writing, reviewing, or optimizing any SOQL query, SOSL search, or Apex database operation. It enforces query safety rules, selectivity requirements, and governor limit compliance for all database operations.

Hard rules for every SOQL query, SOSL search, and Apex database operation.
Violations cause governor limit failures, security vulnerabilities, or
production outages. See @../_reference/SOQL_PATTERNS.md for selectivity thresholds and
@../_reference/GOVERNOR_LIMITS.md for per-transaction budgets.

## Never Rules

1. **Never place SOQL or SOSL inside a loop.** Every iteration consumes one
   of the per-transaction SOQL query budget (see @../_reference/GOVERNOR_LIMITS.md). Query
   once before the loop, store results in a `Map<Id, SObject>`, then iterate.

2. **Never write a non-selective query on objects with >200,000 rows.** The
   query optimizer will full-table-scan and the query fails in trigger context.
   Every WHERE clause must target an indexed field below the selectivity
   threshold (see @../_reference/SOQL_PATTERNS.md, Selectivity Thresholds table).

3. **Never use `FIELDS(ALL)` or `FIELDS(CUSTOM)` in triggers, service classes,
   or production paths.** Select only the fields the calling code actually
   reads. `FIELDS()` directives are for exploration and debugging only.

4. **Never hardcode Salesforce record IDs.** IDs differ between orgs and
   sandboxes. Use `Schema.SObjectType`, Custom Metadata, or Custom Labels to
   resolve IDs at runtime.

5. **Never omit `LIMIT` on unbounded queries.** Any query that could return an
   unknown number of rows must include a `LIMIT` clause to stay within the
   per-transaction row limit (see @../_reference/GOVERNOR_LIMITS.md).

6. **Never concatenate user input into dynamic SOQL strings.** This creates
   SOQL injection vulnerabilities. Use bind variables (`:variable`) for inline
   SOQL or `Database.queryWithBinds()` for dynamic SOQL.

7. **Never use a leading wildcard in `LIKE` filters** (`LIKE '%term%'`).
   Leading wildcards prevent index use and cause full table scans. Use SOSL
   (`FIND`) for full-text search instead.

8. **Never use `!=` or `NOT IN` as the sole WHERE filter.** These operators
   are non-optimizable and always produce table scans (see @../_reference/SOQL_PATTERNS.md,
   Optimizable vs Non-Optimizable Operators).

9. **Never omit security enforcement on user-facing queries.** Queries
   triggered by user actions (LWC, Aura, VF, REST endpoints) must include
   `WITH USER_MODE` or equivalent FLS/CRUD enforcement.

10. **Never load all records just to count them.** Use `SELECT COUNT() FROM`
    or aggregate queries instead of querying records and calling `.size()`.

## Always Rules

1. **Always bulkify database operations.** Collect IDs in a `Set<Id>`, query
   once with `WHERE Id IN :idSet`, and store results in a `Map<Id, SObject>`.

2. **Always use bind variables** (`:variable`) in inline SOQL. For dynamic
   SOQL, always use `Database.queryWithBinds()` with a bind map.

3. **Always use `WITH USER_MODE`** (see @../_reference/API_VERSIONS.md for minimum version) on queries executed in
   user-facing contexts (LWC controllers, Aura controllers, VF controllers,
   REST resources). Use `WITH SYSTEM_MODE` only for documented system
   processes (batch jobs, integrations) with explicit justification.

4. **Always filter on indexed fields.** Prefer `Id`, `Name`, `OwnerId`,
   `RecordTypeId`, `CreatedDate`, `SystemModstamp`, lookup/master-detail
   fields, or External ID fields. See @../_reference/SOQL_PATTERNS.md, Standard Indexed
   Fields table for the full list.

5. **Always add `LIMIT` when only one record is expected** (`LIMIT 1`) or
   when displaying a bounded list.

6. **Always use relationship queries** (parent-to-child subqueries or
   child-to-parent dot notation) instead of separate queries when fetching
   related data. Subqueries do not count as separate SOQL queries.

7. **Always use SOSL instead of `LIKE` for text search across objects.**
   SOSL uses the search index and is far more efficient than `LIKE` on
   large-volume objects.

8. **Always validate object and field names** via `Schema.getGlobalDescribe()`
   before building dynamic SOQL. Never trust external input for object or
   field names.

9. **Always test triggers and services with 200 records** (the standard
   trigger batch size) to validate bulk safety against governor limits.

## Anti-Pattern Table

| Problem | Correct Pattern |
|---|---|
| SOQL inside `for` loop | Query before loop, store in `Map<Id, SObject>` |
| `SELECT FIELDS(ALL) FROM Account` in service class | `SELECT Id, Name FROM Account` -- explicit fields only |
| `WHERE Description LIKE '%keyword%'` | `FIND 'keyword' IN ALL FIELDS RETURNING Account(Id, Name)` (SOSL) |
| `WHERE Custom_Field__c = 'value'` on non-indexed field (LDV) | Add indexed field to WHERE, or request custom index |
| `String query = '...WHERE Name = \'' + input + '\''` | `[SELECT Id FROM Account WHERE Name = :input]` or `Database.queryWithBinds()` |
| `List<Account> all = [SELECT Id FROM Account]; Integer c = all.size();` | `Integer c = [SELECT COUNT() FROM Account];` |
| Hardcoded `WHERE Id = '001xx000003DGXXX'` | `WHERE Id = :accountId` with runtime-resolved variable |
| No `WITH USER_MODE` on LWC controller query | Add `WITH USER_MODE` to enforce FLS + sharing |
| Separate queries for parent and child records | Use subquery: `SELECT Id, (SELECT Id FROM Contacts) FROM Account` |
| `WHERE Status__c != 'Closed'` as only filter | Add a selective indexed filter: `WHERE RecordTypeId = :rtId AND Status__c != 'Closed'` |

## Limit Budgets (Quick Reference)

Do not memorize raw numbers -- always check @../_reference/GOVERNOR_LIMITS.md for the
authoritative table. Key constraint categories that shape every query decision:

- **SOQL query limit** per synchronous/asynchronous transaction (see @../_reference/GOVERNOR_LIMITS.md)
- **Total rows returned** per transaction (see @../_reference/GOVERNOR_LIMITS.md)
- **Heap size** synchronous/asynchronous (see @../_reference/GOVERNOR_LIMITS.md)
- **CPU time** synchronous/asynchronous (see @../_reference/GOVERNOR_LIMITS.md)

Use `Limits.getQueries()` / `Limits.getLimitQueries()` to check remaining
budget at runtime before issuing additional queries.

## Related

- **sf-soql-optimization** -- Action skill for interactive query optimization,
  index strategy guidance, and Query Plan Tool usage.
- **sf-apex-constraints** -- Apex-level constraint rules (bulkification, DML
  patterns, CPU/heap management).
