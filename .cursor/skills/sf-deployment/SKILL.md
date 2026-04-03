---
name: sf-deployment
description: >-
  Use when deploying to a Salesforce org. SF CLI source deploy, metadata API, package deployment, validation-then-quick-deploy, rollback planning, and production deployment best practices.
disable-model-invocation: true
---

# Salesforce Deployment Strategies

Reference: @../_reference/DEPLOYMENT_CHECKLIST.md

## When to Use

- Deploying Apex, LWC, or metadata changes to a sandbox or production org
- Planning deployment order for metadata with dependencies
- Setting up validation-then-quick-deploy workflows for zero-downtime production releases
- Troubleshooting deployment errors, coverage failures, or metadata conflicts
- Choosing between Change Sets, SF CLI source deploy, or Unlocked Packages

---

## Deployment Method Comparison

| Method            | Speed  | Rollback | Best For                              | Tracking  |
|-------------------|--------|----------|---------------------------------------|-----------|
| Change Sets       | Slow   | Manual   | Admin-managed, simple orgs            | None      |
| SF CLI (Source)   | Fast   | Manual   | Developer workflow, CI/CD             | Git       |
| Metadata API      | Medium | Manual   | Automated scripts, complex manifests  | External  |
| Unlocked Package  | Fast   | Version  | Modular orgs, ISV, internal products  | Version   |
| Managed Package   | Slow   | Version  | AppExchange ISV, protected IP         | Version   |

---

## SF CLI Deploy Commands

### Basic Deployments

```bash
# Deploy entire source directory
sf project deploy start \
    --source-dir force-app \
    --target-org myOrg \
    --wait 30

# Deploy specific metadata types
sf project deploy start \
    --metadata ApexClass \
    --target-org myOrg

# Deploy specific components
sf project deploy start \
    --metadata "ApexClass:AccountService,ApexClass:AccountServiceTest" \
    --target-org myOrg

# Deploy using package.xml manifest
sf project deploy start \
    --manifest manifest/package.xml \
    --target-org myOrg \
    --wait 60

# Deploy with test execution
sf project deploy start \
    --source-dir force-app \
    --test-level RunLocalTests \
    --target-org myOrg \
    --wait 60

# Deploy specific tests
sf project deploy start \
    --source-dir force-app \
    --test-level RunSpecifiedTests \
    --tests AccountServiceTest,OpportunityServiceTest \
    --target-org myOrg
```

### Deploy Flags Reference

| Flag                   | Description                                           |
|------------------------|-------------------------------------------------------|
| `--source-dir`         | Local source directory to deploy                      |
| `--manifest`           | package.xml manifest file path                        |
| `--metadata`           | Specific metadata types or components                 |
| `--test-level`         | Test level: NoTestRun/RunSpecifiedTests/RunLocalTests/RunAllTestsInOrg |
| `--tests`              | Comma-separated test class names (with RunSpecifiedTests) |
| `--wait`               | Minutes to wait for async deploy (default: 33)        |
| `--ignore-errors`      | Ignore deploy errors (use with caution)               |
| `--ignore-conflicts`   | Ignore source tracking conflicts                      |
| `--async`              | Run deploy asynchronously, return job ID              |
| `--verbose`            | Show detailed output                                  |

> **Note:** There is no `--dry-run` on `deploy start`. Use `sf project deploy validate` instead.

---

## Test Level Guide

### NoTestRun

```bash
sf project deploy start --test-level NoTestRun --source-dir force-app --target-org sandbox
```

Use for sandbox deployments of non-Apex metadata. Allowed for production only when the deployment contains no Apex code.

### RunSpecifiedTests

```bash
sf project deploy start \
    --test-level RunSpecifiedTests \
    --tests AccountServiceTest,ContactTriggerTest \
    --source-dir force-app \
    --target-org myOrg
```

Runs only the named test classes. Sufficient for production if coverage >= 75% for deployed classes.

### RunLocalTests (Recommended for most deployments)

```bash
sf project deploy start \
    --test-level RunLocalTests \
    --source-dir force-app \
    --target-org myOrg
```

Runs all tests in the org except managed package tests. Required standard for production deployments.

### RunAllTestsInOrg

```bash
sf project deploy start \
    --test-level RunAllTestsInOrg \
    --source-dir force-app \
    --target-org myOrg
```

Runs every test including managed package tests. Use for major releases or full org validation.

---

## package.xml (Manifest) Format

### Targeted Component Deployment

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>AccountService</members>
        <members>AccountServiceTest</members>
        <name>ApexClass</name>
    </types>
    <types>
        <members>AccountTrigger</members>
        <name>ApexTrigger</name>
    </types>
    <types>
        <members>accountCard</members>
        <name>LightningComponentBundle</name>
    </types>
    <types>
        <members>Account.Status__c</members>
        <name>CustomField</name>
    </types>
    <version>66.0</version>
</Package>
```

> `<members>*</members>` deploys ALL components of that type, including test classes. For production, prefer listing specific members when you need to exclude certain components.

---

## Validation-Then-Quick-Deploy Workflow

Validation separates test execution from the actual deployment. Use this for production to minimise downtime.

### Step 1: Validate (runs tests, does not deploy)

```bash
sf project deploy validate \
    --source-dir force-app \
    --test-level RunLocalTests \
    --target-org prod \
    --wait 60

# Capture the Job ID from output
JOB_ID=0Af5e00000BnXXX
```

### Step 2: Wait for Tests to Pass

```bash
sf project deploy report --job-id $JOB_ID --target-org prod
sf project deploy resume --job-id $JOB_ID --target-org prod --wait 60
```

### Step 3: Quick Deploy (no tests re-run)

```bash
sf project deploy quick \
    --job-id $JOB_ID \
    --target-org prod \
    --wait 10
```

Quick deploy window: 10 days after successful validation, but only if no Apex code modifications have been made to the org since the validation.

---

## Destructive Changes (Removing Metadata)

Deploy a `destructiveChanges.xml` alongside an empty `package.xml`.

```xml
<!-- destructiveChanges.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>OldAccountService</members>
        <name>ApexClass</name>
    </types>
    <types>
        <members>Account.LegacyField__c</members>
        <name>CustomField</name>
    </types>
    <version>66.0</version>
</Package>
```

```bash
sf project deploy start \
    --manifest deploy-package/package.xml \
    --post-destructive-changes deploy-package/destructiveChanges.xml \
    --test-level RunLocalTests \
    --target-org myOrg
```

`--pre-destructive-changes` runs before deployment; `--post-destructive-changes` after. Use post for removing replaced components.

---

## Rollback Strategies

Salesforce does not have native one-click rollback. Plan ahead.

### Full Commit Revert (Preferred)

```bash
git revert HEAD
sf project deploy start --source-dir force-app --test-level RunLocalTests --target-org prod
```

> Single-file rollback is only safe for isolated, dependency-free components. For coupled changes, revert the full git commit and deploy the complete set of changed files.

### Pre-Deployment Snapshot

```bash
sf project retrieve start \
    --manifest manifest/package.xml \
    --target-org prod \
    --output-dir backup/pre-deploy-$(date +%Y%m%d)
```

### Package Version Rollback (Unlocked Packages)

```bash
sf package install \
    --package "04t5e000000XXXXX" \
    --target-org prod \
    --wait 30
```

---

## Common Deployment Errors and Fixes

| Error | Cause | Fix |
|---|---|---|
| "Test coverage of selected Apex Trigger is 0%" | Trigger has no test class | Write and include a test class |
| "Average test coverage below 75%" | Org-wide coverage insufficient | Add tests for uncovered classes |
| "Entity of type X not found" | Component missing in target org | Deploy dependency first or check name |
| "CANNOT_INSERT_UPDATE_ACTIVATE_ENTITY" | Trigger or validation rule blocking deploy | Check error details for the specific rule |
| "duplicate value found" | Unique field constraint violation | Check for existing records or duplicate picklist values |
| "Object X not available in this org" | Feature not enabled in target org | Enable the feature flag or include org setting |

---

## Related

- **Constraints**: `sf-deployment-constraints` -- deployment safety rules
- **Agent**: `sf-architect` -- interactive, in-depth guidance
