# Contributing to Salesforce Claude Code

Thanks for wanting to contribute! This repo is a community resource for Salesforce developers using Claude Code.

## Table of Contents

- [What We're Looking For](#what-were-looking-for)
- [Quick Start](#quick-start)
- [Contributing Skills](#contributing-skills)
- [Contributing Agents](#contributing-agents)
- [Contributing Hooks](#contributing-hooks)
- [Contributing User-Invocable Skills](#contributing-user-invocable-skills)
- [Pull Request Process](#pull-request-process)

---

## What We're Looking For

### Agents

New Salesforce-specific agents:

- Platform specialists (Experience Cloud, Health Cloud, Financial Services Cloud)
- Integration experts (MuleSoft, Heroku, external APIs)
- Migration specialists (Classic to Lightning, org merges)
- Domain experts (CPQ, Field Service, Marketing Cloud)

### Skills

Workflow definitions and domain knowledge:

- Apex patterns and best practices
- LWC component patterns
- Salesforce integration strategies
- Testing and deployment workflows
- Admin/declarative automation guides

### Hooks

Useful Salesforce automations:

- Governor limit checking hooks
- SFDX command validation
- Apex/LWC test coverage reminders
- Security scanning hooks

### User-Invocable Skills

Skills with `user-invocable: true` that users invoke via `/skill-name`:

- Deployment skills (`/sf-deployment`, `/sf-devops-ci-cd`)
- Testing skills (`/sf-tdd-workflow`, `/sf-apex-testing`, `/sf-e2e-testing`)
- Security skills (`/sf-security`, `/sf-governor-limits`)
- Platform skills (`/continuous-agent-loop`, `/prompt-optimizer`, `/strategic-compact`)

---

## Quick Start

```bash
# 1. Fork and clone
gh repo fork <org>/salesforce-claude-code --clone
cd salesforce-claude-code

# 2. Install dependencies
npm install

# 3. Create a branch
git checkout -b feat/my-contribution

# 4. Add your contribution (see sections below)

# 5. Run validation
npm test

# 6. Submit PR
git add . && git commit -m "feat: add my-contribution" && git push -u origin feat/my-contribution
```

---

## Contributing Skills

Skills are knowledge modules that Claude Code loads based on context.

### Directory Structure

```text
skills/
  your-skill-name/
    SKILL.md
```

### SKILL.md Template

```markdown
---
name: your-skill-name
description: "Use when [trigger] for Salesforce [domain]. Do NOT use for [exclusions]. (100-250 chars, 3+ SF keywords)"
origin: SCC
---

# Your Skill Title

Brief overview of what this skill covers.

## Core Concepts

Explain key Salesforce patterns and guidelines.

## Code Examples

Include practical, tested Apex/LWC/SOQL examples.

## Best Practices

- Actionable guidelines
- Do's and don'ts
- Common pitfalls to avoid

## When to Use

Describe scenarios where this skill applies.
```

### Skill Checklist

- [ ] Focused on one Salesforce domain/technology
- [ ] Includes practical code examples (Apex, LWC, SOQL, etc.)
- [ ] Under 500 lines
- [ ] Uses clear section headers
- [ ] Tested with Claude Code

---

## Contributing Agents

Agents are specialized assistants invoked via the Task tool.

### File Location

```text
agents/your-agent-name.md
```

### Agent Template

```markdown
---
name: your-agent-name
description: "Use when [trigger]. Do NOT use for [exclusions]. 100-250 chars with 3+ Salesforce keywords."
tools: ["Read", "Write", "Edit", "Bash", "Grep", "Glob"]
model: sonnet
origin: SCC
---

You are a [role] specialist for Salesforce development.

## Your Role

- Primary responsibility
- Secondary responsibility
- What you DO NOT do (boundaries)

## Workflow

### Step 1: Understand
How you approach the task.

### Step 2: Execute
How you perform the work.

### Step 3: Verify
How you validate results.

## Output Format

What you return to the user.
```

### Agent Fields

| Field | Description | Options |
|-------|-------------|---------|
| `name` | Lowercase, hyphenated | `sf-apex-reviewer` |
| `description` | Used to decide when to invoke | Be specific! |
| `tools` | Only what's needed | `Read, Write, Edit, Bash, Grep, Glob, WebFetch, Task` |
| `model` | Complexity level | `haiku` (simple), `sonnet` (coding), `opus` (complex), `inherit` (caller decides) |
| `origin` | Must be SCC | `SCC` |

---

## Contributing Hooks

Hooks are automatic behaviors triggered by Claude Code events.

### File Locations

- Hook config: `hooks/hooks.json`
- Hook scripts: `scripts/hooks/your-hook.js`

### Hook Types

| Type | Trigger | Use Case |
|------|---------|----------|
| `PreToolUse` | Before tool runs | Validate SF CLI commands, warn about destructive ops |
| `PostToolUse` | After tool runs | Check test coverage, run sfdx-scanner |
| `SessionStart` | Session begins | Load org context, detect scratch orgs |
| `Stop` | Session ends | Summarize changes, suggest next steps |
| `PreCompact` | Before compaction | Save session state |

### Hook Script Pattern

```javascript
#!/usr/bin/env node
'use strict';

const { execSync } = require('child_process');

// Read hook context from stdin
let input = '';
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const ctx = JSON.parse(input);
    // Hook logic here
    process.exit(0); // Allow
  } catch {
    process.exit(0); // Fail open
  }
});
```

---

## Contributing User-Invocable Skills

User-invocable skills are actions users invoke via `/skill-name`.

### File Location

```text
skills/your-skill-name/SKILL.md
```

### User-Invocable Skill Template

```markdown
---
name: your-skill-name
description: "Use when [trigger] for Salesforce [domain]. Do NOT use for [exclusions]. (100-250 chars, 3+ SF keywords)"
origin: SCC
user-invocable: true
---

# Skill Name

## When to Use

When to invoke this skill.

## Workflow

1. First step
2. Second step
3. Final step

## Output

What the user receives.
```

---

## Pull Request Process

### 1. PR Title Format

```text
feat(skills): add cpq-patterns skill
feat(agents): add data-migration agent
feat(hooks): add sfdx-scanner hook
fix(skills): update sf-apex-testing examples
docs: improve contributing guide
```

### 2. PR Description

```markdown
## Summary
What you're adding and why.

## Type
- [ ] Skill
- [ ] Agent
- [ ] Hook

## Testing
How you tested this with Salesforce projects.

## Checklist
- [ ] Follows format guidelines
- [ ] Tested with Claude Code
- [ ] No sensitive info (API keys, org credentials)
- [ ] Passes `npm test`
```

### 3. Review Process

1. Maintainers review within 48 hours
2. Address feedback if requested
3. Once approved, merged to main

---

## Guidelines

### Do

- Keep contributions focused on Salesforce development
- Include practical code examples
- Test with real Salesforce projects before submitting
- Follow existing patterns and naming conventions
- Document Salesforce-specific edge cases

### Don't

- Include sensitive data (API keys, org credentials, session IDs)
- Add overly niche configurations
- Submit untested contributions
- Create duplicates of existing functionality

---

## File Naming

- Use lowercase with hyphens: `sf-apex-reviewer.md`
- Be descriptive: `sf-trigger-frameworks.md` not `triggers.md`
- Match name to filename

---

Thanks for contributing! Let's build a great Salesforce development resource together.
