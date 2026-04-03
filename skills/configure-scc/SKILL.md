---
name: configure-scc
description: >-
  Use when setting up SCC for Salesforce Apex and LWC development. Interactive wizard to install
  profiles, modules, and customize the harness for your org.
origin: SCC
user-invocable: true
---

# Configure SCC

Interactive guide for installing and configuring Salesforce Claude Code.

## When to Use

- When installing SCC for the first time on a Salesforce project
- When adding new modules or profiles to an existing SCC installation
- When customizing hook behavior or profiles for your team's workflow
- When troubleshooting SCC configuration or missing components
- When setting up SCC for different team members or CI/CD environments

## Installation

### Quick Install

```bash
# Install globally
npm install -g scc-universal

# Install with a profile
npx scc-universal install all      # Everything (all agents, skills, rules)
npx scc-universal install apex     # Apex-focused development
npx scc-universal install lwc      # LWC-focused development
```

### Profile Details

| Profile | Includes |
|---------|----------|
| `apex` | Common rules + Apex rules, agents, skills |
| `lwc` | Common rules + LWC rules, agents, skills |
| `full` | All agents, skills, rules |

### Diagnostics

```bash
npx scc-universal doctor    # Check for missing/drifted files
npx scc-universal status    # View installed components
npx scc-universal repair    # Restore drifted files
npx scc-universal uninstall # Remove SCC-managed files
```

## Hook Configuration

### Profiles

```bash
# Set hook profile (controls which hooks run)
export SCC_HOOK_PROFILE=minimal    # Session start + stop only
export SCC_HOOK_PROFILE=standard   # Default — includes quality checks
export SCC_HOOK_PROFILE=strict     # All hooks including auto-format
```

### Disable Specific Hooks

```bash
export SCC_DISABLED_HOOKS=governor-check,cost-tracker
```

## Package Manager

SCC auto-detects your package manager. Override with:

```bash
export CLAUDE_PACKAGE_MANAGER=npm  # or pnpm, yarn, bun
```

## Environment-Specific Configuration

### Sandbox / Scratch Org Development

```bash
# Set default target org for SF CLI commands
sf config set target-org=my-scratch-org

# Scratch org duration is set via --duration-days flag or scratch org definition file
# sf org create scratch -f config/project-scratch-def.json --duration-days 7
```

### CI/CD Environments

```bash
# Minimal hooks for CI (fast, no interactive prompts)
export SCC_HOOK_PROFILE=minimal

# Disable all cost/session tracking in CI
export SCC_DISABLED_HOOKS=cost-tracker,session-start,session-end,evaluate-session
```

### Team Setup

Share SCC configuration across your team by adding to your project's `.env.example`:

```bash
# .env.example — copy to .env and customize
SCC_HOOK_PROFILE=standard
CLAUDE_PACKAGE_MANAGER=npm
```

## Troubleshooting

### Common Issues

| Problem | Cause | Fix |
|---------|-------|-----|
| `npx scc-universal install` fails | Node.js < 20 | Upgrade: `nvm install 20` |
| Hooks not firing | SCC not installed in project | Run `npx scc-universal doctor` to check |
| `Permission denied` on hooks | Script not executable | Run `npx scc-universal repair` |
| Skills not loading | Wrong install profile | Run `npx scc-universal install all` |
| `sf` command not found | SF CLI not installed | Install: `npm install -g @salesforce/cli` |
| `sf` commands fail with errors | SF CLI version too old | Upgrade: `npm update -g @salesforce/cli` (SCC requires SF CLI v2.x / `sf` not `sfdx`) |
| Hooks slow down session | Too many hooks enabled | Switch to `SCC_HOOK_PROFILE=minimal` |

### Diagnostic Commands

```bash
# Full diagnostic report
npx scc-universal doctor

# See exactly what's installed
npx scc-universal list-installed

# Preview what WOULD be installed (dry run)
npx scc-universal plan apex

# Check state store
npx scc-universal status

# Reset everything and reinstall
npx scc-universal uninstall && npx scc-universal install all
```

### Upgrading SCC

```bash
# Update to latest version
npm install -g scc-universal@latest

# Repair any drifted files after upgrade
npx scc-universal repair

# Verify upgrade
npx scc-universal doctor
```

## Verification

```bash
npm test              # Run all validators
npx scc-universal doctor        # Check installation health
sf --version          # Verify SF CLI is installed
npx scc-universal status        # Confirm installed components
```
