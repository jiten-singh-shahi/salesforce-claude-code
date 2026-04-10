# Agentforce Action Types — Reference

Non-Apex action types for Agentforce agents. MCP Server actions have their own skill: `sf-agentforce-mcp-actions`.

## Named Query (GA)

Parameterized SOQL exposed as REST API endpoint and agent action. No Apex or Flow required.

```
Query Name: GetRecentOrders
SOQL: SELECT Id, Name, Status__c, CreatedDate
      FROM Order__c
      WHERE AccountId = :accountId
      ORDER BY CreatedDate DESC LIMIT 5
```

- Auto-creates REST endpoint: `/services/data/v66.0/named/query/GetRecentOrders?accountId=001xx...`
- Activate in API Catalog, then add as agent action
- **Limitation**: Input parameters only in WHERE and LIMIT clauses. Cannot edit after agent action activation without deactivation
- **Agent Script target**: `target: "namedQuery://GetRecentOrders"`

## AuraEnabled Methods (Beta)

Reuse existing `@AuraEnabled` controller methods as agent actions:

1. Generate OpenAPI spec: VS Code > "SFDX: Create OpenAPI Document from This Class" > creates `.yaml` + `.externalServiceRegistration-meta.xml`
1. Optionally add `x-sfdc: publishAsAgentAction: true` for auto-creation
1. Deploy to API Catalog
1. Add as agent action (category: "AuraEnabled Method (Beta)")

## Apex Citations

Source attribution in agent responses. Two approaches:

| Class | Behavior | Use When |
|---|---|---|
| `AiCopilot.GenAiCitationInput` | Supplies sources to reasoning engine; auto-places inline citations | Default — let the engine decide |
| `AiCopilot.GenAiCitationOutput` | Direct control over citation placement; bypasses reasoning engine | Predetermined citation logic |

Supported sources: knowledge articles, PDF files, external web pages. Requires agent created after May 2025. Action must return both generated response and citation metadata.

## Lightning Types

Custom LWC components for rich conversational UI in agent responses.

```
lightningTypes/
  flightResponse/
    schema.json                    # JSON Schema for validation
    lightningDesktopGenAi/         # Channel: Employee Agent
      renderer.json                # Output LWC component
    enhancedWebChat/               # Channel: Service Agent (Enhanced Chat v2)
      renderer.json
  flightFilter/
    schema.json
    lightningDesktopGenAi/
      editor.json                  # Input LWC component
```

- LWC targets: `lightning__AgentforceInput` (editor), `lightning__AgentforceOutput` (renderer)
- **Constraint**: Custom Lightning Types only override UI for actions using **Apex classes** as input/output
- Editor LWC must include `handleInputChange()` dispatching `valuechange` event

## Adaptive Response Formats

Rich responses without custom LWC development (Service Agents on messaging channels):

| Format | UI | Fields |
|---|---|---|
| **Rich Choice** | Carousel, buttons, list selector | Title, description, link, image per tile |
| **Rich Link** | Media card | Link title, URL, image, description |

Determined automatically by returned data structure from Apex or Flow actions.

## Flow Actions

Use when logic involves declarative orchestration or non-developer maintenance.

```
Flow: Update_Account_Segment (Autolaunched)
Variables: accountId (Input), newSegment (Input), result (Output)
Steps: Get Record → Decision → Update Record → Assign result
```

Add to topics in Setup or reference in Agent Script `reasoning.actions` with `target: "flow://FlowApiName"`.

## Prompt Templates

```
Template Name: Case Summary for Agent
Template Type: Flex
Grounding: Case record

Body:
Summarise the following case for a support representative.
- Case Number: {!$Input:Case.CaseNumber}
- Subject: {!$Input:Case.Subject}
- Status: {!$Input:Case.Status}
- Customer: {!$Input:Case.Account.Name}

Provide: 1) 2-sentence summary  2) Recommended next action  3) Complexity: Low/Medium/High
```

Agent Script target: `target: "generatePromptResponse://Case_Summary"`
