# Deployment Checklist — Salesforce Reference

> Last verified: API v66.0 (Spring '26)
> Source: https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_deploy.htm

## Test Levels

| Test Level | What Runs | When to Use |
|---|---|---|
| `NoTestRun` | Nothing | Sandbox only; production only if no Apex code in deployment |
| `RunSpecifiedTests` | Named test classes only | Small Apex deployments; coverage >= 75% for deployed classes |
| `RunLocalTests` | All local tests (excludes managed package tests) | Recommended default for production deployments |
| `RunAllTestsInOrg` | All tests including managed packages | Major releases or full org validation |
| `RunRelevantTests` (v66.0+) | Tests linked to changed classes via `@testFor` | CI/CD PR validation for faster feedback |

## Validation-Then-Quick-Deploy Workflow

| Step | Command | Notes |
|---|---|---|
| 1. Validate | `sf project deploy validate` | Runs tests, does NOT deploy |
| 2. Wait | `sf project deploy report --job-id <ID>` | Check async status |
| 3. Quick deploy | `sf project deploy quick --job-id <ID>` | No re-run of tests, deploys in seconds |

Quick deploy window: **10 days** after successful validation, invalidated if any Apex is deployed to the org in the interim.

## Deployment Order for Dependent Metadata

| Order | Metadata Type | Depends On |
|---|---|---|
| 1 | CustomObject | — |
| 2 | CustomField | CustomObject |
| 3 | RecordType | CustomObject |
| 4 | ValidationRule | CustomField |
| 5 | Layout | CustomField, RecordType |
| 6 | ApexClass | CustomObject, CustomField |
| 7 | ApexTrigger | ApexClass (handlers) |
| 8 | LightningComponentBundle | ApexClass (controllers) |
| 9 | FlexiPage / App Page | LWC |
| 10 | PermissionSet | Objects, Fields, Apex |
| 11 | Profile | All of the above — deploy last |

## Destructive Changes

To delete metadata, deploy `destructiveChanges.xml` alongside an empty `package.xml`. Use `--post-destructive-changes` (runs after deploy) for removing replaced components. Use `--pre-destructive-changes` (runs before deploy) for removing blockers.

## Rollback Strategies

| Strategy | When to Use |
|---|---|
| `git revert` + full redeploy | Coupled changes across multiple files |
| Single-file rollback | Isolated, dependency-free component only |
| Pre-deploy snapshot (`sf project retrieve start`) | Before any production deploy |
| Package version rollback (`sf package install`) | Unlocked/managed package orgs |

## Production Deployment Checklist

- [ ] All local tests pass with 75%+ org-wide code coverage
- [ ] Validation against production succeeded
- [ ] Change management ticket approved
- [ ] Deployment order documented for dependent components
- [ ] Rollback plan prepared
- [ ] Data backup confirmed for schema changes
- [ ] Stakeholders notified
- [ ] Post-deploy smoke test plan ready

## Common Deployment Errors

| Error | Cause | Fix |
|---|---|---|
| "Test coverage is 0% for trigger X" | Trigger has no test class | Write and include a test class |
| "Average coverage below 75%" | Org-wide coverage insufficient | Add tests for uncovered classes |
| "Entity of type X not found" | Component missing in target org | Deploy dependency first |
| "CANNOT_INSERT_UPDATE_ACTIVATE_ENTITY" | Trigger/validation blocking deploy | Check error details |
| "duplicate value found" | Unique constraint violation | Check for existing records |

## SF CLI Deploy Flags

| Flag | Purpose |
|---|---|
| `--source-dir` | Local source directory to deploy |
| `--manifest` | package.xml file path |
| `--metadata` | Specific types or components |
| `--test-level` | Test execution level |
| `--tests` | Comma-separated test class names (with RunSpecifiedTests) |
| `--wait` | Minutes to wait for async deploy |
| `--async` | Return job ID immediately |
| `--verbose` | Detailed output |
