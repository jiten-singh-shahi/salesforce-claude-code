# SCC Claude Code Plugin

Salesforce Claude Code (SCC) — production-ready AI agent harness for Salesforce development.

## Installation

### From Marketplace

1. Open Claude Code
2. Go to Extensions/Plugins
3. Search for "Salesforce Claude Code"
4. Click Install

### Manual Installation

```bash
npm install -g scc-universal
npx scc install full
```

### From Source

```bash
git clone <repo-url> salesforce-claude-code
cd salesforce-claude-code
npm install
npx scc install full
```

## What's Included

- **27 agents** for Salesforce development (Apex, LWC, SOQL, Flows, Visualforce, Aura, DevOps, Security)
- **58 skills** for domain knowledge, workflows, and patterns (39 user-invocable via `/skill-name`, 19 auto-activating)
- **28 rules** for coding standards and best practices
- **28 hooks** for quality gates and automation
- **8 schemas** for configuration validation

## Configuration

Set hook profile: `SCC_HOOK_PROFILE=minimal|standard|strict`

Disable specific hooks: `SCC_DISABLED_HOOKS=governor-check,cost-tracker`
