---
name: sf-agentforce-development
description: "Agentforce agent development — Agent Script, topics/subagents, actions, testing, metadata. Use when building Agentforce agents, Apex InvocableMethod actions, or agent SOQL patterns. Do NOT use for non-Agentforce Apex or Flow-only automation."
origin: SCC
user-invocable: false
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

**What publish does**: `sf agent publish authoring-bundle` validates the `.agent` file, auto-generates all downstream metadata (`Bot`, `BotVersion`, `GenAiPlannerBundle`, `GenAiPlugin` per topic), and wires action references. You do NOT need to manually create `GenAiFunction` metadata — the `target:` field resolves directly against the invocable action registry.

### Complete Example

```
config:
   developer_name: "Service_Agent"
   agent_label: "Customer Service Agent"
   agent_type: "AgentforceServiceAgent"
   default_agent_user: "agentuser@example.com"
   description: "Service agent with custom Apex actions."

variables:
   customer_email: mutable string = ""
   is_verified: mutable boolean = False
   EndUserId: linked string
      source: @MessagingSession.MessagingEndUserId
      description: "MessagingEndUser Id"
   RoutableId: linked string
      source: @MessagingSession.Id
      description: "MessagingSession Id"
   ContactId: linked string
      source: @MessagingEndUser.ContactId
      description: "MessagingEndUser ContactId"
   EndUserLanguage: linked string
      source: @MessagingSession.EndUserLanguage
      description: "MessagingSession EndUserLanguage"

language:
   default_locale: "en_US"
   additional_locales: ""
   all_additional_locales: False

system:
   instructions: |
      You are a customer service agent. Be friendly and concise.
      Always verify identity before accessing account data.
   messages:
      welcome: "Hello! How can I help you today?"
      error: "I apologize. Let me transfer you to a team member."

start_agent topic_selector:
   label: "Topic Selector"
   description: "Routes messages to the appropriate topic"
   reasoning:
      instructions: ->
         | Analyze the message and determine the best topic.
      actions:
         verify: @utils.transition to @topic.identity
            description: "Verify customer identity"
         orders: @utils.transition to @topic.order_management
            description: "Help with order status or modifications"
         escalate: @utils.escalate
            description: "Transfer to human agent"

topic identity:
   label: "Identity Verification"
   description: "Verifies customer identity via email lookup"

   actions:
      lookup_customer:
         description: "Look up customer by email"
         inputs:
            email: string
               description: "Customer email address"
               is_required: True
         outputs:
            found: boolean
               description: "Whether a matching customer was found"
               is_used_by_planner: True
         target: "apex://LookupCustomerAction"

   reasoning:
      instructions: ->
         if @variables.is_verified == True:
            | Customer is already verified.
            transition to @topic.order_management
         | Ask for their email address to verify identity.
      actions:
         lookup: @actions.lookup_customer
            with email = ...
            set @variables.is_verified = @outputs.found

   after_reasoning: ->
      if @variables.is_verified == True:
         transition to @topic.order_management

topic order_management:
   label: "Order Management"
   description: "Helps customers check order status"

   actions:
      get_order_details:
         description: "Retrieve order details by order number"
         inputs:
            order_number: string
               description: "The order number to look up"
               is_required: True
               is_user_input: True
            customer_email: string
               description: "Customer email for verification"
               is_required: True
         outputs:
            status: string
               description: "Current order status"
               is_displayable: True
               is_used_by_planner: True
            tracking_number: string
               description: "Shipping tracking number"
               is_displayable: True
         target: "apex://GetOrderDetailsAction"

   reasoning:
      instructions: ->
         if @variables.is_verified == False:
            transition to @topic.identity
         | Help the customer with their order inquiry.
      actions:
         get_order: @actions.get_order_details
            with order_number = ...
            with customer_email = @variables.customer_email
```

> **Two-block pattern**: Actions are declared in a top-level `actions:` block (with `target`, `inputs`, `outputs`) and referenced in `reasoning.actions` via `@actions.<name>` with `with`/`set`. The `target:` field resolves to the underlying implementation. In namespaced orgs, prefix: `target: "apex://ns__ClassName"` (check `sfdx-project.json`).

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
-> run @actions.get_recent_orders
      with customer_id = @variables.customer_id
      set @variables.recent_orders = @outputs.orders
```

---

## Action Types

### Apex @InvocableMethod

Apex actions are built by `sf-apex-agent` using patterns from `sf-apex-constraints`. Key Agentforce-specific requirements:

- **Labels/descriptions are critical** — the LLM reads these to decide routing
- **InvocableVariable descriptions** must specify data type and format: `"accountId — 18-digit Account record ID"`
- **Return result objects** (not void) — agent needs structured confirmation
- **Use `Database` class** (partial success) not DML verbs (all-or-nothing)
- **Varied verb names**: "Locate", "Retrieve", "Calculate" — not "Get X", "Get Y"
- **Decompose** complex actions to avoid CPU timeout (10s sync limit)
- **Long-running work**: enqueue Queueable, return requestId

### Other Action Types

MCP Server, Named Query, AuraEnabled, Apex Citations, Lightning Types, Adaptive Response Formats, Flow Actions, and Prompt Templates are documented in:

@_reference/ACTION_TYPES.md

For MCP Server actions specifically, see skill `sf-agentforce-mcp-actions`.

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
  genAiPlannerBundles/My_Agent/  # .genAiPlannerBundle-meta.xml (auto-generated by publish)
  genAiPlugins/Topic_Name/       # .genAiPlugin-meta.xml
  genAiFunctions/Action_Name/    # .genAiFunction-meta.xml (Classic UI only — Agent Script wires via target:)
  aiEvaluationDefinitions/       # .aiEvaluationDefinition-meta.xml
```

**Deploy order (Classic UI)**: Bot/BotVersion → GenAiPromptTemplate → GenAiFunction → GenAiPlugin → GenAiPlannerBundle → AiAuthoringBundle → AiEvaluationDefinition → Activate

**Deploy order (Agent Script)**: Deploy Apex `@InvocableMethod` classes → `sf agent publish authoring-bundle` (handles everything else)

**Retrieve**: `sf project retrieve start --metadata "AiAuthoringBundle:My_Agent*"`

---

## Security

- Always use `with sharing` and `AccessLevel.USER_MODE` / `WITH USER_MODE`
- Ground Prompt Templates only with fields the user's profile can read
- Review agent conversations in Setup > Agent Conversations

---

## Classic Topics (Pre-Agent Script)

For orgs on API < v65, configure topics in Agentforce Builder UI with classification description, WILL/WILL NOT scope, and numbered instructions (positive framing). All instruction guidelines and context engineering principles from the reference apply identically.

---

## Related

- Agent: `sf-agentforce-agent` — for interactive guidance
- Constraints: sf-apex-constraints
- Reference: @../_reference/AGENTFORCE_PATTERNS.md
