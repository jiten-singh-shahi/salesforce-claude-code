# Testing Standards — Salesforce Reference

> Last verified: API v66.0 (Spring '26)
> Source: <https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_testing.htm>

## Coverage Requirements

| Context | Minimum Coverage | Recommended Target |
|---|---|---|
| Production deployment | 75% org-wide | 85%+ per class |
| Managed package (AppExchange) | 75% org-wide | 90%+ per class |
| Per-class (not enforced but tracked) | 0% | 80%+ |

Coverage measures **lines executed**, not branches tested. 100% line coverage can still miss branches in `if/else` statements.

## Core Annotations

| Annotation | Scope | Purpose |
|---|---|---|
| `@IsTest` / `@isTest` | Class or method | Marks code as test-only (not counted toward coverage) |
| `@TestSetup` | Method | Runs once per class; each test method gets its own rollback |
| `@TestVisible` | Field or method | Makes private members accessible in tests without changing access modifiers |
| `@testFor(ClassName)` | Class (v66.0+) | Explicitly maps test class to production class for `RunRelevantTests` |

## Test Class Rules

| Rule | Detail |
|---|---|
| Test classes deploy to production | They DO count toward the 6 MB Apex code size limit |
| Test classes are excluded from coverage | They are not included in coverage calculations |
| `@TestSetup` data is isolated per method | Each test method gets a fresh transaction with setup data |
| No `SeeAllData=true` | Exception: Pricebook-dependent tests only |
| No hardcoded Record IDs | IDs differ between orgs and sandboxes |

## Test.startTest() / Test.stopTest()

| Behavior | Detail |
|---|---|
| `Test.startTest()` | Resets all governor limit counters — fresh budget for code under test |
| `Test.stopTest()` | Async work (@future, Queueable, Batch) enqueued inside the block runs synchronously here |
| Scope | Only one `startTest/stopTest` pair per test method |

## TestDataFactory Pattern

A central `@IsTest` factory class that creates test records consistently across the test suite. Benefits:

- Prevents duplicated record-creation logic across test classes
- Ensures valid test data with all required fields populated
- Supports override maps for scenario-specific field values
- Centralizes maintenance when field requirements change

## Test Method Naming

Format: `test{MethodName}_{scenario}_{expectedResult}`

Examples:

- `testCalculateDiscount_premiumTier_returns20Percent()`
- `testCreateAccount_duplicateName_throwsException()`
- `testProcessOrders_emptyList_noExceptionThrown()`

## Assertion API

| API | Minimum Version | Notes |
|---|---|---|
| `Assert.areEqual()`, `Assert.isTrue()`, `Assert.fail()` | v56.0+ | Preferred — clearer method names |
| `System.assertEquals()`, `System.assert()` | All versions | Legacy — still valid |

Every test method must have at least one meaningful assertion. Asserting only that a record was inserted is insufficient — assert specific field values and business logic outcomes.

## Bulk Testing

Always test with **200 records** (the standard trigger batch size). A method that works with 1 record may fail at governor limits with 200.

## Mock Patterns

| Pattern | Use Case |
|---|---|
| `HttpCalloutMock` | Mock HTTP callouts in test context |
| `System.StubProvider` | Mock arbitrary interfaces without HTTP |
| `Test.setMock()` | Register the mock before the code under test runs |

## RunRelevantTests (Spring '26, API v66.0+)

Smart test-selection mode that runs only tests statistically linked to changed Apex classes. Pair with `@testFor` for explicit mapping. Falls back to `RunLocalTests` if `sourceApiVersion` < 66.0.

## Anti-Patterns

| Anti-Pattern | Problem | Fix |
|---|---|---|
| No assertions | Test always passes | Every test needs meaningful assertions |
| `SeeAllData=true` | Brittle, fails on sandbox refresh | Create data in test |
| One method testing 10 scenarios | Masks which scenario fails | One scenario per test method |
| Hardcoded IDs | Fails in other orgs | Query or create records |
| Missing `@testFor` | RunRelevantTests may skip test | Add `@testFor(ClassName)` |
| No bulk test (200 records) | Governor limit violations hidden | Test with 200 records |
