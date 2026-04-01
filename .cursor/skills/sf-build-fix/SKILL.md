---
name: sf-build-fix
description: >-
  Auto-fix Salesforce build errors — Apex compilation, metadata conflicts, dependencies, test failures. Use when build errors block deployment. Do NOT use for writing new features or refactoring.
disable-model-invocation: true
---

# Build Fix — Salesforce Build and Deployment Error Resolution

Fix build and deployment errors incrementally. Parse error output, classify issues, fix one at a time, re-validate.

Reference: @../_reference/DEPLOYMENT_CHECKLIST.md

## When to Use

- When Apex compilation errors are blocking a deployment
- When metadata conflicts prevent deploying to a target org
- When test failures need to be resolved before deployment validation passes
- When dependency resolution is needed (missing objects, fields, or class references)
- When you receive build errors from `sf project deploy` and need systematic resolution

## Workflow

### Step 1 — Capture Errors

Run a dry-run deployment or check compiler output:

```bash
sf project deploy validate --target-org <alias> --json 2>&1
```

If the user pasted error output directly, use that instead.

### Step 2 — Parse and Classify

Group errors by type and fix in this dependency order:

| Priority | Error Type | Fix Strategy |
|----------|-----------|--------------|
| 1 | Missing object/field metadata | Deploy metadata first -- objects before classes |
| 2 | Missing class/interface reference | Check spelling, verify class exists, check API version |
| 3 | Type mismatch | Cast explicitly, check null handling, verify generic types |
| 4 | Method signature changed | Update all callers, check for overloaded methods |
| 5 | Metadata conflict | Retrieve latest from org with `sf project retrieve start`, merge |
| 6 | Test failure | Fix test data setup, update assertions, check @TestSetup |
| 7 | Governor limit in test | Add Test.startTest()/stopTest(), reduce data volume |

### Step 3 — Fix One at a Time

For each error:

1. Read the file at the reported line number
2. Understand the context (class, method, trigger)
3. Apply the minimal fix
4. Verify it compiles: `sf project deploy validate --metadata "ApexClass:<ClassName>" --target-org <org>`

### Step 4 — Re-validate

After all fixes:

```bash
sf project deploy validate --target-org <alias> --test-level RunLocalTests
```

## Common Apex Compilation Errors

| Error Message Pattern | Root Cause | Fix |
|----------------------|------------|-----|
| `Variable does not exist: X` | Undeclared variable or field removed | Declare variable or check field API name |
| `Method does not exist or incorrect signature` | Wrong parameter types or method renamed | Check method signature in target class |
| `Illegal assignment from X to Y` | Type mismatch | Add explicit cast or fix generic type |
| `Non-void method might not return a value` | Missing return in a branch | Add return statement to all code paths |
| `Compile Error: unexpected token` | Syntax error | Check line above the reported line |
| `System.NullPointerException` (test) | Null reference in test setup | Add null checks or fix @TestSetup |
| `Duplicate value found` (test) | Test data collision | Use unique identifiers, avoid SeeAllData |
| `FIELD_CUSTOM_VALIDATION_EXCEPTION` (test) | Validation rule blocking test DML | Populate all required fields in test data |
| `MIXED_DML_OPERATION` (test) | Setup + non-setup DML in same transaction | Use `System.runAs()` in tests or `@future` in production |
| `UNABLE_TO_LOCK_ROW` (test) | Concurrent test data conflicts | Use unique records per test method |

## Dependency Resolution Order

When deploying multiple metadata types, follow this order:

1. Custom Objects and Fields
2. Record Types and Page Layouts
3. Apex Classes (utilities and base classes first)
4. Apex Triggers
5. Lightning Web Components
6. Flows (Process Builder is deprecated since Winter '23 -- migrate to Flows)
7. Permission Sets and Profiles
8. Apex Test Classes (verify at end)

## Metadata Conflict Resolution

When `sf project deploy` reports conflicts:

1. **Retrieve current org state**: `sf project retrieve start --metadata <type>:<name>`
2. **Compare**: `diff force-app/main/default/<path> <retrieved-path>`
3. **Merge**: Keep production changes, layer your modifications on top
4. **Do not force-overwrite** production metadata without understanding the diff

## Rules

- Fix one error at a time -- cascade fixes often resolve multiple issues
- Do NOT refactor while fixing builds
- Do NOT change architecture
- If a fix introduces new errors, revert and try a different approach

## Examples

```
sf-build-fix
sf-build-fix Fix the Apex compile errors from this deployment output: <paste errors>
sf-build-fix The AccountService.cls has a type mismatch on line 47
sf-build-fix Resolve the metadata conflicts blocking our deployment to UAT
```

## Related

- **Constraints**: `sf-deployment-constraints` -- deployment safety rules and validation gates
