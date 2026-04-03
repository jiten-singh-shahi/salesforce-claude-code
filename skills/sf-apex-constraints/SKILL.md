---
name: sf-apex-constraints
description: "Enforce Apex governor limits, naming, bulkification, and security rules. Use when writing or reviewing ANY Apex class, trigger, or batch job. Do NOT use for LWC, Flow, or Visualforce."
origin: SCC
user-invocable: false
allowed-tools: Read, Grep, Glob
---

# Apex Constraints

## When to Use

This skill auto-activates when writing, reviewing, or modifying any Apex class, trigger, or batch job. It enforces governor limits, naming conventions, bulkification rules, and security requirements for all Apex artifacts.

Hard rules that every Apex class, trigger, and batch job must satisfy. Violations here cause governor failures, security review rejections, or production incidents. Reference files contain the full data; this skill contains only the enforcement rules.

## Core Rules

@../_reference/GOVERNOR_LIMITS.md
@../_reference/NAMING_CONVENTIONS.md
@../_reference/SECURITY_PATTERNS.md
@../_reference/DEPRECATIONS.md

## Apex-Specific Rules

### Never Do

- **SOQL inside a loop** — exceeds the per-transaction SOQL query limit (see @../_reference/GOVERNOR_LIMITS.md); query once outside the loop, store in Map
- **DML inside a loop** — exceeds the per-transaction DML limit (see @../_reference/GOVERNOR_LIMITS.md); collect records in a List, single DML after loop
- **Catch generic `Exception`** — masks programming bugs (NullPointerException, TypeException); catch specific types only
- **Omit sharing keyword** — classes without a sharing keyword default to `without sharing`; always declare `with sharing`, `without sharing`, or `inherited sharing` explicitly
- **Use `without sharing` on user-facing classes** — bypasses record-level security; must be `with sharing`
- **Hardcode Record IDs** — IDs differ per org/sandbox; use SOQL, Custom Metadata, or Custom Settings
- **Hardcode credentials or endpoint URLs** — use Named Credentials / External Credentials
- **Use `global` access modifier** — locks managed package API surface; use `public` unless building a package API
- **Leave `System.debug` in production code** — fills debug logs, can expose sensitive data
- **Use string concatenation in dynamic SOQL** — SOQL injection risk; use bind variables or `Database.queryWithBinds()`
- **Ignore `Database.SaveResult`** — partial-success DML silently drops failures; always inspect every result
- **Use `element.innerHTML = userInput`** — XSS vulnerability; use `textContent` or sanitized components
- **Write methods longer than 50 lines** — extract private helper methods for testability
- **Use `List<sObject>` as a parameter type** — loses type information; use concrete types like `List<Account>`
- **Use Hungarian notation** (`strName`, `lstAccounts`) — use descriptive camelCase names instead

### Always Do

- **Declare `with sharing` by default** — only use `without sharing` with a documented justification
- **Enforce CRUD/FLS** — use `WITH USER_MODE` for SOQL, `AccessLevel.USER_MODE` for DML on user-facing operations
- **Bulkify all triggers** — test with 200 records (standard trigger batch size); no per-record SOQL/DML
- **One trigger per object** — delegate all logic to a handler class (`{Object}TriggerHandler`)
- **Use PascalCase for classes**, camelCase for methods/variables, UPPER_SNAKE_CASE for constants
- **Suffix classes by role** — `Service`, `Selector`, `TriggerHandler`, `Batch`, `Job`, `Scheduler`, `Controller`, `Test`, `Exception`
- **Suffix test classes with `Test`** (not prefix) — `AccountServiceTest`, not `TestAccountService`
- **Name test methods** as `test{Method}_{scenario}_{expectedResult}`
- **Create domain-specific exception classes** — not generic `Exception` throws
- **Check limits programmatically** before expensive operations — use `Limits.getQueries()`, `Limits.getCpuTime()`, etc.
- **Use Map/Set for lookups** — O(1) vs O(n) nested loops; prevents CPU time exhaustion
- **Use `String.join()` for string building** — not concatenation in loops (heap + CPU cost)
- **Null-check before dereferencing** — use `?.` (null-safe navigation) for parent relationship fields
- **Offload to async** when processing >200 records or when CPU exceeds 8,000ms threshold
- **Organize class members** in order: constants, static variables, instance variables, constructors, public methods, private methods, inner classes

## Anti-Pattern Reference

| Anti-Pattern | Problem | Correct Pattern |
|---|---|---|
| SOQL in loop | Exceeds per-transaction SOQL limit (see @../_reference/GOVERNOR_LIMITS.md) | Query once, store in Map |
| DML in loop | Exceeds per-transaction DML limit (see @../_reference/GOVERNOR_LIMITS.md) | Collect records, single DML after loop |
| Nested loops for matching | CPU time exhaustion (O(n^2)) | Map/Set lookup (O(1)) |
| String concat in loop | Heap growth + CPU waste | `List<String>` + `String.join()` |
| SELECT * (all fields) | Heap exhaustion | SELECT only required fields |
| No sharing keyword | Silent `without sharing` default | Explicit `with sharing` declaration |
| Missing CRUD/FLS check | Security review failure | `WITH USER_MODE` / `AccessLevel.USER_MODE` |
| Dynamic SOQL via concat | SOQL injection | Bind variables / `queryWithBinds()` |
| Catching `Exception` | Masks real bugs | Catch specific exception types |
| Ignoring SaveResult | Silent data loss | Inspect every `Database.SaveResult` |
| Hardcoded IDs | Breaks across orgs | SOQL / Custom Metadata lookup |

## Related

- **Pattern skill**: `sf-apex-best-practices` — implementation examples for the rules above (class organization, error handling, collection patterns)
- Reference files: @../_reference/GOVERNOR_LIMITS.md, @../_reference/NAMING_CONVENTIONS.md, @../_reference/SECURITY_PATTERNS.md
