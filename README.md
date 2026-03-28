# Salesforce Claude Code (SCC)

[![npm version](https://img.shields.io/npm/v/scc-universal.svg)](https://www.npmjs.com/package/scc-universal)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node Version](https://img.shields.io/node/v/scc-universal.svg)](https://nodejs.org)

> The complete AI development system for Salesforce — expert agents, automated quality gates, and institutional knowledge, powered by @salesforce/mcp

SCC is a Claude Code plugin that supercharges your Salesforce development workflow with specialized AI agents, domain skills, lifecycle hooks, and always-on coding rules. Built for Apex, LWC, SOQL, Flow, Visualforce, Aura, DevOps, and Agentforce — covering every layer of the Salesforce platform.

---

## How It Works

SCC is a unified system where each layer serves a distinct role:

| Layer | What It Does | Examples |
|-------|-------------|----------|
| **@salesforce/mcp** | Platform capabilities — query orgs, deploy metadata, run tests, analyze code | Org management, SOQL queries, Apex test execution |
| **27 Agents** | Expert routing — each agent specializes in one Salesforce domain | `sf-apex-reviewer`, `sf-soql-optimizer`, `sf-trigger-architect`, `sf-security-reviewer` |
| **58 Skills** | Institutional knowledge + workflows — 39 user-invocable via `/skill-name`, 19 auto-activating | `/sf-apex-best-practices`, `/sf-deployment`, `/sf-soql-optimization`, `/sf-security` |
| **28 Rules** | Always-on governance — enforced on every interaction | `with sharing` mandatory, `WITH USER_MODE` for SOQL, naming conventions |
| **28 Hooks** | Automated enforcement — quality gates run on every code change | SOQL-in-loop detection, PMD via sf scanner, privilege escalation checks |

**Together:** `@salesforce/mcp` gives Claude the hands to work with Salesforce. SCC gives Claude the brain to work well.

---

## What's Included

| Category | Count | Description |
|---|---|---|
| Agents | 27 | Specialized Salesforce subagents |
| Skills | 58 | Domain knowledge + workflow modules (39 user-invocable, 19 auto-activating) |
| Rules | 28 | Always-on guidelines (Apex / LWC / SOQL / Flow / Visualforce / Aura / common) |
| Hooks | 28 | Lifecycle hooks (SessionStart, PreToolUse, PostToolUse, PostToolUseFailure, PreCompact, Stop, SessionEnd) |
| Harnesses | 2 | Claude Code, Cursor |

---

## Requirements

- **Node.js >= 20** — required to run the `npx scc` CLI
- **Python 3.x** — required for continuous-learning / instinct skills (`/continuous-learning-v2`)

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
| `sf-planner` | Decomposes Salesforce features into implementation tasks |
| `sf-code-reviewer` | General Salesforce code quality review |
| `sf-apex-reviewer` | Deep Apex quality, patterns, and governor limits |
| `sf-lwc-reviewer` | LWC component architecture and accessibility review |
| `sf-tdd-guide` | Test-driven development guidance for Apex |
| `sf-security-reviewer` | CRUD/FLS/sharing and injection vulnerability audit |
| `sf-soql-optimizer` | SOQL query analysis and index-aware rewriting |
| `sf-trigger-architect` | Trigger framework design and refactoring |
| `sf-devops-guide` | SF CLI, scratch orgs, CI/CD pipeline guidance |
| `sf-flow-reviewer` | Flow Builder best practices and performance review |
| `sf-agentforce-builder` | Agentforce agent design and configuration |
| `sf-performance-optimizer` | Governor limit analysis and performance tuning |
| `sf-integration-architect` | REST/SOAP/Platform Events integration patterns |
| `sf-data-architect` | Object model, relationships, and data migration |
| `sf-deployment-guide` | Deployment strategy, validation, and rollback |
| `sf-chief-of-staff` | Session coordination and task delegation |
| `doc-updater` | Documentation generation and maintenance |
| `sf-e2e-runner` | End-to-end test execution and analysis |
| `sf-harness-optimizer` | AI harness configuration optimization |
| `refactor-cleaner` | Code refactoring and cleanup |
| `sf-architect` | Salesforce architecture design and review |
| `sf-build-resolver` | Build error resolution and dependency fixes |
| `sf-docs-lookup` | Salesforce documentation search and reference |
| `sf-admin` | Salesforce admin configuration and audit |
| `sf-visualforce-reviewer` | Visualforce page review and migration guidance |
| `sf-aura-reviewer` | Aura component review and LWC migration guidance |
| `loop-operator` | Autonomous loop execution and monitoring |

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
| `sf-package-development` | Managed and unlocked package development |
| `sf-data-modeling` | Object model, relationships, and data design |
| `sf-debugging` | Debug logs, checkpoints, and trace flags |
| `sf-deployment` | Deployment validation, partial deploys, rollback |
| `sf-integration` | REST/SOAP callouts, named credentials, auth |
| `sf-security` | CRUD/FLS, sharing, stripInaccessible patterns |
| `sf-scratch-org-workflow` | Scratch org creation, pooling, and lifecycle |
| `sf-api-design` | Salesforce API design and best practices |
| `sf-docker-patterns` | Docker patterns for Salesforce CI/CD |
| `sf-e2e-testing` | End-to-end testing for Salesforce apps |
| `sf-metadata-migrations` | Metadata migration strategies |
| `sf-tdd-workflow` | Test-driven development for Salesforce |
| `sf-soql-optimization` | Index strategies, selective queries, bulkification |
| `strategic-compact` | Strategic context compaction patterns |
| `sf-trigger-frameworks` | FFLIB and pragmatic trigger handler patterns |
| `verification-loop` | Verification and validation workflows |
| `continuous-learning-v2` | Continuous learning and skill evolution |
| `deep-research` | Deep research methodology and patterns |
| `eval-harness` | Evaluation harness design and execution |
| `mcp-server-patterns` | MCP server design and integration patterns |
| `search-first` | Search-first development methodology |
| `security-scan` | Security scanning patterns and automation |
| `skill-stocktake` | Skill inventory and gap analysis |
| `continuous-agent-loop` | Continuous autonomous agent loop patterns and controls |
| `blueprint` | Build a step-by-step construction plan for multi-session, multi-agent Salesforce projects |
| `prompt-optimizer` | Analyze and rewrite prompts to match SCC components for better agent performance |
| `sf-visualforce-development` | Visualforce page patterns, controllers, and migration to LWC |
| `sf-aura-development` | Aura component patterns and LWC migration strategies |
| `sf-platform-events-cdc` | Platform Events and Change Data Capture patterns |
| `sf-approval-processes` | Approval process design and automation patterns |
| `sf-experience-cloud` | Experience Cloud site development and customization |
| `sf-reporting-dashboards` | Salesforce reporting and dashboard development |

---

## Skills (User-Invocable)

39 skills are user-invocable via `/skill-name`. 19 are auto-activating context skills. Key skills by category:

### Salesforce Development

| Skill | Description |
|---|---|
| `/sf-apex-best-practices` | Apex code review — governor limits, bulkification, security, patterns |
| `/sf-lwc-development` | LWC component review — architecture, reactivity, accessibility |
| `/sf-tdd-workflow` | Test-driven Apex development with test-first workflow |
| `/sf-soql-optimization` | Analyze and optimize SOQL queries for performance |
| `/sf-trigger-frameworks` | Trigger framework patterns — One-Trigger-Per-Object, handler base class |
| `/sf-security` | Security audit — CRUD/FLS, sharing, SOQL injection, XSS |
| `/sf-deployment` | Deployment workflow — validate, test, deploy to sandbox or production |
| `/sf-scratch-org-workflow` | Create and configure a Salesforce scratch org |
| `/sf-apex-testing` | Run and analyze Apex test results with coverage |
| `/sf-flow-development` | Review Flows for best practices and anti-patterns |
| `/sf-agentforce-development` | Design and configure an Agentforce AI agent |
| `/sf-governor-limits` | Governor limit audit — SOQL, DML, heap, CPU, callouts |
| `/blueprint` | Create a step-by-step implementation plan |
| `/sf-debugging` | Debug using logs, debug levels, and tracing |
| `/sf-e2e-testing` | End-to-end test patterns and deployment verification |
| `/sf-platform-events-cdc` | Platform Events and Change Data Capture review |
| `/sf-visualforce-development` | Visualforce review — XSS, ViewState, LWC migration |
| `/sf-aura-development` | Aura component review — Locker Service, LWC migration |
| `/sf-data-modeling` | Data modeling, sharing rules, and admin configuration |

### Platform & Workflow

| Skill | Description |
|---|---|
| `/sf-build-fix` | Fix build errors and resolve dependencies |
| `/verification-loop` | Quality gate — security, governor, coverage, code review |
| `/continuous-agent-loop` | Multi-agent orchestration and autonomous loops |
| `/continuous-learning-v2` | Pattern learning, instincts, session management |
| `/prompt-optimizer` | Optimize prompts for better agent performance |
| `/eval-harness` | Evaluate code quality with formal eval framework |
| `/skill-stocktake` | Audit skill portfolio health and coverage |
| `/sf-help` | Discover SCC skills, agents, and workflows |
| `/sf-quickstart` | Interactive onboarding and project detection |
| `/checkpoint` | Save a development checkpoint for rollback |
| `/save-session` | Save current session state |
| `/resume-session` | Resume a saved session |
| `/sessions` | List and manage sessions |
| `/refactor-clean` | Dead code removal and consolidation |
| `/update-docs` | Update project documentation |
| `/sf-docs-lookup` | Look up Salesforce documentation |
| `/aside` | Quick side investigation without losing context |
| `/model-route` | Route tasks to optimal model by complexity |
| `/sf-harness-audit` | Audit SCC harness configuration |
| `/deep-research` | Multi-source research with citations |

---

## Hook Profiles

Control which hooks run via the `SCC_HOOK_PROFILE` environment variable:

| Profile | Description |
|---|---|
| `minimal` | Only critical hooks (session start context display) |
| `standard` | Recommended — session start + pre-tool validation + post-write reminders (default) |
| `strict` | All hooks enabled with additional enforcement and stop-hook summaries |

```bash
# Set in your shell or .env
SCC_HOOK_PROFILE=standard

# Disable specific hooks
SCC_DISABLED_HOOKS=session-start,auto-format
```

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
3. Use the `sf-performance-optimizer` agent for deep analysis

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
npm test
```

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

## Acknowledgements

SCC's plugin architecture was inspired by [Everything Claude Code (ECC)](https://github.com/affaan-m/everything-claude-code) by [Affaan Mustafa](https://github.com/affaan-m), licensed under the MIT License. Since v1.0.0, SCC is independently maintained with its own roadmap, Salesforce-specific content, and infrastructure.
