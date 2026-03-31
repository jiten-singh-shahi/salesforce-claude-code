# SCC v1.0.0 Release Notes

**Release Date:** 2026-03-18

## Overview

Initial release of Salesforce Claude Code (SCC) — a production-ready AI agent harness plugin for Salesforce development. SCC provides specialized agents, skills, hooks, rules, and MCP configurations tailored exclusively for Salesforce developers.

## What's Included

### Agents (27)

- **18 Salesforce-specific agents**: sf-apex-reviewer, sf-lwc-reviewer, sf-flow-reviewer, sf-trigger-architect, sf-soql-optimizer, sf-data-architect, sf-agentforce-builder, sf-deployment-guide, sf-architect, sf-build-resolver, sf-docs-lookup, sf-integration-architect, sf-performance-optimizer, sf-e2e-runner, sf-devops-guide, sf-admin, sf-visualforce-reviewer, sf-aura-reviewer
- **9 shared agents**: sf-planner, sf-code-reviewer, sf-security-reviewer, sf-tdd-guide, doc-updater, refactor-cleaner, sf-harness-optimizer, sf-chief-of-staff, loop-operator

### Skills (58 total — 39 user-invocable, 19 auto-activating)

- **23 Salesforce-specific** (user-invocable): `/sf-agentforce-development`, `/sf-apex-best-practices`, `/sf-apex-testing`, `/sf-aura-development`, `/sf-build-fix`, `/sf-data-modeling`, `/sf-debugging`, `/sf-deployment`, `/sf-docs-lookup`, `/sf-e2e-testing`, `/sf-flow-development`, `/sf-governor-limits`, `/sf-harness-audit`, `/sf-help`, `/sf-lwc-development`, `/sf-platform-events-cdc`, `/sf-quickstart`, `/sf-scratch-org-workflow`, `/sf-security`, `/sf-soql-optimization`, `/sf-tdd-workflow`, `/sf-trigger-frameworks`, `/sf-visualforce-development`
- **10 platform** (user-invocable): `/aside`, `/checkpoint`, `/continuous-agent-loop`, `/model-route`, `/prompt-optimizer`, `/refactor-clean`, `/resume-session`, `/save-session`, `/sessions`, `/update-docs`
- **19 auto-activating context skills**: configure-scc, mcp-server-patterns, search-first, security-scan, strategic-compact, sf-apex-async-patterns, sf-apex-cursor, sf-apex-enterprise-patterns, sf-api-design, sf-approval-processes, sf-devops-ci-cd, sf-docker-patterns, sf-experience-cloud, sf-integration, sf-lwc-testing, sf-metadata-management, sf-metadata-migrations, sf-package-development, sf-reporting-dashboards

### Rules (28)

- `common/` (11 files) — Universal coding and workflow standards
- `apex/` (4 files) — Apex coding style, bulkification, triggers, async
- `lwc/` (4 files) — LWC coding style, accessibility, performance, testing
- `flow/` (3 files) — Flow best practices, naming conventions, testing
- `soql/` (2 files) — SOQL optimization and security
- `visualforce/` (2 files) — Visualforce coding style, security
- `aura/` (2 files) — Aura coding style, security

### Hooks (27 at v1.0.0 release; now 28)

Full lifecycle coverage: SessionStart, PreToolUse, PostToolUse, PostToolUseFailure, PreCompact, Stop, SessionEnd — 27 hook scripts at initial release

### Cross-Harness Support

- Claude Code (full integration)
- Cursor (3 rule files)

## Installation

```bash
npm install -g scc-universal
npx scc install all
```

## Requirements

- Node.js >= 20
- Salesforce CLI (sf) recommended
