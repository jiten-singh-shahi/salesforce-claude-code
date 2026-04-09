---
name: sf-agentforce-development
description: >-
  Agentforce agent development — Agent Script, topics, actions, testing, metadata. Use when building Agentforce agents. Do NOT use for non-Agentforce Apex or Flow-only automation.
---

# Agentforce Development

Procedures for building Agentforce AI agents. Architecture, syntax reference, metadata types, instruction guidelines, and context engineering principles live in the reference file.

@../_reference/AGENTFORCE_PATTERNS.md

## When to Use

- Building Agentforce AI agents with Agent Script (`.agent` files)
- Generating and publishing authoring bundles via CLI
- Configuring agent topics, actions, or conversation instructions
- Creating custom Apex actions or Flow actions for Agentforce
- Testing agents with YAML test specs, CLI, or Testing Center
- Deploying agent metadata (GenAi types) to orgs

---

## Agent Types

| Type | Audience | Channel | Use Case |
|------|----------|---------|----------|
| Einstein Copilot | Internal users | Salesforce UI sidebar | Sales/service rep productivity |
| Experience Cloud Agent | External users | Messaging, web chat | Customer self-service |
| Custom Agent | Any | API, custom channel | Bespoke workflows, backend automation |

---

## Development Approaches

| | Agent Script (Recommended) | Classic Setup |
|---|---|---|
| **API version** | v65+ | v60+ |
| **Surface** | `.agent` files in VS Code + CLI | Agentforce Builder UI |
| **Source control** | Yes — diffable `.agent` files | No — UI-only |
| **CI/CD** | Full: validate → publish → test → activate | Limited: deploy GenAi metadata |
| **When to use** | All new agents; teams needing code review | Orgs on API < v65; admin-managed simple agents |

**Default to Agent Script** for all new development.

---

## Agent Script Development

### File Structure

```
force-app/main/default/aiAuthoringBundles/My_Agent/
  My_Agent.agent              # Agent Script file
  My_Agent.bundle-meta.xml    # Metadata XML
```

### CLI Workflow

```bash
# Generate authoring bundle (from spec or --no-spec for boilerplate)
sf agent generate authoring-bundle --spec specs/agentSpec.yaml \
    --name "My Agent" --api-name My_Agent

# Edit .agent file in VS Code (syntax highlighting + validation)
# Validate → Publish → Preview → Activate
sf agent validate authoring-bundle --target-org MySandbox
sf agent publish authoring-bundle --target-org MySandbox
sf agent preview --target-org MySandbox
sf agent activate --api-name My_Agent --target-org MySandbox
```

### Complete Example

```
config:
  developer_name: "Service_Agent"
  agent_label: "Customer Service Agent"

variables:
  customer_email: mutable string = ""
  is_verified: mutable boolean = False
  session_lang: linked string
    source: "EndUserLanguage"

system:
  instructions: |
    You are a customer service agent. Be friendly and concise.
    Always verify identity before accessing account data.
  messages:
    welcome: "Hello! How can I help you today?"
    error: "I apologize. Let me transfer you to a team member."

start_agent topic_selector:
  description: "Routes messages to the appropriate topic"
  reasoning:
    instructions: ->
      | Analyze the message and determine the best topic.
    actions:
      verify: @utils.transition to @topic.identity
        description: "Verify customer identity"
      orders: @utils.transition to @topic.order_management
        description: "Help with order status or modifications"

topic identity:
  description: "Verifies customer identity via email lookup"
  reasoning:
    instructions: ->
      if @variables.is_verified == True:
        | Customer is already verified.
        transition to @topic.order_management
      | Ask for their email address to verify identity.
    actions:
      lookup:
        action: @actions.lookup_customer
        description: "Look up customer by email"
        inputs:
          email: ...
        set:
          is_verified: output.found

  after_reasoning: ->
    if @variables.is_verified == True:
      transition to @topic.order_management

topic order_management:
  description: "Helps customers check order status"
  reasoning:
    instructions: ->
      if @variables.is_verified == False:
        transition to @topic.identity
      | Help the customer with their order inquiry.
    actions:
      get_order:
        action: @actions.get_order_details
        description: "Retrieve order details by order number"
        inputs:
          order_number: ...
          customer_email: @variables.customer_email
```

### Key Patterns

**Deterministic** (`->`) — guaranteed execution:

```
-> if @variables.is_verified == False:
     transition to @topic.identity
```

**LLM prompts** (`|`) — accumulated and sent to model:

```
| Help the customer with their order.
| Be concise and provide the order number.
```

**Deterministic action** (`run`) — bypasses LLM:

```
-> run @actions.get_recent_orders with
     customer_id: @variables.customer_id
   set
     recent_orders: result
```

---

## Action Types

### Apex @InvocableMethod

Apex actions are built by `sf-apex-agent` using patterns from `sf-apex-constraints`. Key Agentforce-specific requirements for `@InvocableMethod` actions:

- **Labels/descriptions are critical** — the LLM reads these to decide routing. Keep in sync between Apex annotations and Builder action config
- **InvocableVariable descriptions** must specify data type and format: `"accountId — 18-digit Account record ID"`
- **Return result objects** (not void) — agent needs structured confirmation to continue reasoning
- **Use `Database` class** (partial success) not DML verbs (all-or-nothing)
- **Varied verb names** across actions: "Locate", "Retrieve", "Calculate" — not "Get X", "Get Y"
- **Decompose** complex actions to avoid CPU timeout (10s sync limit)
- **Long-running work**: enqueue Queueable, return requestId for status tracking

### MCP Server

External tools exposed to Agentforce via Model Context Protocol (JSON-RPC 2.0 over HTTP/SSE).

- **Setup**: Register server in MCP Server Registry (Setup > MCP Servers). Tools appear in Agentforce Asset Library
- **Auth**: OAuth 2.0 with Integration User. Principle of least privilege. FLS and sharing rules enforced
- **Rate limit**: ~50 requests/min/server
- **Tool discovery**: On connection, server returns schema with tool names, descriptions, required/optional parameters, return types
- **Prebuilt servers**: Salesforce DX MCP Server (deploy, test, scratch orgs), Heroku Platform, MuleSoft
- **Hosted MCP (Pilot)**: Fully managed cloud endpoints — zero infrastructure. Pre-built for core CRM and B2C Commerce APIs

### Named Query (GA)

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

### AuraEnabled Methods (Beta)

Reuse existing `@AuraEnabled` controller methods as agent actions:

1. Generate OpenAPI spec: VS Code → "SFDX: Create OpenAPI Document from This Class" → creates `.yaml` + `.externalServiceRegistration-meta.xml`
1. Optionally add `x-sfdc: publishAsAgentAction: true` for auto-creation
1. Deploy to API Catalog
1. Add as agent action (category: "AuraEnabled Method (Beta)")

### Apex Citations

Source attribution in agent responses. Two approaches:

| Class | Behavior | Use When |
|---|---|---|
| `AiCopilot.GenAiCitationInput` | Supplies sources to reasoning engine; engine auto-places inline numbered citations | Default — let the engine decide placement |
| `AiCopilot.GenAiCitationOutput` | Direct control over citation placement; bypasses reasoning engine | Predetermined citation logic needed |

Supported sources: knowledge articles, PDF files, external web pages. Requires agent created after May 2025. Action must return both generated response and citation metadata.

### Lightning Types

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

### Adaptive Response Formats

Rich responses without custom LWC development (Service Agents on messaging channels):

| Format | UI | Fields |
|---|---|---|
| **Rich Choice** | Carousel, buttons, list selector | Title, description, link, image per tile |
| **Rich Link** | Media card | Link title, URL, image, description |

Determined automatically by returned data structure from Apex or Flow actions.

---

## Flow Actions

Use when logic involves declarative orchestration or non-developer maintenance.

```
Flow: Update_Account_Segment (Autolaunched)
Variables: accountId (Input), newSegment (Input), result (Output)
Steps: Get Record → Decision → Update Record → Assign result
```

Add to topics in Setup or reference in Agent Script `reasoning.actions`.

---

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

---

## Testing

Apex unit tests for `@InvocableMethod` actions are handled by `sf-apex-agent` using `sf-testing-constraints`. This section covers **agent-level testing** — verifying topic routing, action execution, and response quality.

### Agent Test Spec (YAML)

```yaml
name: Service_Agent_Tests
description: End-to-end tests for Customer Service Agent
subjectType: AGENT
subjectName: Service_Agent
subjectVersion: v1
testCases:
  - utterance: "What's the status of order #12345?"
    expectedTopic: Order_Management
    expectedActions:
      - get_order_details
    expectedOutcome: "Agent provides order status details including shipping info"
    contextVariables:
      - name: EndUserLanguage
        value: en
    metrics:
      - topic_sequence_match
      - action_sequence_match
      - bot_response_rating
      - coherence
      - completeness
      - conciseness
      - latency

  - utterance: "I need to file a complaint about my delivery"
    expectedTopic: Case_Management
    expectedActions:
      - create_support_case
    expectedOutcome: "Agent creates a case and provides the case number"
    metrics:
      - topic_sequence_match
      - action_sequence_match
      - bot_response_rating
      - instructionAdherence

  - utterance: "Hola, necesito ayuda con mi pedido"
    expectedTopic: Order_Management
    contextVariables:
      - name: EndUserLanguage
        value: es
    metrics:
      - topic_sequence_match
      - coherence
```

### Multi-Turn Conversation Testing

```yaml
testCases:
  - utterance: "I want to return my order"
    expectedTopic: Order_Management
    conversationHistory:
      - role: user
        message: "Hi, I need help"
      - role: agent
        message: "Hello! How can I help you today?"
        topic: topic_selector
      - role: user
        message: "I have a problem with order #12345"
      - role: agent
        message: "I found order #12345. It was delivered on March 15."
        topic: Order_Management
    metrics:
      - topic_sequence_match
      - action_sequence_match
```

### Custom Evaluations

```yaml
testCases:
  - utterance: "What's the weather in SF?"
    customEvaluations:
      - label: Temperature Check
        jsonPathExpression: $.actions[0].result.temperature
        comparisonOperator: greaterThan
        expectedValue: "0"
```

### CLI Test Workflow

```bash
# Generate test spec from agent definition
sf agent generate test-spec --output-file specs/testSpec.yaml

# Create test in org from YAML spec
sf agent test create --spec specs/testSpec.yaml --target-org MySandbox

# Run tests synchronously with JUnit output (CI-friendly)
sf agent test run --api-name Service_Agent_Tests --wait 10 \
    --result-format junit --output-dir ./test-results \
    --target-org MySandbox

# View results
sf agent test results --test-id <id> --target-org MySandbox

# List all agent tests
sf agent test list --target-org MySandbox
```

### Testing REST API (CI Integration)

```
# Start test run
POST /services/data/v63.0/einstein/ai-evaluations/runs
Body: { "aiEvaluationDefinitionName": "Service_Agent_Tests" }
Response: { "runId": "0Xx..." }

# Poll status
GET /services/data/v63.0/einstein/ai-evaluations/runs/{runId}
Response: { "status": "NEW | IN_PROGRESS | COMPLETED | ERROR" }

# Get results
GET /services/data/v63.0/einstein/ai-evaluations/runs/{runId}/results
Response: { "testCases": [...], "testResults": [...] }
```

Auth: OAuth 2.0 via External Client App (JWT with consumer key/secret).

### Testing Tools Summary

| Tool | Purpose |
|---|---|
| **Agent Builder Preview** | Real-time conversational testing (simulated or live mode) |
| **Agentforce Testing Center** | Bulk test execution; auto-generates test cases from knowledge |
| **CLI (`sf agent test`)** | Headless testing, JUnit output, CI pipeline integration |
| **VS Code Agent Panel** | View/run tests + Agent Preview pane + Apex Replay Debugger |
| **Testing REST API** | Programmatic test execution from external CI systems |
| **Agent Grid (Beta)** | Spreadsheet-like rapid testing with real CRM data |

---

## Metadata & Deployment

```
force-app/main/default/
  aiAuthoringBundles/My_Agent/   # .agent + .bundle-meta.xml
  bots/My_Agent/                 # .bot-meta.xml
  botVersions/My_Agent.v1/      # .botVersion-meta.xml
  genAiPlannerBundles/My_Agent/  # .genAiPlannerBundle-meta.xml
  genAiPlugins/Topic_Name/       # .genAiPlugin-meta.xml
  genAiFunctions/Action_Name/    # .genAiFunction-meta.xml + input/output schema.json
  aiEvaluationDefinitions/       # .aiEvaluationDefinition-meta.xml
```

**Deploy order**: Bot/BotVersion → GenAiPromptTemplate → GenAiFunction → GenAiPlugin → GenAiPlannerBundle → AiAuthoringBundle → AiEvaluationDefinition → Activate

**Retrieve**: `sf project retrieve start --metadata "AiAuthoringBundle:My_Agent*"`

---

## Security

- Always use `with sharing` and `AccessLevel.USER_MODE` / `WITH USER_MODE`
- Ground Prompt Templates only with fields the user's profile can read
- Review agent conversations in Setup > Agent Conversations

---

## Classic Topics (Pre-Agent Script)

For orgs on API < v65, configure topics in Agentforce Builder UI:

```
Topic: Case Management
Description: Handles case creation, updating, and status inquiries.
Scope WILL: Case creation, status checks, escalation
Scope WILL NOT: Billing disputes, resolution timeline promises
Instructions:
1. Verify customer identity before accessing case details
2. Create a new case if no existing open case matches
3. Escalate if customer is frustrated or issue is complex
```

All instruction guidelines and context engineering principles from the reference apply identically.

---

## Related

- Agent: `sf-agentforce-agent` — for interactive guidance
- Constraints: sf-apex-constraints
- Reference: @../_reference/AGENTFORCE_PATTERNS.md
