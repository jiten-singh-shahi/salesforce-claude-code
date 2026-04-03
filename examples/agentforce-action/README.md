# Agentforce Custom Action

Custom Agentforce action using `@InvocableMethod` with structured inputs/outputs for Flow and Agent integration. Requires API version 66.0+ (Spring '26).

## When to Use This Pattern

- Building custom actions for Agentforce agents
- Exposing Apex logic to Flows as invocable actions
- Creating reusable automation building blocks with typed inputs and outputs
- Integrating external services into Agentforce conversations

## Structure

```text
force-app/main/default/
  classes/
    CreateCaseAction.cls            # Invocable action class
    CreateCaseAction_Test.cls       # Test class with mock data
```

## Invocable Action Class

```apex
public with sharing class CreateCaseAction {

    public class ActionInput {
        @InvocableVariable(required=true label='Subject' description='Case subject line')
        public String subject;

        @InvocableVariable(required=true label='Description' description='Detailed case description')
        public String description;

        @InvocableVariable(label='Priority' description='Case priority: Low, Medium, High, Critical')
        public String priority;

        @InvocableVariable(label='Account ID' description='Related account ID')
        public Id accountId;

        @InvocableVariable(label='Contact ID' description='Related contact ID')
        public Id contactId;
    }

    public class ActionOutput {
        @InvocableVariable(label='Case ID' description='ID of the created case')
        public Id caseId;

        @InvocableVariable(label='Case Number' description='Auto-generated case number')
        public String caseNumber;

        @InvocableVariable(label='Success' description='Whether the action succeeded')
        public Boolean success;

        @InvocableVariable(label='Error Message' description='Error details if action failed')
        public String errorMessage;
    }

    @InvocableMethod(
        label='Create Support Case'
        description='Creates a new support case from Agentforce or Flow input'
        category='Support'
    )
    public static List<ActionOutput> createCase(List<ActionInput> inputs) {
        List<ActionOutput> outputs = new List<ActionOutput>();

        for (ActionInput input : inputs) {
            ActionOutput output = new ActionOutput();
            try {
                Case newCase = new Case(
                    Subject = input.subject,
                    Description = input.description,
                    Priority = String.isNotBlank(input.priority) ? input.priority : 'Medium',
                    Status = 'New',
                    Origin = 'Agentforce',
                    AccountId = input.accountId,
                    ContactId = input.contactId
                );
                insert newCase;

                // Re-query for auto-generated fields
                newCase = [SELECT Id, CaseNumber FROM Case WHERE Id = :newCase.Id LIMIT 1];

                output.caseId = newCase.Id;
                output.caseNumber = newCase.CaseNumber;
                output.success = true;
            } catch (Exception e) {
                output.success = false;
                output.errorMessage = e.getMessage();
            }
            outputs.add(output);
        }

        return outputs;
    }
}
```

## Test Class

```apex
@IsTest
private class CreateCaseAction_Test {

    @TestSetup
    static void setupData() {
        Account testAccount = new Account(Name = 'Test Corp');
        insert testAccount;

        Contact testContact = new Contact(
            FirstName = 'Jane',
            LastName = 'Doe',
            AccountId = testAccount.Id,
            Email = 'jane.doe@testcorp.com'
        );
        insert testContact;
    }

    @IsTest
    static void testCreateCase_Success() {
        Account acct = [SELECT Id FROM Account LIMIT 1];
        Contact con = [SELECT Id FROM Contact LIMIT 1];

        CreateCaseAction.ActionInput input = new CreateCaseAction.ActionInput();
        input.subject = 'Login issue';
        input.description = 'Customer cannot log in to portal';
        input.priority = 'High';
        input.accountId = acct.Id;
        input.contactId = con.Id;

        Test.startTest();
        List<CreateCaseAction.ActionOutput> results =
            CreateCaseAction.createCase(new List<CreateCaseAction.ActionInput>{ input });
        Test.stopTest();

        System.assertEquals(1, results.size());
        System.assertEquals(true, results[0].success);
        System.assertNotEquals(null, results[0].caseId);
        System.assertNotEquals(null, results[0].caseNumber);

        Case created = [SELECT Subject, Priority, Origin FROM Case WHERE Id = :results[0].caseId];
        System.assertEquals('Login issue', created.Subject);
        System.assertEquals('High', created.Priority);
        System.assertEquals('Agentforce', created.Origin);
    }

    @IsTest
    static void testCreateCase_DefaultPriority() {
        CreateCaseAction.ActionInput input = new CreateCaseAction.ActionInput();
        input.subject = 'General inquiry';
        input.description = 'Question about features';

        Test.startTest();
        List<CreateCaseAction.ActionOutput> results =
            CreateCaseAction.createCase(new List<CreateCaseAction.ActionInput>{ input });
        Test.stopTest();

        System.assertEquals(true, results[0].success);
        Case created = [SELECT Priority FROM Case WHERE Id = :results[0].caseId];
        System.assertEquals('Medium', created.Priority);
    }

    @IsTest
    static void testCreateCase_BulkInvocation() {
        List<CreateCaseAction.ActionInput> inputs = new List<CreateCaseAction.ActionInput>();
        for (Integer i = 0; i < 50; i++) {
            CreateCaseAction.ActionInput input = new CreateCaseAction.ActionInput();
            input.subject = 'Bulk case ' + i;
            input.description = 'Description for case ' + i;
            inputs.add(input);
        }

        Test.startTest();
        List<CreateCaseAction.ActionOutput> results = CreateCaseAction.createCase(inputs);
        Test.stopTest();

        System.assertEquals(50, results.size());
        for (CreateCaseAction.ActionOutput output : results) {
            System.assertEquals(true, output.success);
        }
    }
}
```

## Flow Integration

Once the action is deployed, it appears in Flow Builder under **Action** elements:

1. Open Flow Builder and add an **Action** element
2. Search for "Create Support Case"
3. Map Flow variables to the `ActionInput` fields
4. Use the `ActionOutput` fields in subsequent Flow elements

```text
Flow: Case Creation from Chat
  Step 1: Get Input (Screen / Agentforce prompt)
  Step 2: Action → Create Support Case
    - Subject = {!chatSubject}
    - Description = {!chatDescription}
    - Priority = {!selectedPriority}
    - Account ID = {!currentAccountId}
  Step 3: Decision → Check {!ActionOutput.success}
    - True → Display confirmation with {!ActionOutput.caseNumber}
    - False → Display {!ActionOutput.errorMessage}
```

## Key Principles

- Always use `with sharing` to enforce record-level security
- Mark required inputs with `required=true` on `@InvocableVariable`
- Provide `label` and `description` on every variable for Flow/Agent discoverability
- Handle errors gracefully and return them in the output rather than throwing exceptions
- Design for bulk invocation: the method receives and returns `List<>`, not single records
- Re-query for auto-number fields after insert

## Common Pitfalls

- Forgetting to bulkify: inserting records inside a loop hits governor limits
- Not handling null optional inputs, which causes NullPointerException
- Missing `label` and `description` makes the action hard to find in Flow Builder
- Throwing unhandled exceptions breaks the entire Flow/Agent transaction
- Using `without sharing` inadvertently bypasses record access controls

## SCC Skills

- `/sf-agentforce-development` -- scaffold and review Agentforce actions
- `/sf-apex-best-practices` -- review the action class for best practices
- `/sf-tdd-workflow` -- write tests first, then implement the action
- `/sf-governor-limits` -- check governor limit compliance in bulk scenarios
