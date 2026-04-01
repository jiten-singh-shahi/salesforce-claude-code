# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Salesforce Claude Code (SCC)** is an agent harness performance system — a Claude Code plugin providing production-ready agents, skills, hooks, and MCP configurations specifically for Salesforce development. Works across Claude Code and Cursor.

- **npm package:** `scc-universal` (CLI install name)
- **Plugin name:** `salesforce-claude-code` (marketplace display name)

## Build & Test Commands

```bash
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
node scripts/ci/validate-skills.js
node scripts/ci/validate-hooks.js
node scripts/ci/validate-install-manifests.js
node scripts/ci/validate-no-personal-paths.js

# Lint (ESLint + markdownlint)
npm run lint

# Auto-fix markdownlint errors
npx markdownlint '**/*.md' --ignore node_modules --fix

# Coverage (80% lines/functions/branches/statements required)
npm run coverage

# SCC CLI
npx scc install <target>     # Install SCC content (apex, lwc, all)
npx scc doctor               # Diagnose missing/drifted files
npx scc repair               # Restore drifted files
npx scc status               # Query JSON state store
npx scc uninstall            # Remove SCC-managed files
npx scc plan                 # Preview files to be installed (dry run)
npx scc list-installed       # Show currently installed SCC files
```

## Architecture

The project is a **plugin system** — mostly Markdown/JSON content consumed by AI agent harnesses, backed by Node.js scripts for installation, hooks, and validation.

### Core Content (Markdown + YAML frontmatter)

- **agents/** — 25 specialized subagents. Format: Markdown with YAML frontmatter (`name`, `description`, `tools`, `model`, `origin`, `readonly`).
- **skills/** — 55 workflow/domain-knowledge modules (35 user-invocable, 20 auto-activating). Format: `skills/<name>/SKILL.md` with YAML frontmatter (`name`, `description`, `origin`, `user-invocable`).
- **hooks/hooks.json** — Claude Code hook lifecycle (SessionStart, PreToolUse, PostToolUse, PostToolUseFailure, PreCompact, Stop, SessionEnd). Hook scripts live in `scripts/hooks/`.

### Generated Content (Never Edit Directly)

- **.cursor/** — Auto-generated from `agents/` and `skills/` by `npm run build`. The pre-commit hook enforces sync. Always edit the source in `agents/` or `skills/`, then run `npm run build` and stage `.cursor/`.

### Script Infrastructure (Node.js, CommonJS)

- **scripts/scc.js** — Main CLI entry point (`npx scc`).
- **scripts/cli/** — End-user CLI commands (install, uninstall).
- **scripts/dev/** — Contributor/dev tools (doctor, repair, status, build-cursor, harness-audit).
- **scripts/lib/** — Shared utilities (package-manager detection, install executor, JSON state store, adapters).
- **scripts/hooks/** — Hook implementations. Uses `run-with-flags.js` for profile-based gating.
- **scripts/ci/** — CI validators enforcing structure/frontmatter of all content types.
- **manifests/** — Selective-install manifests defining what files to install per language/target.
- **schemas/** — JSON Schemas for hooks, plugin config, install state, package-manager config.

### Cross-Harness Support

- **.claude-plugin/** — Plugin manifest for Claude Code marketplace.
- **.cursor-plugin/** — Plugin manifest for Cursor marketplace.

## Pre-commit Hook

The pre-commit hook (`.githooks/pre-commit`) mirrors CI locally: build, ESLint, markdownlint, all 6 validators, and full test suite. Setup for new contributors:

```bash
git config core.hooksPath .githooks
```

## Release Process

Versioning is automated via release-please. On merge to `main`:

1. Release-please creates a Release PR bumping `package.json` and all 4 plugin manifests (`.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `.cursor-plugin/plugin.json`, `.cursor-plugin/marketplace.json`).
2. Merging the Release PR triggers `npm publish --provenance --access public`.

Conventional commit types drive version bumps: `feat:` → minor, `fix:` → patch, `feat!:` → major.

## Key Conventions

- **Target Salesforce API version: 66.0 (Spring '26)**. When referencing API-version-specific features (SOQL Cursors, RunRelevantTests, @testFor), always note the minimum version required.
- **Node.js >= 20** required. Pinned: Node 20.19.0, Python 3.12.8 (`.tool-versions`).
- **CommonJS throughout** — all scripts use `require()`/`module.exports`.
- **File naming** — lowercase with hyphens (e.g., `sf-apex-reviewer.md`, `sf-trigger-frameworks`).
- **Hook profiles** — `SCC_HOOK_PROFILE=minimal|standard|strict` controls which hooks run. `SCC_DISABLED_HOOKS=...` disables specific hooks.
- **Package manager** — auto-detects npm/pnpm/yarn/bun. Override via `CLAUDE_PACKAGE_MANAGER` env var.
- **Commit format** — Conventional commits: `<type>: <description>`. Max header: 100 chars. Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`, `build`, `revert`.
