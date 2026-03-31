---
name: sf-e2e-testing
description: >-
  Use when writing Salesforce Apex end-to-end integration tests, deployment verification, or bulk scenario validation. Do NOT use for unit tests or TDD.
---

# Salesforce E2E Testing

Comprehensive testing patterns for Salesforce applications including Apex integration tests, LWC component tests, and deployment verification.

Reference: @../_reference/TESTING_STANDARDS.md

## When to Use

- When writing integration tests that exercise complete business workflows end-to-end
- When verifying full automation chains including triggers, flows, and queueable jobs
- When setting up pre-deployment verification test suites for a sandbox or production org
- When testing bulk scenarios with 200+ records across the full trigger and automation stack
- When building LWC integration tests with Jest that mock Apex wire adapters and calls

## Apex Integration Tests

```apex
@IsTest
private class OpportunityWorkflowTest {

    @TestSetup
    static void setup() {
        Account acc = new Account(Name = 'E2E Test Account');
        insert acc;

        Opportunity opp = new Opportunity(
            AccountId = acc.Id,
            Name = 'E2E Test Opp',
            StageName = 'Prospecting',
            CloseDate = Date.today().addDays(30),
            Amount = 50000
        );
        insert opp;
    }

    @IsTest
    static void shouldProgressThroughFullSalesCycle() {
        Opportunity opp = [SELECT Id, StageName FROM Opportunity LIMIT 1];

        Test.startTest();

        opp.StageName = 'Qualification';
        update opp;

        opp.StageName = 'Proposal/Price Quote';
        update opp;

        opp.StageName = 'Closed Won';
        update opp;

        Test.stopTest();

        Opportunity result = [SELECT StageName, IsClosed, IsWon FROM Opportunity WHERE Id = :opp.Id];
        Assert.areEqual('Closed Won', result.StageName);
        Assert.isTrue(result.IsClosed, 'Should be closed');
        Assert.isTrue(result.IsWon, 'Should be won');

        // Verify downstream automation fired
        List<Task> followUpTasks = [SELECT Id FROM Task WHERE WhatId = :opp.Id];
        Assert.isTrue(!followUpTasks.isEmpty(), 'Should have created follow-up tasks');
    }

    @IsTest
    static void shouldHandleBulkStageChanges() {
        List<Opportunity> opps = new List<Opportunity>();
        Account acc = [SELECT Id FROM Account LIMIT 1];
        for (Integer i = 0; i < 200; i++) {
            opps.add(new Opportunity(
                AccountId = acc.Id,
                Name = 'Bulk Opp ' + i,
                StageName = 'Prospecting',
                CloseDate = Date.today().addDays(30)
            ));
        }
        insert opps;

        Test.startTest();
        for (Opportunity opp : opps) {
            opp.StageName = 'Closed Won';
        }
        update opps;
        Test.stopTest();

        Integer closedCount = [SELECT COUNT() FROM Opportunity WHERE StageName = 'Closed Won'];
        Assert.isTrue(closedCount >= 200, 'All opportunities should be closed');
    }
}
```

## LWC Integration Tests

```javascript
import { createElement } from 'lwc';
import OpportunityPipeline from 'c/opportunityPipeline';
import getOpportunities from '@salesforce/apex/OpportunityController.getOpportunities';

jest.mock('@salesforce/apex/OpportunityController.getOpportunities', () => ({
    default: jest.fn()
}), { virtual: true });

const MOCK_OPPS = [
    { Id: '006xx0001', Name: 'Opp 1', StageName: 'Prospecting', Amount: 10000 },
    { Id: '006xx0002', Name: 'Opp 2', StageName: 'Closed Won', Amount: 50000 },
];

describe('c-opportunity-pipeline (integration)', () => {
    afterEach(() => { while (document.body.firstChild) document.body.removeChild(document.body.firstChild); });

    it('renders pipeline with correct stage grouping', async () => {
        getOpportunities.mockResolvedValue(MOCK_OPPS);
        const element = createElement('c-opportunity-pipeline', { is: OpportunityPipeline });
        document.body.appendChild(element);

        await Promise.resolve();
        await Promise.resolve();

        const stages = element.shadowRoot.querySelectorAll('.stage-column');
        expect(stages.length).toBeGreaterThan(0);
    });
});
```

## Deployment Verification

```bash
# Full E2E deployment verification
sf project deploy validate --test-level RunLocalTests --target-org staging
sf project deploy start --test-level RunLocalTests --target-org staging
sf apex run test --test-level RunLocalTests --result-format human --target-org staging
```

## Flow Integration Testing

```apex
@IsTest
private class CaseEscalationFlowTest {

    @IsTest
    static void shouldEscalateHighPriorityCases() {
        Account acc = new Account(Name = 'Flow E2E Account');
        insert acc;

        Case c = new Case(
            AccountId = acc.Id,
            Subject = 'Urgent Issue',
            Priority = 'High',
            Status = 'New'
        );
        insert c;

        Test.startTest();
        c.Status = 'Escalated';
        update c;
        Test.stopTest();

        List<Task> tasks = [SELECT Subject, Priority FROM Task WHERE WhatId = :c.Id AND Subject LIKE '%Escalation%'];
        Assert.isTrue(!tasks.isEmpty(), 'Flow should have created escalation task');
        Assert.areEqual('High', tasks[0].Priority, 'Task priority should match case priority');
    }
}
```

## Platform Event Testing

```apex
@IsTest
private class OrderEventTest {

    @IsTest
    static void shouldPublishEventOnOrderCompletion() {
        Order_Complete__e event = new Order_Complete__e(
            Order_Id__c = 'ORD-001',
            Total_Amount__c = 5000.00
        );

        Test.startTest();
        Database.SaveResult sr = EventBus.publish(event);
        Test.stopTest();

        Assert.isTrue(sr.isSuccess(), 'Event should publish successfully');
    }

    @IsTest
    static void shouldProcessEventInSubscriber() {
        Order_Complete__e event = new Order_Complete__e(
            Order_Id__c = 'ORD-002',
            Total_Amount__c = 10000.00
        );

        Test.startTest();
        EventBus.publish(event);
        Test.getEventBus().deliver(); // Force trigger subscriber to execute
        Test.stopTest();

        List<Fulfillment__c> fulfillments = [
            SELECT Order_Id__c FROM Fulfillment__c WHERE Order_Id__c = 'ORD-002'
        ];
        Assert.areEqual(1, fulfillments.size(), 'Subscriber should have created fulfillment');
    }
}
```

## Async Job Verification

```apex
@IsTest
private class AsyncWorkflowTest {

    @IsTest
    static void shouldProcessQueueableChain() {
        Account acc = new Account(Name = 'Async E2E');
        insert acc;

        Test.startTest();
        System.enqueueJob(new AccountEnrichmentJob(acc.Id));
        Test.stopTest();

        Account result = [SELECT Description, Industry FROM Account WHERE Id = :acc.Id];
        Assert.isNotNull(result.Description, 'Enrichment job should populate description');
    }
}
```

## Multi-User Testing

```apex
@IsTest
private class PermissionE2ETest {

    @IsTest
    static void shouldRestrictAccessForStandardUser() {
        // Note: Profile names are locale-dependent. For non-English orgs,
        // query by Profile.UserType or use a custom permission set.
        Profile stdProfile = [SELECT Id FROM Profile WHERE Name = 'Standard User'];
        User testUser = new User(
            Alias = 'stdu', Email = 'stduser@test.com',
            EmailEncodingKey = 'UTF-8', LastName = 'StdUser',
            LanguageLocaleKey = 'en_US', LocaleSidKey = 'en_US',
            ProfileId = stdProfile.Id, TimeZoneSidKey = 'America/Los_Angeles',
            UserName = 'stduser' + DateTime.now().getTime() + '@test.com'
        );
        insert testUser;

        System.runAs(testUser) {
            Test.startTest();
            try {
                ConfidentialRecord__c rec = new ConfidentialRecord__c(Name = 'Secret');
                insert rec;
                Assert.fail('Should have thrown insufficient access exception');
            } catch (DmlException e) {
                Assert.isTrue(e.getMessage().contains('INSUFFICIENT_ACCESS') ||
                             e.getMessage().contains('access'),
                             'Should get access denied: ' + e.getMessage());
            }
            Test.stopTest();
        }
    }
}
```

## Performance Assertions

```apex
@IsTest
private class PerformanceE2ETest {

    @IsTest
    static void shouldStayWithinGovernorLimits() {
        List<Account> accounts = new List<Account>();
        for (Integer i = 0; i < 200; i++) {
            accounts.add(new Account(Name = 'Perf Test ' + i));
        }
        insert accounts;

        Test.startTest();
        Integer queriesBefore = Limits.getQueries();

        AccountService.processAccounts(new Map<Id, Account>(accounts).keySet());

        Integer queriesUsed = Limits.getQueries() - queriesBefore;
        Test.stopTest();

        Assert.isTrue(queriesUsed <= 5,
            'Should use <= 5 SOQL queries for 200 records, used: ' + queriesUsed);
    }
}
```

## Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Testing with 1 record only | Misses bulkification bugs | Test with 200+ records |
| No Test.startTest/stopTest | Governor limits from setup count against test | Wrap test logic in startTest/stopTest |
| Using SeeAllData=true | Tests depend on org data, fail unpredictably | Use @TestSetup with test-specific data |
| Hardcoded IDs | Break across orgs and sandboxes | Query for IDs or use TestDataFactory |
| No downstream verification | Trigger fires but automation not verified | Assert on records created by automation |
| Ignoring async results | Queueable/Batch results not checked | Test.stopTest forces execution, then assert |

## Best Practices

- Use @TestSetup for shared test data across methods
- Test complete workflows, not just individual methods
- Include bulk tests (200+ records) for all trigger-based automation
- Test both happy path and error scenarios
- Verify downstream automation by checking created records
- Use Test.startTest()/Test.stopTest() to isolate governor limit counting
- Use Test.getEventBus().deliver() to force Platform Event subscriber execution
- Use System.runAs() to test permission and sharing model enforcement
- Assert governor limit consumption for performance-sensitive code
- For HTTP callout tests, use `Test.setMock(HttpCalloutMock.class, mock)` -- see the sf-integration skill for mock patterns

## Related

- **Constraints**: `sf-testing-constraints` -- test isolation rules, assertion requirements, coverage gates
