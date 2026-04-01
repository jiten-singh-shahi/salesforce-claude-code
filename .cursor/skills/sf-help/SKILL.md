---
name: sf-help
description: >-
  Use when asking what SCC can do. Discover SCC commands, agents, and skills — organized by Salesforce workflow to answer what tools are available and which to use.
---

# SCC Help — Command, Skill, and Agent Discovery

Show available SCC commands, skills, and agents organized by Salesforce workflow. Answers "what can I do?" and "which command/skill should I use?"

SCC provides **55 skills** (35 user-invocable) for deep domain knowledge and core workflows, and **25 specialized agents** for complex multi-step work.

> **Note:** All workflows are now available as **skills**. Skills activate automatically when relevant, and 35 of them can also be invoked directly by name. See the categorized list below.

## When to Use

- When you need to discover what SCC commands, skills, or agents are available
- When deciding which command or skill to use for a specific Salesforce workflow
- When onboarding to a project and want to understand SCC capabilities
- When searching for a specific tool by keyword (e.g., "apex", "lwc", "deploy", "test", "security")
- When you want a categorized overview of the full SCC toolset

## Usage

```
sf-help                    # Full categorized command + skill list
sf-help apex               # Commands and skills for Apex development
sf-help lwc                # Commands and skills for LWC development
sf-help deploy             # Skills for deployment workflows
sf-help test               # Skills for testing workflows
sf-help security           # Skills for security review
sf-help <keyword>          # Search commands and skills by keyword
```

## Utility Skills

### Project Setup & Onboarding

| Skill | What It Does |
|-------|-------------|
| `/sf-help` | This skill — discover available skills and agents |
| `/sf-quickstart` | Interactive onboarding for new projects |

### Build & Refactoring

| Skill | What It Does |
|-------|-------------|
| `/sf-build-fix` | Fix build and deployment errors |
| `/refactor-clean` | Dead code removal and consolidation |

### Session & Checkpoints

| Skill | What It Does |
|-------|-------------|
| `/save-session` | Save session state for later |
| `/resume-session` | Resume from saved session |
| `/sessions` | List and manage saved sessions |
| `/checkpoint` | Save a recovery checkpoint |

### Documentation & Meta

| Skill | What It Does |
|-------|-------------|
| `/sf-docs-lookup` | Look up documentation topics |
| `/update-docs` | Update project documentation |
| `/update-platform-docs` | Refresh platform deprecation & API version reference docs |
| `/sf-harness-audit` | Audit SCC configuration health |
| `/aside` | Start a side conversation without affecting main context |
| `/model-route` | Route to the best model for a task |

## Salesforce Domain Skills (24)

These skills can be invoked directly by name (e.g., "use sf-tdd-workflow" or "apply sf-security"):

### Code Review & Quality

| Skill | What It Does |
|-------|-------------|
| `sf-apex-best-practices` | Enterprise Apex coding standards and patterns |
| `sf-governor-limits` | Governor limit detection and remediation |
| `sf-soql-optimization` | SOQL query performance optimization |
| `sf-trigger-frameworks` | Trigger handler pattern refactoring |

### Testing

| Skill | What It Does |
|-------|-------------|
| `sf-tdd-workflow` | Test-driven Apex development (RED-GREEN-REFACTOR) |
| `sf-apex-testing` | Apex test patterns and coverage analysis |
| `sf-e2e-testing` | End-to-end integration testing |

### Security

| Skill | What It Does |
|-------|-------------|
| `sf-security` | Security audit (CRUD/FLS, sharing, injection) |

### Development

| Skill | What It Does |
|-------|-------------|
| `sf-lwc-development` | Lightning Web Component development |
| `sf-flow-development` | Flow design and automation |
| `sf-agentforce-development` | Agentforce agent and action development |
| `sf-data-modeling` | Data model and relationship design |
| `sf-visualforce-development` | Visualforce page development and migration |
| `sf-aura-development` | Aura component development and migration |
| `sf-platform-events-cdc` | Platform Events and Change Data Capture |

### Deployment & DevOps

| Skill | What It Does |
|-------|-------------|
| `sf-deployment` | Guided deployment workflow |
| `sf-debugging` | Debug log analysis and troubleshooting |

### Platform Skills

| Skill | What It Does |
|-------|-------------|
| `continuous-agent-loop` | Continuous autonomous agent workflow |
| `prompt-optimizer` | Optimize prompts for SCC |

### Platform Agents (migrated from skills)

| Agent | What It Does |
|-------|-------------|
| `sf-blueprint-planner` | Architecture blueprint generation |
| `deep-researcher` | Deep multi-source research |
| `sf-verification-runner` | Pre-deployment verification loop |
| `learning-engine` | Instinct-based learning from sessions |
| `eval-runner` | Evaluate and benchmark SCC performance |

## Additional Skills (20)

These skills activate automatically when relevant context is detected. They do not need to be invoked directly:

| Skill Category | Skills |
|---------------|--------|
| Salesforce | `sf-integration`, `sf-api-design`, `sf-metadata-management`, `sf-devops-ci-cd`, `sf-approval-processes`, `sf-experience-cloud`, `sf-apex-enterprise-patterns`, `sf-apex-cursor`, `sf-lwc-testing`, `sf-apex-async-patterns`, `sf-apex-constraints`, `sf-soql-constraints`, `sf-security-constraints`, `sf-trigger-constraints`, `sf-testing-constraints`, `sf-lwc-constraints`, `sf-deployment-constraints` |
| Platform | `mcp-server-patterns`, `security-scan`, `strategic-compact` |

## Available Agents

For complex multi-step work, SCC provides 25 specialized agents. Key agents (10 of 25) are listed below. These are invoked automatically when relevant, but you can also reference them directly:

| Agent | Specialty |
|-------|-----------|
| `sf-trigger-architect` | Trigger framework design (FFLIB, pragmatic handler) |
| `sf-code-reviewer` | Comprehensive cross-domain Salesforce code review |
| `sf-apex-reviewer` | Enterprise Apex code review |
| `sf-lwc-reviewer` | Lightning Web Component review |
| `sf-security-reviewer` | Security audit (CRUD/FLS, sharing, injection) |
| `sf-flow-reviewer` | Flow design and automation review |
| `sf-agentforce-builder` | Agentforce agent and action development |
| `sf-architect` | Solution architecture and data model design |
| `sf-integration-architect` | Integration pattern design |
| `sf-performance-optimizer` | Performance bottleneck analysis |

## Quick Start Recommendations

**New to a Salesforce project?** Start with:

1. `/sf-quickstart` — detect your project and configure SCC
2. Use `sf-tdd-workflow` skill — write tests first
3. Use `sf-apex-best-practices` skill — review before committing
4. Use `sf-security` skill — security check before deploying

**Fixing build errors?** Use `/sf-build-fix`

**Need documentation?** Use `/sf-docs-lookup <topic>`

**Want to improve test coverage?** Use `sf-apex-testing` skill then `sf-tdd-workflow` skill

**Debugging an issue?** Use `sf-debugging` skill

## Examples

```
sf-help
sf-help apex
sf-help What skill should I use to review my trigger code?
sf-help How do I check for governor limit violations?
```
