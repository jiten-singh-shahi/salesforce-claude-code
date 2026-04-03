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
│  ┌──────────┐ ┌──────────┐                               │
│  │  Agents   │ │  Skills  │                               │
│  │  (17)     │ │  (55)    │                               │
│  └─────┬────┘ └─────┬────┘                               │
│        │            │                                    │
│  ┌─────┴────────────┴─────────────────────────────────┐ │
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
│                    CLI (npx scc-universal)                          │
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

**Salesforce domain agents (11)**: sf-apex-agent, sf-lwc-agent, sf-flow-agent, sf-admin-agent, sf-integration-agent, sf-agentforce-agent, sf-architect, sf-bugfix-agent, sf-review-agent, sf-aura-reviewer, sf-visualforce-reviewer

**Platform agents (6)**: deep-researcher, doc-updater, eval-runner, learning-engine, loop-operator, refactor-cleaner

### Skills (Directories with SKILL.md)

Domain-knowledge modules loaded into context when relevant. Skills have:

- `name` and `description` in frontmatter
- Sections: When to Use, How It Works, Examples, Anti-patterns
- `origin: SCC` to identify Salesforce-specific skills

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

The `npx scc-universal` CLI provides:

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
| Claude Code | `.claude-plugin/` | Full (hooks, agents, skills) |
| Cursor | `.cursor/` | Skills, agents, hooks |

## Installation Flow

```
npx scc-universal install all
    │
    ├── Read manifests/install-profiles.json
    ├── Resolve component list for profile
    ├── Generate install plan (scripts/dev/install-plan.js)
    ├── Execute plan (scripts/cli/install-apply.js)
    │   ├── Copy agents to target
    │   ├── Copy skills to target
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
