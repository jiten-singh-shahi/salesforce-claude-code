# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Migrated 6 orchestration skills to agents per Law 4 ("Agents sequence, skills teach"):
  - `verification-loop` → `sf-verification-runner` agent
  - `blueprint` → `sf-blueprint-planner` agent
  - `deep-research` → `deep-researcher` agent
  - `eval-harness` → `eval-runner` agent
  - `continuous-learning-v2` → `learning-engine` agent
  - `skill-stocktake` → merged into `sf-harness-optimizer` agent
- Hook path `skills/continuous-learning-v2/hooks/observe.sh` → `scripts/hooks/learning-observe.sh`
- Skills count: 65 → 59, Agents count: 27 → 32

## [0.0.0] - 2026-03-26

### Highlights

- Initial release of Salesforce Claude Code (SCC) — production-ready AI agent harness for Salesforce development.
- Built on the architecture and tooling of [Everything Claude Code (ECC)](https://github.com/affaan-m/everything-claude-code) by Affaan Mustafa, licensed under the MIT License.
- 27 specialized agents covering Apex, LWC, SOQL, Flows, Visualforce, Aura, Agentforce, DevOps, security, and architecture.
- 58 skills (39 user-invocable, 19 auto-activating) for Salesforce best practices, patterns, and workflows.
- 28 rules across common, Apex, LWC, SOQL, Flow, Visualforce, and Aura domains.
- 28 hooks across 7 lifecycle events with profile-based control (minimal, standard, strict).
- Cross-harness support for Claude Code and Cursor with adapter-based content transformation.
- AJV schema validation for state store, install state, install config, and CI validators.

### Agents (27)

- Salesforce specialists: sf-apex-reviewer, sf-lwc-reviewer, sf-trigger-architect, sf-soql-optimizer, sf-security-reviewer, sf-performance-optimizer, sf-flow-reviewer, sf-agentforce-builder, sf-data-architect, sf-integration-architect, sf-admin, sf-visualforce-reviewer, sf-aura-reviewer
- Platform agents: sf-planner, sf-code-reviewer, sf-tdd-guide, sf-architect, sf-build-resolver, sf-docs-lookup, sf-devops-guide, sf-deployment-guide, sf-chief-of-staff, sf-harness-optimizer, sf-e2e-runner
- Utility agents: doc-updater, refactor-cleaner, loop-operator

### Skills (58)

- 32 Salesforce-specific: sf-apex-best-practices, sf-apex-async-patterns, sf-apex-enterprise-patterns, sf-apex-testing, sf-apex-cursor, sf-lwc-development, sf-lwc-testing, sf-trigger-frameworks, sf-governor-limits, sf-soql-optimization, sf-integration, sf-deployment, sf-data-modeling, sf-debugging, sf-security, sf-devops-ci-cd, sf-scratch-org-workflow, sf-flow-development, sf-metadata-management, sf-metadata-migrations, sf-package-development, sf-agentforce-development, sf-api-design, sf-visualforce-development, sf-aura-development, sf-platform-events-cdc, sf-approval-processes, sf-experience-cloud, sf-reporting-dashboards, sf-docker-patterns, sf-e2e-testing, sf-tdd-workflow
- 7 platform skills: configure-scc, continuous-agent-loop, mcp-server-patterns, prompt-optimizer, search-first, security-scan, strategic-compact
- 13 workflow skills: sf-help, sf-quickstart, sf-build-fix, sf-harness-audit, checkpoint, sf-docs-lookup, refactor-clean, save-session, resume-session, sessions, update-docs, aside, model-route

### Rules (28)

- Common (11): agents, coding-style, development-workflow, git-workflow, governor-limits, hooks, naming-conventions, patterns, performance, security, testing
- Apex (4): async, bulkification, coding-style, triggers
- LWC (4): accessibility, coding-style, performance, testing
- SOQL (2): optimization, security
- Flow (3): best-practices, naming-conventions, testing
- Visualforce (2): coding-style, security
- Aura (2): coding-style, security

### Hook System (28 hooks, 7 lifecycle events)

- SessionStart: Salesforce project context detection (org info, CLI version, connected orgs)
- PreToolUse: SF CLI validation, deprecated sfdx warnings, git push reminder, doc write warning, block-no-verify (protects git hooks)
- PostToolUse: test coverage reminders (Apex/LWC), auto-format, typecheck, console.log detection, build/PR notifications
- PostToolUseFailure: MCP health-check with exponential backoff and auto-reconnect
- PreCompact: state preservation before context compaction
- Stop: uncommitted changes reminder, session summary, cost tracking
- SessionEnd: session metadata persistence, session evaluation
- Quality gates: governor-check (SOQL/DML in loops), quality-gate (anti-pattern detection via apex-analysis), sfdx-scanner integration
- Profile-based gating via `SCC_HOOK_PROFILE` (minimal, standard, strict) and `SCC_DISABLED_HOOKS`

### Cross-Harness Support

- Claude Code plugin manifest (`.claude-plugin/plugin.json`)
- Cursor adapter layer: skill-adapter and agent-adapter transform content from Claude Code format to Cursor format
- Build step (`npm run build:cursor`) generates `.cursor/skills/` (58) and `.cursor/agents/` (27) from source
- Install-time transformation: `npx scc install --target cursor` auto-transforms during copy
- Cursor hooks adapter (`.cursor/hooks/adapter.js`) delegates to shared `scripts/hooks/` implementations
- MCP config auto-installed: `.mcp.json` (Claude Code) or `.cursor/mcp.json` (Cursor)

### Schema Validation (8 schemas)

- AJV-validated at runtime: state-store.schema.json (6 entity types), install-state.schema.json, scc-install-config.schema.json
- AJV-validated in CI: hooks.schema.json, install-modules.schema.json, install-profiles.schema.json
- Descriptive: plugin.schema.json, package-manager.schema.json
- State store entity model: sessions, skillRuns, skillVersions, decisions, installState, governanceEvents
- Graceful AJV fallback when not installed (bare environments)

### Infrastructure

- CLI tool (`npx scc`): install, uninstall, plan, doctor, repair, status, list-installed, sessions, session-inspect
- Install config persistence: `--config scc-install.json` for team-shared install preferences
- Selective installation via profiles (apex, lwc, full) and targets (claude, cursor)
- Scripts organized by audience: `scripts/cli/` (end-user), `scripts/dev/` (contributor), `scripts/hooks/` (runtime), `scripts/lib/` (shared), `scripts/ci/` (validators)
- npm package ships only what users need (cli + hooks + lib); dev/ci tools are repo-only
- 8 CI validators for agents, commands, rules, skills, hooks, manifests, personal paths, catalog
- 67 automated tests with 80% coverage threshold
- GitHub Actions: CI (test + coverage), Validate (content structure), Lint (ESLint + markdownlint), Release (npm publish)
