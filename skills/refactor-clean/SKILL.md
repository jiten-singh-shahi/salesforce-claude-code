---
name: refactor-clean
description: >-
  Use when cleaning up Salesforce Apex or LWC code. Dead code removal and consolidation using PMD
  and Salesforce Code Analyzer for safe cleanup.
origin: SCC
user-invocable: true
disable-model-invocation: true
---

# Refactor Clean — Dead Code Removal and Consolidation

Remove dead code and consolidate duplicates safely. Uses Salesforce Code Analyzer (`sf code-analyzer run`) for detection when available, falls back to manual analysis.

## When to Use

- When cleaning up unused Apex classes, methods, or LWC components
- When consolidating duplicate utility methods across multiple service classes
- When preparing a codebase for a security review or AppExchange submission
- When Salesforce Code Analyzer or PMD reports high-severity findings that need cleanup
- When reducing technical debt by removing commented-out code and unreferenced classes

## Workflow

### Step 1 — Detect Dead Code

**Option A: Salesforce Code Analyzer (preferred)**
```bash
sf code-analyzer run --target force-app --format table
sf code-analyzer run --target force-app --format json | jq '.[] | select(.severity <= 2)'
```

**Option B: Manual analysis**
```bash
# Find Apex classes with no references.
# Uses sfdx-project.json packageDirectories to find all source paths,
# rather than hardcoding force-app/main/default.
# Note: This heuristic searches source files for class name strings. Results may
# be incomplete — classes can be referenced dynamically (Type.forName), from
# managed packages, external integrations, or metadata not in source control.
# Always verify before deleting.
SRC_DIRS=$(node -e "
  const p = require('./sfdx-project.json');
  console.log(p.packageDirectories.map(d => d.path).join(' '));
" 2>/dev/null || echo "force-app")
for dir in $SRC_DIRS; do
  find "$dir" -name "*.cls" -not -name "*Test*" | while read cls; do
    name=$(basename "$cls" .cls)
    # Note: Use word-boundary matching for precise results to avoid partial name matches
    refs=$(grep -rlw "$name" $SRC_DIRS --include="*.cls" --include="*.trigger" --include="*.js" --include="*.xml" 2>/dev/null | grep -v "$cls" | wc -l)
    if [ "$refs" -eq 0 ]; then echo "UNREFERENCED: $name"; fi
  done
done

# Find unused methods within a class (private methods not called internally)
grep -n "private.*void\|private.*String\|private.*List\|private.*Map" <file>.cls
```

### Step 2 — Classify Safety

Categorize each finding before removing anything:

| Safety Level | Criteria | Action |
|-------------|----------|--------|
| **SAFE** | Private methods with no internal callers, unreferenced private classes, commented-out code blocks | Remove immediately |
| **CAUTION** | Public methods not referenced in code (may be called by Flows, Process Builders, or external systems) | Check metadata references first |
| **DANGER** | `global` methods, `@AuraEnabled`, `@InvocableMethod`, `@InvocableVariable`, `@RemoteAction`, `@HttpGet/Post`, managed package components | Do NOT remove without explicit verification |

### Step 3 — Check Metadata References

Before removing any CAUTION or DANGER items:

```bash
# Check if a method is referenced in Flows
grep -rl "ClassName.MethodName" force-app/main/default/flows/

# Check if a class is used in Process Builders
grep -rl "ClassName" force-app/main/default/workflows/

# Check if a class is referenced in Custom Metadata
grep -rl "ClassName" force-app/main/default/customMetadata/

# Check if an LWC component is used in FlexiPages
grep -rl "c-component-name" force-app/main/default/flexipages/

# Check if a class is referenced in page layouts
grep -rl "ClassName" force-app/main/default/layouts/
```

### Step 4 — Managed Package Considerations

Never remove without checking:
- `@AuraEnabled` methods — may be called by LWC/Aura components not in your source
- `@InvocableMethod` — may be called by Flows you can't see in source control
- `global` methods — may be called by subscriber orgs or external packages
- `webService` methods — may be called by external integrations
- Methods referenced in Permission Sets or Custom Permissions

### Step 5 — Remove One at a Time

For each SAFE item:
1. Delete the dead code
2. Run tests: `sf apex run test --test-level RunLocalTests --wait 15`
3. Verify deployment: `sf project deploy start --dry-run --wait 10`
4. If tests fail, revert the deletion immediately

### Step 6 — Consolidate Duplicates

After dead code removal, look for consolidation opportunities:
1. Identify similar methods across classes (same logic, different names)
2. Extract shared logic into a utility/service class
3. Update all callers to use the shared implementation
4. Run full test suite after each consolidation

## Safety Rules

- Always create a checkpoint before starting: `/checkpoint refactor-start`
- Remove one item at a time — never batch deletions
- Run tests after each removal
- Never remove `@AuraEnabled`, `@InvocableMethod`, or `global` without verifying all callers
- Check metadata references (Flows, Process Builders, FlexiPages) before deleting any public method
- Keep a log of what was removed and why

## Examples

```
refactor-clean Remove unused Apex classes and dead methods from force-app/
refactor-clean Consolidate duplicate utility methods across AccountService and ContactService
refactor-clean Find and remove unreferenced LWC components
refactor-clean Run Salesforce Code Analyzer and clean up all HIGH severity PMD findings
```
