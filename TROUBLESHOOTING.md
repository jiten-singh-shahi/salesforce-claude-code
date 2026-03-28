# Troubleshooting Guide

Common issues and solutions for Salesforce Claude Code (SCC) plugin.

## Table of Contents

- [Salesforce CLI Issues](#salesforce-cli-issues)
- [Scratch Org Errors](#scratch-org-errors)
- [Deployment Failures](#deployment-failures)
- [Agent Harness Failures](#agent-harness-failures)
- [Hook Errors](#hook-errors)
- [Installation & Setup](#installation--setup)
- [Performance Issues](#performance-issues)
- [Common Error Messages](#common-error-messages)
- [Getting Help](#getting-help)

---

## Salesforce CLI Issues

### SF CLI Not Detected

**Symptom:** SCC hooks report "sf not found" or "sfdx not found"

**Causes:**

- Salesforce CLI not installed
- CLI not in PATH
- Wrong CLI version (v1 vs v2)

**Solutions:**

```bash
# Check CLI installation
sf --version
# or legacy
sfdx --version

# Install Salesforce CLI v2
npm install -g @salesforce/cli

# Verify installation
sf plugins --core

# If using nvm, ensure correct Node version
nvm use 20
```

### Authentication Failures

**Symptom:** "No default org set" or "INVALID_SESSION_ID" errors

**Solutions:**

```bash
# List authenticated orgs
sf org list

# Re-authenticate to DevHub
sf org login web --set-default-dev-hub

# Re-authenticate to target org
sf org login web --set-default --alias my-org

# Check org status
sf org display

# Refresh access token
sf org login jwt --client-id <id> --jwt-key-file <path> --username <user>
```

---

## Scratch Org Errors

### Scratch Org Creation Fails

**Symptom:** `sf org create scratch` fails with shape or limits errors

**Causes:**

- DevHub not set or expired
- Active scratch org limit reached
- Invalid scratch org definition

**Solutions:**

```bash
# Check DevHub authentication
sf org display --target-dev-hub

# List active scratch orgs (check limits)
sf org list --all

# Delete unused scratch orgs
sf org delete scratch --target-org <alias> --no-prompt

# Validate scratch org definition
cat config/project-scratch-def.json | python3 -m json.tool

# Create with verbose logging
sf org create scratch --definition-file config/project-scratch-def.json \
  --alias my-scratch --duration-days 7 --wait 15
```

### Source Push Failures

**Symptom:** `sf project deploy start` or `sf push` fails

**Solutions:**

```bash
# Check for conflicts
sf project deploy preview

# Force push (use with caution)
sf project deploy start --ignore-conflicts

# Deploy specific metadata
sf project deploy start --source-dir force-app/main/default/classes/MyClass.cls

# Check deployment status
sf project deploy report
```

---

## Deployment Failures

### Validation Errors

**Symptom:** Deployment fails with test or coverage errors

**Solutions:**

```bash
# Run validation-only deployment
sf project deploy validate --test-level RunLocalTests

# Check test results
sf apex run test --test-level RunLocalTests --result-format human

# Check code coverage
sf apex run test --code-coverage --result-format human

# Deploy with specific tests
sf project deploy start --test-level RunSpecifiedTests \
  --tests MyClassTest MyOtherClassTest
```

### Metadata Conflicts

**Symptom:** "Component already exists" or merge conflicts

**Solutions:**

```bash
# Retrieve current state from org
sf project retrieve start --target-org my-org

# Compare local vs org
sf project deploy preview

# Retrieve specific metadata
sf project retrieve start --metadata ApexClass:MyClass

# Reset source tracking
sf project reset tracking --target-org my-scratch
```

---

## Agent Harness Failures

### Agent Not Found

**Symptom:** "Agent not loaded" or "Unknown agent" errors

**Causes:**

- Plugin not installed correctly
- Agent path misconfiguration

**Solutions:**

```bash
# Check SCC installation status
npx scc doctor

# Verify agents are installed
ls .claude/agents/

# Check installed files
npx scc list-installed
```

### Agent Returns Incomplete Results

**Symptom:** Agent starts but gives partial or incorrect Salesforce advice

**Solutions:**

- Ensure the correct agent is being invoked (check description matching)
- Provide more context in your prompt (org type, API version, specific metadata)
- Check if the agent has the required tools (some need `Bash` for SF CLI commands)

---

## Hook Errors

### Hooks Not Firing

**Symptom:** Pre/post hooks don't execute

**Causes:**

- Hooks not registered in settings.json
- Hook profile too restrictive
- Hook script errors

**Solutions:**

```bash
# Check hook profile
echo $SCC_HOOK_PROFILE  # Should be minimal, standard, or strict

# Test hook manually
echo '{"tool":"Bash","tool_input":{"command":"sf org list"}}' | \
  node scripts/hooks/pre-tool-use.js

# Check for script errors
node -c scripts/hooks/session-start.js

# Verify hooks.json is valid
node scripts/ci/validate-hooks.js
```

### Session Start Hook Fails

**Symptom:** No Salesforce context displayed at session start

**Solutions:**

```bash
# Run session-start manually
node scripts/hooks/session-start.js

# Check if SF CLI is accessible from hook context
which sf

# Verify sfdx-project.json exists
cat sfdx-project.json
```

---

## Installation & Setup

### Plugin Not Loading

**Symptom:** SCC features unavailable after install

**Solutions:**

```bash
# NPM install
npm install -g scc-universal

# Verify installation
npx scc doctor

# Check for drifted files
npx scc status

# Repair installation
npx scc repair
```

### Package Manager Detection Fails

**Symptom:** Wrong package manager used

**Solutions:**

```bash
# Set preferred package manager
export CLAUDE_PACKAGE_MANAGER=npm

# Or set per-project
echo '{"packageManager": "npm"}' > .claude/package-manager.json
```

---

## Performance Issues

### Slow Agent Responses

**Symptom:** Agents take 30+ seconds for simple Salesforce tasks

**Causes:**

- Too many hooks enabled
- Large codebase without focused prompts
- Context window overloaded with MCP tools

**Solutions:**

- Use `SCC_HOOK_PROFILE=minimal` for faster responses
- Be specific in prompts: "Review MyTrigger.cls" instead of "Review all code"
- Disable unused MCP servers

### Governor Limit Warnings Overwhelming

**Symptom:** Too many false-positive governor limit warnings

**Solutions:**

```bash
# Disable specific hooks
export SCC_DISABLED_HOOKS=governor-check

# Or switch to minimal profile
export SCC_HOOK_PROFILE=minimal
```

---

## Common Error Messages

### "EACCES: permission denied"

```bash
# Fix hook permissions
find scripts/hooks -name "*.js" -exec chmod +x {} \;
```

### "MODULE_NOT_FOUND"

```bash
# Install dependencies
npm install

# Or reinstall
rm -rf node_modules && npm install
```

### "Cannot find sfdx-project.json"

```bash
# Initialize Salesforce project
sf project generate --name my-project

# Or verify you're in the right directory
ls sfdx-project.json
```

---

## Getting Help

If you're still experiencing issues:

1. **Run diagnostics:**

   ```bash
   npx scc doctor
   sf doctor
   ```

2. **Enable debug logging:**

   ```bash
   export CLAUDE_DEBUG=1
   export SF_LOG_LEVEL=debug
   ```

3. **Collect diagnostic info:**

   ```bash
   sf --version
   node --version
   npx scc status
   sf org list
   ```

4. **Check GitHub Issues** for known problems and solutions

---

## Related Documentation

- [README.md](./README.md) - Installation and features
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Development guidelines
- [Security Guide](./the-security-guide.md) - CRUD/FLS, injection prevention, encryption
