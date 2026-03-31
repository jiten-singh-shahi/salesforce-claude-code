# Agentforce Patterns — Reference

> Source: https://developer.salesforce.com/docs/ai/agentforce/guide/get-started-actions.html
> Also: https://developer.salesforce.com/blogs/2025/07/best-practices-for-building-agentforce-apex-actions
> Also: https://developer.salesforce.com/blogs/2025/01/how-to-write-effective-natural-language-instructions-for-agentforce
> Last verified: API v66.0, Spring '26 (2026-03-28)

## Architecture

```
Agent
 +-- Topic (job-to-be-done container, e.g. "Order Management")
 |    +-- Classification Description (routes user queries to this topic)
 |    +-- Scope (what the agent WILL and WILL NOT do)
 |    +-- Instructions (numbered guidelines for agent behavior)
 |    +-- Actions (1..N tools the agent can invoke)
 |         +-- Action Instructions (purpose, goal, scope)
 |         +-- Input Parameters (with input instructions)
 |         +-- Output Parameters (with output instructions)
 +-- Topic ...
```

**Recommended limits**: max 10 topics per agent; 12-15 actions per topic. Exceeding causes context confusion in the Atlas reasoning engine.

## Action Types

| Action Source | How It Works | When to Use |
|---|---|---|
| **Apex `@InvocableMethod`** | Annotated static method exposed to Agentforce Builder | Custom business logic, DML, callouts |
| **Apex REST** | `@RestResource` class registered via API catalog | External API wrappers |
| **AuraEnabled** | `@AuraEnabled` controller method with OpenAPI doc | Reusing existing LWC controller logic |
| **Autolaunched Flow** | Flow with no screens; invoked as action | Declarative orchestration, record ops |
| **Prompt Template** | Flex prompt template from Prompt Builder | LLM-generated text, summaries, classification |
| **Named Query (Beta)** | Custom SOQL exposed as action | Read-only data retrieval |
| **MCP Server** | External tool via Model Context Protocol | Third-party integrations |

All action types support enhancement via: Lightning Types (rich UI), Global Copy, Apex Citations (knowledge articles, PDFs, external URLs).

## Apex Action Rules

| Rule | Detail |
|---|---|
| Annotation | `@InvocableMethod(label='...' description='...')` on a `public static` method |
| Sharing | Always use `with sharing`; run DML/queries in `with user` mode |
| Bulkification | Actions do NOT bulkify by default; each executes in its own transaction |
| Error handling | Use `try-catch`; return user-friendly messages; use `Database` class for partial processing |
| Decomposition | Break complex actions into smaller ones to avoid CPU timeout (10s sync limit) |
| Async work | Use Queueable Apex for long-running tasks; return a requestId for status tracking |
| Labels | Keep Apex `label`/`description` in sync with Agentforce Builder action config |

## Instruction Guidelines

| Instruction Type | Rules |
|---|---|
| **Topic Classification** | Concise; describes what queries route here. E.g. "Manages customer inquiries about order status and returns." |
| **Topic Scope** | Explicit WILL/WILL NOT. E.g. "Handle resending confirmations, but do not create new reservations." |
| **Topic Instructions** | Numbered list in a single box. Positive framing ("always do X" not "don't do Y"). No deterministic business rules here -- put those in action code. |
| **Action Instructions** | 1-3 sentences: purpose, goal, scope. Specify dependent actions. Use varied verb names across actions. |
| **Input Instructions** | Specify field name, data type, format. E.g. "accountId -- The 18-digit unique Account record ID" |
| **Output Instructions** | Describe return value with type. E.g. "balance: numeric value representing current account balance" |

**Anti-patterns**: Overusing "must"/"never"/"always" (agent gets stuck); relying on topic instructions for input validation (use action code); similar action names like "Get Project Details" vs "Get Task Details" (use varied verbs: "Locate" vs "Retrieve").

## Agent Script (Agentforce Builder)

Agent Script combines natural language instructions with programmatic expressions.

| Element | Purpose |
|---|---|
| Instructions | LLM reasoning areas (non-deterministic) |
| Expressions | If/else conditions, transitions, variable ops (deterministic) |
| Variables | Store conversation state; prevent context window overflow |
| `@` references | Link to actions and topics in Canvas view |
| `/` shortcut | Insert expressions in Canvas view |
| Topic pass-through | Chain actions across topics; deterministic or LLM-controlled |

Development surfaces: Canvas View (visual blocks), Script View (syntax highlighting + autocomplete), Agentforce DX (local VS Code with `sf agent` CLI).

## Invocation Channels

| Channel | Method |
|---|---|
| Flow | Standard "AI Agent" action in Flow Builder; pass user message + optional session ID |
| Apex | Invocable Action API with agent API name; REST-exposable |
| LWC | Via Apex method call |
| External systems | REST with OAuth 2.0 (Web-Server or User-Agent flow) |
| Agent-to-agent | Flow-based agent action invocation |
| Slack, websites, apps | Deploy via Agentforce channel configuration |

Session ID ties multi-turn conversations together. First message generates the ID; pass it with subsequent messages.

## Testing

| Tool | Purpose |
|---|---|
| **Agent Builder Preview** | Real-time conversational testing with context simulation (language, app, page, record) |
| **Agentforce Testing Center** | Bulk test execution; auto-generates test cases from knowledge base content |
| **Agentforce DX CLI** | `sf agent generate test-spec` (YAML), `sf agent test create`, `sf agent test run` |
| **VS Code Agent Panel** | View/run tests; Agent Preview pane for conversations; Apex Replay Debugger for actions |
| **Testing API** | REST API + Connect API for programmatic test execution |
| **Apex unit tests** | Standard `@isTest` for action implementation code |

DX test workflow: generate YAML spec -> customize test cases -> create in org -> run -> integrate into CI pipeline.

## Context Engineering Principles

1. Limit topics (max 10) and actions per topic (12-15) to avoid context confusion
2. Use variables to store key facts instead of relying on conversation memory
3. Eliminate contradictions across topic instructions, action instructions, and scope definitions
4. Validate RAG/knowledge data is current and accurate
5. Use structured actions for critical business logic; reserve natural language for conversational tasks
6. Four failure modes to watch: context distraction, context clash, context poisoning, context confusion
