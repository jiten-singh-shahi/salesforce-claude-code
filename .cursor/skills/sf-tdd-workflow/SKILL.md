---
name: sf-tdd-workflow
description: >-
  Use when doing test-driven Salesforce Apex development — RED-GREEN-REFACTOR cycle for classes, triggers, and LWC Jest. Do NOT use for test patterns only.
disable-model-invocation: true
---

# Salesforce TDD Workflow

The test-driven development process adapted for the Salesforce platform. Test implementation patterns (mocks, factories, coverage strategies) live in `sf-apex-testing`. This skill covers the TDD _process_ — RED-GREEN-REFACTOR cycle and how to apply it to Apex, LWC, and Flows.

Reference: @../_reference/TESTING_STANDARDS.md

---

## When to Use

- When starting new Apex class or trigger development using the RED-GREEN-REFACTOR cycle
- When writing LWC Jest tests before building component logic
- When refactoring existing untested Apex code and needing a safety net
- When establishing TDD practices and coverage targets for a team
- When adding tests for a class below the 75% coverage deployment requirement

> **Related:** For test implementation details (@TestSetup, mocks, bulk testing, coverage), see `sf-apex-testing`.

---

## Core Workflow: RED-GREEN-REFACTOR

### Step 1: RED — Write Failing Tests First

Write the test before the production code exists. The test should compile but fail.

**Apex:**

```apex
@IsTest
private class AccountServiceTest {

    @TestSetup
    static void makeData() {
        Account acc = new Account(Name = 'Test Account', Industry = 'Technology');
        insert acc;
    }

    @IsTest
    static void shouldCalculateAnnualRevenue() {
        Account acc = [SELECT Id FROM Account LIMIT 1];

        Test.startTest();
        Decimal revenue = AccountService.calculateAnnualRevenue(acc.Id);
        Test.stopTest();

        Assert.isNotNull(revenue, 'Revenue should not be null');
        Assert.isTrue(revenue >= 0, 'Revenue should be non-negative');
    }

    @IsTest
    static void shouldHandleNullInput() {
        Test.startTest();
        try {
            AccountService.calculateAnnualRevenue(null);
            Assert.fail('Should have thrown exception');
        } catch (AccountService.AccountServiceException e) {
            Assert.isTrue(e.getMessage().contains('Account Id'),
                'Error should mention Account Id');
        }
        Test.stopTest();
    }

    @IsTest
    static void shouldHandleBulkRecords() {
        List<Account> accounts = new List<Account>();
        for (Integer i = 0; i < 200; i++) {
            accounts.add(new Account(Name = 'Bulk Test ' + i));
        }
        insert accounts;

        Test.startTest();
        List<Decimal> revenues = AccountService.calculateAnnualRevenueBulk(
            new Map<Id, Account>(accounts).keySet()
        );
        Test.stopTest();

        System.assertEquals(200, revenues.size(), 'Should process all 200 records');
    }
}
```

**LWC Jest:**

```javascript
import { createElement } from 'lwc';
import AccountCard from 'c/accountCard';
import getAccount from '@salesforce/apex/AccountController.getAccount';

jest.mock('@salesforce/apex/AccountController.getAccount',
    () => ({ default: jest.fn() }), { virtual: true });

describe('c-account-card', () => {
    afterEach(() => {
        while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
    });

    it('displays account name when data is loaded', async () => {
        getAccount.mockResolvedValue({ Name: 'Acme Corp', Industry: 'Technology' });
        const element = createElement('c-account-card', { is: AccountCard });
        element.recordId = '001xx000003ABCDEF';
        document.body.appendChild(element);

        await Promise.resolve();
        const nameEl = element.shadowRoot.querySelector('.account-name');
        expect(nameEl.textContent).toBe('Acme Corp');
    });
});
```

### Step 2: GREEN — Implement Minimum Code

Write only enough code to make the tests pass. No premature optimization.

### Step 3: REFACTOR — Clean Up

- Extract common patterns into utility classes
- Apply enterprise patterns (Service Layer, Selector Layer) if warranted
- Ensure bulkification
- Run full test suite to verify no regressions

---

## Trigger TDD

Create the handler class stub first (empty method signatures so the test compiles), then write the test, then implement the handler, then wire the trigger.

```apex
// RED: Write test for trigger handler
@IsTest
private class AccountTriggerHandlerTest {

    @IsTest
    static void shouldSetDefaultIndustryOnInsert() {
        Account acc = new Account(Name = 'TDD Account');

        Test.startTest();
        insert acc;
        Test.stopTest();

        Account result = [SELECT Industry FROM Account WHERE Id = :acc.Id];
        System.assertEquals('Other', result.Industry, 'Should default Industry to Other');
    }

    @IsTest
    static void shouldNotOverrideExistingIndustry() {
        Account acc = new Account(Name = 'TDD Account', Industry = 'Technology');

        Test.startTest();
        insert acc;
        Test.stopTest();

        Account result = [SELECT Industry FROM Account WHERE Id = :acc.Id];
        System.assertEquals('Technology', result.Industry, 'Should keep existing Industry');
    }
}

// GREEN: Implement handler
public with sharing class AccountTriggerHandler {
    public static void onBeforeInsert(List<Account> newAccounts) {
        for (Account acc : newAccounts) {
            if (acc.Industry == null) acc.Industry = 'Other';
        }
    }
}

// Wire trigger (last step)
trigger AccountTrigger on Account (before insert) {
    AccountTriggerHandler.onBeforeInsert(Trigger.new);
}
```

---

## Async TDD Patterns

### Queueable TDD

```apex
@IsTest
private class AccountEnrichmentJobTest {

    @IsTest
    static void shouldEnrichAccountsWithExternalData() {
        Account acc = new Account(Name = 'Enrich Me', BillingCity = 'San Francisco');
        insert acc;

        Test.startTest();
        System.enqueueJob(new AccountEnrichmentJob(new Set<Id>{ acc.Id }));
        Test.stopTest(); // Forces Queueable to execute synchronously

        Account result = [SELECT Description FROM Account WHERE Id = :acc.Id];
        System.assertNotEquals(null, result.Description, 'Should have enrichment data');
    }
}
```

### Batch TDD

```apex
@IsTest
private class DataCleanupBatchTest {

    @IsTest
    static void shouldDeactivateStaleAccounts() {
        List<Account> accounts = new List<Account>();
        for (Integer i = 0; i < 200; i++) {
            accounts.add(new Account(Name = 'Stale ' + i));
        }
        insert accounts;

        // Create old Tasks so LastActivityDate is set automatically
        List<Task> oldTasks = new List<Task>();
        for (Account acc : accounts) {
            oldTasks.add(new Task(
                WhatId = acc.Id, Subject = 'Old Activity',
                ActivityDate = Date.today().addDays(-365), Status = 'Completed'
            ));
        }
        insert oldTasks;

        Test.startTest();
        Database.executeBatch(new DataCleanupBatch(), 200);
        Test.stopTest();

        Integer activeCount = [SELECT COUNT() FROM Account
            WHERE Active__c = 'Yes' AND Name LIKE 'Stale%'];
        Assert.areEqual(0, activeCount, 'All stale accounts should be deactivated');
    }
}
```

---

## Flow Testing in TDD

Test Flows by triggering them through DML and verifying outcomes.

```apex
@IsTest
private class OpportunityFlowTest {

    @IsTest
    static void shouldCreateFollowUpTaskWhenOppClosedWon() {
        Account acc = new Account(Name = 'Flow Test');
        insert acc;

        Opportunity opp = new Opportunity(
            AccountId = acc.Id, Name = 'Flow Test Opp',
            StageName = 'Prospecting', CloseDate = Date.today().addDays(30)
        );
        insert opp;

        Test.startTest();
        opp.StageName = 'Closed Won';
        update opp;
        Test.stopTest();

        List<Task> tasks = [SELECT Subject FROM Task WHERE WhatId = :opp.Id];
        System.assert(!tasks.isEmpty(), 'Flow should have created a follow-up task');
    }
}
```

---

## TDD in CI/CD Pipeline

```yaml
# GitHub Actions: Run TDD suite on every PR
- name: Run Apex Tests and Check Coverage
  run: |
    sf apex run test \
      --test-level RunLocalTests \
      --code-coverage \
      --result-format json \
      --wait 15 \
      --output-dir test-results \
      --target-org ci-scratch

    RESULT_FILE=$(ls test-results/test-run-*.json 2>/dev/null | head -1)
    if [ -z "$RESULT_FILE" ]; then
      echo "No test result file found"
      exit 1
    fi
    COVERAGE=$(node -e "const r=JSON.parse(require('fs').readFileSync('$RESULT_FILE','utf8')); \
      console.log(r.result?.summary?.orgWideCoverage?.replace('%',''))")
    echo "Org-wide coverage: ${COVERAGE}%"
    node -e "if (parseFloat('$COVERAGE') < 75) { process.exit(1); }"
```

---

## Coverage Targets

| Type | Minimum | Target |
|------|---------|--------|
| Apex Classes | 75% | 85%+ |
| Apex Triggers | 75% | 90%+ |
| LWC Components | N/A | 80%+ |
| Integration Tests | N/A | Key paths |

---

## Common TDD Mistakes

| Mistake | Problem | Fix |
|---------|---------|-----|
| Testing platform behavior | Tests Salesforce, not your code | Test business logic outcomes only |
| Testing getters/setters | No business value | Skip trivial accessors |
| No bulk test | Passes with 1 record, fails with 200 | Always include 200+ record test |
| Hardcoded record IDs | Breaks across orgs | Use @TestSetup or TestDataFactory |
| Skipping negative tests | Misses error handling gaps | Test invalid input, missing permissions |
| Testing inside try/catch without re-throw | Test passes even when assertion fails | Use `Assert.fail('Should have thrown')` pattern |

---

## Related

- **Agent**: `sf-tdd-guide` — For interactive, in-depth guidance
- **Skills**: `sf-apex-testing` — Test implementation patterns

### Constraints

- `sf-testing-constraints` — Enforces test isolation, assertion requirements, SeeAllData prohibition, and coverage thresholds
