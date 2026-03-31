---
name: strategic-compact
description: >-
  Use when managing context during long Salesforce Apex development sessions. Suggests manual compaction
  at logical intervals to preserve deploy and org context across phases.
origin: SCC
user-invocable: false
---

# Strategic Compact Skill

Suggests manual `/compact` at strategic points in your workflow rather than relying on arbitrary auto-compaction.

## When to Use

- When running long Salesforce development sessions that approach context limits (200K+ tokens)
- When transitioning between distinct development phases (org exploration -> planning -> implementation)
- When switching between unrelated Salesforce domains (Apex -> LWC -> Flow configuration)
- After completing a major milestone (feature shipped, deployment succeeded) before starting new work
- When responses slow down or become less coherent due to context pressure

## Why Strategic Compaction?

Auto-compaction triggers at arbitrary points:

- Often mid-task, losing important context about org structure or governor limits
- No awareness of logical task boundaries
- Can interrupt complex multi-step Salesforce operations (deploy pipeline, test runs)

Strategic compaction at logical boundaries:

- **After org exploration, before implementation** — Compact metadata/schema context, keep implementation plan
- **After completing a feature** — Fresh start for next feature
- **Before switching domains** — Clear Apex context before LWC work

## How It Works

The `suggest-compact.js` script runs on PreToolUse (Edit/Write) and:

1. **Tracks tool calls** — Counts tool invocations in session
2. **Threshold detection** — Suggests at configurable threshold (default: 50 calls)
3. **Periodic reminders** — Reminds every 25 calls after threshold

## Compaction Decision Guide

| Phase Transition | Compact? | Why |
|-----------------|----------|-----|
| Org exploration -> Planning | Yes | Org metadata is bulky; plan is the distilled output |
| Planning -> Apex implementation | Yes | Plan is saved to a file; free up context for code |
| Apex implementation -> LWC work | Yes | Clear Apex context for unrelated frontend work |
| Apex implementation -> Apex testing | Maybe | Keep if tests reference recent code; compact if switching focus |
| Debugging -> Next feature | Yes | Debug traces pollute context for unrelated work |
| Mid-implementation | No | Losing class names, field APIs, and partial state is costly |
| After a failed deployment | Yes | Clear the dead-end reasoning before trying a new approach |
| Trigger work -> Flow work | Yes | Different domains with different context needs |

## What Survives Compaction

Understanding what persists helps you compact with confidence:

| Persists | Lost |
|----------|------|
| CLAUDE.md instructions | Intermediate reasoning and analysis |
| Task list (if saved to a file) | File contents you previously read |
| Project-level settings and rules | Multi-step conversation context |
| Git state (commits, branches) | Tool call history and counts |
| Files on disk | Nuanced user preferences stated verbally |
| Org metadata on disk | SOQL query results from exploration |

## Best Practices

1. **Compact after planning** — Once plan is finalized and saved to a file, compact to start fresh
2. **Compact after debugging** — Clear error-resolution context before continuing
3. **Don't compact mid-implementation** — Preserve context for related Apex/LWC changes
4. **Read the suggestion** — The hook tells you *when*, you decide *if*
5. **Write before compacting** — Save important context (org structure, field APIs) to files or memory before compacting
6. **Use `/compact` with a summary** — Add a custom message: `/compact Focus on implementing trigger handler next`

## Salesforce-Specific Tips

- **Save org metadata before compacting** — Object/field lists, record type IDs, profile names
- **Save governor limit findings** — If you discovered limit issues, document them first
- **Save deployment results** — Deployment errors/warnings should be saved before compacting
- **Keep test results accessible** — Write failing test details to a file before compacting

## Token Optimization Patterns

### Trigger-Table Lazy Loading

> **Note:** This is an aspirational optimization pattern -- SCC currently loads skills based on frontmatter triggers, not a runtime lazy-loading table.

Instead of loading full skill content at session start, use a trigger table that maps keywords to skill paths. Skills load only when triggered, reducing baseline context by 50%+:

| Trigger Keywords | Skill | Load When |
|---------|-------|-----------|
| "test", "tdd", "coverage" | sf-apex-testing | User mentions testing |
| "security", "sharing", "crud" | sf-security | Security-related work |
| "deploy", "scratch org", "ci" | sf-deployment | Deployment context |
| "soql", "query", "selectivity" | sf-soql-optimization | Query optimization |
| "trigger", "handler", "fflib" | sf-trigger-frameworks | Trigger development |

### Context Composition Awareness

Monitor what consumes your context window:

- **CLAUDE.md files** — Always loaded, keep lean
- **Loaded skills** — Each skill adds 1-5K tokens; SCC has 58 skills
- **Conversation history** — Grows with each exchange
- **Tool results** — File reads, SOQL results, test output add bulk
- **Rules** — Always-on guidelines consume baseline context

### Duplicate Instruction Detection

Common sources of duplicate context in SCC projects:

- Skills that repeat CLAUDE.md instructions
- Multiple skills covering overlapping domains (e.g., security guidance in both `sf-security` and `sf-governor-limits` skills)
- Agent descriptions that duplicate skill content

## Save-Before-Compact Examples

Before compacting, write critical context to files so it survives:

### Save Org Metadata

```bash
# Save field list for target object
sf sobject describe --sobject Account --json > .claude/org-context/account-fields.json

# Save record type IDs
sf data query --query "SELECT Id, Name, DeveloperName FROM RecordType WHERE SobjectType = 'Account'" --json > .claude/org-context/record-types.json
```

### Save Investigation Findings

```markdown
<!-- .claude/session-notes.md — write before compacting -->
## Governor Limit Findings (2026-03-24)
- AccountTriggerHandler.cls line 45: SOQL in loop (CRITICAL)
- OrderService.cls: 3 DML statements could be combined (MEDIUM)
- Coverage: AccountService 82%, OrderService 61% (needs work)

## Deployment Blockers
- Missing field: Account.Risk_Category__c not in target org
- Flow "Auto Case Assignment" references deleted queue
```

### Save Test Results

```markdown
<!-- .claude/test-results.md -->
## Last Test Run
- 142/145 passing
- Failed: OrderServiceTest.shouldHandleBulkUpdate (NPE at line 89)
- Failed: CaseTriggerTest.shouldEscalateHighPriority (assertion at line 34)
- Failed: IntegrationTest.shouldCallExternalAPI (callout not mocked)
- Coverage: 78% org-wide
```

## Multi-Session Continuity

For work spanning multiple sessions, use compact + session commands:

```
Session 1: Plan feature
  +-- /save-session -> saves plan, org context, findings
  +-- /compact -> clean slate

Session 2: Implement Apex
  +-- /resume-session -> restores plan context
  +-- [implement Apex classes]
  +-- /save-session -> saves implementation state
  +-- /compact

Session 3: Implement LWC + Deploy
  +-- /resume-session -> restores implementation context
  +-- [build LWC, deploy, verify]
```

## Large Project Handling

For projects with 100K+ lines of code:

- **Don't read entire codebase** — Use Grep/Glob to find specific files
- **Use codemaps** — `deep-researcher` agent creates navigable index without loading full files
- **Compact aggressively between features** — Each feature is a fresh context
- **Save architecture notes to files** — Don't rely on conversation memory for class relationships
- **Use agents for parallel investigation** — Subagents have their own context windows

## Approximate Token Costs (as of the current API version per @../_reference/API_VERSIONS.md — may vary with model and encoding)

| Content Type | Approximate Tokens | Notes |
|-------------|-------------------|-------|
| CLAUDE.md | 2-5K | Always loaded |
| Each rule file | 500-2K | All active rules loaded |
| Each loaded skill | 1-5K | Loaded on demand |
| Apex class (500 lines) | 3-5K | When Read tool is used |
| LWC component (3 files) | 2-4K | HTML + JS + CSS |
| SOQL query result (100 rows) | 2-8K | Depends on field count |
| Test output (full suite) | 5-15K | Use `--result-format human` to reduce |
| Debug log (1000 lines) | 8-15K | Filter with `--log-level WARN` |

## Related

- `suggest-compact.js` hook — Automatic compaction suggestions
- `/save-session` and `/resume-session` — State that survives compaction
- `sf-debugging` skill — Debug context preservation
- `learning-engine` agent — Extracts patterns before session ends
