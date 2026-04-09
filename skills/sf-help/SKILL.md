---
name: sf-help
description: >-
  Use when asking what SCC can do. Discover SCC agents and skills — organized
  by Salesforce workflow to answer what tools are available and which to use.
origin: SCC
user-invocable: true
---

# SCC Help — Agent and Skill Discovery

SCC provides **17 agents** for end-to-end Salesforce development and **57 skills** for domain knowledge. Agents are lean workflow orchestrators. Skills carry patterns, examples, and rules.

## When to Use

- Discovering what SCC agents and skills are available
- Deciding which agent to use for a specific task
- Onboarding to a project and understanding SCC capabilities
- Searching by keyword (e.g., "apex", "lwc", "deploy", "test", "security")

## Domain Agents (11)

These agents auto-activate based on your task. Each follows TDD and preloads constraint skills.

| Agent | What It Does |
|-------|-------------|
| `sf-architect` | Orchestrator — analyzes requirements, designs solutions, decomposes tasks, runs final review |
| `sf-apex-agent` | All Apex — classes, triggers, batch, async, callouts, tests (TDD) |
| `sf-lwc-agent` | All LWC — components, Jest tests, wire service, events, SLDS |
| `sf-flow-agent` | All Flow — record-triggered, screen, scheduled, approval processes |
| `sf-admin-agent` | All config — objects, permissions, sharing, metadata, Experience Cloud |
| `sf-integration-agent` | All integration — REST/SOAP callouts, Named Creds, Platform Events, CDC |
| `sf-agentforce-agent` | Agentforce — topics, custom Apex actions, prompt templates |
| `sf-review-agent` | Cross-domain review — security audit, performance, test coverage |
| `sf-bugfix-agent` | Fix build errors, test failures, deploy issues (minimal diff) |
| `sf-aura-reviewer` | Review Aura components + migration to LWC |
| `sf-visualforce-reviewer` | Review Visualforce pages + migration to LWC |

## Platform Agents (6)

| Agent | What It Does |
|-------|-------------|
| `deep-researcher` | Multi-source research with citations |
| `doc-updater` | Documentation sync and codemap generation |
| `eval-runner` | Evaluate and benchmark performance |
| `learning-engine` | Instinct-based learning from sessions |
| `loop-operator` | Autonomous agent loop management |
| `refactor-cleaner` | Dead code removal and consolidation |

## Constraint Skills (7) — Auto-loaded by agents

These enforce hard rules. Agents preload them via `skills` frontmatter.

| Skill | Rules |
|-------|-------|
| `sf-apex-constraints` | Governor limits, bulkification, naming |
| `sf-lwc-constraints` | Component naming, security, accessibility |
| `sf-trigger-constraints` | One-trigger-per-object, handler delegation |
| `sf-security-constraints` | CRUD/FLS, sharing, injection prevention |
| `sf-testing-constraints` | Coverage, isolation, assertions |
| `sf-soql-constraints` | Query safety, selectivity |
| `sf-deployment-constraints` | Deploy safety, test levels, validation |

## Pattern Skills (29) — Read by agents on demand

Agents read these for domain knowledge when the task matches. Not user-invocable.

### Apex

| Skill | Knowledge |
|-------|-----------|
| `sf-apex-best-practices` | Class organization, error handling, collections |
| `sf-apex-testing` | TestDataFactory, bulk scenarios, mocks |
| `sf-apex-async-patterns` | Batch vs Queueable vs @future decision |
| `sf-apex-enterprise-patterns` | FFLIB selector/domain/service/UoW |
| `sf-apex-cursor` | Cursor API for large result sets |
| `sf-trigger-frameworks` | Handler patterns, recursion prevention |
| `sf-soql-optimization` | Selectivity, indexes, query plans |
| `sf-governor-limits` | Limit reference, optimization strategies |

### LWC

| Skill | Knowledge |
|-------|-----------|
| `sf-lwc-development` | Component lifecycle, wire, events, SLDS |
| `sf-lwc-testing` | Jest mocking, DOM queries, accessibility |

### Flow

| Skill | Knowledge |
|-------|-----------|
| `sf-flow-development` | Flow types, bulkification, error handling |
| `sf-approval-processes` | Approval lifecycle, multi-step, delegation |

### Admin / Config

| Skill | Knowledge |
|-------|-----------|
| `sf-data-modeling` | Objects, relationships, CMDTs, sharing |
| `sf-experience-cloud` | Sites, guest users, external sharing |
| `sf-metadata-management` | package.xml, .forceignore, source tracking |

### Integration

| Skill | Knowledge |
|-------|-----------|
| `sf-integration` | REST/SOAP callouts, Named Creds, retry |
| `sf-platform-events-cdc` | Event publish/subscribe, CDC setup |
| `sf-api-design` | Custom REST endpoints, batch operations |

### Agentforce

| Skill | Knowledge |
|-------|-----------|
| `sf-agentforce-development` | Topics, actions, prompt templates |

### Cross-domain

| Skill | Knowledge |
|-------|-----------|
| `sf-security` | CRUD/FLS enforcement, sharing, injection |
| `sf-e2e-testing` | Integration test strategy, bulk scenarios |
| `sf-debugging` | Debug logs, explain plans, common errors |
| `sf-deployment` | Deploy strategies, validation-only, rollback |
| `sf-devops-ci-cd` | GitHub Actions, CI/CD, scratch org CI |
| `sf-cli-reference` | SF CLI commands — org, data, source, package, deploy |
| `sf-tdd-workflow` | Red-Green-Refactor, TDD methodology |
| `sf-build-fix` | Compilation errors, metadata conflicts |

### Legacy

| Skill | Knowledge |
|-------|-----------|
| `sf-aura-development` | Aura patterns + LWC migration |
| `sf-visualforce-development` | VF patterns + LWC migration |

## Utility Skills — User-invocable

| Skill | What It Does |
|-------|-------------|
| `/sf-help` | This skill — discover available agents and skills |
| `/sf-quickstart` | Interactive onboarding for new projects |
| `/sf-docs-lookup` | Look up Salesforce documentation |
| `/sf-harness-audit` | Audit SCC configuration health |
| `/sf-2gp-security-review` | 2GP managed package AppExchange security review |
| `/sessions` | List and manage saved sessions |

## Quick Start

1. `/sf-quickstart` — detect project type, configure SCC
2. Describe your task — sf-architect auto-activates for planning
3. Domain agents auto-activate for building (sf-apex-agent, sf-lwc-agent, etc.)
4. sf-review-agent auto-activates before deployment

**Fixing build errors?** Describe the error — sf-bugfix-agent activates.

**Need docs?** `/sf-docs-lookup <topic>`

## Related

- **Pattern skills**: `sf-quickstart`, `sf-docs-lookup`, `sf-harness-audit`
