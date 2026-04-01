---
name: update-docs
description: >-
  Use when syncing documentation after Salesforce Apex code changes. Update README, API docs, and deploy metadata references to match the current org codebase.
disable-model-invocation: true
---

# Update Docs — Synchronize Documentation with Codebase

Synchronize documentation with the current state of the Salesforce codebase. Scans metadata, extracts project structure, and updates documentation files.

## When to Use

- After making code changes that affect the project structure or API surface
- When new Apex classes, triggers, LWC components, or flows have been added or removed
- When deployment steps or prerequisites have changed
- To check for stale documentation that hasn't been updated in 90+ days
- When regenerating API documentation for `@RestResource`, `@AuraEnabled`, or `@InvocableMethod` classes

## Workflow

### Step 1 — Scan Project Metadata

Read project configuration to understand the tech stack:

```bash
# Core project config
cat sfdx-project.json

# Package dependencies
cat sfdx-project.json | grep -A5 "packageDirectories"

# Node.js tooling
cat package.json 2>/dev/null | grep -A10 '"scripts"'
```

### Step 2 — Inventory Source Components

Count and categorize all Salesforce metadata:

```bash
# Apex classes
find force-app -name "*.cls" -not -name "*Test.cls" | wc -l

# Apex test classes
find force-app -name "*Test.cls" | wc -l

# Apex triggers
find force-app -name "*.trigger" | wc -l

# LWC components
find force-app -path "*/lwc/*/*.js" | wc -l

# Custom objects
find force-app -name "*.object-meta.xml" | wc -l

# Flows
find force-app -name "*.flow-meta.xml" | wc -l

# Permission sets
find force-app -name "*.permissionset-meta.xml" | wc -l
```

### Step 3 — Update README Sections

Update these sections with `<!-- AUTO-GENERATED-START -->` / `<!-- AUTO-GENERATED-END -->` markers:

**Project Structure:**

```markdown
## Project Structure

| Component | Count | Location |
|-----------|-------|----------|
| Apex Classes | 45 | `force-app/main/default/classes/` |
| Apex Triggers | 8 | `force-app/main/default/triggers/` |
| Test Classes | 32 | `force-app/main/default/classes/*Test.cls` |
| LWC Components | 12 | `force-app/main/default/lwc/` |
| Custom Objects | 15 | `force-app/main/default/objects/` |
| Flows | 6 | `force-app/main/default/flows/` |
```

**Setup Instructions:**

- Scratch org creation command from `config/project-scratch-def.json`
- Data seeding scripts if present
- Permission set assignments

**Available Commands:**

- List custom SF CLI commands from `package.json` scripts
- Document any custom sfdx plugins

### Step 4 — Generate API Documentation

For classes with `@RestResource`, `@AuraEnabled`, or `@InvocableMethod`:

```markdown
## API Endpoints

### AccountController (@RestResource)
- `GET /services/apexrest/accounts` — List accounts
- `POST /services/apexrest/accounts` — Create account

### AccountService (@AuraEnabled methods)
- `getAccountDetails(Id accountId)` — Returns account with contacts
- `updateAccountStatus(Id accountId, String status)` — Updates status
```

### Step 5 — Generate Deployment Guide

Create or update deployment documentation:

```markdown
## Deployment Guide

### Prerequisites
- SF CLI v2.x installed
- Target org authenticated: `sf org login web --alias <alias>`

### Deploy Steps
1. Validate: `sf project deploy validate --target-org <alias> --test-level RunLocalTests`
2. Deploy: `sf project deploy start --target-org <alias> --test-level RunLocalTests`

### Metadata Dependencies
`sf project deploy start` handles dependency resolution automatically — no manual ordering is needed. If a deployment fails due to a missing dependency, verify that all referenced metadata is included in the source being deployed.
```

### Step 6 — Check Staleness

Flag documentation files not updated in 90+ days:

```bash
find . -name "README.md" -o -name "CONTRIBUTING.md" -o -name "*.md" -path "*/docs/*" | while read f; do
  last_modified=$(git log -1 --format=%ai -- "$f" 2>/dev/null)
  if [ -n "$last_modified" ]; then
    last_epoch=$(date -d "$last_modified" +%s 2>/dev/null || date -j -f "%Y-%m-%d %H:%M:%S %z" "$last_modified" +%s 2>/dev/null)
    days=$(( ($(date +%s) - $last_epoch) / 86400 ))
    if [ "$days" -gt 90 ]; then echo "STALE ($days days): $f"; fi
  fi
done
```

### Step 7 — Verify Auto-Generated Markers

Ensure all auto-generated sections have proper markers so future updates don't clobber manual content. Only modify content between `<!-- AUTO-GENERATED-START -->` and `<!-- AUTO-GENERATED-END -->` markers.

## Rules

- Only update sections between auto-generated markers
- Never overwrite manually-written content
- Always show a diff before writing changes
- Preserve existing formatting and style of the document

## Examples

```
/update-docs
/update-docs Sync the README with the new Agentforce integration feature
/update-docs Regenerate API documentation for all @RestResource classes
/update-docs Check for stale documentation and suggest updates
```
