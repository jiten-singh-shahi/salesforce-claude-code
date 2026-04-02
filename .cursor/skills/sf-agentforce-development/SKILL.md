---
name: sf-agentforce-development
description: >-
  Agentforce AI agent development — topics, actions, Prompt Templates, testing. Use when building or testing Agentforce agents. Do NOT use for non-Agentforce Apex or Flow-only automation.
---

# Agentforce Development

Procedures for building Agentforce AI agents on the Salesforce platform. Architecture details, action type reference, instruction guidelines, and context engineering principles live in the reference file.

@../_reference/AGENTFORCE_PATTERNS.md

## When to Use

- Building Agentforce AI agents from scratch
- Configuring agent topics, actions, or conversation instructions
- Creating custom Apex actions or Flow actions for Agentforce
- Authoring or reviewing prompt templates for agent responses
- Testing, debugging, or evaluating agent behavior in Agent Builder
- Reviewing Agentforce limits or security requirements

---

## Agent Types

| Type | Audience | Channel | Use Case |
|------|----------|---------|----------|
| Einstein Copilot | Internal users | Salesforce UI sidebar | Sales/service rep productivity |
| Experience Cloud Agent | External users | Messaging, web chat | Customer self-service |
| Custom Agent | Any | API, custom channel | Bespoke workflows, backend automation |

---

## Topics: Defining Scope and Instructions

Topics are the primary organisational unit for agent capabilities.

```
Topic Name: Case Management
Description: Handles customer service case creation, updating, and
             status inquiries. Covers support tickets and complaints.

Instructions:
- Verify customer identity before accessing case details
- Create a new case if no existing open case matches the issue
- Escalate to a human agent if the customer is frustrated or issue is technical
- Summarise the resolution when closing a case

Guardrails:
- Do not discuss competitor products
- Do not make promises about resolution timelines
- Recommend contacting billing for billing disputes (out of scope)
```

---

## Custom Apex Actions -- @InvocableMethod

### Complete Example

```apex
public with sharing class CaseManagementAction {

    @InvocableMethod(
        label='Create Support Case'
        description='Creates a new support case for a customer.
            Requires accountId and subject.'
        category='Case Management'
    )
    public static List<CreateCaseResult> createSupportCase(
            List<CreateCaseRequest> requests) {
        List<CreateCaseResult> results = new List<CreateCaseResult>();
        List<Case> casesToInsert = new List<Case>();

        for (CreateCaseRequest req : requests) {
            casesToInsert.add(new Case(
                AccountId   = req.accountId,
                ContactId   = req.contactId,
                Subject     = req.subject,
                Description = req.description,
                Priority    = req.priority != null ? req.priority : 'Medium',
                Status      = 'New',
                Origin      = 'Agentforce'
            ));
        }

        List<Database.SaveResult> saveResults =
            Database.insert(casesToInsert, false, AccessLevel.USER_MODE);

        Set<Id> successIds = new Set<Id>();
        for (Database.SaveResult sr : saveResults) {
            if (sr.isSuccess()) successIds.add(sr.getId());
        }

        Map<Id, Case> caseMap = new Map<Id, Case>(
            [SELECT Id, CaseNumber FROM Case WHERE Id IN :successIds]
        );

        for (Database.SaveResult sr : saveResults) {
            CreateCaseResult result = new CreateCaseResult();
            if (sr.isSuccess()) {
                result.caseId     = sr.getId();
                result.caseNumber = caseMap.get(sr.getId())?.CaseNumber;
                result.success    = true;
                result.message    = 'Case created: ' + result.caseNumber;
            } else {
                result.success = false;
                result.message = 'Failed: ' + sr.getErrors()[0].getMessage();
            }
            results.add(result);
        }
        return results;
    }

    public class CreateCaseRequest {
        @InvocableVariable(label='Account ID'
            description='Salesforce Account ID of the customer'
            required=true)
        public Id accountId;

        @InvocableVariable(label='Contact ID'
            description='Contact ID raising the case' required=false)
        public Id contactId;

        @InvocableVariable(label='Subject'
            description='Brief issue description (max 255 chars)'
            required=true)
        public String subject;

        @InvocableVariable(label='Description'
            description='Detailed issue description' required=false)
        public String description;

        @InvocableVariable(label='Priority'
            description='Low, Medium, High, Critical' required=false)
        public String priority;
    }

    public class CreateCaseResult {
        @InvocableVariable(label='Case ID')
        public Id caseId;

        @InvocableVariable(label='Case Number')
        public String caseNumber;

        @InvocableVariable(label='Success')
        public Boolean success;

        @InvocableVariable(label='Message')
        public String message;
    }
}
```

### @InvocableMethod Best Practices

```apex
// Good label and description — LLM uses these to decide when to call
@InvocableMethod(
    label='Get Account Recent Cases'
    description='Retrieves the 5 most recent open cases for an account.
        Use when customer asks about open tickets or case status.'
    category='Case Management'
)

// Return a result object (agent needs confirmation), not void
// Bulkify — agent runtime may batch calls
```

---

## Flow Actions for Agentforce

Use Flow actions when logic involves declarative orchestration, screen interactions, or non-developer maintenance.

```
Flow: Update_Account_Segment (Autolaunched Flow)
Variables:
  - accountId (Input, Text, Required)
  - newSegment (Input, Text, Required)
  - result (Output, Text)

Steps:
  1. Get Records: Account WHERE Id = {accountId}
  2. Decision: Is segment different from current?
  3. Update Records: Account.Segment__c = {newSegment}
  4. Assignment: result = "Segment updated to " + {newSegment}
```

Add the Flow to an Agentforce topic as an action in Setup.

---

## Prompt Templates

### Creating a Flex Prompt Template

```
Template Name: Case Summary for Agent
Template Type: Flex (general purpose)
Grounding: Case record

Template Body:
You are a helpful customer service assistant.
Summarise the following case for a support representative.

Case Details:
- Case Number: {!$Input:Case.CaseNumber}
- Subject: {!$Input:Case.Subject}
- Status: {!$Input:Case.Status}
- Priority: {!$Input:Case.Priority}
- Customer: {!$Input:Case.Account.Name}
- Description: {!$Input:Case.Description}

Provide:
1. A 2-sentence summary of the issue
2. Recommended next action
3. Estimated complexity: Low/Medium/High
```

### Using Prompt Templates in Apex

> Note: The ConnectApi surface for Einstein/Agentforce changes rapidly. Verify exact class/method names against the ConnectApi Apex Reference for your target API version (v66.0 Spring '26).

```apex
public with sharing class PromptTemplateAction {

    @InvocableMethod(
        label='Generate Case Summary'
        description='Generates an AI summary using Einstein Prompt Template'
    )
    public static List<SummaryResult> generateCaseSummary(
            List<SummaryRequest> requests) {
        List<SummaryResult> results = new List<SummaryResult>();

        for (SummaryRequest req : requests) {
            try {
                ConnectApi.EinsteinPromptTemplateGenerationsRepresentation
                    response = ConnectApi.EinsteinLLM
                        .generateMessagesForPromptTemplate(
                            'Case_Summary_for_Agent',
                            new Map<String, String>{
                                'Input:Case' => req.caseId
                            },
                            new Map<String, ConnectApi
                                .EinsteinPromptTemplateGenerationsInput>()
                        );

                SummaryResult result = new SummaryResult();
                result.summary = response.generations[0].text;
                result.success = true;
                results.add(result);
            } catch (Exception e) {
                SummaryResult result = new SummaryResult();
                result.success = false;
                result.errorMessage = e.getMessage();
                results.add(result);
            }
        }
        return results;
    }

    public class SummaryRequest {
        @InvocableVariable(label='Case ID' required=true)
        public Id caseId;
    }

    public class SummaryResult {
        @InvocableVariable(label='Summary')
        public String summary;
        @InvocableVariable(label='Success')
        public Boolean success;
        @InvocableVariable(label='Error Message')
        public String errorMessage;
    }
}
```

---

## Mixing Deterministic Logic with LLM Actions (Spring '26)

Agentforce supports mixing deterministic actions (Apex, Flow) with LLM-driven prompt actions within a single topic.

> Configuration is done in the Agentforce Builder UI. The pseudo-code below illustrates the architectural pattern.

```
Topic: CaseTriage

Step 1 (Deterministic — Apex):
    Call: EscalateCaseAction
    Condition: case.Priority == 'Critical'

Step 2 (Deterministic — Apex):
    Call: GetKnowledgeArticles
    Input: case.Subject
    -> Grounds the LLM with relevant articles

Step 3 (LLM — Prompt Template):
    Template: Case_Resolution_Suggestion
    Grounding: case record + articles from Step 2

Step 4 (Deterministic — Apex):
    Call: LogAgentInteraction
    -> Audit trail logged regardless of LLM output
```

Use when: compliance rules need deterministic execution, multi-step processes mix AI judgment with guaranteed logic, or audit trails must separate deterministic decisions from AI content.

---

## Testing Agentforce

### Unit Testing Apex Actions

```apex
@IsTest
public class CaseManagementActionTest {

    @TestSetup
    static void setup() {
        Account acc = new Account(Name='Test Account');
        insert acc;
        Contact con = new Contact(LastName='Doe', AccountId=acc.Id);
        insert con;
    }

    @IsTest
    static void testCreateCase_validInput_createsCase() {
        Account acc = [SELECT Id FROM Account LIMIT 1];
        Contact con = [SELECT Id FROM Contact LIMIT 1];

        CaseManagementAction.CreateCaseRequest req =
            new CaseManagementAction.CreateCaseRequest();
        req.accountId = acc.Id;
        req.contactId = con.Id;
        req.subject   = 'Cannot access portal';
        req.priority  = 'High';

        Test.startTest();
        List<CaseManagementAction.CreateCaseResult> results =
            CaseManagementAction.createSupportCase(
                new List<CaseManagementAction.CreateCaseRequest>{req});
        Test.stopTest();

        System.assert(results[0].success);
        System.assertNotEquals(null, results[0].caseId);

        Case created = [SELECT Status, Origin, Priority
            FROM Case WHERE Id = :results[0].caseId];
        System.assertEquals('Agentforce', created.Origin);
        System.assertEquals('High', created.Priority);
    }

    @IsTest
    static void testCreateCase_bulk_createsMultipleCases() {
        Account acc = [SELECT Id FROM Account LIMIT 1];

        List<CaseManagementAction.CreateCaseRequest> requests =
            new List<CaseManagementAction.CreateCaseRequest>();
        for (Integer i = 0; i < 200; i++) {
            CaseManagementAction.CreateCaseRequest req =
                new CaseManagementAction.CreateCaseRequest();
            req.accountId = acc.Id;
            req.subject   = 'Bulk test case ' + i;
            requests.add(req);
        }

        Test.startTest();
        List<CaseManagementAction.CreateCaseResult> results =
            CaseManagementAction.createSupportCase(requests);
        Test.stopTest();

        Integer successCount = 0;
        for (CaseManagementAction.CreateCaseResult r : results) {
            if (r.success) successCount++;
        }
        System.assertEquals(200, successCount);
    }
}
```

---

## SF CLI Agent Commands (Spring '26)

```bash
# Activate an agent
sf agent activate --name "Sales Assistant" --target-org MySandbox

# Run automated agent tests
sf agent test run --target-org MySandbox --output-dir test-results/

# Resume a paused test job
sf agent test resume --job-id <jobId> --target-org MySandbox

# Get test results
sf agent test results --job-id <jobId> --result-format human

# Generate starter agent spec
sf agent generate agent-spec \
    --agent-type custom \
    --output-dir force-app/main/agents \
    --target-org MySandbox
```

---

## Security: Data Access in AI Context

```apex
// Enforce sharing in Agentforce Apex actions
public with sharing class SecureAgentAction {

    @InvocableMethod(label='Get Customer Orders')
    public static List<OrderResult> getOrders(List<OrderRequest> requests) {
        // Collect ALL accountIds — runtime may batch multiple requests
        Set<Id> accountIds = new Set<Id>();
        for (OrderRequest req : requests) {
            accountIds.add(req.accountId);
        }

        // USER_MODE enforces CRUD/FLS and sharing rules
        List<Order__c> orders = [
            SELECT Id, Name, Status__c, Amount__c, AccountId
            FROM Order__c
            WHERE AccountId IN :accountIds
            WITH USER_MODE
            LIMIT 50
        ];

        // Build results grouped by AccountId...
    }
}
```

### PII Considerations

- Use field-level security to control what the agent can access
- Ground Prompt Templates only with fields the user's profile can read
- Review agent conversations in Setup > Agent Conversations

---

## Related

- Agent: `sf-agentforce-agent` -- for interactive, in-depth guidance
- Constraints: sf-apex-constraints
- Reference: @../_reference/AGENTFORCE_PATTERNS.md
