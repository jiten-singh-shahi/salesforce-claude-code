# SOQL Patterns — Reference

> Source: <https://developer.salesforce.com/docs/atlas.en-us.soql_sosl.meta/soql_sosl/sforce_api_calls_soql.htm>
> Last verified: API v66.0, Spring '26 (2026-03-28)

## Query Selectivity

The Force.com query optimizer evaluates every WHERE filter against selectivity thresholds. If no filter is selective, the query does a full table scan (and fails on objects >200 000 rows in triggers).

### Selectivity Thresholds

| Index Type | First 1M Records | Records Beyond 1M | Max Target Rows |
|---|---|---|---|
| Standard index | < 30% | < 15% | 1,000,000 |
| Custom index | < 10% | < 5% | 333,333 |

A filter is **selective** when targeted rows fall below the threshold. Multiple non-selective AND filters can combine to be selective if their intersection is below the threshold.

### Optimizable vs Non-Optimizable Operators

| Optimizable | Non-Optimizable |
|---|---|
| `=`, `<`, `>`, `<=`, `>=` | `!=`, `NOT` |
| `IN`, `LIKE` (leading-% excluded) | `NOT IN`, `EXCLUDES` |
| `INCLUDES` | `LIKE 'abc%def'` (leading wildcard) |

### Standard Indexed Fields (Auto-Created)

| Field | Notes |
|---|---|
| `Id` | Primary key |
| `Name` | Compound name fields on standard objects |
| `OwnerId` | Lookup to User/Group |
| `RecordTypeId` | |
| `CreatedDate` | |
| `SystemModstamp` | Preferred over `LastModifiedDate` for filtering |
| `LastModifiedDate` | Shares index with `SystemModstamp` internally |
| Lookup / Master-Detail fields | All relationship foreign keys |
| `Email` | On Contact and Lead only |
| `Division` | If multi-division enabled |
| External ID fields | Index auto-created when field marked External ID |

**Non-indexable types:** Multi-select picklist, Long text area, Rich text area, Encrypted text, Non-deterministic formula fields.

## Relationship Query Limits

| Constraint | Limit |
|---|---|
| Child-to-parent levels (dot notation) | 5 |
| Parent-to-child subqueries per query | 20 |
| Child-to-parent relationships per query | 55 |
| Records returned per subquery | 2,000 |
| Parent-to-child nesting (REST/SOAP, API v58.0+) | 5 levels |
| Parent-to-child nesting (Apex) | 2 levels |

## Aggregate Query Rules

| Function | Field Types Supported |
|---|---|
| `COUNT()` | All (no field argument) |
| `COUNT(field)` | All except long text, rich text |
| `COUNT_DISTINCT(field)` | All except long text, rich text |
| `SUM(field)` | Number, Currency, Percent |
| `AVG(field)` | Number, Currency, Percent |
| `MIN(field)` | Number, Currency, Percent, Date, Datetime |
| `MAX(field)` | Number, Currency, Percent, Date, Datetime |

| Constraint | Value |
|---|---|
| Max grouped rows returned | 2,000 |
| Max fields in `GROUP BY` | 3 (with ROLLUP/CUBE) |
| `GROUP BY ROLLUP` | Supported (API v18.0+) |
| `GROUP BY CUBE` | Supported (API v18.0+) |
| `HAVING` | Filters on aggregate result only |
| `TYPEOF` with GROUP BY | Not supported |

## SOQL Keyword Reference

Core syntax: `SELECT ... FROM ... WHERE ... GROUP BY ... HAVING ... ORDER BY ... [ASC|DESC] [NULLS FIRST|LAST] LIMIT n OFFSET n` (OFFSET max 2,000).

### Scope, Security & Locking Clauses

| Clause | Purpose | Constraints |
|---|---|---|
| `FOR UPDATE` | Row-level pessimistic lock (10 s timeout) | No ORDER BY; no aggregates; max 200 rows |
| `FOR VIEW` | Updates `RecentlyViewed` | Informational; no query behavior change |
| `FOR REFERENCE` | Updates `RecentlyViewed` for related records | Informational; no query behavior change |
| `WITH SECURITY_ENFORCED` | Enforce FLS in SELECT (legacy) | SELECT only; throws on violation |
| `WITH USER_MODE` | Full CRUD + FLS + sharing (recommended) | Works in DML too; API v60.0+ |
| `WITH SYSTEM_MODE` | Bypass all security | Works in DML too; API v60.0+ |
| `USING SCOPE scope` | Restrict record scope | Values: `Everything`, `Mine`, `Queue`, `Delegated`, `MyTerritory`, `MyTeamTerritory`, `Team` |

### TYPEOF (Polymorphic Relationships)

Syntax: `TYPEOF field WHEN Type1 THEN fields WHEN Type2 THEN fields ELSE fields END`. Filter with `WHERE field.Type IN (...)`. Cannot combine with: `GROUP BY`, `ROLLUP`, `CUBE`, `HAVING`, `COUNT()`.

## SOQL Cursor Pagination (API v66.0+)

| Constraint | Value |
|---|---|
| Max records per cursor | 50,000,000 |
| `fetch()` max page size | 2,000 rows |
| Max `fetch()` calls per transaction | 10 |
| Max cursors per day (org-wide) | 10,000 |
| Max rows per day (org-wide, aggregate) | 100,000,000 |
| Cursor lifetime (sync) | 10 minutes |
| Cursor lifetime (async) | 60 minutes |

API: `Database.getCursor(soqlString)` returns `Database.Cursor`. Use `cursor.fetch(offset, count)` and `cursor.getNumRecords()`.

## SOQL Governor Limits (Quick Ref)

| Resource | Synchronous | Asynchronous |
|---|---|---|
| SOQL queries per transaction | 100 | 200 |
| Total rows returned | 50,000 | 50,000 |
| `FOR UPDATE` max rows | 200 | 200 |
| OFFSET max value | 2,000 | 2,000 |
| QueryLocator rows (Batch) | N/A | 50,000,000 |
