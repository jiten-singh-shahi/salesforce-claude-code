---
name: prompt-optimizer
description: >-
  Use when improving a Salesforce, Apex, or LWC prompt. Analyze intent and gaps,
  match SCC skills/agents, output a ready-to-paste optimized prompt. Advisory only.
origin: SCC
user-invocable: true
---

# Prompt Optimizer

Analyze a draft prompt, critique it, match it to SCC ecosystem components,
and output a complete optimized prompt the user can paste and run.

## When to Use

- User says "optimize this prompt", "improve my prompt", "rewrite this prompt"
- User says "help me write a better prompt for..."
- User says "what's the best way to ask Claude Code to..."
- User pastes a draft prompt and asks for feedback or enhancement
- User says "I don't know how to prompt for this"
- User says "how should I use SCC for..."
- User explicitly invokes `/prompt-optimizer`

### Do Not Use When

- User wants the task done directly (just execute it)
- User says "optimize this code", "optimize performance" — these are refactoring tasks, not prompt optimization
- User is asking about SCC configuration (use `configure-scc` instead)
- User wants a skill inventory (use `/sf-harness-audit` skill instead)
- User says "just do it"

## How It Works

**Advisory only — do not execute the user's task.**

Do NOT write code, create files, run commands, or take any implementation
action. Your ONLY output is an analysis plus an optimized prompt.

If the user says "just do it" or "don't optimize, just execute",
do not switch into implementation mode inside this skill. Tell the user this
skill only produces optimized prompts, and instruct them to make a normal
task request if they want execution instead.

Run this 6-phase pipeline sequentially. Present results using the Output Format below.

### Analysis Pipeline

### Phase 0: Project Detection

Before analyzing the prompt, detect the current project context:

1. Check if a `CLAUDE.md` exists in the working directory — read it for project conventions
2. Detect tech stack from project files:
   - `sfdx-project.json` → Salesforce (Apex / LWC / SOQL / Flow / Agentforce)
   - `package.json` → Node.js / LWC tooling / Jest tests
3. Note detected tech stack for use in Phase 3 and Phase 4

If no project files are found (e.g., the prompt is abstract or for a new project),
skip detection and flag "tech stack unknown" in Phase 4.

### Phase 1: Intent Detection

Classify the user's task into one or more categories:

| Category | Signal Words | Example |
|----------|-------------|---------|
| New Feature | build, create, add, implement | "Build a lead scoring trigger" |
| Bug Fix | fix, broken, not working, error | "Fix the trigger recursion" |
| Refactor | refactor, clean up, restructure | "Refactor to trigger framework" |
| Research | how to, what is, explore, investigate | "How to add Platform Events" |
| Testing | test, coverage, verify | "Add tests for AccountService" |
| Review | review, audit, check | "Review my Apex trigger" |
| Documentation | document, update docs | "Update the API docs" |
| Infrastructure | deploy, CI, scratch org, DevOps | "Set up CI/CD with scratch orgs" |
| Design | design, architecture, plan | "Design the data model" |

### Phase 2: Scope Assessment

If Phase 0 detected a project, use codebase size as a signal. Otherwise, estimate
from the prompt description alone and mark the estimate as uncertain.

| Scope | Heuristic | Orchestration |
|-------|-----------|---------------|
| TRIVIAL | Single file, < 50 lines | Direct execution |
| LOW | Single component or module | Single command or skill |
| MEDIUM | Multiple components, same domain | Command chain + sf-review-agent agent |
| HIGH | Cross-domain, 5+ files | Use sf-architect agent first, then phased execution |
| EPIC | Multi-session, multi-PR, architectural shift | Use sf-architect agent for multi-session plan |

### Phase 3: SCC Component Matching

Map intent + scope + tech stack (from Phase 0) to specific SCC components.

#### By Intent Type

| Intent | Invocable Skills | Skills | Agents |
|--------|----------|--------|--------|
| New Feature | /sf-tdd-workflow, /sf-apex-best-practices | sf-apex-best-practices, sf-apex-enterprise-patterns | sf-architect, sf-apex-agent, sf-review-agent |
| Bug Fix | /sf-tdd-workflow, /sf-build-fix | sf-apex-testing, sf-debugging | sf-bugfix-agent, sf-apex-agent |
| Refactor | /refactor-clean, /sf-apex-best-practices | sf-trigger-frameworks, sf-apex-enterprise-patterns | refactor-cleaner, sf-review-agent |
| Testing | /sf-tdd-workflow, /sf-apex-testing, /sf-e2e-testing | sf-apex-testing, sf-tdd-workflow | sf-apex-agent |
| Review | /sf-apex-best-practices, /sf-lwc-development, /sf-security | sf-security | sf-review-agent, sf-review-agent |
| Documentation | /update-docs | — | doc-updater, deep-researcher |
| Infrastructure | /sf-deployment | sf-devops-ci-cd, sf-deployment | sf-architect |
| Design (EPIC) | — | — | sf-architect, sf-architect |

#### By Tech Stack

| Tech Stack | Skills to Add | Agent |
|------------|--------------|-------|
| Apex | sf-apex-best-practices, sf-apex-testing, sf-security | sf-review-agent |
| LWC | sf-lwc-development, sf-lwc-testing | sf-lwc-agent |
| SOQL | sf-soql-optimization | sf-apex-agent |
| Flow | sf-flow-development | sf-flow-agent |
| Agentforce | sf-agentforce-development | sf-agentforce-agent |
| DevOps | sf-devops-ci-cd, sf-deployment | sf-architect |
| Security | sf-security | sf-review-agent |
| EPIC | — | sf-architect, sf-architect |

### Phase 4: Missing Context Detection

Scan the prompt for missing critical information. Check each item and mark
whether Phase 0 auto-detected it or the user must supply it:

- [ ] **Tech stack** — Detected in Phase 0, or must user specify?
- [ ] **Target scope** — Files, directories, or modules mentioned?
- [ ] **Acceptance criteria** — How to know the task is done?
- [ ] **Error handling** — Edge cases and failure modes addressed?
- [ ] **Security requirements** — Auth, input validation, secrets?
- [ ] **Testing expectations** — Unit, integration, E2E?
- [ ] **Performance constraints** — Governor limits, bulk patterns, SOQL selectivity?
- [ ] **UI/UX requirements** — Design specs, SLDS compliance, accessibility? (if LWC)
- [ ] **Database changes** — Schema, migrations, indexes? (if data layer)
- [ ] **Existing patterns** — Reference files or conventions to follow?
- [ ] **Scope boundaries** — What NOT to do?

**If 3+ critical items are missing**, ask the user up to 3 clarification
questions before generating the optimized prompt. Then incorporate the
answers into the optimized prompt.

### Phase 5: Workflow & Model Recommendation

Determine where this prompt sits in the development lifecycle:

```
Research → Plan → Implement (TDD) → Review → Verify → Commit
```

For MEDIUM+ tasks, always start with the sf-architect agent. For EPIC tasks, use the sf-architect agent.

**Model recommendation** (include in output):

| Scope | Recommended Model | Rationale |
|-------|------------------|-----------|
| TRIVIAL-LOW | Sonnet | Fast, cost-efficient for simple tasks |
| MEDIUM | Sonnet | Best coding model for standard work |
| HIGH | Sonnet (main) + Opus (planning) | Opus for architecture, Sonnet for implementation |
| EPIC | Opus (sf-architect) + Sonnet (execution) | Deep reasoning for multi-session planning |

**Multi-prompt splitting** (for HIGH/EPIC scope):

For tasks that exceed a single session, split into sequential prompts:

- Prompt 1: Research + Plan (use search-first skill, then sf-architect agent)
- Prompt 2-N: Implement one phase per prompt (each ends with sf-review-agent agent)
- Final Prompt: Integration test + /sf-apex-best-practices across all phases
- Use /save-session and /resume-session to preserve context between sessions

---

## Output Format

Present your analysis in this exact structure. Respond in the same language
as the user's input.

### Section 1: Prompt Diagnosis

**Strengths:** List what the original prompt does well.

**Issues:**

| Issue | Impact | Suggested Fix |
|-------|--------|---------------|
| (problem) | (consequence) | (how to fix) |

**Needs Clarification:** Numbered list of questions the user should answer.
If Phase 0 auto-detected the answer, state it instead of asking.

### Section 2: Recommended SCC Components

| Type | Component | Purpose |
|------|-----------|---------|
| Command | /sf-tdd-workflow | TDD workflow for Apex |
| Skill | sf-apex-best-practices | Apex coding standards |
| Agent | sf-review-agent | Post-implementation review |
| Model | Sonnet | Recommended for this scope |

### Section 3: Optimized Prompt — Full Version

Present the complete optimized prompt inside a single fenced code block.
The prompt must be self-contained and ready to copy-paste. Include:

- Clear task description with context
- Tech stack (detected or specified)
- /command invocations at the right workflow stages
- Acceptance criteria
- Verification steps
- Scope boundaries (what NOT to do)

For items that reference blueprint, write: "Use the sf-architect agent to..."
(not `/blueprint`, since sf-architect is an agent, not a command).

### Section 4: Optimized Prompt — Quick Version

A compact version for experienced SCC users. Vary by intent type:

| Intent | Quick Pattern |
|--------|--------------|
| New Feature | `Use sf-architect agent for [feature]. /sf-tdd-workflow to implement. /sf-apex-best-practices. Use sf-review-agent agent.` |
| Bug Fix | `/sf-tdd-workflow — write failing test for [bug]. Fix to green. Use sf-review-agent agent.` |
| Refactor | `/refactor-clean [scope]. /sf-apex-best-practices. Use sf-review-agent agent.` |
| Research | `Use search-first skill for [topic]. Use sf-architect agent based on findings.` |
| Testing | `/sf-tdd-workflow [class]. /sf-e2e-testing for critical flows. /sf-apex-testing.` |
| Review | `/sf-apex-best-practices. Then use sf-review-agent agent.` |
| Docs | `/update-docs. Use deep-researcher agent.` |
| EPIC | `Use sf-architect agent for "[objective]". Execute phases with sf-review-agent agent gates.` |

### Section 5: Enhancement Rationale

| Enhancement | Reason |
|-------------|--------|
| (what was added) | (why it matters) |

### Footer

> Not what you need? Tell me what to adjust, or make a normal task request
> if you want execution instead of prompt optimization.

---

## Examples

### Trigger Examples

- "Optimize this prompt for SCC"
- "Rewrite this prompt so Claude Code uses the right commands"
- "How should I prompt SCC for this task?"

### Example 1: Vague Salesforce Prompt (Project Detected)

**User input:**

```
Help me write an Account trigger
```

**Phase 0 detects:** `sfdx-project.json` → Salesforce project; `package.json` with Jest

**Optimized Prompt (Full):**

```
Implement an Account trigger using the project's existing Trigger Framework pattern.

Technical requirements:
- Follow the project's existing trigger handler architecture (check for TriggerHandler base class or similar framework)
- Implement bulkification — all SOQL queries and DML operations must be outside loops
- Add appropriate error handling and custom exception classes
- Follow Salesforce governor limits best practices

Workflow:
1. Use sf-architect agent to plan trigger handler structure and business logic
2. /sf-tdd-workflow — write failing test class first (use @TestSetup and test data factory)
3. Implement AccountTrigger and AccountTriggerHandler
4. /sf-apex-best-practices to review implementation
5. Use sf-review-agent agent to verify all tests pass and coverage reaches 75%+

Security requirements:
- Use WITH USER_MODE for SOQL queries
- Verify CRUD/FLS permissions

Acceptance criteria:
- Test coverage 85%+
- Zero governor limit violations
- Passes /sf-security review
```

### Example 2: Moderate English Prompt

**User input:**

```
Add a REST API endpoint for account creation with validation
```

**Phase 0 detects:** `sfdx-project.json` → Salesforce project

**Optimized Prompt (Full):**

```
Add a REST API endpoint for account creation (POST /api/accounts).

Tech stack: Salesforce Apex REST (detected from sfdx-project.json)

Requirements:
- @RestResource(urlMapping='/api/accounts')
- Input validation: Name (required), Industry, BillingCountry
- Auth: Connected App OAuth — caller must have Account create permission
- Return 201 with created Account Id on success
- Return 400 with validation errors on invalid input
- Return 403 for insufficient permissions

Workflow:
1. Use sf-architect agent for the endpoint structure, validation logic, and error response envelope
2. /sf-tdd-workflow — write tests for success, validation failure, permission failure
3. Implement AccountAPI class following existing REST patterns
4. /sf-security — verify CRUD/FLS enforcement
5. /sf-apex-best-practices
6. Use sf-review-agent agent — run full test suite, confirm no regressions

Do not:
- Modify existing Account fields or validation rules
- Add new custom fields without a separate plan step
```

### Example 3: EPIC Project

**User input:**

```
Migrate our legacy Apex triggers to a trigger framework
```

**Optimized Prompt (Full):**

```
Use the sf-architect agent to plan: "Migrate all legacy Apex triggers to trigger framework"

Before executing, answer these questions in the blueprint:
1. Which trigger framework is preferred (custom TriggerHandler, Apex Commons, or other)?
2. How many triggers exist and which objects are highest priority?
3. Are there existing test classes that need to be preserved?
4. What is the deployment strategy (all at once vs object-by-object)?

The blueprint should produce phases like:
- Phase 1: Audit all existing triggers and document business logic
- Phase 2: Implement TriggerHandler base class and factory
- Phase 3: Migrate highest-priority object triggers with /sf-tdd-workflow gates
- Phase 4: Migrate remaining triggers
- Phase N: Remove legacy trigger code, run full regression

Each phase = 1 deployment unit, with sf-review-agent agent gates between phases.
Use /save-session between phases. Use /resume-session to continue.

Recommended: Opus for blueprint planning, Sonnet for phase execution.
```

---

## Related Components

| Component | When to Reference |
|-----------|------------------|
| `configure-scc` | User hasn't set up SCC yet |
| `/sf-harness-audit` (skill) | Audit which components are installed (use instead of hardcoded catalog) |
| `search-first` | Research phase in optimized prompts |
| `sf-architect` (agent) | EPIC-scope optimized prompts |
| `strategic-compact` | Long session context management |
| `strategic-compact` (token tips) | Token optimization recommendations |
