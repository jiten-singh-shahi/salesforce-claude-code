# Workflow Examples

This guide provides step-by-step workflow examples showing how Salesforce Claude Code (SCC) is used in practice. Each workflow shows the commands invoked, agents delegated to, hooks that fire, and expected outcomes.

## Workflow 1: Apex TDD -- Test-Driven Development

Build a new Apex service using the Red-Green-Refactor cycle. Tests are written first, then the implementation, then reviewed and refactored.

### Scenario

You need to create an `AccountRatingService` that assigns ratings to accounts based on their annual revenue.

### Step 1 -- Plan the Implementation

```
Plan an AccountRatingService that rates accounts as Hot (>= $1M revenue), Warm ($100K-$1M), or Cold (< $100K)
```

**Agent invoked**: `sf-architect`

**What happens**: The planner agent analyzes the requirement and produces a structured plan including:

- Classes to create (`AccountRatingService.cls`, `AccountRatingServiceTest.cls`)
- Governor limit considerations (no SOQL/DML needed -- pure in-memory logic)
- Test scenarios (happy path, bulk 200 records, null input, empty list, permission testing)

### Step 2 -- Write Tests First (Red Phase)

```
/sf-tdd-workflow Create an AccountRatingService that rates accounts based on AnnualRevenue
```

**Agent invoked**: `sf-apex-agent`

**What happens**:

1. Checks if `TestDataFactory.cls` exists in the project.
2. Creates `AccountRatingServiceTest.cls` with test methods:
   - `testRateAccount_HighRevenue_SetsHotRating` -- single record, Hot path
   - `testRateAccount_Bulk200Records_NoLimitExceptions` -- bulk test with 200 records
   - `testRateAccount_ZeroRevenue_SetsColdRating` -- edge case
   - `testRateAccount_NullList_ThrowsIllegalArgument` -- negative case
   - `testRateAccount_EmptyList_NoException` -- empty input
   - `testRateAccount_RunAsLimitedUser_EnforcesSharingRules` -- permission test
3. Runs the tests to confirm they fail (Red phase confirmed).

**Hook activity**:

- `post-write.js` fires after the test class file is written, reminding about test coverage.

### Step 3 -- Implement the Service (Green Phase)

The TDD workflow continues by creating the minimal `AccountRatingService.cls` to pass all tests:

```bash
sf apex run test --class-names AccountRatingServiceTest --target-org MyScratchOrg --result-format human --wait 10
```

**Hook activity**:

- `governor-check.js` fires after each Edit to the Apex file, checking for SOQL/DML in loops.
- `quality-gate.js` fires after edits, checking for anti-patterns.
- `sfdx-validate.js` fires before the test command, checking for missing flags.

**Expected outcome**: All 6 test methods pass. Coverage is 90%+.

### Step 4 -- Review the Code

```
/sf-apex-best-practices Review AccountRatingService.cls
```

**Agent invoked**: `sf-review-agent`

**What happens**: The reviewer checks the implementation against its checklist:

1. Sharing declaration (`with sharing` present)
2. SOQL outside loops (no SOQL needed in this case)
3. DML outside loops (single `update` call on a collection)
4. Null safety (null parameter check)
5. Security (CRUD/FLS enforcement)
6. Test quality (meaningful assertions, bulk test, negative cases)

**Expected outcome**: Review report with 0 CRITICAL findings, possibly LOW suggestions for constants or documentation.

### Step 5 -- Refactor

With green tests as a safety net, refactor:

- Extract revenue thresholds to Custom Metadata or constants
- Apply service layer pattern if needed
- Run tests after each change to confirm they still pass

```
/sf-governor-limits Check AccountRatingService for governor limit risks
```

**Agent invoked**: `sf-apex-agent`

**Expected outcome**: Clean audit -- no governor limit risks in pure in-memory logic.

---

## Workflow 2: LWC Development -- Component Creation to Testing

Build a new Lightning Web Component with full testing and accessibility review.

### Scenario

You need to create an `accountRatingCard` LWC that displays an account's rating with color-coded badges.

### Step 1 -- Scaffold the Component

```
/sf-lwc-development Create an accountRatingCard component that shows account name, rating badge (Hot=red, Warm=orange, Cold=blue), and annual revenue
```

**Agent invoked**: `sf-lwc-agent`

**What happens**: Reviews the plan for the component and provides guidance on:

- Component structure (HTML template, JS controller, CSS, meta XML)
- Wire service vs imperative Apex for data loading
- Accessibility requirements (ARIA labels, color contrast, keyboard navigation)
- SLDS (Salesforce Lightning Design System) badge patterns

### Step 2 -- Create the Component Files

The agent creates four files:

**`accountRatingCard.html`** -- Template with SLDS badge and conditional styling.

**`accountRatingCard.js`** -- Controller with `@wire` to fetch account data and computed properties for badge styling.

**`accountRatingCard.css`** -- Custom styles (minimal, relying on SLDS).

**`accountRatingCard.js-meta.xml`** -- Metadata defining targets (Lightning Record Page, App Page).

**Hook activity**:

- `post-write.js` fires after each file write, detecting LWC files and reminding about test coverage.
- `post-edit-console-warn.js` fires after JS edits, warning about any `console.log` statements.

### Step 3 -- Write Jest Tests

```
/sf-tdd-workflow Write Jest tests for the accountRatingCard LWC component
```

**What happens**: Creates `__tests__/accountRatingCard.test.js` with:

```javascript
import { createElement } from 'lwc';
import AccountRatingCard from 'c/accountRatingCard';
import getAccountRating from '@salesforce/apex/AccountRatingService.getAccountRating';

// Mock the Apex wire adapter
jest.mock('@salesforce/apex/AccountRatingService.getAccountRating',
  () => ({ default: jest.fn() }),
  { virtual: true }
);

describe('c-account-rating-card', () => {
  afterEach(() => { while (document.body.firstChild) document.body.removeChild(document.body.firstChild); });

  it('renders Hot badge with correct styling', async () => { /* ... */ });
  it('renders Cold badge for low revenue accounts', async () => { /* ... */ });
  it('shows loading spinner while data is being fetched', async () => { /* ... */ });
  it('displays error message when wire service fails', async () => { /* ... */ });
  it('is accessible (no ARIA violations)', async () => { /* ... */ });
});
```

### Step 4 -- Run Tests

```bash
npx lwc-jest --coverage
```

**Expected outcome**: All tests pass with 80%+ coverage.

### Step 5 -- Accessibility Review

```
/sf-lwc-development Review accountRatingCard for accessibility compliance
```

**Agent invoked**: `sf-lwc-agent`

**What it checks**:

- Color is not the only indicator (badges also have text labels)
- ARIA attributes on interactive elements
- Keyboard navigation support
- Screen reader compatibility
- Color contrast ratios meet WCAG 2.1 AA

**Expected outcome**: Accessibility report. Common findings include missing `aria-label` on badges or insufficient color contrast on the Cold (blue) badge.

### Step 6 -- Deploy to Scratch Org

```
/sf-deployment Deploy accountRatingCard and AccountRatingService to scratch org
```

**Agent invoked**: `sf-architect`

**Hook activity**:

- `sfdx-validate.js` fires before the deploy command, checking for missing `--test-level` flag.
- `post-bash-build-complete.js` fires after deployment completes.

---

## Workflow 3: Deployment Pipeline -- Scratch Org to Production

Full development lifecycle from scratch org creation through production deployment.

### Step 1 -- Create a Scratch Org

```
/sf-deployment Create a new scratch org for feature/account-rating
```

**Agent invoked**: `sf-architect`

**What happens**:

1. Verifies Dev Hub is connected:

   ```bash
   sf org list --json
   ```

2. Creates a scratch org with the project definition:

   ```bash
   sf org create scratch --definition-file config/project-scratch-def.json --alias account-rating --duration-days 7 --set-default
   ```

3. Pushes source to the new scratch org:

   ```bash
   sf project deploy start --source-dir force-app/ --target-org account-rating
   ```

4. Imports sample data if a data plan exists:

   ```bash
   sf data import tree --plan data/sample-data-plan.json --target-org account-rating
   ```

**Hook activity**:

- `session-start.js` fires at session start, displaying the newly created scratch org.
- `sfdx-validate.js` fires before each SF CLI command.

### Step 2 -- Develop the Feature

Use the Apex TDD workflow (Workflow 1) and LWC development workflow (Workflow 2) to build the feature in the scratch org.

### Step 3 -- Run All Tests

```
/sf-apex-testing Run all local tests in the scratch org
```

**What happens**:

```bash
sf apex run test --target-org account-rating --test-level RunLocalTests --code-coverage --result-format human --wait 30
```

**Expected outcome**: All tests pass. Org-wide coverage is above 75%.

### Step 4 -- Validate Against Staging

```
/sf-deployment Validate deployment to staging (dry run)
```

**Agent invoked**: `sf-architect`

```bash
sf project deploy validate --source-dir force-app/ --target-org Staging --test-level RunLocalTests --wait 30
```

**Hook activity**:

- `sfdx-validate.js` recognizes the validate command and confirms it is a dry run (no destructive action).

**Expected outcome**: Validation succeeds. No test failures, no missing dependencies, coverage thresholds met.

### Step 5 -- Deploy to Staging

```bash
sf project deploy start --source-dir force-app/ --target-org Staging --test-level RunLocalTests --wait 30
```

**Hook activity**:

- `sfdx-validate.js` checks for `--test-level` flag (present -- good).
- `post-bash-build-complete.js` fires after deployment completes, logging a success notice.

### Step 6 -- Verify Deployment

```
Verify the deployment to Staging succeeded and all tests pass
```

**Agent invoked**: `sf-review-agent`

**What happens**:

1. Queries the deployment status.
2. Runs a subset of tests on Staging to confirm everything works.
3. Checks that the new components are accessible in the target org.

**Expected outcome**: Verification passes. The feature is ready for production deployment.

---

## Workflow 4: Security Audit -- Scan, Fix, Re-Scan

Run a comprehensive security audit on the codebase, fix findings, and verify the fixes.

### Step 1 -- Run the Security Scan

```
/sf-security Run a full security audit on force-app/
```

**Agent invoked**: `sf-review-agent`

**What happens**: The security reviewer performs a multi-pass analysis:

**Pass 1 -- Sharing Model**:

- Checks every Apex class for explicit sharing declaration (`with sharing`, `without sharing`, `inherited sharing`).
- Flags classes without sharing declaration as CRITICAL.
- Flags `without sharing` classes that lack a justification comment as HIGH.

**Pass 2 -- CRUD/FLS Enforcement**:

- Checks SOQL queries for `WITH USER_MODE` (preferred) or `WITH SECURITY_ENFORCED` (legacy).
- Checks DML operations for `AccessLevel.USER_MODE` or `Security.stripInaccessible`.
- Flags unprotected queries as HIGH.

**Pass 3 -- SOQL Injection**:

- Scans for string concatenation in dynamic SOQL (`Database.query()`).
- Checks if `String.escapeSingleQuotes()` is used.
- Flags direct user input concatenation as CRITICAL.

**Pass 4 -- LWC Security**:

- Checks for `innerHTML` usage (XSS risk).
- Verifies `lightning/platformResourceLoader` is used for external scripts (not direct script tags).
- Checks for hardcoded credentials or API keys.

**Expected output**:

```
Security Audit Report
=====================
Classes scanned: 24
LWC components scanned: 8

CRITICAL (2):
  AccountQueryController.cls:15 -- SOQL injection via string concatenation in Database.query()
  ReportExporter.cls:1 -- Missing sharing declaration (defaults to without sharing)

HIGH (3):
  ContactService.cls:42 -- SOQL query without FLS enforcement (no WITH USER_MODE)
  OpportunityService.cls:18 -- DML without AccessLevel.USER_MODE
  LeadProcessor.cls:1 -- 'without sharing' without justification comment

MEDIUM (1):
  accountList.js:22 -- innerHTML assignment (potential XSS)
```

### Step 2 -- Fix the Findings

Address each finding by severity, starting with CRITICAL:

**Fix SOQL injection:**

```
/sf-apex-best-practices Fix the SOQL injection in AccountQueryController.cls
```

The agent replaces string concatenation with bind variables:

```apex
// Before (CRITICAL)
String query = 'SELECT Id FROM Account WHERE Name = \'' + searchTerm + '\'';
List<Account> results = Database.query(query);

// After (SAFE)
List<Account> results = [SELECT Id FROM Account WHERE Name = :searchTerm];
```

**Fix missing sharing:**

```apex
// Before
public class ReportExporter {

// After
public with sharing class ReportExporter {
```

**Fix FLS enforcement:**

```apex
// Before
List<Contact> contacts = [SELECT Id, Name, Email FROM Contact WHERE AccountId = :accountId];

// After
List<Contact> contacts = [SELECT Id, Name, Email FROM Contact WHERE AccountId = :accountId WITH USER_MODE];
```

**Hook activity**:

- `governor-check.js` fires after each edit, checking the modified files.
- `quality-gate.js` fires after each edit, running additional quality checks.

### Step 3 -- Re-Scan

```
/sf-security Re-scan force-app/ to verify all security findings are resolved
```

**Expected output**:

```
Security Audit Report
=====================
Classes scanned: 24
LWC components scanned: 8

CRITICAL: 0
HIGH: 0
MEDIUM: 0
LOW: 1
  LeadProcessor.cls:12 -- Consider adding FLS check on custom field access

All critical and high severity findings resolved.
```

### Step 4 -- Run sfdx-scanner (Strict Profile)

For teams using the strict hook profile, the `sfdx-scanner-check.js` hook automatically runs PMD static analysis before every `git push` or `sf deploy`:

```bash
# This happens automatically via the hook, or manually:
sf scanner run --target force-app/ --engine pmd --format table
```

---

## Workflow 5: Performance Optimization -- Governor Audit to SOQL Tuning

Identify and fix performance bottlenecks in an existing Salesforce codebase.

### Step 1 -- Run the Governor Audit

```
/sf-governor-limits Scan force-app/main/default/classes/ for governor limit risks
```

**Agent invoked**: `sf-apex-agent`

**What happens**: The agent scans all Apex classes and triggers for:

- SOQL queries inside loops (CRITICAL)
- DML operations inside loops (CRITICAL)
- HTTP callouts inside loops (CRITICAL)
- Async operations inside loops (HIGH)
- Non-bulkified trigger patterns (HIGH)
- Schema describe calls in loops (MEDIUM)
- Deeply nested loops (3+ levels) (MEDIUM)
- Unbounded SOQL on large standard objects (LOW)

**Expected output**:

```
Governor Limit Audit
====================
Files scanned: 42 (.cls + .trigger)
Test classes skipped: 18

CRITICAL (3):
  OrderProcessor.cls:67 -- SOQL query inside for loop (will hit 100 SOQL limit)
    Fix: Move query before the loop and use a Map for lookups
  OrderProcessor.cls:89 -- DML inside for loop (will hit 150 DML limit)
    Fix: Collect records in a List and perform DML after the loop
  IntegrationSync.cls:34 -- HTTP callout inside while loop (will hit 100 callout limit)
    Fix: Batch callouts or use Queueable for async processing

HIGH (2):
  AccountTrigger.trigger:5 -- Non-bulkified trigger: Trigger.new[0]
    Fix: Iterate over Trigger.new to handle bulk operations
  NotificationService.cls:23 -- System.enqueueJob() inside loop
    Fix: Collect work items and enqueue a single Queueable after the loop

MEDIUM (1):
  ReportGenerator.cls:112 -- Loop nesting depth 3 -- high CPU time risk
    Fix: Refactor to reduce nesting or use Maps for lookups
```

### Step 2 -- Optimize SOQL Queries

```
/sf-soql-optimization Optimize the SOQL queries in OrderProcessor.cls
```

**Agent invoked**: `sf-apex-agent`

**What happens**: The agent refactors the code to move queries outside loops:

```apex
// Before (CRITICAL -- SOQL in loop)
for (Order__c order : orders) {
    List<OrderItem__c> items = [
        SELECT Id, Quantity__c, Product__c
        FROM OrderItem__c
        WHERE Order__c = :order.Id
    ];
    processItems(order, items);
}

// After (SAFE -- single query with Map lookup)
Set<Id> orderIds = new Map<Id, Order__c>(orders).keySet();
Map<Id, List<OrderItem__c>> itemsByOrder = new Map<Id, List<OrderItem__c>>();
for (OrderItem__c item : [
    SELECT Id, Quantity__c, Product__c, Order__c
    FROM OrderItem__c
    WHERE Order__c IN :orderIds
]) {
    if (!itemsByOrder.containsKey(item.Order__c)) {
        itemsByOrder.put(item.Order__c, new List<OrderItem__c>());
    }
    itemsByOrder.get(item.Order__c).add(item);
}

for (Order__c order : orders) {
    List<OrderItem__c> items = itemsByOrder.get(order.Id);
    if (items != null) {
        processItems(order, items);
    }
}
```

### Step 3 -- Fix the Trigger Bulkification

```
/sf-trigger-frameworks Refactor AccountTrigger to use a handler pattern with proper bulkification
```

**Agent invoked**: `sf-architect`

**What happens**: Converts the non-bulkified trigger into the thin-trigger-fat-handler pattern:

```apex
// AccountTrigger.trigger (thin)
trigger AccountTrigger on Account (
    before insert, before update, after insert, after update
) {
    AccountTriggerHandler handler = new AccountTriggerHandler();
    if (Trigger.isBefore && Trigger.isInsert) handler.onBeforeInsert(Trigger.new);
    if (Trigger.isBefore && Trigger.isUpdate) handler.onBeforeUpdate(Trigger.new, Trigger.oldMap);
    if (Trigger.isAfter && Trigger.isInsert) handler.onAfterInsert(Trigger.new);
    if (Trigger.isAfter && Trigger.isUpdate) handler.onAfterUpdate(Trigger.new, Trigger.oldMap);
}
```

### Step 4 -- Test with Bulk Data

Run tests that exercise the refactored code with 200 records (the standard trigger batch size):

```
/sf-apex-testing Run tests for OrderProcessor and AccountTriggerHandler with bulk data verification
```

```bash
sf apex run test --class-names OrderProcessorTest,AccountTriggerHandlerTest --target-org MyScratchOrg --code-coverage --result-format human --wait 10
```

**Hook activity**:

- `governor-check.js` fires after each edit to the Apex files, confirming the SOQL/DML-in-loop patterns are resolved.
- `quality-gate.js` fires after edits, confirming anti-patterns are cleaned up.

### Step 5 -- Re-Audit

```
/sf-governor-limits Re-scan force-app/ to verify all governor limit risks are resolved
```

**Expected output**:

```
Governor Limit Audit
====================
Files scanned: 42 (.cls + .trigger)
Test classes skipped: 18

CRITICAL: 0
HIGH: 0
MEDIUM: 1
  ReportGenerator.cls:112 -- Loop nesting depth 3 (existing, deferred to future sprint)

All critical and high severity findings resolved.
```

### Step 6 -- Performance Validation

```
/sf-governor-limits Run a comprehensive performance audit including SOQL query analysis
```

**Agent invoked**: `sf-apex-agent`

**What it checks beyond governor limits**:

- Query selectivity (indexed fields in WHERE clauses)
- Large data volume considerations (millions of records)
- Batch size recommendations
- Heap size projections for large result sets
- CPU time estimates for complex loops

**Expected outcome**: Performance report with recommendations for indexing, query plan optimization, and batch processing strategies.

---

## Summary: Commands, Agents, and Hooks by Workflow

| Workflow | Primary Commands | Agents Invoked | Key Hooks |
|---|---|---|---|
| Apex TDD | `/sf-tdd-workflow`, `/sf-apex-best-practices`, `/sf-governor-limits` | sf-apex-agent, sf-review-agent, sf-apex-agent | governor-check, quality-gate, post-write |
| LWC Development | `/sf-lwc-development`, `/sf-deployment` | sf-lwc-agent, sf-architect | post-write, post-edit-console-warn, sfdx-validate |
| Deployment Pipeline | `/sf-deployment`, `/sf-apex-testing`, `/sf-deployment` | sf-architect, sf-architect, sf-review-agent | session-start, sfdx-validate, post-bash-build-complete |
| Security Audit | `/sf-security`, `/sf-apex-best-practices` | sf-review-agent, sf-review-agent | governor-check, quality-gate, sfdx-scanner-check |
| Performance Optimization | `/sf-governor-limits`, `/sf-soql-optimization`, `/sf-trigger-frameworks`, `/sf-governor-limits` | sf-apex-agent, sf-apex-agent, sf-architect | governor-check, quality-gate, sfdx-validate |
