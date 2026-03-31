<!-- Source: https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_scratch_orgs.htm -->
<!-- Last verified: API v66.0 — 2026-03-29 -->
<!-- ⚠️ UNVERIFIED — Salesforce docs site returned JS-only content; facts sourced from Trailhead + skill knowledge -->

# Scratch Org Patterns — Salesforce Reference

## project-scratch-def.json Top-Level Fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `orgName` | string | No | Display name |
| `edition` | string | Yes | See editions table below |
| `hasSampleData` | boolean | No | Default `false` |
| `language` | string | No | e.g. `en_US` |
| `country` | string | No | e.g. `US` |
| `adminEmail` | string | No | Admin user email |
| `description` | string | No | Free-text |
| `duration` | integer | No | 1–30 days; default 7 |
| `features` | string[] | No | See features table |
| `settings` | object | No | Nested settings objects |
| `sourceOrg` | string | No | Org ID for org shape |
| `snapshot` | string | No | Snapshot name (pilot) |

## Supported Editions

| Edition | Use Case |
|---|---|
| `Developer` | Standard development; most features available |
| `Enterprise` | Testing enterprise-specific features |
| `Partner Developer` | ISV / partner development |
| `Group` | Testing simplified CRM features |

## Common Features

| Feature | Purpose |
|---|---|
| `API` | API access (always include) |
| `AuthorApex` | Apex development |
| `Communities` | Experience Cloud |
| `ContactsToMultipleAccounts` | Multi-account contacts |
| `CustomProfiles` | Custom user profiles |
| `DebugApex` | Apex debugger |
| `EnableSetPasswordInApi` | Set passwords via API |
| `FieldService` | Field Service Lightning |
| `LightningExperienceEnabled` | Lightning UI (always include) |
| `LiveAgentEnabled` | Live Agent chat |
| `MultiCurrency` | Multi-currency support |
| `Omnichannel` | Omni-Channel routing |
| `PersonAccounts` | Person Account record type |
| `SalesUser` | Sales Cloud user features |
| `ServiceUser` | Service Cloud user features |
| `Sites` | Salesforce Sites |
| `Territory2` | Territory Management 2.0 |
| `Translation` | Translation Workbench |

## Dev Hub Scratch Org Limits

| Dev Hub Edition | Active Orgs | Daily Creates |
|---|---|---|
| Developer Edition | 6 | 3 |
| Enterprise (paid) | 40 | 20 |
| Unlimited (paid) | 100 | 40 |

## Duration Strategy

| Scenario | Duration | Definition File |
|---|---|---|
| CI pipeline | 1–3 days | Minimal (3 features: API, AuthorApex, DebugApex) |
| Feature development | 7 days (default) | Full project scratch def |
| Complex feature | Up to 30 days (max) | Full project scratch def |

Minimal CI orgs spin up in ~2–3 min vs 5+ min for feature-rich orgs.

## Core CLI Commands

| Command | Purpose |
|---|---|
| `sf org create scratch --definition-file <path> --alias <name> --set-default --duration-days <n>` | Create scratch org |
| `sf project deploy start --source-dir force-app --target-org <alias>` | Push source to org |
| `sf project retrieve start --source-dir force-app --target-org <alias>` | Pull changes from org |
| `sf project deploy preview --source-dir force-app --target-org <alias>` | Preview local changes not yet pushed |
| `sf project retrieve preview --source-dir force-app --target-org <alias>` | Preview org changes not yet pulled |
| `sf project deploy start --ignore-conflicts --target-org <alias>` | Force push (resolve conflict: local wins) |
| `sf project retrieve start --ignore-conflicts --target-org <alias>` | Force pull (resolve conflict: org wins) |
| `sf project reset tracking --target-org <alias>` | Reset corrupted source tracking |
| `sf org list --verbose` | List all scratch orgs |
| `sf org display --target-org <alias>` | Show org details and expiry |
| `sf org delete scratch --target-org <alias> --no-prompt` | Delete and free allocation |
| `sf org open --target-org <alias>` | Open org in browser |
| `sf config set target-org <alias>` | Set default target org |

## Org Shape & Snapshots

| Feature | Status | Prerequisites |
|---|---|---|
| Org Shape | GA | "Org Shape" enabled in Dev Hub; source org = production or Developer Edition; user needs "Manage Org Shapes" permission |
| Scratch Org Snapshots | Pilot/Beta | Requires Salesforce enablement; contact account team |

## sfdx-project.json Key Fields

| Field | Purpose |
|---|---|
| `packageDirectories[].path` | Source directory (e.g. `force-app`) |
| `packageDirectories[].default` | Primary package directory |
| `packageDirectories[].package` | Package name (for packaging) |
| `packageDirectories[].versionNumber` | e.g. `1.0.0.NEXT` |
| `packageDirectories[].dependencies` | Array of `{ package, versionNumber }` |
| `namespace` | Package namespace (empty string = no namespace) |
| `sourceApiVersion` | e.g. `66.0` |
| `packageAliases` | Map of alias to Salesforce ID |

> **Note:** `sfdcLoginUrl` is deprecated. Use `sf org login web --instance-url` instead.

## Daily Dev Workflow Summary

| Step | Command |
|---|---|
| 1. Auth Dev Hub (one-time) | `sf org login web --set-default-dev-hub --alias devhub` |
| 2. Create scratch org | `sf org create scratch --definition-file config/project-scratch-def.json --alias feature-123 --set-default --duration-days 7` |
| 3. Install dependencies | `sf package install --package 04t... --target-org feature-123 --wait 10` |
| 4. Push source | `sf project deploy start --source-dir force-app --target-org feature-123` |
| 5. Load test data | `sf apex run --file scripts/apex/create-test-data.apex --target-org feature-123` |
| 6. Open org | `sf org open --target-org feature-123` |
| 7. Pull declarative changes | `sf project retrieve start --source-dir force-app --target-org feature-123` |
| 8. Deploy with tests | `sf project deploy start --source-dir force-app --test-level RunLocalTests --target-org feature-123` |
| 9. Delete when done | `sf org delete scratch --target-org feature-123 --no-prompt` |
