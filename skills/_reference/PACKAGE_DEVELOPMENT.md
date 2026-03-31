<!-- Source: https://developer.salesforce.com/docs/atlas.en-us.pkg2_dev.meta/pkg2_dev/sfdx_dev2gp.htm -->
<!-- Last verified: API v66.0 — 2026-03-29 -->
<!-- ⚠️ UNVERIFIED — Salesforce docs site returned JS-only content; facts sourced from Trailhead + skill knowledge -->

# Package Development — Salesforce Reference

## Package Types

| Type | Installable | Upgradeable | Namespace Required | IP Protected | Best For |
|---|---|---|---|---|---|
| Unmanaged | Yes | No | No | No | One-off sharing, templates, samples |
| Unlocked (2GP) | Yes | Yes | Optional | No | Internal modular orgs, team packages |
| Managed (2GP) | Yes | Yes | Yes | Yes | AppExchange ISV, commercial products |
| Managed (1GP) | Yes | Yes | Yes | Yes | Legacy AppExchange packages |
| Source (no package) | N/A | N/A | No | No | Direct org-to-org development |

## 1GP vs 2GP

| Aspect | 1GP (First-Generation) | 2GP (Second-Generation) |
|---|---|---|
| Version creation | Upload in packaging org UI | CLI: `sf package version create` |
| Dev Hub required | No | Yes |
| Scratch org development | Not natively supported | Full support |
| Source-driven | No | Yes |
| Dependency management | Manual | Declarative in `sfdx-project.json` |
| CI/CD automation | Limited | Full CLI automation |

## Salesforce ID Prefixes

| Object | Prefix | Example |
|---|---|---|
| Package (container) | `0Ho` | `0Ho5e000000XXXXX` |
| Package Version (installable) | `04t` | `04t5e000000XXXXX` |
| Subscriber Package | `033` | `0335e000000XXXXX` |

## Version Number Format

Format: `Major.Minor.Patch.Build`

| Component | Meaning | Example |
|---|---|---|
| Major | Breaking changes | `2.0.0.NEXT` |
| Minor | New features, backward-compatible | `1.3.0.NEXT` |
| Patch | Bug fixes | `1.3.1.NEXT` |
| Build | Auto-increment with `NEXT` or explicit integer | `1.0.0.NEXT` / `1.0.0.5` |

## Version Promotion States

| State | Install Targets | Transition |
|---|---|---|
| Beta (created, not promoted) | Scratch orgs, sandboxes, Developer Edition orgs | `sf package version create` |
| Released (promoted) | Production, sandboxes, any org | `sf package version promote` |
| Deprecated | Cannot be newly installed; remains in existing orgs | `sf package version update --deprecated` |

## Code Coverage Requirement

| Context | Minimum Coverage |
|---|---|
| Create version with `--code-coverage` | 75% Apex code coverage |
| Promote to released | Must have been created with `--code-coverage` passing |
| Install in production | Released version required (which requires 75% coverage) |
| Beta install (scratch/sandbox) | No coverage requirement |

## Namespace Rules

| Decision | Namespace? | When |
|---|---|---|
| AppExchange / commercial distribution | Yes (required) | Managed packages for external customers |
| IP protection needed | Yes | Obfuscated Apex in managed packages |
| Internal org modularity | No | Unlocked packages, simpler API names |
| No AppExchange plans | No | Avoids naming complexity |

### Namespace Impact on API Names

| Component Type | Without Namespace | With Namespace (`myns`) |
|---|---|---|
| Apex class | `AccountService` | `myns.AccountService` |
| Custom field | `Status__c` | `myns__Status__c` |
| Custom object | `Project__c` | `myns__Project__c` |

> **Irreversible:** Once a namespace is assigned to a managed package and a released version is created, the namespace is permanent.

## Managed Package Upgrade Constraints

| Action | Allowed After Release? |
|---|---|
| Add new fields (optional) | Yes |
| Add new Apex methods | Yes |
| Add new objects | Yes |
| Add new metadata | Yes |
| Delete fields or objects | **No** |
| Change field types | **No** |
| Remove `global` Apex methods | **No** |
| Change namespace | **No** |
| Add required fields | **Risky** — breaks subscribers creating records |

## Apex Visibility in Managed Packages

| Keyword | Subscriber Access |
|---|---|
| `global` | Fully accessible from subscriber Apex and Flows |
| `@namespaceAccessible` + `public` | Accessible from subscriber Apex only |
| `public` (no annotation) | Hidden from subscribers |
| `private` | Hidden; IP protected |

## Package CLI Commands

| Command | Purpose |
|---|---|
| `sf package create --name <n> --type Unlocked --path <dir> --no-namespace --target-dev-hub devhub` | Create package (one-time) |
| `sf package version create --package <n> --installation-key "$KEY" --code-coverage --wait 20 --target-dev-hub devhub` | Create beta version |
| `sf package version promote --package "<n>@1.0.0-1" --target-dev-hub devhub` | Promote to released |
| `sf package install --package "<n>@1.0.0-1" --installation-key "$KEY" --target-org <org> --wait 10` | Install in target org |
| `sf package version list --packages <n> --verbose --target-dev-hub devhub` | List all versions |
| `sf package installed list --target-org <org>` | List installed packages |
| `sf package install --security-type AdminsOnly` | Restrict to admin profiles |
| `sf package install --security-type AllUsers` | Grant to all profiles |

## sfdx-project.json Dependency Declaration

| Field | Purpose |
|---|---|
| `packageDirectories[].dependencies[]` | Array of `{ package, versionNumber }` |
| `packageAliases` | Map: alias name to `0Ho` (package) or `04t` (version) ID |
| `versionNumber` in dependency | Use `X.Y.Z.LATEST` to pick latest build of that version |

Dependencies must be installed in dependency order (base packages first). No `--all` flag exists.

## Package Architecture Best Practice

| Pattern | Components | Layer |
|---|---|---|
| Shared Utilities | ~30 | Base (no dependencies) |
| Sales Core | ~80 | Depends on Shared Utilities |
| Service Core | ~60 | Depends on Shared Utilities |
| Integrations | ~40 | Depends on Sales Core + Service Core |

Smaller packages = faster version creation, independent deployment, clear ownership.

## Subscriber Testing Workflow

| Step | Command / Action |
|---|---|
| 1. Install beta in scratch org | `sf package install --package "04t..." --target-org myScratch --wait 20` |
| 2. Run all tests | `sf apex run test --test-level RunAllTestsInOrg --code-coverage --target-org myScratch` |
| 3. Verify >= 75% coverage | Check test results |
| 4. Promote | `sf package version promote --package "<name>@X.Y.Z-N" --target-dev-hub devhub` |
| 5. Install in subscriber sandbox | `sf package install --package "<name>@X.Y.Z-N" --target-org subscriber-sandbox --wait 30` |
| 6. Run subscriber tests | `sf apex run test --test-level RunLocalTests --target-org subscriber-sandbox` |
| 7. Install in production | `sf package install --package "<name>@X.Y.Z-N" --target-org production --wait 30` |
