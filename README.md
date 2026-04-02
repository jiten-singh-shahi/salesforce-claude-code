# Salesforce Claude Code (SCC)

[![npm version](https://img.shields.io/npm/v/scc-universal.svg)](https://www.npmjs.com/package/scc-universal)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node Version](https://img.shields.io/node/v/scc-universal.svg)](https://nodejs.org)

> The complete AI development system for Salesforce — expert agents, automated quality gates, and institutional knowledge, powered by @salesforce/mcp

SCC (`scc-universal` on npm) is a Claude Code plugin that supercharges your Salesforce development workflow with specialized AI agents, domain skills, lifecycle hooks, and always-on coding rules. Built for Apex, LWC, SOQL, Flow, Visualforce, Aura, DevOps, and Agentforce — covering every layer of the Salesforce platform.

---

## How It Works

SCC is a unified system where each layer serves a distinct role:

| Layer | What It Does | Examples |
|-------|-------------|----------|
| **@salesforce/mcp** | Platform capabilities — query orgs, deploy metadata, run tests, analyze code | Org management, SOQL queries, Apex test execution |
| **17 Agents** | Lean full-stack agents that design, build, test, and review | `sf-architect`, `sf-apex-agent`, `sf-lwc-agent`, `sf-review-agent` |
| **55 Skills** | Institutional knowledge + workflows — 17 user-invocable via `/skill-name`, 38 auto-activating | `/sf-help`, `/sf-quickstart`, `/configure-scc`, `/sessions` |
| **7 Constraint Skills** | Always-on governance via auto-activating skills | `sf-apex-constraints`, `sf-soql-constraints`, `sf-security-constraints`, `sf-trigger-constraints` |
| **29 Hooks** | Automated enforcement — quality gates run on every code change | SOQL-in-loop detection, PMD via sf scanner, privilege escalation checks |

**Together:** `@salesforce/mcp` gives Claude the hands to work with Salesforce. SCC gives Claude the brain to work well.

---

## What's Included

| Category | Count | Description |
|---|---|---|
| Agents | 17 | Specialized Salesforce subagents (11 domain + 6 platform) |
| Skills | 55 | Domain knowledge + workflow modules (17 user-invocable, 38 auto-activating) |
| Hooks | 29 | Lifecycle hooks (SessionStart, PreToolUse, PostToolUse, PostToolUseFailure, PreCompact, Stop, SessionEnd) |
| Harnesses | 2 | Claude Code, Cursor |

---

## Requirements

- **Node.js >= 20** — required to run the `npx scc` CLI
- **Python 3.x** — required for learning-engine agent (instinct CLI)

---

## Quick Install

```bash
# Install everything
npx scc install all

# Install only Apex
npx scc install apex

# Install only LWC
npx scc install lwc

# Install only DevOps
npx scc install devops

# Diagnose / repair installed files
npx scc doctor
npx scc repair
```

### CLI Reference

| Command | Description |
|---|---|
| `scc install <target>` | Install SCC content (apex, lwc, all) |
| `scc plan` | Preview install manifest (dry run) |
| `scc list-installed` | Show currently installed SCC files |
| `scc doctor` | Diagnose missing or drifted files |
| `scc repair` | Restore drifted files |
| `scc status` | Query JSON state store |
| `scc sessions` | List saved sessions |
| `scc session-inspect` | Inspect a specific session's details |
| `scc uninstall` | Remove SCC-managed files |

**Install flags:**

| Flag | Description |
|---|---|
| `--profile <name>` | Install profile: `apex`, `lwc`, or `full` (default) |
| `--target <harness>` | Target harness: `claude` (default) or `cursor` |
| `--config <path>` | Custom install manifest path |
| `--dry-run` | Preview changes without applying (works with repair, uninstall) |
| `--json` | Output in JSON format |
| `--yes` | Skip confirmation prompts |

### Install Modules

SCC content is organized into 7 modules. Profiles compose subsets:

| Module | Description | Depends On |
|---|---|---|
| `core` | Essential agents, core skills, lifecycle hooks | — |
| `apex` | Apex agents, skills, SOQL, constraints | core |
| `lwc` | LWC agent, skills, constraints | core |
| `platform` | Cross-domain agents, universal skills, debugging, integration | core |
| `devops` | CI/CD, deployment, scratch orgs | core |
| `security` | Security agent, CRUD/FLS, governor limits, SOQL optimization | core |
| `extended` | Flow, Visualforce, Aura, Agentforce, Admin, Events, API design | core |

| Profile | Modules Included |
|---|---|
| `apex` | core + apex + platform + devops + security |
| `lwc` | core + lwc + platform + devops + security |
| `full` | All 7 modules (default) |

### Harness-Specific Instructions

**Claude Code** — files are auto-installed via `npx scc install all`. Agents, skills, commands, rules, and hooks are all activated.

**Cursor** — run `npx scc install all --target cursor`. Agents, skills, rules, and MCP config are auto-installed to `.cursor/` directory.

---

## Key Features

### Apex Best Practices

- Bulkification patterns, governor limit awareness, and collections-first coding
- Trigger handler framework integration (FFLIB Enterprise Patterns + pragmatic single-trigger)
- Async Apex: Queueable, Batch, Schedulable design patterns
- Exception handling, custom exception hierarchies, and structured logging

### LWC Patterns

- Component lifecycle management and reactive property wiring
- Base component usage, composition over inheritance
- Accessibility (ARIA) compliance and keyboard navigation
- Wire adapters, imperative Apex calls, and error boundary patterns

### SOQL Optimization

- Index-aware WHERE clause construction and selectivity guidance
- Avoiding full-table scans and non-selective filters
- Parent-child relationship queries and aggregate optimization
- SOQL in loops detection and bulk query strategies

### Trigger Frameworks

- FFLIB-style trigger dispatcher and domain layer integration
- Pragmatic single-trigger-per-object with handler routing
- Recursive prevention patterns and context-aware execution
- TriggerOperation enum usage and before/after separation

### Security — CRUD / FLS / Sharing

- Schema.SObjectField.getDescribe() for FLS checks
- WITH SECURITY_ENFORCED and stripInaccessible() usage
- Sharing model enforcement and without sharing justification
- SOQL injection prevention and safe dynamic queries

### DevOps / CI-CD

- SF CLI v2 (sf) command patterns and project structure
- Scratch org creation, source push/pull, and org pooling
- Metadata API vs Source format understanding
- GitHub Actions / GitLab CI pipeline patterns for Salesforce

### Agentforce AI Agents

- Agentforce Agent Builder configuration and topic definitions
- Custom action creation (Apex, Flow, prompt templates)
- Agent testing and conversation design patterns
- Einstein AI feature integration

### Salesforce MCP Integration

SCC is designed to complement the official [Salesforce MCP server](https://github.com/salesforce/salesforce-mcp). Install both for the full experience:

- **@salesforce/mcp** provides: org management, metadata deployment, SOQL queries, Apex test execution, code analysis, LWC tools, DevOps operations
- **SCC provides**: domain expertise to use those tools correctly, quality gates to catch mistakes, and institutional knowledge to follow best practices

MCP config is auto-installed by `npx scc install`:

```bash
npx scc install all --target claude   # Installs .mcp.json at project root
npx scc install all --target cursor   # Installs .cursor/mcp.json
```

### Enhanced Quality Gates

SCC integrates with [Salesforce Code Analyzer](https://developer.salesforce.com/tools/sfdx-scanner) for machine-enforceable checks:

```bash
# Install the scanner (one-time setup)
sf plugins install @salesforce/sfdx-scanner
```

Once installed, SCC automatically runs PMD analysis:

- **Standard profile**: Scanner runs before `git push` and `sf project deploy`
- **Strict profile**: Scanner runs on every code edit
- Graceful no-op if scanner is not installed — SCC falls back to regex-based checks

### Cross-Harness Support

All content is structured for use across multiple AI harnesses:

- **Claude Code** — primary harness with full hook integration
- **Cursor** — rules, skills, and hooks exported to `.cursor/` directory

---

## Agents

| Agent | Description |
|---|---|
| `sf-architect` | Orchestrator — analyze requirements, design solutions, decompose tasks, final review |
| `sf-apex-agent` | All Apex — classes, triggers, batch, async, callouts, tests (TDD) |
| `sf-lwc-agent` | All LWC — components, Jest tests, wire service, events, SLDS |
| `sf-flow-agent` | All Flow — record-triggered, screen, scheduled, approval processes |
| `sf-admin-agent` | All config — objects, permissions, sharing, metadata, Experience Cloud |
| `sf-integration-agent` | All integration — REST/SOAP callouts, Named Creds, Platform Events, CDC |
| `sf-agentforce-agent` | Agentforce — topics, custom Apex actions, prompt templates |
| `sf-review-agent` | Cross-domain review — security audit, performance, test coverage |
| `sf-bugfix-agent` | Fix build errors, test failures, deploy issues (minimal diff) |
| `sf-aura-reviewer` | Aura component review and LWC migration guidance |
| `sf-visualforce-reviewer` | Visualforce page review and migration guidance |
| `doc-updater` | Documentation generation and maintenance |
| `refactor-cleaner` | Code refactoring and cleanup |
| `loop-operator` | Autonomous loop execution and monitoring |
| `deep-researcher` | Multi-source Salesforce research and synthesis |
| `learning-engine` | Continuous learning from session patterns |
| `eval-runner` | Eval suite definition and execution |

---

## Skills

| Skill | Description |
|---|---|
| `sf-agentforce-development` | Agentforce agent design, topics, and actions |
| `sf-apex-async-patterns` | Queueable, Batch, Schedulable design |
| `sf-apex-best-practices` | Apex coding standards and patterns |
| `sf-apex-cursor` | Apex cursor-based pagination patterns |
| `sf-apex-enterprise-patterns` | FFLIB and enterprise Apex patterns |
| `sf-apex-testing` | @IsTest, test data factories, mock patterns |
| `configure-scc` | SCC plugin configuration and setup |
| `sf-devops-ci-cd` | GitHub Actions / GitLab CI for Salesforce |
| `sf-flow-development` | Flow types, fault handling, bulkification |
| `sf-governor-limits` | Limit tracking, monitoring, and avoidance |
| `sf-lwc-development` | Component composition, lifecycle, reactivity |
| `sf-lwc-testing` | LWC Jest testing and component test patterns |
| `sf-metadata-management` | Metadata API and source format management |
| `sf-data-modeling` | Object model, relationships, and data design |
| `sf-debugging` | Debug logs, checkpoints, and trace flags |
| `sf-deployment` | Deployment validation, partial deploys, rollback |
| `sf-integration` | REST/SOAP callouts, named credentials, auth |
| `sf-security` | CRUD/FLS, sharing, stripInaccessible patterns |
| `sf-api-design` | Salesforce API design and best practices |
| `sf-e2e-testing` | End-to-end testing for Salesforce apps |
| `sf-tdd-workflow` | Test-driven development for Salesforce |
| `sf-soql-optimization` | Index strategies, selective queries, bulkification |
| `strategic-compact` | Strategic context compaction patterns |
| `sf-trigger-frameworks` | FFLIB and pragmatic trigger handler patterns |
| `mcp-server-patterns` | MCP server design and integration patterns |
| `search-first` | Search-first development methodology |
| `security-scan` | Security scanning patterns and automation |
| `continuous-agent-loop` | Continuous autonomous agent loop patterns and controls |
| `prompt-optimizer` | Analyze and rewrite prompts to match SCC components for better agent performance |
| `sf-visualforce-development` | Visualforce page patterns, controllers, and migration to LWC |
| `sf-aura-development` | Aura component patterns and LWC migration strategies |
| `sf-platform-events-cdc` | Platform Events and Change Data Capture patterns |
| `sf-approval-processes` | Approval process design and automation patterns |
| `sf-experience-cloud` | Experience Cloud site development and customization |
| `sf-docs-lookup` | Official Salesforce documentation lookup |
| `sf-help` | Discover SCC skills, agents, and workflows |
| `sf-quickstart` | Interactive onboarding and project detection |
| `sf-build-fix` | Build error resolution and dependency fixes |
| `sf-harness-audit` | Audit SCC harness configuration |
| `update-platform-docs` | Update platform reference documentation |
| `aside` | Quick Salesforce answer mid-task without losing context |
| `checkpoint` | Save a development checkpoint via git stash for rollback |
| `model-route` | Route tasks to optimal Claude model tier by complexity |
| `refactor-clean` | Dead code removal and consolidation via PMD/Code Analyzer |
| `resume-session` | Resume a saved Salesforce development session |
| `save-session` | Persist session state for future resumption |
| `sessions` | List, load, and inspect saved sessions |
| `update-docs` | Sync documentation after Apex code changes |
| `sf-apex-constraints` | Always-on: governor limits, naming, bulkification rules |
| `sf-deployment-constraints` | Always-on: deploy safety, validation-only first, rollback readiness |
| `sf-lwc-constraints` | Always-on: LWC naming, security, accessibility, performance |
| `sf-security-constraints` | Always-on: CRUD/FLS, sharing, SOQL injection, XSS |
| `sf-soql-constraints` | Always-on: query safety, selectivity, governor compliance |
| `sf-testing-constraints` | Always-on: 75% coverage minimum, test isolation, assertions |
| `sf-trigger-constraints` | Always-on: one-trigger-per-object, handler delegation, recursion |

---

## Skills

17 skills are user-invocable via `/skill-name`. 38 are auto-activating context skills (28 pattern + 7 constraint + 3 platform).

### User-Invocable (17)

Invoke with `/skill-name` in Claude Code or Cursor.

| Skill | Description |
|---|---|
| `/sf-help` | Discover SCC skills, agents, and workflows |
| `/sf-quickstart` | Interactive onboarding and project detection |
| `/sf-docs-lookup` | Look up Salesforce documentation |
| `/sf-harness-audit` | Audit SCC harness configuration |
| `/sessions` | List and manage sessions |
| `/configure-scc` | Interactive SCC setup wizard for profiles, modules, and org config |
| `/continuous-agent-loop` | Multi-agent orchestration and autonomous loops |
| `/prompt-optimizer` | Optimize prompts for better agent performance |
| `/checkpoint` | Save a development checkpoint for rollback |
| `/save-session` | Save current session state |
| `/resume-session` | Resume a saved session |
| `/refactor-clean` | Dead code removal and consolidation |
| `/update-docs` | Update project documentation |
| `/update-platform-docs` | Update platform reference docs with latest release features |
| `/aside` | Quick side investigation without losing context |
| `/model-route` | Route tasks to optimal model by complexity |
| `/search-first` | Research existing tools and patterns before writing custom code |

### Pattern Skills (28) — Agent-Consulted

Agents read these on demand for domain knowledge. Not directly invocable via `/`.

| Skill | Description |
|---|---|
| `sf-apex-best-practices` | Apex code review — governor limits, bulkification, security, patterns |
| `sf-apex-testing` | Run and analyze Apex test results with coverage |
| `sf-apex-async-patterns` | Batch vs Queueable vs @future decision framework |
| `sf-apex-enterprise-patterns` | FFLIB selector/domain/service/UoW layers |
| `sf-apex-cursor` | Cursor API for large SOQL result sets |
| `sf-trigger-frameworks` | Trigger framework patterns — One-Trigger-Per-Object, handler base class |
| `sf-soql-optimization` | Analyze and optimize SOQL queries for performance |
| `sf-governor-limits` | Governor limit audit — SOQL, DML, heap, CPU, callouts |
| `sf-lwc-development` | LWC component review — architecture, reactivity, accessibility |
| `sf-lwc-testing` | Jest testing for LWC — mocks, DOM queries, accessibility |
| `sf-flow-development` | Review Flows for best practices and anti-patterns |
| `sf-approval-processes` | Approval lifecycle, multi-step, delegation patterns |
| `sf-data-modeling` | Data modeling, sharing rules, and admin configuration |
| `sf-experience-cloud` | Experience Cloud sites, guest users, external sharing |
| `sf-metadata-management` | package.xml, .forceignore, source tracking |
| `sf-integration` | REST/SOAP callouts, Named Credentials, retry patterns |
| `sf-platform-events-cdc` | Platform Events and Change Data Capture review |
| `sf-api-design` | Custom REST endpoints, batch operations |
| `sf-agentforce-development` | Design and configure an Agentforce AI agent |
| `sf-security` | Security audit — CRUD/FLS, sharing, SOQL injection, XSS |
| `sf-e2e-testing` | End-to-end test patterns and deployment verification |
| `sf-debugging` | Debug using logs, debug levels, and tracing |
| `sf-deployment` | Deployment workflow — validate, test, deploy to sandbox or production |
| `sf-devops-ci-cd` | GitHub Actions, CI/CD, scratch org CI |
| `sf-tdd-workflow` | Test-driven Apex development with test-first workflow |
| `sf-build-fix` | Fix build errors and resolve dependencies |
| `sf-visualforce-development` | Visualforce review — XSS, ViewState, LWC migration |
| `sf-aura-development` | Aura component review — Locker Service, LWC migration |

### Auto-Activating Skills

38 skills activate automatically during development — no `/` invocation needed.

**Constraint Skills (always-on governance):**

| Skill | Enforces |
|---|---|
| `sf-apex-constraints` | Governor limits, naming conventions, bulkification, security |
| `sf-deployment-constraints` | Validation-only first, test coverage gates, metadata ordering |
| `sf-lwc-constraints` | LWC naming, security, accessibility, performance rules |
| `sf-security-constraints` | CRUD/FLS, sharing model, SOQL injection, XSS protection |
| `sf-soql-constraints` | Query safety, selectivity, governor limit compliance |
| `sf-testing-constraints` | 75% coverage minimum, test isolation, assertion requirements |
| `sf-trigger-constraints` | One-trigger-per-object, handler delegation, recursion prevention |

**Platform Context Skills (3):**

| Skill | Activates When |
|---|---|
| `mcp-server-patterns` | Building MCP servers for Salesforce integration |
| `security-scan` | Scanning Claude Code config for vulnerabilities and misconfigurations |
| `strategic-compact` | Managing context during long development sessions |

Pattern skills (28, listed above) also activate contextually when their domain is relevant.

---

## Hook Profiles

Control which hooks run via the `SCC_HOOK_PROFILE` environment variable:

| Profile | Description |
|---|---|
| `minimal` | Only critical hooks (session start context display) |
| `standard` | Recommended — session start + pre-tool validation + post-write reminders (default) |
| `strict` | All hooks enabled with additional enforcement and stop-hook summaries |

### Environment Variables

| Variable | Values | Description |
|---|---|---|
| `SCC_HOOK_PROFILE` | `minimal`, `standard`, `strict` | Controls which hooks run (default: `standard`) |
| `SCC_DISABLED_HOOKS` | Comma-separated names | Disable specific hooks (e.g., `session-start,auto-format`) |
| `SF_ORG_ALIAS` | Any org alias | Default Salesforce target org for session context |
| `CLAUDE_PACKAGE_MANAGER` | `npm`, `pnpm`, `yarn`, `bun` | Override auto-detected package manager |

---

## Tips and Best Practices

### Salesforce-Specific Workflows

**New Feature Development:**

1. `/blueprint` - Plan the implementation (metadata types, governor limits)
2. `/sf-tdd-workflow` - Write tests first, then implement
3. `/sf-apex-best-practices` - Review your code
4. `/sf-deployment` - Deploy to target org

**Code Review:**

1. `/sf-apex-best-practices` - Full review of uncommitted changes
2. `/sf-security` - Security-focused audit
3. `/sf-governor-limits` - Check for governor limit issues

**Performance Optimization:**

1. `/sf-soql-optimization` - Fix expensive queries
2. `/sf-governor-limits` - Find limit violations
3. Use the `sf-review-agent` for deep analysis

### Context Window Management

- Keep MCP servers minimal (SF CLI MCP + 2-3 others)
- Use specific prompts: "Review AccountTrigger.cls" not "review everything"
- Use `/compact` when context gets large

### Parallel Workflows

- Use `/fork` for non-overlapping tasks
- Use git worktrees for parallel scratch org work:

```bash
git worktree add ../feature-branch feature-branch
cd ../feature-branch
sf org create scratch --alias feature-scratch
```

### Key Principles

1. **Governor limits are king** — Every agent checks for limit violations
2. **Test-first approach** — 75% is the SF minimum, aim for 85%+
3. **Use the right agent** — Specialized agents give better results than generic prompts
4. **Hook profiles matter** — Start with `standard`, move to `strict` for CI
5. **Context is precious** — Be specific in prompts, disable unused MCPs
6. **Security baked in** — CRUD/FLS and sharing model from the start

---

## Documentation

| Guide | Description |
|---|---|
| [Hook Development](docs/hook-development.md) | How to create, test, and deploy hooks with profile gating |
| [Authoring Guide](docs/authoring-guide.md) | Templates for creating agents, skills, and rules |
| [Workflow Examples](docs/workflow-examples.md) | Step-by-step walkthroughs for Apex TDD, LWC dev, deployment, security audit |
| [Architecture](docs/ARCHITECTURE.md) | System design overview with diagrams |
| [Token Optimization](docs/token-optimization.md) | Settings and habits to reduce token consumption |
| [Security Guide](the-security-guide.md) | CRUD/FLS, injection prevention, encryption, session security |
| [Troubleshooting](TROUBLESHOOTING.md) | Common issues and solutions |
| [Changelog](CHANGELOG.md) | Version history and release notes |

---

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Follow the existing file naming convention: lowercase with hyphens.
2. All agents must have valid YAML frontmatter (`name`, `description`, `tools`, `model`).
3. All skills must include a `SKILL.md` with `name`, `description`, and `origin: SCC` in frontmatter.
4. Run `npm test` before submitting a pull request — all CI validators must pass.
5. Use Conventional Commits format: `<type>: <description>` (max 100 chars).
6. Coverage must stay above 80% for lines, functions, branches, and statements.

```bash
git clone <repo>
cd salesforce-claude-code
npm install
git config core.hooksPath .githooks   # Enable pre-commit checks
npm test                               # Build + lint + validate + tests
bash scripts/ci/smoke-test.sh          # Pack + install/uninstall smoke test
```

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

## Acknowledgements

SCC's plugin architecture was inspired by [Everything Claude Code (ECC)](https://github.com/affaan-m/everything-claude-code) by [Affaan Mustafa](https://github.com/affaan-m), licensed under the MIT License. Since v1.0.0, SCC is independently maintained with its own roadmap, Salesforce-specific content, and infrastructure.
