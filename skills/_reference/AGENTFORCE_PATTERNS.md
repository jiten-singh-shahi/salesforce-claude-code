# Agentforce Patterns — Reference

> Source: <https://developer.salesforce.com/docs/ai/agentforce/guide/agent-script.html>
> Also: <https://developer.salesforce.com/docs/ai/agentforce/guide/agent-dx.html>
> Also: <https://developer.salesforce.com/blogs/2026/02/agent-script-decoded-intro-to-agent-script-language-fundamentals>
> Also: <https://developer.salesforce.com/blogs/2025/07/best-practices-for-building-agentforce-apex-actions>
> Also: <https://developer.salesforce.com/blogs/2025/01/how-to-write-effective-natural-language-instructions-for-agentforce>
> Last verified: API v66.0, Spring '26 (2026-04-09)

## Architecture

### Agent Script (Recommended — Spring '26+)

```
AiAuthoringBundle (.agent file)
 +-- config (developer_name, agent_label, description)
 +-- variables (mutable read/write, linked read-only)
 +-- system (global instructions, welcome/error messages)
 +-- start_agent (entry point — topic routing)
 +-- topics (1..N conversation domains)
      +-- description (routes user queries here)
      +-- reasoning
      |    +-- instructions (-> procedural + | LLM prompts)
      |    +-- actions (tools exposed to LLM)
      +-- after_reasoning (optional post-LLM deterministic logic)
```

Publishes to: `Bot/BotVersion → GenAiPlannerBundle → GenAiPlugin (topics) → GenAiFunction (actions)`

### Classic Setup (Pre-Agent Script / API < v65)

```
Agent (Bot)
 +-- Topic (GenAiPlugin)
 |    +-- Classification Description
 |    +-- Scope (WILL / WILL NOT)
 |    +-- Instructions (numbered guidelines)
 |    +-- Actions (GenAiFunction, 1..N)
 |         +-- Action Instructions
 |         +-- Input/Output Parameters
 +-- Topic ...
```

**Recommended limits**: max 10 topics per agent; 12-15 actions per topic. Exceeding causes context confusion in the Atlas reasoning engine.

## Agent Script Syntax

Files use `.agent` extension. Stored in `force-app/main/default/aiAuthoringBundles/<Name>/<Name>.agent`. Whitespace-sensitive (3 spaces per indent, no tabs).

### Operators

| Symbol | Purpose |
|---|---|
| `#` | Single-line comment |
| `->` | Begins procedural/executable logic |
| `\|` | Begins natural language prompt text sent to LLM |
| `{!expression}` | Template expression (variable injection at runtime) |
| `...` | Slot-fill token (LLM extracts value from conversation) |
| `@actions.name` | Reference an action |
| `@outputs.name` | Access action output values |
| `@topic.name` | Delegate to another topic (returns to caller) |
| `@variables.name` | Reference a variable |
| `@utils.escalate` | Escalate to human agent |
| `@utils.setVariables` | Instruct LLM to set variable values |
| `@utils.transition to` | LLM-selected topic transition (in reasoning.actions) |
| `transition to` | Deterministic topic transition (in reasoning.instructions or after_reasoning) |

### Comparison & Logical Operators

| Type | Operators |
|---|---|
| Comparison | `==`, `!=`, `<`, `>`, `>=`, `<=`, `is None`, `is not None` |
| Logical | `&&`, `\|\|`, `!` |
| Arithmetic | `+`, `-` only (no `*`, `/`, `%`) |
| Conditionals | `if` / `else` (no `else if` — use separate `if` statements) |
| Booleans | Must be capitalized: `True`, `False` |

### Required Block Order

1. **config** — `developer_name` (required), `agent_label`, `description`, `default_agent_user`
2. **variables** — `mutable <type> = <default>` or `linked <type>` with `source: "..."` (read-only)
3. **system** — `instructions`, `messages.welcome`, `messages.error`
4. **start_agent** — Entry point; topic classification and routing
5. **topics** — Conversation domains with `reasoning` (required) and `after_reasoning` (optional)

### Variable Types

| Kind | Syntax | Use |
|---|---|---|
| Mutable | `name: mutable string = ""` | Read/write state (string, boolean, number) |
| Linked | `name: linked string` + `source: "EndUserLanguage"` | Read-only from external context (session, channel) |

### Action Invocation

**Deterministic (run)** — executes unconditionally in procedural logic:

```
-> run @actions.get_order with
     order_id: @variables.order_id
   set
     order_details: result
```

**LLM-Driven (reasoning.actions)** — LLM decides when to call:

```
reasoning:
  actions:
    lookup_order:
      action: @actions.get_order
      description: "Retrieves order details by ID"
      inputs:
        order_id: ...
      set:
        order_details: output
```

### Conditional Tool Display

```
actions:
  refund_order:
    action: @actions.process_refund
    description: "Process a refund"
    available when: @variables.is_verified == True && @variables.order_total > 0
```

`available when` hides the action from the LLM until conditions are met. Use for gating sensitive operations behind authentication or state checks.

### Topic Transitions

| Method | Where | Syntax |
|---|---|---|
| Deterministic | `reasoning.instructions`, `after_reasoning` | `transition to <topic>` |
| LLM-selected | `reasoning.actions` | `@utils.transition to @topic.<name>` |
| Delegation | Anywhere | `@topic.<name>` (returns to caller after completion) |

### Execution Flow (Runtime Pipeline)

1. User message arrives
2. `start_agent` evaluates — routes to appropriate topic via `reasoning.instructions`
3. Selected topic's `reasoning.instructions` execute top-to-bottom (deterministic `->` lines)
4. All `|` (pipe) text accumulates into a single prompt sent to the LLM
5. LLM processes prompt and may invoke tools from `reasoning.actions`
6. Variables update from action outputs (`set` clauses)
7. `after_reasoning` executes (deterministic cleanup/mandatory transitions)
8. Cycle repeats for next user message

## Metadata Types

| Metadata Type | package.xml Name | Directory | API Version | Purpose |
|---|---|---|---|---|
| AiAuthoringBundle | `AiAuthoringBundle` | `aiAuthoringBundles/<Name>/` | v65+ | Agent Script container (`.agent` + `.bundle-meta.xml`) |
| Bot | `Bot` | `bots/` | v38+ | Top-level agent representation |
| BotVersion | `BotVersion` | `botVersions/` | v38+ | Agent version config (one active per agent) |
| GenAiPlannerBundle | `GenAiPlannerBundle` | `genAiPlannerBundles/` | v64+ | Reasoning engine container (replaces GenAiPlanner) |
| GenAiPlugin | `GenAiPlugin` | `genAiPlugins/` | v60+ | Agent topic (category of related actions) |
| GenAiFunction | `GenAiFunction` | `genAiFunctions/<Name>/` | v60+ | Agent action (input/output in schema.json) |
| GenAiPromptTemplate | `GenAiPromptTemplate` | `genAiPromptTemplates/` | v60+ | Prompt template for LLM guidance |
| AiEvaluationDefinition | `AiEvaluationDefinition` | `aiEvaluationDefinitions/` | v63+ | Agent test definitions |
| LightningTypeBundle | `LightningTypeBundle` | `lightningTypes/<Name>/` | v64+ | Rich UI type for agent responses |
| ConversationContextVariable | — | — | v60+ | Context variables (session, channel) |
| ConversationVariable | — | — | v60+ | Customer data collected during conversation |

**Deployment order** (strict): Bot/BotVersion → GenAiPromptTemplate → GenAiFunction → GenAiPlugin → GenAiPlannerBundle → Activate BotVersion

**Legacy**: GenAiPlanner (v60-63) replaced by GenAiPlannerBundle in v64+.

## Action Types

| Action Source | How It Works | When to Use |
|---|---|---|
| **Apex `@InvocableMethod`** | Annotated static method exposed to Agentforce Builder | Custom business logic, DML, callouts |
| **Autolaunched Flow** | Flow with no screens; invoked as action | Declarative orchestration, record ops |
| **Prompt Template** | Flex prompt template from Prompt Builder | LLM-generated text, summaries, classification |
| **MCP Server** | External tool via Model Context Protocol (JSON-RPC 2.0 over HTTP/SSE) | Third-party integrations; registered in MCP Server Registry |
| **Named Query (GA)** | Parameterized SOQL exposed as REST API and agent action | Read-only data retrieval without Apex/Flow |
| **AuraEnabled (Beta)** | `@AuraEnabled` method with auto-generated OpenAPI spec via API Catalog | Reusing existing LWC/Aura controller logic |
| **Apex REST** | `@RestResource` class registered via API Catalog | External API wrappers |

### Action Enhancements

| Enhancement | Purpose |
|---|---|
| **Apex Citations** | Source attribution via `GenAiCitationInput` (auto-placement) or `GenAiCitationOutput` (explicit control). Sources: knowledge articles, PDFs, external URLs |
| **Lightning Types** | `LightningTypeBundle` with `schema.json` + channel-specific `renderer.json`/`editor.json`. Custom LWC targets: `lightning__AgentforceInput`, `lightning__AgentforceOutput` |
| **Adaptive Response Formats** | Rich Choice (carousel, buttons, list selector) and Rich Link (media card). Available for Service Agents on messaging channels |
| **Global Copy** | Consistent copy-to-clipboard UI in agent responses |

## Apex Action Rules

| Rule | Detail |
|---|---|
| Annotation | `@InvocableMethod(label='...' description='...')` on a `public static` method |
| Sharing | Always use `with sharing`; run DML/queries in `with user` mode |
| Bulkification | Actions do NOT bulkify by default; each executes in its own transaction |
| Error handling | Use `try-catch`; return user-friendly messages; use `Database` class for partial processing |
| Decomposition | Break complex actions into smaller ones to avoid CPU timeout (10s sync limit) |
| Async work | Use Queueable Apex for long-running tasks; return a requestId for status tracking |
| Labels | Keep Apex `label`/`description` in sync with Agentforce Builder action config — LLM reads these for routing |
| Return type | Return a result object (not void); agent needs structured confirmation to continue reasoning |

## Instruction Guidelines

Applies to both Agent Script (in `|` prompt blocks, `description` fields) and Classic Setup.

| Instruction Type | Rules |
|---|---|
| **Topic Classification** | Concise; describes what queries route here. Eliminate semantic overlap between topics. E.g. "Manages customer inquiries about order status and returns." |
| **Topic Scope** | Explicit WILL/WILL NOT. E.g. "Handle resending confirmations, but do not create new reservations." |
| **Topic Instructions** | Numbered list, positive framing ("always do X" not "don't do Y"). No deterministic business rules — put those in action code or Agent Script `->` logic |
| **Action Instructions** | 1-3 sentences: purpose, goal, scope. Specify dependent actions. Use varied verb names ("Locate", "Retrieve", "Calculate" — not "Get X", "Get Y") |
| **Input Instructions** | Specify field name, data type, format. E.g. "accountId — The 18-digit unique Account record ID" |
| **Output Instructions** | Describe return value with type. E.g. "balance: numeric value representing current account balance" |

**Anti-patterns**: Overusing "must"/"never"/"always" (agent gets stuck); relying on instructions for input validation (use action code); similar action names (use varied verbs); overscripting every conversational turn (stifles LLM reasoning).

## Context Engineering

### Five Levels of Determinism

| Level | Mechanism | Determinism |
|---|---|---|
| 1 | Topic & action selection via classification descriptions | Low — LLM chooses |
| 2 | Agent instructions as behavioral guardrails | Low-Medium — LLM interprets |
| 3 | Data grounding (RAG via Data Cloud, knowledge articles) | Medium — facts constrain LLM |
| 4 | Explicit state via variables (persistent grounding, action I/O mapping, conditional filtering) | High — variables gate logic |
| 5 | Deterministic actions (Apex, Flow, Agent Script `->` logic) | Full — code executes |

**Rule of thumb**: If a workflow involves >3 sequential steps, use Level 5 (deterministic code) rather than relying on topic instructions.

### Four Context Failures

| Failure | Description |
|---|---|
| **Context Distraction** | Too many irrelevant tools dilute decision quality. Mitigate with focused topics |
| **Context Clash** | Contradicting instructions across prompts, topics, actions, RAG data |
| **Context Poisoning** | Inaccurate or outdated grounding data (knowledge articles, CRM records) |
| **Context Confusion** | Too many complex competing tasks; facts assigned to wrong entities |

### Principles

1. Limit topics (max 10) and actions per topic (12-15)
2. Use variables to store key facts — do not rely on conversation memory
3. Eliminate contradictions across topic instructions, action instructions, and scope
4. Validate RAG/knowledge data is current and accurate
5. Use structured actions for critical business logic; reserve natural language for conversational tasks
6. Only enforce determinism where necessary (access control, critical rules) — agents need flexibility

## Testing

### Built-in Metrics

| Metric | Expectation Name | Description |
|---|---|---|
| Topic | `topic_sequence_match` | Verifies correct topic routing |
| Action | `action_sequence_match` | Verifies correct action execution |
| Outcome | `bot_response_rating` | Natural language comparison of expected vs actual |
| Coherence | `coherence` | Easy to understand, no grammar errors |
| Completeness | `completeness` | Includes all essential information |
| Conciseness | `conciseness` | Brief but comprehensive |
| Latency | `output_latency_milliseconds` | Response time measurement |
| Instruction Adherence | `instructionAdherence` | Alignment with topic instructions (HIGH/LOW/UNCERTAIN) |
| Factuality | `factuality` | How factual the response is |

### Test Spec YAML Format

```yaml
name: My_Agent_Tests
subjectType: AGENT
subjectName: My_Agent
testCases:
  - utterance: "What's my order status?"
    expectedTopic: Order_Management
    expectedActions:
      - Get_Order_Status
    expectedOutcome: "Your order #12345 is shipped."
    contextVariables:
      - name: EndUserLanguage
        value: en
    metrics:
      - topic_sequence_match
      - action_sequence_match
      - bot_response_rating
      - coherence
```

### Testing Tools

| Tool | Purpose |
|---|---|
| **Agent Builder Preview** | Real-time conversational testing (simulated or live mode) |
| **Agentforce Testing Center** | Bulk test execution; auto-generates test cases from knowledge |
| **Agentforce DX CLI** | `sf agent generate test-spec`, `sf agent test create`, `sf agent test run` |
| **VS Code Agent Panel** | View/run tests; Agent Preview pane; Apex Replay Debugger for actions |
| **Testing REST API** | `POST /einstein/ai-evaluations/runs`, `GET .../runs/{id}`, `GET .../runs/{id}/results` |
| **Agent Grid (Beta)** | Spreadsheet-like environment for rapid testing with real CRM data |
| **Apex unit tests** | Standard `@isTest` for action implementation code |

## SF CLI Agent Commands

Requires SF CLI v2.115.15+ (`@salesforce/plugin-agent`).

### Create & Generate

| Command | Purpose |
|---|---|
| `sf agent generate agent-spec --type <customer\|internal> --role "..." --output-file specs/agentSpec.yaml` | Generate agent spec YAML via LLM interview |
| `sf agent generate authoring-bundle --spec specs/agentSpec.yaml --name "Name" --api-name API_Name` | Generate `.agent` file + metadata XML from spec |
| `sf agent generate authoring-bundle --no-spec` | Generate with default boilerplate |
| `sf agent generate test-spec --output-file specs/testSpec.yaml` | Generate test spec YAML |
| `sf agent generate template --agent-file path/Bot.bot-meta.xml --agent-version 1 --source-org my-org` | Generate agent template for packaging |
| `sf agent create --spec specs/agentSpec.yaml --name "Name" --api-name API_Name` | Create agent in org from spec (non-Agent Script path) |
| `sf template generate project --template agent` | Scaffold sample DX project with agent |

### Publish & Validate

| Command | Purpose |
|---|---|
| `sf agent publish authoring-bundle --target-org my-org` | Publish: validate → generate metadata → deploy |
| `sf agent publish authoring-bundle --skip-retrieve` | Publish without retrieving generated metadata (CI) |
| `sf agent validate authoring-bundle` | Validate syntax/structure without publishing |

### Preview

| Command | Purpose |
|---|---|
| `sf agent preview` | Interactive terminal preview session |
| `sf agent preview start --simulate-actions` | Start programmatic preview (simulated mode) |
| `sf agent preview start --use-live-actions` | Start programmatic preview (live org resources) |
| `sf agent preview send --session-id <id> --message "..."` | Send message to active preview |
| `sf agent preview end --session-id <id>` | End preview and retrieve traces |
| `sf agent preview sessions` | List active preview sessions |

### Test

| Command | Purpose |
|---|---|
| `sf agent test create --spec specs/testSpec.yaml` | Create test in org from YAML spec |
| `sf agent test run --api-name My_Test --wait 10 --result-format junit --output-dir ./results` | Execute tests (sync with JUnit output for CI) |
| `sf agent test resume --test-run-id <id>` | Resume async test run |
| `sf agent test results --test-id <id>` | View completed test results |
| `sf agent test list` | List all agent tests in org |

### Activate & Manage

| Command | Purpose |
|---|---|
| `sf agent activate --api-name My_Agent --version 2` | Activate agent version |
| `sf agent deactivate --api-name My_Agent` | Deactivate agent |
| `sf org create agent-user` | Create default agent user with required profiles/permissions |

## Invocation Channels

| Channel | Method |
|---|---|
| Flow | Standard "AI Agent" action in Flow Builder; pass user message + optional session ID |
| Apex | Invocable Action API with agent API name |
| LWC | Via Apex method call |
| External systems | REST with OAuth 2.0 |
| Agent-to-agent | A2A Protocol for cross-platform delegation; Agent Script `transition to` for internal chaining |
| Slack, websites, apps | Deploy via Agentforce channel configuration |

### Multi-Agent Patterns

| Pattern | Description |
|---|---|
| **Greeter** | Simple intent detection + routing to service rep |
| **Operator** | Intelligent routing to specialist AI agents or humans |
| **Orchestrator** | Manages agent swarm: receives request → creates plan → delegates → aggregates responses |

Session ID ties multi-turn conversations together. First message generates the ID; pass it with subsequent messages.

## Agent Configuration

| Setting | Values | Notes |
|---|---|---|
| **Tone** | `formal`, `neutral`, `casual` | Adjusts per language (e.g., casual English, polite-form Japanese) |
| **Language** | Any supported | Primary language for agent responses |
| **Welcome message** | Up to 800 characters | Customizable initial greeting |
| **Error message** | Up to 800 characters | Fallback response on failure |
| **System message** | Agent persona, mission, tone, guardrails | In Agent Script: `system.instructions` block |
| **Default Agent User** | User record | Required for Service Agents; sets execution context |

## Agent Spec YAML

Generated by `sf agent generate agent-spec`. Input to `sf agent generate authoring-bundle`.

| Field | Type | Default | Description |
|---|---|---|---|
| `agentType` | `customer` \| `internal` | — | Target audience |
| `companyName` | string | — | Organization name |
| `companyDescription` | string | — | Brief company description for context |
| `role` | string | — | Agent's job description (drives topic generation) |
| `maxNumOfTopics` | number | 5 | Maximum topics to generate |
| `agentUser` | string | — | Default agent user email |
| `enrichLogs` | boolean | false | Enable enriched conversation logging |
| `tone` | `formal` \| `neutral` \| `casual` | casual | Response tone |
| `promptTemplateName` | string | — | Optional knowledge grounding template |
| `groundingContext` | string | — | Additional context for LLM |
| `topics[]` | array | (auto-generated) | Topic name + description pairs |

## Limits & Costs

| Limit | Value |
|---|---|
| Agent API timeout | 120 seconds per request |
| Recommended topics per agent | Max 10 (context confusion beyond) |
| Recommended actions per topic | Max 12-15 (routing degrades) |
| Standard action cost | 20 Flex Credits (~$0.10) per action, up to 10K tokens |
| Voice action cost | 30 Flex Credits (~$0.15) per action |
| Per-conversation pricing | $2/conversation (alternative to per-action) |
| Breakeven | 20 actions/conversation ($2.00 Flex = $2.00 per-conversation) |
| Apex CPU timeout | 10 seconds synchronous limit per action |
| Welcome/error message | 800 characters max |

Standard Apex governor limits apply per action (each executes in its own transaction). For heavy computation, offload to Heroku Applink.

## Trust & Security

| Layer | Purpose |
|---|---|
| **Einstein Trust Layer** | Sits between agent UI and LLMs. Configurable data masking, zero data retention, input/output toxicity detection |
| **Instruction Adherence** | AI-generated scoring detects agent deviation from topic instructions (HIGH/LOW/UNCERTAIN) |
| **Sharing enforcement** | `with sharing` + `WITH USER_MODE` in Apex actions |
| **Field-Level Security** | Controls what data the agent can read/surface |
| **MCP Server Registry** | Admin-controlled whitelist for external MCP servers. Rate-limiting, access control |
| **Audit** | Agent conversations reviewable in Setup > Agent Conversations |

## Classic Setup (Pre-Agent Script)

For orgs on API v63 or earlier, or without Agent Script enabled, agents are configured entirely through the Setup UI. Topics and actions are managed in Agentforce Builder without `.agent` files. Use `GenAiPlanner` (v60-63) instead of `GenAiPlannerBundle`. All instruction guidelines, action patterns, context engineering principles, and testing approaches above still apply — only the development surface differs.

## Further Reading

Agentforce evolves rapidly across releases. When this reference does not cover a feature or syntax, check these sources or search the web for the latest documentation.

### Official Documentation

| Topic | URL |
|---|---|
| Agent Script Guide | <https://developer.salesforce.com/docs/ai/agentforce/guide/agent-script.html> |
| Agent Script Language Reference | <https://developer.salesforce.com/docs/ai/agentforce/guide/ascript-reference.html> |
| Agentforce DX Overview | <https://developer.salesforce.com/docs/ai/agentforce/guide/agent-dx.html> |
| Agent Metadata Types | <https://developer.salesforce.com/docs/ai/agentforce/references/agents-metadata-tooling/agents-metadata.html> |
| Agent Metadata (DX) | <https://developer.salesforce.com/docs/ai/agentforce/guide/agent-dx-metadata.html> |
| Generate Authoring Bundle | <https://developer.salesforce.com/docs/ai/agentforce/guide/agent-dx-nga-authbundle.html> |
| Publish Authoring Bundle | <https://developer.salesforce.com/docs/ai/agentforce/guide/agent-dx-nga-publish.html> |
| Generate Agent Spec | <https://developer.salesforce.com/docs/ai/agentforce/guide/agent-dx-generate-agent-spec.html> |
| Lightning Types | <https://developer.salesforce.com/docs/ai/agentforce/guide/lightning-types.html> |
| Apex Citations | <https://developer.salesforce.com/docs/ai/agentforce/guide/citations.html> |
| Test Spec Customization | <https://developer.salesforce.com/docs/ai/agentforce/guide/agent-dx-test-customize.html> |
| Testing API Reference | <https://developer.salesforce.com/docs/ai/agentforce/references/testing-api/testing-connect-reference.html> |
| MCP Solutions Guide | <https://developer.salesforce.com/docs/einstein/genai/guide/mcp.html> |
| Named Query Actions | <https://developer.salesforce.com/docs/ai/agentforce/guide/agent-namedquery.html> |
| InvocableMethod Actions | <https://developer.salesforce.com/docs/ai/agentforce/guide/agent-invocablemethod.html> |
| Agent Script Recipes | <https://developer.salesforce.com/sample-apps/agent-script-recipes/getting-started/overview> |
| Agentforce Considerations | <https://help.salesforce.com/s/articleView?id=ai.copilot_considerations.htm> |

### Developer Blogs

| Topic | URL |
|---|---|
| Agent Script Decoded (Feb 2026) | <https://developer.salesforce.com/blogs/2026/02/agent-script-decoded-intro-to-agent-script-language-fundamentals> |
| Spring '26 Developer Guide | <https://developer.salesforce.com/blogs/2026/01/developers-guide-to-the-spring-26-release> |
| TDX 2026 Developer Guide | <https://developer.salesforce.com/blogs/2026/03/the-salesforce-developers-guide-to-tdx-2026> |
| Agentforce Builder (Admin Blog) | <https://admin.salesforce.com/blog/2026/build-with-confidence-inside-the-new-agentforce-builder> |
| Best Practices: Apex Actions | <https://developer.salesforce.com/blogs/2025/07/best-practices-for-building-agentforce-apex-actions> |
| NL Instructions Guide | <https://developer.salesforce.com/blogs/2025/01/how-to-write-effective-natural-language-instructions-for-agentforce> |
| Context Engineering Guide | <https://developer.salesforce.com/blogs/2025/08/a-developers-guide-to-context-engineering-with-agentforce> |
| Variables & Filters | <https://developer.salesforce.com/blogs/2025/04/control-agent-access-and-decision-making-with-variables-and-filters> |
| MCP Support Across Salesforce | <https://developer.salesforce.com/blogs/2025/06/introducing-mcp-support-across-salesforce> |
| AuraEnabled as Agent Actions | <https://developer.salesforce.com/blogs/2025/09/auraenabled-apex-methods-are-now-available-as-agent-actions> |
| Adaptive Response Formats | <https://developer.salesforce.com/blogs/2025/10/customize-agent-conversations-with-adaptive-response-formats> |

### Architecture & Patterns

| Topic | URL |
|---|---|
| 5 Levels of Determinism | <https://www.salesforce.com/agentforce/five-levels-of-determinism/> |
| Agentic Patterns | <https://architect.salesforce.com/fundamentals/agentic-patterns> |
| Enterprise Agentic Architecture | <https://architect.salesforce.com/docs/architect/fundamentals/guide/enterprise-agentic-architecture> |
| Agent Interoperability (A2A) | <https://www.salesforce.com/blog/agent-interoperability/> |
| Multi-Agent Orchestration | <https://www.salesforce.com/agentforce/multi-agent-orchestration/> |

### Tools & Repositories

| Topic | URL |
|---|---|
| SF CLI plugin-agent (GitHub) | <https://github.com/salesforcecli/plugin-agent> |
| SF CLI Release Notes | <https://github.com/forcedotcom/cli/blob/main/releasenotes/README.md> |
| SF CLI Agent Commands Reference | <https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_reference.meta/sfdx_cli_reference/cli_reference_agent_commands_unified.htm> |
| Agentforce DX VS Code Extension | <https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-agents> |
| AgentExchange Marketplace | <https://agentexchange.salesforce.com> |
