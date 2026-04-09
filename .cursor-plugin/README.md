# SCC Cursor Plugin

Salesforce Claude Code (SCC) — production-ready AI agent harness for Salesforce development.

## Installation

### From Marketplace

1. Open Cursor
2. Go to Settings > Plugins
3. Search for "Salesforce Claude Code"
4. Click Install

### Manual Installation

```bash
npm install -g scc-universal
npx scc-universal install all --target cursor
```

### Local Development

```bash
ln -s /path/to/salesforce-claude-code ~/.cursor/plugins/local/salesforce-claude-code
```

## What's Included

- **17 agents** for Salesforce development (11 domain + 6 platform)
- **57 skills** for domain knowledge, workflows, and patterns (18 user-invocable via `/skill-name`, 39 auto-activating)
- **29 hooks** for quality gates and automation
- **MCP config** for Salesforce DX and SF CLI integration

## Configuration

Set hook profile: `SCC_HOOK_PROFILE=minimal|standard|strict`

Disable specific hooks: `SCC_DISABLED_HOOKS=governor-check,cost-tracker`
