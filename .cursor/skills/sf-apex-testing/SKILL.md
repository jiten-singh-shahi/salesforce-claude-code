---
name: sf-apex-testing
description: >-
  Apex unit testing — test structure, TestDataFactory, governor limit testing, async testing, mocks, coverage. Use when writing tests or improving coverage. Do NOT use for TDD workflow or LWC Jest tests.
---

# Apex Testing

Procedures and patterns for writing effective Apex tests. Constraint rules (never/always lists for test isolation, assertions, SeeAllData) live in `sf-testing-constraints`. This skill covers the _how_ — test structure, factories, mocks, async testing, and coverage strategies.

Reference: @../_reference/TESTING_STANDARDS.md

---

## When to Use

- When writing test classes for new Apex code before deploying to production
- When existing tests pass but only cover happy paths
- When a deployment fails with "insufficient code coverage" errors
- When building mock patterns for callouts or dependency injection

> **Related:** For the TDD workflow (red-green-refactor process), see `sf-tdd-workflow`.

---

## @isTest Annotation

```apex
@isTest
private class AccountServiceTest {

    @TestSetup
    static void makeData() {
        // Runs once before any test method in this class
        // Each test method gets a fresh transaction with this data
    }

    @isTest
    static void testCreateAccount_validData_createsSuccessfully() {
        // Arrange / Act / Assert
    }
}
```

Test classes do not count toward coverage calculations but DO count toward the 6 MB Apex code character limit. Use `@TestVisible` to make private members accessible in tests without changing access modifiers.

---

## @TestSetup

Runs once per test class. Each test method gets its own database rollback, so modifications in one test do not bleed into another.

```apex
@TestSetup
static void makeData() {
    Account acc = new Account(
        Name              = 'Test Corp',
        Type              = 'Customer',
        AnnualRevenue     = 1000000,
        Customer_Tier__c  = 'Standard'
    );
    insert acc;

    List<Opportunity> opps = new List<Opportunity>();
    for (Integer i = 0; i < 10; i++) {
        opps.add(new Opportunity(
            Name       = 'Test Opp ' + i,
            AccountId  = acc.Id,
            StageName  = i < 5 ? 'Prospecting' : 'Qualification',
            CloseDate  = Date.today().addDays(30 + i),
            Amount     = 5000 * (i + 1)
        ));
    }
    insert opps;
}
```

---

## TestDataFactory Pattern

A central factory class creates test records consistently across the test suite, preventing duplicated record-creation logic.

```apex
@isTest
public class TestDataFactory {

    public static Account createAccount() {
        return createAccount(new Map<String, Object>());
    }

    public static Account createAccount(Map<String, Object> overrides) {
        Account acc = new Account(
            Name              = 'Test Account ' + generateUniqueString(),
            Type              = 'Customer',
            Industry          = 'Technology',
            AnnualRevenue     = 500000,
            Customer_Tier__c  = 'Standard'
        );
        applyOverrides(acc, overrides);
        insert acc;
        return acc;
    }

    public static List<Account> createAccounts(Integer count) {
        List<Account> accounts = new List<Account>();
        for (Integer i = 0; i < count; i++) {
            accounts.add(new Account(
                Name             = 'Bulk Test Account ' + i,
                Type             = 'Customer',
                Customer_Tier__c = 'Standard'
            ));
        }
        insert accounts;
        return accounts;
    }

    public static User createUserWithProfile(String profileName) {
        Profile p = [SELECT Id FROM Profile WHERE Name = :profileName LIMIT 1];
        User u = new User(
            Alias            = 'tstuser',
            Email            = generateUniqueString() + '@testfactory.example.com',
            EmailEncodingKey = 'UTF-8',
            LastName         = 'Testing',
            LanguageLocaleKey = 'en_US',
            LocaleSidKey     = 'en_US',
            ProfileId        = p.Id,
            TimeZoneSidKey   = 'America/Los_Angeles',
            UserName         = generateUniqueString() + '@testfactory.example.com'
        );
        insert u;
        return u;
    }

    private static Integer uniqueCounter = 0;

    private static String generateUniqueString() {
        return String.valueOf(++uniqueCounter) + '_' +
               String.valueOf(Datetime.now().getTime()).right(6);
    }

    private static void applyOverrides(SObject record, Map<String, Object> overrides) {
        for (String fieldName : overrides.keySet()) {
            record.put(fieldName, overrides.get(fieldName));
        }
    }
}
```

---

## Test Structure: Arrange-Act-Assert

Every test method follows three phases with a blank line between them.

```apex
@isTest
static void testCalculateDiscount_premiumTier_returns20Percent() {
    // Arrange
    Account acc = TestDataFactory.createAccount(
        new Map<String, Object>{ 'Customer_Tier__c' => 'Premium' }
    );
    Decimal orderAmount = 10000;

    // Act
    Test.startTest();
    Decimal discount = DiscountCalculator.calculate(acc.Id, orderAmount);
    Test.stopTest();

    // Assert
    Assert.areEqual(2000, discount,
        'Premium tier accounts should receive a 20% discount on $10,000 orders');
}
```

### Test Method Naming

Format: `test{MethodName}_{scenario}_{expectedResult}`

```
testCalculateDiscount_premiumTier_returns20Percent()
testCalculateDiscount_nullAmount_returnsZero()
testCreateAccount_duplicateName_addsFieldError()
```

---

## Governor Limit Testing

Always test with 200 records (standard trigger batch size). A method that works with 1 record may fail at governor limits with 200.

```apex
@isTest
static void testTrigger_bulkInsert_staysWithinLimits() {
    List<Account> accounts = TestDataFactory.createAccounts(200);

    List<Account> processed = [
        SELECT Id, Customer_Tier__c FROM Account
        WHERE Id IN :new Map<Id, Account>(accounts).keySet()
    ];

    System.assertEquals(200, processed.size(), 'All 200 accounts should be present');
}
```

Use `Test.startTest()` / `Test.stopTest()` to reset governor limit counters, giving the code under test a fresh limit context.

---

## Exception Testing

```apex
@isTest
static void testUpgradeToPremium_insufficientRevenue_throwsUpgradeException() {
    Account acc = TestDataFactory.createAccount(
        new Map<String, Object>{ 'AnnualRevenue' => 10000 }
    );

    Test.startTest();
    try {
        AccountsService.upgradeToPremium(new Set<Id>{ acc.Id });
        Assert.fail('Expected UpgradeException was not thrown');
    } catch (AccountsService.UpgradeException e) {
        Assert.isTrue(
            e.getMessage().contains('Annual revenue must be at least'),
            'Exception message should explain the reason. Got: ' + e.getMessage()
        );
    }
    Test.stopTest();
}
```

Use the `Assert` class (see @../_reference/API_VERSIONS.md for minimum version): `Assert.areEqual`, `Assert.isTrue`, `Assert.isNotNull`, `Assert.fail`.

---

## Permission Testing with System.runAs

```apex
@isTest
static void testViewRestrictedReport_standardUser_throwsException() {
    User standardUser = TestDataFactory.createUserWithProfile('Standard User');
    Restricted_Report__c report = new Restricted_Report__c(Name = 'Confidential Q4');
    insert report;

    Test.startTest();
    System.runAs(standardUser) {
        try {
            ReportService.viewReport(report.Id);
            Assert.fail('Standard user should not be able to view restricted reports');
        } catch (ReportService.AccessDeniedException e) {
            Assert.isTrue(true, 'Expected AccessDeniedException thrown correctly');
        }
    }
    Test.stopTest();
}
```

---

## Async Testing

### @future and Queueable

`Test.startTest()` / `Test.stopTest()` forces @future and Queueable jobs to execute synchronously.

```apex
@isTest
static void testFutureCallout_sendsRequest() {
    Test.setMock(HttpCalloutMock.class, new MockERPCallout(200, '{"status":"ok"}'));
    Account acc = TestDataFactory.createAccount();

    Test.startTest();
    ExternalDataSync.syncAccountToERP(acc.Id);
    Test.stopTest();

    List<Integration_Error_Log__c> errors = [
        SELECT Id FROM Integration_Error_Log__c WHERE Account__c = :acc.Id
    ];
    System.assertEquals(0, errors.size(), 'No errors should be logged');
}
```

### Batch Apex

```apex
@isTest
static void testBatch_processesAllRecords() {
    // insert 200 records
    Test.startTest();
    Database.executeBatch(new AccountAnnualReviewBatch(), 200);
    Test.stopTest(); // start(), execute(), finish() all run synchronously
    // Assert results
}
```

---

## Mock Patterns

### HttpCalloutMock

```apex
@isTest
public class MockERPCallout implements HttpCalloutMock {
    private Integer statusCode;
    private String responseBody;

    public MockERPCallout(Integer statusCode, String responseBody) {
        this.statusCode   = statusCode;
        this.responseBody = responseBody;
    }

    public HttpResponse respond(HttpRequest req) {
        HttpResponse res = new HttpResponse();
        res.setStatusCode(statusCode);
        res.setBody(responseBody);
        res.setHeader('Content-Type', 'application/json');
        return res;
    }
}
```

### Multi-Callout Mock

```apex
@isTest
public class MultiCalloutMock implements HttpCalloutMock {
    private Map<String, HttpResponse> responses = new Map<String, HttpResponse>();

    public MultiCalloutMock addResponse(String urlPattern, Integer statusCode, String body) {
        HttpResponse res = new HttpResponse();
        res.setStatusCode(statusCode);
        res.setBody(body);
        responses.put(urlPattern, res);
        return this;
    }

    public HttpResponse respond(HttpRequest req) {
        for (String pattern : responses.keySet()) {
            if (req.getEndpoint().contains(pattern)) {
                return responses.get(pattern);
            }
        }
        throw new CalloutException('No mock response configured for: ' + req.getEndpoint());
    }
}
```

### Stub API (System.StubProvider)

For mocking dependencies without HTTP, use the `System.StubProvider` interface with `Test.createStub()`.

```apex
IAccountsSelector mockSelector = (IAccountsSelector)
    Test.createStub(IAccountsSelector.class, new MockAccountsSelector(mockAccounts));
```

> **Note:** The instance field must be typed as the interface (e.g., `IAccountsSelector`), not the concrete class. Casting a stub proxy to a concrete class throws TypeException at runtime.

---

## Coverage Strategy

Line coverage is misleading. A method with an `if` statement can show 100% line coverage if you only test the `true` branch. Test every branch.

```apex
// This method has 4 branches — test each:
// 1. testCalculateDiscount_premiumTier
// 2. testCalculateDiscount_standardTier
// 3. testCalculateDiscount_unknownTier (else)
// 4. testCalculateDiscount_nullTier
public Decimal calculateDiscount(String tier, Decimal amount) {
    if (tier == 'Premium') return amount * 0.20;
    else if (tier == 'Standard') return amount * 0.10;
    else return 0;
}
```

---

## RunRelevantTests and @testFor (Spring '26)

> Requires the minimum API version for this feature (see @../_reference/API_VERSIONS.md). If `sfdx-project.json` specifies a `sourceApiVersion` below it, `RunRelevantTests` silently falls back to `RunLocalTests`.

`@testFor` explicitly declares which production class a test class covers, improving `RunRelevantTests` selection accuracy.

```apex
@isTest
@testFor(AccountService)
private class AccountServiceTest {
    // tests for AccountService
}
```

**Rules:** Reference any top-level Apex class (not inner classes). Cannot be placed on non-test classes. Use separate test classes for each target — Apex does not support stacking duplicate annotations.

---

## Related

- **Agent**: `sf-apex-agent` — For interactive, in-depth guidance
- **Skills**: `sf-tdd-workflow` — TDD workflow for Apex

### Guardrails

- `sf-testing-constraints` — Enforces test isolation, assertion requirements, SeeAllData prohibition, and coverage thresholds
