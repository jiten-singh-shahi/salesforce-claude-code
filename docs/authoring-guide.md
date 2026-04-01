# Authoring Guide

This guide covers how to create new agents, skills, and rules for Salesforce Claude Code (SCC). Each content type has a specific format, naming convention, and CI validation requirement.

## General Conventions

- **File naming**: Use lowercase with hyphens (kebab-case). Example: `sf-apex-reviewer.md`, `sf-tdd-workflow`.
- **Salesforce-specific prefix**: All Salesforce-specific content uses the `sf-` prefix. Platform-agnostic content omits the prefix (e.g., `strategic-compact`, `continuous-agent-loop`).
- **CommonJS throughout**: All Node.js scripts use `require()` and `module.exports`.
- **Origin tag**: All SCC content uses `origin: SCC` in frontmatter.

## Agent Authoring

Agents are specialized subagents that Claude Code delegates to for specific tasks. They live in the `agents/` directory as Markdown files with YAML frontmatter.

### Agent File Structure

```markdown
---
name: sf-my-agent
description: "Use when [trigger] for Salesforce [domain]. Do NOT use for [exclusions]. (100-250 chars, 3+ SF keywords)"
tools: ["Read", "Grep", "Glob", "Bash", "Edit", "Write"]
model: sonnet
origin: SCC
---

You are an expert in [domain]. You [core capability statement].

## Severity Matrix

| Severity | Definition | Examples |
|----------|-----------|---------|
| CRITICAL | Will cause runtime failure or security breach | ... |
| HIGH | Will fail under load or incorrect in edge cases | ... |
| MEDIUM | Technical debt or best practice violation | ... |
| LOW | Style or minor improvement | ... |

---

## [Domain Area 1]

### [Specific Check or Pattern]

**Wrong:**

```apex
// Code that demonstrates the anti-pattern
```

**Right:**

```apex
// Code that demonstrates the correct approach
```

---

## Checklist Summary

When reviewing [content type], verify:

1. **Check 1**: Description
2. **Check 2**: Description
...

---

## Related

- **Skills**: `skill-name-1`, `skill-name-2`
- **Skills**: `/skill-name` (user-invocable)
```

### YAML Frontmatter Fields

| Field | Required | Type | Description |
|---|---|---|---|
| `name` | Yes | string | Unique agent identifier. Use `sf-` prefix for Salesforce-specific agents. |
| `description` | Yes | string (100-250 chars) | Clear description with "Use when" clause, "Do NOT" clause, and 3+ SF keywords. |
| `tools` | Yes | array | List of tools the agent can use: `Read`, `Grep`, `Glob`, `Bash`, `Edit`, `Write`. |
| `model` | Yes | string | Model to use: `opus` (complex), `sonnet` (most agents), `haiku` (lightweight), `inherit` (caller decides). |
| `origin` | Yes | string | Must be `SCC` for all Salesforce Claude Code content. |

### Agent Content Guidelines

1. **Opening persona**: Start with "You are an expert in..." to establish the agent's domain expertise.
2. **Severity matrix**: Include a table mapping severity levels to definitions and examples. This helps the agent prioritize findings consistently.
3. **Code examples**: Use paired Wrong/Right examples showing anti-patterns and their corrections. Always use fenced code blocks with language identifiers (`apex`, `javascript`, `soql`, `html`).
4. **Checklist summary**: End with a numbered verification checklist the agent follows for every review.
5. **Related section**: Link to related skills for discoverability.

### Model Selection

- **opus**: Use for agents that perform deep architectural analysis, multi-file reasoning, or complex decision-making (e.g., `sf-architect`, `sf-integration-architect`).
- **sonnet**: Use for most agents. Good balance of capability and speed (e.g., `sf-apex-reviewer`, `sf-lwc-reviewer`, `sf-tdd-guide`).
- **haiku**: Use for lightweight, fast-response agents that perform simple lookups or formatting.

## Skill Authoring

Skills are workflow/domain-knowledge modules that provide reference information and step-by-step patterns. They live in subdirectories under `skills/`, with each skill in its own directory containing a `SKILL.md` file.

### Skill Directory Structure

```
skills/
  sf-apex-testing/
    SKILL.md
  sf-governor-limits/
    SKILL.md
  sf-lwc-development/
    SKILL.md
```

### SKILL.md Format

```markdown
---
name: sf-my-skill
description: One-line description of what this skill teaches. Should be specific and actionable.
origin: SCC
---

# Skill Title

A 1-2 sentence introduction explaining the skill's scope and why it matters.

## When to Use

- When [specific situation 1]
- When [specific situation 2]
- When [specific situation 3]

## [Core Concept 1]

### [Subtopic]

Explanation with code examples:

```apex
// Practical, copy-paste-ready code example
public with sharing class ExampleService {
    public void doSomething() {
        // Demonstrates the pattern
    }
}
```

---

## [Core Concept 2]

...

---

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Fix |
|---|---|---|
| Pattern name | Why it is bad | How to fix it |

---

## Related

- **Agent**: `sf-agent-name` -- For interactive guidance
- **Skills**: `/sf-skill-name` -- Quick access via slash command (user-invocable)
```

### Skill Frontmatter Fields

| Field | Required | Type | Description |
|---|---|---|---|
| `name` | Yes | string | Unique skill identifier matching the directory name. |
| `description` | Yes | string | Concise description of the skill's teaching purpose. |
| `origin` | Recommended | string | Set to `SCC`. |

### Skill Content Guidelines

1. **"When to Use" section**: Always include this. It helps Claude Code decide when to apply the skill. Use bullet points starting with "When...".
2. **Practical examples**: Skills should be reference material, not abstract theory. Every concept should have a runnable code example.
3. **Anti-patterns table**: Include common mistakes, why they are wrong, and how to fix them.
4. **Cross-references**: Link to related agents and other skills in a "Related" section at the bottom.
5. **Depth over breadth**: A skill should thoroughly cover one topic rather than shallowly covering many. For example, `sf-apex-testing` covers test structure, TestDataFactory, isolation, async testing, mocking, and coverage strategy -- all within the testing domain.

### Salesforce-Specific vs Platform Skills

SCC includes two categories of skills:

- **Salesforce-specific** (40 skills, `sf-` prefix): `sf-apex-testing`, `sf-governor-limits`, `sf-lwc-development`, `sf-security`, `sf-trigger-frameworks`, `sf-apex-constraints`, etc.
- **Platform skills** (15 skills, no prefix): `configure-scc`, `continuous-agent-loop`, `mcp-server-patterns`, `prompt-optimizer`, `search-first`, `security-scan`, `strategic-compact`, `checkpoint`, `aside`, `model-route`, `sessions`, `save-session`, `resume-session`, `refactor-clean`, `update-docs`.

Platform skills are Salesforce-adapted patterns for AI-assisted development workflows (loops, research, verification, evaluation).

## User-Invocable Skill Authoring

User-invocable skills are skills that users can invoke directly as slash commands (e.g., `/sf-tdd-workflow`, `/sf-security`). They live in `skills/<skill-name>/SKILL.md` alongside standard skills, but include `user-invocable: true` in their frontmatter.

All commands have been migrated to user-invocable skills. There is no separate `commands/` directory.

### User-Invocable Skill File Structure

User-invocable skills follow the same directory structure as regular skills (`skills/<skill-name>/SKILL.md`) but require additional frontmatter fields:

```markdown
---
name: sf-my-skill
description: "Use when [trigger] for Salesforce [domain]. Do NOT use for [exclusions]. (100-250 chars, 3+ SF keywords)"
origin: SCC
user-invocable: true
---

# Skill Title

Brief introduction explaining what this skill accomplishes and when to invoke it.

## When to Use

- When [specific situation 1]
- When [specific situation 2]
- When [specific situation 3]

## Workflow

### Step 1 -- [Action Name]

Description of what happens in this step.

```bash
# Example CLI command or tool invocation
sf apex run test --class-names MyTest --target-org <alias>
```

### Step 2 -- [Action Name]

...

## Rules

- Rule 1: Constraint or requirement for this skill
- Rule 2: Another constraint
...

## Examples

```
/sf-my-skill Do something specific
/sf-my-skill Another usage example
/sf-my-skill With different parameters
```

## Related

- **Agent**: `sf-agent-name` -- For interactive guidance
- **Skills**: `/sf-other-skill` -- Complementary skill
```

### User-Invocable Skill Frontmatter

| Field | Required | Type | Description |
|---|---|---|---|
| `name` | Yes | string | Unique skill identifier matching the directory name. |
| `description` | Yes | string (100-250 chars) | Clear description with "Use when" clause, "Do NOT" clause, and 3+ SF keywords. |
| `origin` | Yes | string | Set to `SCC` for all Salesforce Claude Code content. |
| `user-invocable` | Yes | boolean | Must be `true` to enable slash command invocation. |

### User-Invocable Skill Content Guidelines

1. **"When to Use" section**: Required. Helps Claude Code decide when to apply the skill. Use bullet points starting with "When...".
2. **Workflow steps**: Use numbered steps (Step 1, Step 2, etc.) to guide the agent through a structured process. Each step should be self-contained and actionable.
3. **Agent delegation**: Skills often delegate to specialized agents. Reference the agent by name (e.g., "Delegate to `sf-apex-reviewer` for the review phase").
4. **CLI examples**: Show exact `sf` CLI commands with realistic arguments. Use `<alias>` or `<placeholder>` for values the user must provide.
5. **Rules section**: Define constraints the skill enforces (e.g., "Never write production Apex without a failing test first").
6. **Usage examples**: Show 3-5 examples of how to invoke the skill with different arguments.
7. **Related section**: Link to complementary agents and skills at the bottom.

### Skill Naming

- Skills use descriptive names like `sf-apex-best-practices`, `sf-security`, `sf-deployment`.
- Salesforce-specific skills use the `sf-` prefix: `sf-tdd-workflow`, `sf-deployment`, `sf-security`.
- Platform skills omit the prefix: `checkpoint`, `strategic-compact`, `save-session`.
- Users invoke them via `/skill-name` (e.g., `/sf-tdd-workflow`, `/sf-security`, `/checkpoint`).

## CI Validation

Every content type has a corresponding CI validator in `scripts/ci/`. These run as part of `npm test` and in CI pipelines.

### Validator Summary

| Validator | What It Checks |
|---|---|
| `validate-agents.js` | Frontmatter: `name` (matches filename), `description` (100-250 chars, 3+ SF keywords, "Use when" clause), `tools` (array), `model` (opus/sonnet/haiku/inherit), `origin` (SCC). Body: `## When to Use`, `## Workflow`, 2+ steps, `## Escalation` for write agents. |
| `validate-skills.js` | Each skill directory has a `SKILL.md`. Frontmatter: `name`, `description` (100-250 chars, 3+ SF keywords), `origin` (SCC). Constraint skills: read-only tools, @reference required. |
| `validate-hooks.js` | `hooks.json` is valid JSON conforming to `schemas/hooks.schema.json`. All referenced scripts exist. Each entry has a `description`. |
| `validate-install-manifests.js` | Manifest files reference real files. No broken paths. |
| `validate-no-personal-paths.js` | No hardcoded personal paths (like `/Users/username/`) in any source files. |

### Running Validators

```bash
# Run all validators (part of npm test)
npm test

# Run a specific validator
node scripts/ci/validate-agents.js
node scripts/ci/validate-skills.js
node scripts/ci/validate-hooks.js
```

Validators exit with code 0 on success and code 1 on failure, with detailed error messages showing which files failed and why.

## PR Submission Checklist

Before submitting a pull request that adds new content, verify:

### For New Agents

- [ ] File is in `agents/` directory with `.md` extension
- [ ] YAML frontmatter has `name`, `description` (100-250 chars, 3+ SF keywords), `tools` (array), `model`, `origin: SCC`
- [ ] `origin: SCC` is set
- [ ] Agent name uses `sf-` prefix for Salesforce-specific agents
- [ ] File uses kebab-case naming matching the frontmatter `name`
- [ ] Severity matrix is included for reviewer agents
- [ ] Code examples use fenced blocks with language identifiers
- [ ] Related section links to relevant skills
- [ ] `node scripts/ci/validate-agents.js` passes

### For New Skills

- [ ] Skill is in its own directory under `skills/` (e.g., `skills/sf-my-skill/SKILL.md`)
- [ ] YAML frontmatter has `name` and `description`
- [ ] `origin: SCC` is set
- [ ] "When to Use" section is present with bullet points
- [ ] Code examples are practical and copy-paste-ready
- [ ] Anti-patterns table is included
- [ ] Related section links agents and other skills
- [ ] `node scripts/ci/validate-skills.js` passes

### For New User-Invocable Skills

- [ ] Skill is in its own directory under `skills/` (e.g., `skills/sf-my-skill/SKILL.md`)
- [ ] YAML frontmatter has `name`, `description` (100-250 chars, 3+ SF keywords), `origin: SCC`, `user-invocable: true`
- [ ] Skill name uses `sf-` prefix for Salesforce-specific skills
- [ ] "When to Use" section is present with bullet points
- [ ] Workflow steps are numbered and actionable
- [ ] Usage examples show 3-5 invocation patterns
- [ ] Related agents and skills are linked
- [ ] `node scripts/ci/validate-skills.js` passes

### For New Hooks

- [ ] Script is in `scripts/hooks/` with `.js` extension
- [ ] Entry is added to `hooks/hooks.json` under the correct lifecycle event
- [ ] Hook uses `run-with-flags.js` wrapper with appropriate profile level
- [ ] `async: true` is set unless the hook must block execution
- [ ] `timeout` is set to a reasonable value
- [ ] Test file is created in `tests/hooks/`
- [ ] Cursor mirror is updated in `.cursor/hooks/` if applicable
- [ ] `node scripts/ci/validate-hooks.js` passes
- [ ] `node tests/hooks/my-hook.test.js` passes

### General

- [ ] `npm test` passes (runs all validators + test suite)
- [ ] `npm run lint` passes (ESLint + markdownlint)
- [ ] No hardcoded personal paths (`node scripts/ci/validate-no-personal-paths.js`)
- [ ] CLAUDE.md counts are updated if content counts changed (agents, skills)
- [ ] Commit message uses conventional format: `feat: add sf-my-content description`
