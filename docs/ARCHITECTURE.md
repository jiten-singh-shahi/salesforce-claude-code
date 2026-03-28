# SCC Architecture Overview

## System Design

Salesforce Claude Code (SCC) is a **plugin harness system** — a collection of Markdown content, JSON configurations, and Node.js scripts consumed by AI agent harnesses (Claude Code, Cursor) to provide Salesforce-specialized development assistance.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    AI Agent Harness                       │
│              (Claude Code / Cursor)                        │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────┐ ┌──────────┐ ┌────────────┐               │
│  │  Agents   │ │  Skills  │ │   Rules    │               │
│  │  (27)     │ │  (58)    │ │  (28)      │               │
│  └─────┬────┘ └─────┬────┘ └─────┬──────┘               │
│        │            │            │              │        │
│  ┌─────┴────────────┴────────────┴──────────────┴─────┐ │
│  │                   hooks.json                        │ │
│  │     SessionStart → PreToolUse → PostToolUse →       │ │
│  │     PostToolUseFailure → PreCompact → Stop →       │ │
│  │     SessionEnd                                      │ │
│  └─────────────────────┬──────────────────────────────┘ │
│                        │                                 │
│  ┌─────────────────────┴──────────────────────────────┐ │
│  │              scripts/hooks/*.js                      │ │
│  │   session-start, pre-tool-use, sfdx-validate,       │ │
│  │   quality-gate, governor-check, stop-hook, etc.     │ │
│  └─────────────────────┬──────────────────────────────┘ │
│                        │                                 │
│  ┌─────────────────────┴──────────────────────────────┐ │
│  │              scripts/lib/*.js                        │ │
│  │   utils, package-manager, state-store,              │ │
│  │   install-executor, hook-flags, project-detect      │ │
│  └────────────────────────────────────────────────────┘ │
│                                                           │
├─────────────────────────────────────────────────────────┤
│                    CLI (npx scc)                          │
│   install | doctor | repair | status | sessions          │
└─────────────────────────────────────────────────────────┘
```

## Content Layer

### Agents (Markdown + YAML Frontmatter)

Specialized subagents delegated to by the main Claude Code agent. Each agent has:

- `name` — Unique identifier
- `description` — What the agent does (used for agent discovery)
- `tools` — Which tools the agent can use
- `model` — Which model to use (sonnet for most, opus for complex tasks)

**Salesforce-specific agents**: sf-apex-reviewer, sf-lwc-reviewer, sf-flow-reviewer, sf-trigger-architect, sf-soql-optimizer, sf-data-architect, sf-agentforce-builder, sf-deployment-guide, sf-architect, sf-build-resolver, sf-docs-lookup, sf-admin, sf-integration-architect, sf-performance-optimizer, sf-data-architect, sf-e2e-runner, sf-devops-guide, sf-visualforce-reviewer, sf-aura-reviewer

**Shared agents**: sf-planner, sf-code-reviewer, sf-security-reviewer, sf-tdd-guide, doc-updater, refactor-cleaner, sf-harness-optimizer, sf-chief-of-staff, loop-operator

### Commands (Markdown with Frontmatter)

Slash commands invoked by users. Each command defines a workflow with steps, examples, and output formats. Commands can reference agents and skills.

### Skills (Directories with SKILL.md)

Domain-knowledge modules loaded into context when relevant. Skills have:

- `name` and `description` in frontmatter
- Sections: When to Use, How It Works, Examples, Anti-patterns
- `origin: SCC` to identify Salesforce-specific skills

### Rules (Organized Markdown)

Always-loaded guidelines organized by domain:

- `common/` — Universal rules (git, security, testing, patterns)
- `apex/` — Apex coding standards, security, triggers
- `lwc/` — LWC coding style, performance, testing
- `soql/` — SOQL optimization and security
- `flow/` — Flow best practices, naming conventions, testing
- `visualforce/` — Visualforce coding style and security
- `aura/` — Aura coding style and security

## Script Layer

### Hook System

Hooks run at lifecycle events and are gated by profiles:

| Profile | Level | Hooks Enabled |
|---------|-------|--------------|
| minimal | 1 | Only essential hooks (pre-compact, cost-tracker) |
| standard | 2 | All standard hooks (quality-gate, governor-check, sfdx-validate) |
| strict | 3 | All hooks including auto-format and type-check |

**Environment variables:**

- `SCC_HOOK_PROFILE` — minimal, standard, strict (default: standard)
- `SCC_DISABLED_HOOKS` — Comma-separated hook IDs to disable

### CLI System

The `npx scc` CLI provides:

- `install <profile>` — Install SCC content for a specific profile (core, apex, lwc, devops, security, full)
- `doctor` — Diagnose missing or drifted files
- `repair` — Restore drifted files to their expected state
- `status` — Query the JSON state store
- `sessions` — List/inspect saved sessions
- `uninstall` — Remove SCC-managed files

### State Management

SCC uses a JSON state store (`~/.scc/state.json`) to track:

- Installed files and their hashes
- Installation profiles
- Drift detection data

## Cross-Harness Support

| Harness | Directory | Integration Level |
|---------|-----------|------------------|
| Claude Code | `.claude-plugin/` | Full (hooks, agents, skills, commands, rules) |
| Cursor | `.cursor/` | Rules only (apex, lwc, salesforce) |

## Installation Flow

```
npx scc install all
    │
    ├── Read manifests/install-profiles.json
    ├── Resolve component list for profile
    ├── Generate install plan (scripts/dev/install-plan.js)
    ├── Execute plan (scripts/cli/install-apply.js)
    │   ├── Copy agents to .agents/
    │   ├── Copy skills to target
    │   ├── Copy rules to target
    │   └── Register hooks
    └── Update state store (scripts/lib/state-store.js)
```

## Design Principles

1. **Content over code** — Most value is in Markdown content, not scripts
2. **Selective installation** — Install only what's needed per project profile
3. **Profile-gated hooks** — Don't impose strict hooks on casual users
4. **Cross-platform** — Node.js scripts work on Windows, macOS, Linux
5. **Salesforce-first** — Every component is tailored for Salesforce development
6. **CommonJS throughout** — No ESM, no transpilation, no build step
