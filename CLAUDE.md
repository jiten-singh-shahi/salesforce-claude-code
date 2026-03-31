# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Salesforce Claude Code (SCC)** is an agent harness performance system — a Claude Code plugin providing production-ready agents, skills, hooks, and MCP configurations specifically for Salesforce development. Published as `scc-universal` on npm (v1.0.0). Works across Claude Code and Cursor.

This is the root directory for all SCC source code.

## Build & Test Commands

```bash
cd salesforce-claude-code

# Install dependencies
npm install

# Build all derived content (Cursor adapters + MCP copies)
npm run build

# Run full validation + tests (runs build first automatically)
npm test

# Run only unit/integration tests
node tests/run-all.js

# Run individual test files
node tests/lib/utils.test.js
node tests/hooks/hooks.test.js

# Run individual CI validators
node scripts/ci/validate-agents.js
node scripts/ci/validate-commands.js
node scripts/ci/validate-skills.js
node scripts/ci/validate-hooks.js
node scripts/ci/validate-install-manifests.js
node scripts/ci/validate-no-personal-paths.js

# Lint (ESLint + markdownlint)
npm run lint

# Coverage (80% lines/functions/branches/statements required)
npm run coverage

# SCC CLI
npx scc install <language>   # Install SCC content for a language (apex, lwc, all)
npx scc doctor               # Diagnose missing/drifted files
npx scc repair               # Restore drifted files
npx scc status               # Query JSON state store
npx scc sessions             # List/inspect sessions
npx scc uninstall            # Remove SCC-managed files
npx scc plan                 # Preview files to be installed (dry run)
npx scc list-installed       # Show currently installed SCC files
npx scc session-inspect      # Inspect a specific session's details
```

## Architecture

The project is a **plugin system** — mostly Markdown/JSON content consumed by AI agent harnesses, backed by Node.js scripts for installation, hooks, and validation.

### Core Content Directories (Markdown + YAML frontmatter)

- **agents/** — 25 specialized subagents (sf-apex-reviewer, sf-lwc-reviewer, sf-tdd-guide, sf-security-reviewer, sf-trigger-architect, sf-flow-reviewer, sf-agentforce-builder, sf-performance-optimizer, sf-integration-architect, sf-code-reviewer, doc-updater, sf-e2e-runner, refactor-cleaner, sf-architect, sf-build-resolver, loop-operator, sf-admin, sf-visualforce-reviewer, sf-aura-reviewer, sf-verification-runner, sf-blueprint-planner, sf-devops-deployment, deep-researcher, learning-engine, eval-runner). Format: Markdown with YAML frontmatter (`name`, `description`, `tools`, `model`).
- **skills/** — 55 workflow/domain-knowledge modules (35 with `user-invocable: true` for direct invocation via `/skill-name`; 20 are auto-activating context skills). Includes Salesforce-specific skills, platform skills, and workflow skills (sf-help, sf-quickstart, sf-build-fix, sf-harness-audit, checkpoint, sf-docs-lookup, refactor-clean, save-session, resume-session, sessions, update-docs, aside, model-route). Format: Markdown with YAML frontmatter (`name`, `description`, `origin`, `user-invocable`) in `skills/<name>/SKILL.md` directories.
- **hooks/hooks.json** — Claude Code hook lifecycle (SessionStart, PreToolUse, PostToolUse, PostToolUseFailure, PreCompact, Stop, SessionEnd). Hook scripts live in `scripts/hooks/`.

### Script Infrastructure (Node.js, CommonJS)

- **scripts/scc.js** — Main CLI entry point (`npx scc`).
- **scripts/cli/** — End-user CLI commands (install, uninstall).
- **scripts/dev/** — Contributor/dev tools (doctor, repair, status, build-cursor, harness-audit, etc.).
- **scripts/lib/** — Shared utilities (package-manager detection, install executor, JSON state store, adapters).
- **scripts/hooks/** — Hook implementations. Uses `run-with-flags.js` for profile-based gating.
- **scripts/ci/** — CI validators enforcing structure/frontmatter of all content types.
- **manifests/** — Selective-install manifests defining what files to install per language/target.
- **schemas/** — JSON Schemas for hooks, plugin config, install state, package-manager config.

### Cross-Harness Support

- **.claude-plugin/** — Plugin manifest for Claude Code marketplace.
- **.cursor/** — Cursor IDE skills, agents, and hooks.

## Key Conventions

- **Target Salesforce API version: 66.0 (Spring '26)**. Skills and code examples target this version. When referencing API-version-specific features (SOQL Cursors, RunRelevantTests, @testFor), always note the minimum version required.
- **Node.js >= 20** required. Pinned: Node 20.19.0, Python 3.12.8 (`.tool-versions`).
- **CommonJS throughout** — all scripts use `require()`/`module.exports`.
- **File naming** — lowercase with hyphens (e.g., `sf-apex-reviewer.md`, `sf-trigger-frameworks`).
- **Hook profiles** — `SCC_HOOK_PROFILE=minimal|standard|strict` controls which hooks run. `SCC_DISABLED_HOOKS=...` disables specific hooks.
- **Package manager** — auto-detects npm/pnpm/yarn/bun. Override via `CLAUDE_PACKAGE_MANAGER` env var.
- **Commit format** — Conventional commits: `<type>: <description>`. Max header: 100 chars. Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`, `build`, `revert`.
