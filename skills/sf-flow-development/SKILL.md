---
name: sf-flow-development
description: "Salesforce Flow development — flow types, patterns, bulkification, error handling, testing, subflows, Flow vs Apex. Use when building or reviewing Flows. Do NOT use for pure Apex or Platform Event architecture."
origin: SCC
user-invocable: true
---

# Salesforce Flow Development

Procedures for building, testing, and maintaining Salesforce Flows. Flow type details, governor limits, bulkification rules, and the Flow vs Apex decision matrix live in the reference file.

@../_reference/FLOW_PATTERNS.md

## When to Use

- Building or debugging Salesforce Flows (record-triggered, screen, scheduled, autolaunched, orchestration)
- Deciding between Flow and Apex for automation
- Configuring fault paths, bulkification, or governor-safe flow patterns
- Implementing subflows, versioning, or modular flow design
- Migrating from Process Builder to Record-Triggered Flows

---

## Before Save: Field Updates (Recommended Pattern)

```
Flow: ACC_SetAccountPriority (Before Save, Account, before insert OR before update)
Entry Condition: {!$Record.AnnualRevenue} >= 1000000

Steps:
  1. Assignment: {!$Record.Priority__c} = "High"
  2. Assignment: {!$Record.Tier__c} = "Enterprise"

Notes:
  - No Get Records, Update Records, or Create Records elements allowed
  - No DML of any kind
  - Very fast — runs in memory before DB write
```

## After Save: Related Record Creation

```
Flow: OPP_CreateNegotiationTask (After Save, Opportunity, after update)
Entry Condition: {!$Record.StageName} = "Negotiation"
                 AND {!$Record.StageName} <> {!$Record__Prior.StageName}

Steps:
  1. Get Records: User WHERE Id = {!$Record.OwnerId}
  2. Create Records: Task (
       Subject = "Review negotiation checklist"
       WhatId = {!$Record.Id}
       OwnerId = {!$Record.OwnerId}
       ActivityDate = TODAY() + 3
       Priority = "High"
     )
```

---

## Before Save vs After Save Decision

```
Need to update the SAME record's fields?
  -> Before Save (no DML counted, faster)
  Note: Before Save flows cannot use Get Records or DML elements,
  but CAN access parent fields via cross-object formula references
  (e.g., {!$Record.Account.Name}).

Need to create/update OTHER records?
  -> After Save (can do DML on other objects)

Need to send emails or call external services?
  -> After Save (outbound actions need committed record)
```

---

## Bulkification Patterns

### DML Outside the Loop (Critical)

```
BAD:
  Loop: For each Contact in {!Contacts}
    |
    +-> Update Records: Contact  <- DML inside loop = 1 DML per record

GOOD:
  Loop: For each Contact in {!Contacts}
    |
    +-> Assignment: Add to contactsToUpdate collection

  Update Records: {!contactsToUpdate}  <- Single DML for entire collection
```

### SOQL Outside the Loop

```
BAD:
  Loop: For each Opportunity in {!Opportunities}
    |
    +-> Get Records: Account WHERE Id = {!loopVar.AccountId}  <- SOQL per record

GOOD:
  Get Records: Account WHERE Id IN {!opportunityAccountIds}  <- single query

  Loop: For each Opportunity in {!Opportunities}
    |
    +-> (Use data from pre-fetched collection, no SOQL)

  Heap warning: If pre-fetch returns 10K+ records, the collection may
  exceed the heap size limit (see @../_reference/GOVERNOR_LIMITS.md). Filter aggressively, or move to Batch Apex.
```

---

## Subflows: Modular Design

```
Parent Flow: SCR_CustomerOnboarding (Screen Flow)
  |
  +-- Subflow: VAL_ValidateAddress (Autolaunched)
  |     Input:  {!streetAddress}, {!city}, {!state}
  |     Output: {!isValidAddress}, {!normalizedAddress}
  |
  +-- Subflow: INT_CreateCRMAccount (Autolaunched)
  |     Input:  {!accountData}
  |     Output: {!newAccountId}
  |
  +-- Subflow: NOT_SendWelcomeEmail (Autolaunched)
        Input:  {!accountId}, {!contactEmail}
```

Variables passed between parent and subflow must be marked as available for input/output in the subflow definition.

---

## Error Handling: Fault Connectors

Every element that can fail should have a fault connector.

```
[Update Records: Update Account]
         |
         +-(SUCCESS)-> [Next Step]
         |
         +-(FAULT)-> [Assignment: errorMessage =
                       "Failed: " + {!$Flow.FaultMessage}]
                         |
                         +-> [Screen: Display Error to User]
                              OR
                              +-> [Create Records: Error_Log__c]
                              OR
                              +-> [Custom Notification: Notify Admin]
```

---

## Get Records Best Practices

```
Element: Get Records
Object: Contact
Filter: AccountId = {!$Record.Id} AND IsActive__c = true
Store All Records: No (when you need just one) / Yes (for a collection)

Tips:
  - Add filter conditions to reduce records returned
  - Select only the fields you need
  - Use "Only the first record" when you need a single result
  - Filter on indexed fields when possible (Id, OwnerId, ExternalId__c)
```

---

## Custom Labels and Custom Metadata in Flows

### Custom Labels

```
Formula Resource:
  Name: FormattedMessage
  Data Type: Text
  Value: {!$Label.Welcome_Message} & " " & {!ContactRecord.FirstName}
```

### Custom Metadata Types

```
Get Records:
  Object: Service_Config__mdt
  Filter: DeveloperName = "Production"
  Fields: Endpoint_URL__c, Timeout_Ms__c
```

---

## Testing Flows

### Apex Test Coverage for Record-Triggered Flows

```apex
@IsTest
public class OppNegotiationFlowTest {

    @TestSetup
    static void setup() {
        Account acc = TestDataFactory.createAccount('Test Account');
        insert acc;
    }

    @IsTest
    static void testNegotiationTask_stageChanged_createsTask() {
        Account acc = [SELECT Id FROM Account LIMIT 1];

        Opportunity opp = new Opportunity(
            Name      = 'Test Opp',
            AccountId = acc.Id,
            StageName = 'Prospecting',
            CloseDate = Date.today().addDays(30),
            Amount    = 50000
        );
        insert opp;

        Test.startTest();
        opp.StageName = 'Negotiation';
        update opp;
        Test.stopTest();

        List<Task> tasks = [SELECT Subject, Priority
            FROM Task WHERE WhatId = :opp.Id];
        System.assertEquals(1, tasks.size());
        System.assertEquals('Review negotiation checklist', tasks[0].Subject);
    }

    @IsTest
    static void testNegotiationTask_bulk_createsTasksForAll() {
        Account acc = [SELECT Id FROM Account LIMIT 1];

        List<Opportunity> opps = new List<Opportunity>();
        for (Integer i = 0; i < 200; i++) {
            opps.add(new Opportunity(
                Name      = 'Bulk Opp ' + i,
                AccountId = acc.Id,
                StageName = 'Prospecting',
                CloseDate = Date.today().addDays(30),
                Amount    = 1000 * i
            ));
        }
        insert opps;

        Test.startTest();
        for (Opportunity opp : opps) { opp.StageName = 'Negotiation'; }
        update opps;
        Test.stopTest();

        Integer taskCount = [SELECT COUNT() FROM Task WHERE WhatId IN :opps];
        System.assertEquals(200, taskCount);
    }
}
```

---

## New Screen Flow Components (Spring '26)

Five native Screen Flow components that eliminate the need for custom LWC in common patterns:

| Component | Best For |
|-----------|----------|
| **Kanban Board** | Stage/status reassignment wizards, visual prioritization |
| **Message** | Confirmation prompts, warnings before destructive steps |
| **File Preview** | Document review steps in approval flows |
| **Integrated Approval** | Wizard-based approval flows where reps submit and track |
| **Editable Data Table** | Mass-edit child records within a guided wizard |

---

## Record-Triggered Flows on Files (Spring '26)

Record-Triggered Flows now support `ContentVersion` as a triggering object.

```
Object: ContentVersion
Trigger: A record is created or updated
Entry Conditions:
  - {!$Record.FileExtension} = 'pdf'
  - {!$Record.Title} Does NOT Contain 'DRAFT'

Use cases:
  - Auto-tag documents based on filename patterns
  - Notify a team when a contract document is uploaded
  - Create audit log when a sensitive file type is uploaded
```

---

## Orchestration Flow Design

Orchestration Flows manage long-running, multi-step processes spanning hours or days.

```
Orchestration Flow: Employee_Onboarding
+-- Stage 1: "System Setup"
|   +-- Background Step: Create user account (Autolaunched Flow)
|   +-- Background Step: Provision email (Autolaunched Flow)
+-- Stage 2: "HR Review"
|   +-- Interactive Step: Complete onboarding form (Screen Flow -> HR Manager)
+-- Stage 3: "Equipment & Access"
|   +-- Interactive Step: Order equipment (Screen Flow -> IT Team queue)
|   +-- Background Step: Grant system permissions (Autolaunched Flow)
+-- Stage 4: "Orientation"
    +-- Interactive Step: Schedule orientation (Screen Flow -> Employee)
```

### Key Design Principles

- Stages execute sequentially -- Stage 2 waits for all Stage 1 steps
- Steps within a stage can run in parallel
- Interactive steps pause the orchestration until the assigned user completes the Screen Flow
- Background steps run automatically using Autolaunched Flows
- Define fault paths on background steps to prevent stalled orchestrations

---

## Flow Versioning and Activation

```
Each Flow has:
  - Multiple versions (v1, v2, v3...)
  - Only ONE active version at a time
  - Inactive versions can be tested without activating

Deployment:
  - Deploying creates a new version
  - Set status: Active in Flow metadata to auto-activate:
```

```xml
<status>Active</status>
```

```bash
sf project deploy start \
    --metadata "Flow:OPP_CreateNegotiationTask" \
    --target-org myOrg
```

---

## Process Builder Migration

```
1. IDENTIFY — List all active Process Builders
   sf data query -q "SELECT Id, MasterLabel, ProcessType FROM Flow
     WHERE ProcessType = 'Workflow' AND Status = 'Active'" --json

2. ANALYZE — Document trigger object, criteria, and actions

3. CREATE — Build equivalent Record-Triggered Flow:
   - Before Save Flow for field updates
   - After Save Flow for create records, email alerts

4. TEST — Deploy to sandbox, test with bulk data (200+ records)

5. DEACTIVATE — Turn off Process Builder, monitor 1-2 weeks

6. CLEANUP — Delete via destructiveChanges.xml
```

---

## Related

- Agent: `sf-flow-reviewer` -- for interactive, in-depth guidance
- Constraints: sf-apex-constraints (for Apex-invoked flows)
- Reference: @../_reference/FLOW_PATTERNS.md
