---
name: sf-testing-constraints
description: >-
  Enforce Apex testing standards — 75% coverage minimum, test isolation, assertions, TestDataFactory. Use when writing or reviewing ANY Apex test class or method. Do NOT use for LWC Jest or Flow tests.
---

# Apex Testing Constraints

## When to Use

This skill auto-activates when writing, reviewing, or modifying any Apex test class or method. It enforces coverage minimums, test isolation, assertion requirements, and TestDataFactory patterns for all test artifacts.

Hard rules for every Apex test class and method. Violating any NEVER rule is a blocking defect. Violating any ALWAYS rule requires justification in a code comment.

Reference: @../_reference/TESTING_STANDARDS.md

---

## NEVER Rules

These are non-negotiable. Flag violations immediately.

### N1 — Never use `@isTest(SeeAllData=true)`

Tests must create their own data. `SeeAllData=true` couples tests to org state and breaks on every sandbox refresh. **Sole exception:** Standard Pricebook tests (prefer `Test.getStandardPricebookId()` even then).

```apex
// VIOLATION
@isTest(SeeAllData=true)
private class BadTest { ... }

// CORRECT
@isTest
private class GoodTest { ... }
```

### N2 — Never write a test without assertions

A test method with zero assertions always passes and catches nothing. Every `@isTest` method must contain at least one meaningful assertion that verifies business logic, not just that DML succeeded.

```apex
// VIOLATION — no assertion
@isTest
static void testCreate() {
    Account a = new Account(Name = 'X');
    insert a;
    // method ends without any assert
}

// CORRECT — asserts business outcome
@isTest
static void testCreate_setsDefaultTier() {
    Account a = new Account(Name = 'X');
    insert a;
    Account result = [SELECT Customer_Tier__c FROM Account WHERE Id = :a.Id];
    Assert.areEqual('Standard', result.Customer_Tier__c,
        'Trigger should set default tier on insert');
}
```

### N3 — Never hardcode Record IDs

IDs differ between orgs, sandboxes, and scratch orgs. Hardcoded IDs cause silent test failures after a refresh.

```apex
// VIOLATION
Id accountId = '0015g00000ABC12AAA';

// CORRECT
Account acc = TestDataFactory.createAccount();
Id accountId = acc.Id;
```

### N4 — Never test only SOQL

A test that queries records without exercising any service, trigger, or business logic method is not a test. It verifies that Salesforce can read its own database.

```apex
// VIOLATION — tests the platform, not your code
@isTest
static void testQuery() {
    insert new Account(Name = 'X');
    List<Account> accs = [SELECT Id FROM Account];
    Assert.areEqual(1, accs.size());
}
```

### N5 — Never use `System.debug` as a substitute for assertions

Debug statements produce no test signal. They cannot fail and cannot catch regressions.

### N6 — Never test multiple unrelated scenarios in one method

One scenario per test method. Multi-scenario methods mask which scenario broke.

---

## ALWAYS Rules

Required in every test class unless explicitly justified.

### A1 — Always use `@TestSetup` for shared test data

Runs once per class; each test method gets its own rollback. Omitting it duplicates DML and wastes governor limits.

```apex
@TestSetup
static void makeData() {
    Account acc = TestDataFactory.createAccount();
    TestDataFactory.createOpportunity(acc.Id);
}
```

### A2 — Always use TestDataFactory

All test record creation goes through a centralized `TestDataFactory` class. Inline `new SObject(...)` / `insert` is acceptable only for one-off scenario overrides the factory cannot express. Single maintenance point, override maps, consistent defaults.

### A3 — Always assert positive AND negative cases

Every service method needs at least:

- One positive test (valid input produces expected output)
- One negative test (invalid input throws expected exception or returns expected error)

```apex
// Positive
@isTest
static void testUpgrade_validAccount_succeeds() { ... }

// Negative
@isTest
static void testUpgrade_insufficientRevenue_throwsException() { ... }
```

### A4 — Always include a bulk test with 200+ records

200 is the standard trigger batch size. Code that passes with 1 record can hit governor limits at 200. Every trigger handler and service method operating on collections must have a 200-record test.

```apex
@isTest
static void testHandler_bulkInsert_200Records_noLimitException() {
    List<Account> accounts = TestDataFactory.createAccounts(200);
    // Trigger already fired on insert; verify outcomes
    Assert.areEqual(200,
        [SELECT COUNT() FROM Account WHERE Customer_Tier__c = 'Standard'],
        'All 200 accounts should have default tier set');
}
```

### A5 — Always use `Test.startTest()` / `Test.stopTest()`

Resets governor limit counters and forces async work (@future, Queueable, Batch) to execute synchronously. One pair per test method.

### A6 — Always use descriptive test method names

Format: `test{MethodName}_{scenario}_{expectedResult}` (e.g., `testCalculateDiscount_premiumTier_returns20Percent`).

### A7 — Always add `@testFor` on test classes (see @../_reference/API_VERSIONS.md for minimum version)

Maps test classes to production classes for `RunRelevantTests`. Missing `@testFor` means the test may be skipped on relevant changes.

---

## Anti-Pattern Quick Reference

| # | Anti-Pattern | Why It Breaks | Required Fix |
|---|---|---|---|
| N1 | `SeeAllData=true` | Fails on sandbox refresh; couples test to org data | Create test data via TestDataFactory |
| N2 | No assertions | Test always passes; catches zero regressions | Add `Assert.areEqual` / `Assert.isTrue` for business logic |
| N3 | Hardcoded Record IDs | IDs differ between orgs | Query or create records in test |
| N4 | SOQL-only test | Tests the platform, not your code | Exercise a service/trigger method, then assert outcomes |
| N5 | `System.debug` instead of assert | No test signal; cannot fail | Replace with assertions |
| N6 | One method, 10 scenarios | Masks which scenario fails | One scenario per test method |
| A1 | No `@TestSetup` | Duplicated DML, wasted governor limits | Add `@TestSetup` with TestDataFactory calls |
| A2 | Inline record creation | Maintenance burden when fields change | Use TestDataFactory with override maps |
| A3 | Only happy-path tests | Error handling never verified | Add negative-case tests |
| A4 | No bulk test | Governor limit violations hidden | Test with 200 records |
| A5 | Missing `startTest/stopTest` | Governor limits not reset; async not executed | Wrap code under test in the pair |
| A6 | Vague method names | Cannot identify failing scenario from name | Use `test{Method}_{scenario}_{expected}` format |
| A7 | Missing `@testFor` | `RunRelevantTests` may skip the test | Add `@testFor(ClassName)` annotation |

---

## Coverage Targets

| Context | Minimum | Recommended |
|---|---|---|
| Production deployment (org-wide) | 75% | 85%+ per class |
| Managed package (AppExchange) | 75% | 90%+ per class |
| Triggers | 75% | 90%+ |

Coverage measures lines executed, not branches. Test every branch, not just every line.

## Related

- `sf-apex-testing` — Full test implementation patterns (mocks, async, permissions)
- `sf-tdd-workflow` — RED-GREEN-REFACTOR process and TDD workflow
- @../_reference/TESTING_STANDARDS.md — Platform testing standards (see @../_reference/API_VERSIONS.md)
