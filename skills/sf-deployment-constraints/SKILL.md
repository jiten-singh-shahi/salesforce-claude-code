---
name: sf-deployment-constraints
description: "Enforce deployment safety — validation-only first, test coverage gates, metadata ordering, rollback readiness. Use when deploying or packaging ANY Salesforce metadata. Do NOT use for local dev or scratch org pushes."
origin: SCC
user-invocable: false
allowed-tools: Read, Grep, Glob
---

# Salesforce Deployment Constraints

## When to Use

This skill auto-activates when deploying, promoting, or packaging Salesforce metadata. It enforces validation-only-first, test coverage gates, dependency ordering, and rollback readiness for all deployment artifacts.

Hard rules that MUST be followed when deploying, promoting, or packaging
Salesforce metadata to any sandbox or production org. Violations are blocking.

Reference: @../_reference/DEPLOYMENT_CHECKLIST.md
@../_reference/DEPRECATIONS.md

---

## Never

1. **Never deploy without validation-only first.**
   Run `sf project deploy validate` before every real deployment to production.
   Quick-deploy (`sf project deploy quick --job-id <ID>`) is only valid within
   10 days and only if no Apex has been deployed to the org since validation.

2. **Never skip the test level flag.**
   Every `sf project deploy start` to a shared org MUST include `--test-level`.
   Omitting it lets the platform pick a default that may be `NoTestRun`,
   which silently passes with zero coverage.

3. **Never deploy Profiles alongside other metadata.**
   Profiles depend on every other metadata type (objects, fields, record types,
   Apex, permission sets). Deploy Profiles in a separate, final deployment step
   after all dependencies are confirmed in the target org.

4. **Never force-push to production.**
   Do not use `--ignore-errors` or `--ignore-conflicts` against a production
   org. If the deployment fails, fix the root cause rather than suppressing
   errors. Force flags are acceptable only in developer sandboxes during
   active prototyping.

5. **Never deploy destructive changes without a pre-deploy snapshot.**
   Before any `--post-destructive-changes` or `--pre-destructive-changes`
   deployment, retrieve the current state of affected components:
   ```bash
   sf project retrieve start \
       --manifest manifest/package.xml \
       --target-org prod \
       --output-dir backup/pre-deploy-$(date +%Y%m%d)
   ```

6. **Never use `--use-most-recent` for quick deploy in multi-team orgs.**
   Another team's deployment between your validate and quick-deploy
   invalidates the job. Always pass `--job-id` explicitly.

---

## Always

1. **Always validate before deploy.**
   ```bash
   sf project deploy validate \
       --source-dir force-app \
       --test-level RunLocalTests \
       --target-org <org> \
       --wait 60
   ```
   Then quick-deploy using the returned job ID.

2. **Always specify an appropriate test level.**
   | Target Environment | Required Test Level |
   |---|---|
   | Developer sandbox (no Apex) | `NoTestRun` acceptable |
   | Developer sandbox (with Apex) | `RunLocalTests` |
   | Staging / UAT sandbox | `RunLocalTests` |
   | Production | `RunLocalTests` (minimum) |
   | Major release / full regression | `RunAllTestsInOrg` |
   | CI/CD PR validation (v66.0+) | `RunRelevantTests` with `@testFor` |

3. **Always check metadata dependency order.**
   Deploy in this sequence; never deploy a later type before its dependency:
   1. CustomObject
   2. CustomField
   3. RecordType
   4. ValidationRule
   5. Layout
   6. ApexClass
   7. ApexTrigger
   8. LightningComponentBundle
   9. FlexiPage / App Page
   10. PermissionSet
   11. Profile (always last)

4. **Always have a rollback plan before production deploy.**
   | Strategy | When |
   |---|---|
   | `git revert` + full redeploy | Coupled multi-file changes |
   | Single-file restore from git | Isolated, dependency-free component |
   | Pre-deploy snapshot retrieve | Any production deployment |
   | Package version rollback | Unlocked/managed package orgs |

5. **Always confirm 75%+ org-wide code coverage before production.**
   Run `sf apex run test --test-level RunLocalTests --code-coverage` locally
   and verify aggregate coverage meets the threshold. Individual deployed
   triggers must have > 0% coverage.

6. **Always include test classes in the deployment package.**
   If deploying Apex classes or triggers, include their corresponding test
   classes in the same `package.xml` or `--source-dir`. Deploying production
   code without its tests causes coverage drift.

---

## Anti-Pattern Table

| Anti-Pattern | Why It Fails | Correct Approach |
|---|---|---|
| Deploy directly to production without validation | Test failures discovered mid-deploy; partial state | Validate first, then quick-deploy |
| Use `NoTestRun` for production Apex deployments | Salesforce rejects or silently drops coverage | Use `RunLocalTests` or `RunRelevantTests` |
| Deploy Profiles in the same package as objects/fields | Profile references fail if dependencies missing | Deploy Profiles separately after all dependencies |
| Use `--ignore-errors` on production | Partial metadata deployed; org left in broken state | Fix errors, re-validate, re-deploy |
| Skip pre-deploy snapshot for destructive changes | No way to restore deleted metadata | Always `sf project retrieve start` first |
| Rely on `--use-most-recent` for quick deploy | Another team's deploy invalidates your validation | Use explicit `--job-id` |
| Deploy test classes separately from production code | Coverage numbers drift; tests may reference stale code | Co-deploy test and production classes together |
| Omit `--test-level` flag entirely | Platform default may be `NoTestRun` | Always specify `--test-level` explicitly |
| Deploy dependent metadata out of order | "Entity not found" errors | Follow the 11-step dependency order above |
| Single-file rollback for coupled changes | Breaks dependencies between related classes | `git revert` the full commit and redeploy all affected files |
| Deploy Custom Labels after referencing Apex/LWC | Components fail to compile if label not yet in target org | Include Custom Labels in same package or deploy them first |
| Deploy Report Types without underlying objects | Report Type references fail on missing custom objects/fields | Deploy objects and fields before Report Types |
| Deploy Connected App with hardcoded consumer secret | Secrets exposed in source control; revoked secrets break auth | Use Named Credentials or environment-specific Connected App config |
| Deploy Flow without testing in sandbox first | Flows fire on existing data immediately; no rollback for record changes | Always test Record-Triggered Flows in sandbox with representative data |
| Use `sf project deploy start` without `--wait` | Detached deploy with no feedback; failures discovered late | Always use `--wait` to monitor deployment progress inline |

---

## Quick Reference: Production Deploy Sequence

```
1. Pre-deploy snapshot   sf project retrieve start --manifest ... --output-dir backup/
2. Validate              sf project deploy validate --test-level RunLocalTests --wait 60
3. Confirm tests pass    sf project deploy report --job-id <ID>
4. Quick deploy          sf project deploy quick --job-id <ID> --wait 10
5. Smoke test            Execute post-deploy verification plan
6. Confirm or rollback   If issues found: git revert + redeploy from backup
```
