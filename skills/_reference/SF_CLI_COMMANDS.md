<!-- Source: https://github.com/salesforcecli/cli -->
<!-- Last verified: SF CLI v2.132.0 — 2026-04-09 -->

# SF CLI Commands — Reference

## Command Index

| Topic | Command | Description |
|---|---|---|
| org | `sf org login web` | Browser-based OAuth login |
| org | `sf org login jwt` | JWT-based non-interactive login |
| org | `sf org login sfdx-url` | Auth via SFDX auth URL file |
| org | `sf org logout` | Log out of an org |
| org | `sf org list` | List all authenticated orgs |
| org | `sf org open` | Open org in browser |
| org | `sf org display` | Display org info (access token, instance URL) |
| org | `sf org create scratch` | Create a scratch org |
| org | `sf org delete scratch` | Delete a scratch org |
| org | `sf org create sandbox` | Create a sandbox |
| org | `sf org delete sandbox` | Delete a sandbox |
| org | `sf org resume sandbox` | Resume sandbox creation |
| org | `sf org create user` | Create a user in an org |
| org | `sf org display user` | Display user info |
| org | `sf org list users` | List users in an org |
| org | `sf org assign permset` | Assign permission set to user |
| org | `sf org assign permsetlicense` | Assign permission set license |
| project | `sf project deploy start` | Deploy source to an org |
| project | `sf project deploy validate` | Validate deploy without committing |
| project | `sf project deploy quick` | Quick deploy a validated deployment |
| project | `sf project deploy report` | Check deploy status |
| project | `sf project deploy resume` | Resume a failed/cancelled deploy |
| project | `sf project deploy cancel` | Cancel an in-progress deploy |
| project | `sf project retrieve start` | Retrieve source from an org |
| project | `sf project retrieve preview` | Preview what will be retrieved |
| project | `sf project generate` | Generate a new SFDX project |
| project | `sf project generate manifest` | Generate package.xml manifest |
| project | `sf project convert source` | Convert source to metadata format |
| project | `sf project convert mdapi` | Convert metadata to source format |
| project | `sf project list ignored` | List files ignored by .forceignore |
| apex | `sf apex run` | Execute anonymous Apex |
| apex | `sf apex run test` | Run Apex tests |
| apex | `sf apex tail log` | Stream debug logs in real time |
| apex | `sf apex get log` | Retrieve a specific debug log |
| apex | `sf apex list log` | List recent debug logs |
| apex | `sf apex generate class` | Generate Apex class from template |
| apex | `sf apex generate trigger` | Generate Apex trigger from template |
| data | `sf data query` | Run a SOQL query |
| data | `sf data query resume` | Resume a bulk query |
| data | `sf data search` | Run a SOSL search |
| data | `sf data create record` | Create a single record |
| data | `sf data update record` | Update a single record |
| data | `sf data delete record` | Delete a single record |
| data | `sf data upsert bulk` | Bulk upsert records from CSV |
| data | `sf data delete bulk` | Bulk delete records from CSV |
| data | `sf data export tree` | Export data as SObject tree |
| data | `sf data import tree` | Import SObject tree data |
| data | `sf data resume` | Resume a bulk data operation |
| package | `sf package create` | Create a package |
| package | `sf package update` | Update package properties |
| package | `sf package list` | List packages in Dev Hub |
| package | `sf package delete` | Delete a package |
| package | `sf package version create` | Create a package version |
| package | `sf package version list` | List package versions |
| package | `sf package version promote` | Promote a version to released |
| package | `sf package version update` | Update version properties |
| package | `sf package version delete` | Delete a package version |
| package | `sf package version report` | Get details of a package version |
| package | `sf package install` | Install a package in an org |
| package | `sf package uninstall` | Uninstall a package |
| package | `sf package installed list` | List installed packages |
| agent | `sf agent create` | Create an AI agent |
| agent | `sf agent generate spec` | Generate agent spec file |
| agent | `sf agent generate test` | Generate agent test cases |
| agent | `sf agent test run` | Run agent tests |
| agent | `sf agent test resume` | Resume agent test run |
| agent | `sf agent preview` | Preview an agent |
| agent | `sf agent activate` | Activate an agent |
| agent | `sf agent deactivate` | Deactivate an agent |
| config | `sf config get` | Get a config value |
| config | `sf config list` | List all config values |
| config | `sf config set` | Set a config value |
| config | `sf config unset` | Unset a config value |
| alias | `sf alias list` | List all aliases |
| alias | `sf alias set` | Set an alias |
| alias | `sf alias unset` | Remove an alias |
| sobject | `sf sobject describe` | Describe an SObject |
| sobject | `sf sobject list` | List SObjects in an org |
| api | `sf api request rest` | Make a REST API request |
| api | `sf api request graphql` | Make a GraphQL API request |
| schema | `sf schema generate sobject` | Generate SObject metadata |
| schema | `sf schema generate field` | Generate field metadata |
| schema | `sf schema generate tab` | Generate tab metadata |
| schema | `sf schema generate platformevent` | Generate platform event metadata |
| lightning | `sf lightning generate component` | Generate Lightning component (LWC/Aura) |
| lightning | `sf lightning generate event` | Generate Lightning event |
| lightning | `sf lightning generate interface` | Generate Lightning interface |
| plugins | `sf plugins install` | Install a CLI plugin |
| plugins | `sf plugins uninstall` | Uninstall a CLI plugin |
| plugins | `sf plugins update` | Update installed plugins |
| plugins | `sf plugins link` | Link a local plugin |
| plugins | `sf plugins discover` | Discover available plugins |
| logic | `sf logic run test` | Run Flow tests |
| utility | `sf doctor` | Diagnose CLI issues |
| utility | `sf info releasenotes display` | Show release notes |
| utility | `sf update` | Update the CLI |
| utility | `sf version` | Display CLI version |
| utility | `sf autocomplete` | Set up shell autocomplete |

---

## org — Organization Management

### sf org login web

| Flag | Required | Description |
|---|---|---|
| `--alias, -a` | No | Alias for the org |
| `--instance-url, -r` | No | Login URL (default: login.salesforce.com; use test.salesforce.com for sandboxes) |
| `--set-default, -d` | No | Set as default target org |
| `--set-default-dev-hub, -v` | No | Set as default Dev Hub |
| `--browser` | No | Browser to use for login |
| `--client-id` | No | Connected App consumer key |

### sf org login jwt

| Flag | Required | Description |
|---|---|---|
| `--client-id, -i` | Yes | Connected App consumer key |
| `--jwt-key-file, -f` | Yes | Path to private key file (.key) |
| `--username, -o` | Yes | Login username |
| `--alias, -a` | No | Alias for the org |
| `--instance-url, -r` | No | Login URL |
| `--set-default, -d` | No | Set as default target org |
| `--set-default-dev-hub, -v` | No | Set as default Dev Hub |

### sf org login sfdx-url

| Flag | Required | Description |
|---|---|---|
| `--sfdx-url-file, -f` | Yes | Path to file containing SFDX auth URL |
| `--alias, -a` | No | Alias for the org |
| `--set-default, -d` | No | Set as default target org |
| `--set-default-dev-hub, -v` | No | Set as default Dev Hub |

### sf org list

| Flag | Required | Description |
|---|---|---|
| `--all` | No | Include expired, deleted, and unknown-status orgs |
| `--clean` | No | Remove all local org auth files with invalid orgs |
| `--skip-connection-status` | No | Skip connection status check (faster) |

### sf org open

| Flag | Required | Description |
|---|---|---|
| `--target-org, -o` | No | Org to open (default: default org) |
| `--path, -p` | No | URL path to open (e.g., `/lightning/setup/SetupOneHome/home`) |
| `--url-only, -r` | No | Print URL instead of opening browser |
| `--browser` | No | Browser to use |

### sf org display

| Flag | Required | Description |
|---|---|---|
| `--target-org, -o` | No | Org to display info for |
| `--verbose` | No | Show access token and connected status |

### sf org create scratch

| Flag | Required | Description |
|---|---|---|
| `--definition-file, -f` | No | Path to scratch org definition file |
| `--target-dev-hub, -v` | No | Dev Hub for scratch org creation |
| `--alias, -a` | No | Alias for the scratch org |
| `--duration-days, -d` | No | Duration in days (1-30, default: 7) |
| `--set-default` | No | Set as default target org |
| `--edition, -e` | No | Salesforce edition (Developer, Enterprise, Group, Professional) |
| `--no-namespace` | No | Create without a namespace |
| `--wait, -w` | No | Minutes to wait (default: 6) |
| `--no-ancestors` | No | Do not include ancestors in scratch org |

### sf org delete scratch

| Flag | Required | Description |
|---|---|---|
| `--target-org, -o` | Yes | Scratch org to delete |
| `--no-prompt, -p` | No | Skip confirmation prompt |

### sf org create sandbox

| Flag | Required | Description |
|---|---|---|
| `--definition-file, -f` | No | Path to sandbox definition file |
| `--name, -n` | Yes | Name of the sandbox |
| `--target-org, -o` | No | Production org for sandbox |
| `--alias, -a` | No | Alias for the sandbox |
| `--set-default` | No | Set as default target org |
| `--wait, -w` | No | Minutes to wait (default: 30) |
| `--poll-interval, -i` | No | Seconds between status polls (default: 30) |
| `--clone, -c` | No | Name of sandbox to clone |
| `--license-type, -l` | No | License type (DEVELOPER, DEVELOPER_PRO, PARTIAL, FULL) |

### sf org assign permset

| Flag | Required | Description |
|---|---|---|
| `--name, -n` | Yes | Permission set name(s) to assign |
| `--target-org, -o` | No | Target org |
| `--on-behalf-of, -b` | No | Username(s) to assign to |

---

## project — Source Deploy and Retrieve

### sf project deploy start

| Flag | Required | Description |
|---|---|---|
| `--source-dir, -d` | No | Source directory path(s) to deploy |
| `--manifest, -x` | No | Path to package.xml manifest |
| `--metadata, -m` | No | Metadata component(s) to deploy (e.g., `ApexClass:MyClass`) |
| `--target-org, -o` | No | Target org for deployment |
| `--wait, -w` | No | Minutes to wait (default: 33) |
| `--test-level, -l` | No | Test level: NoTestRun, RunSpecifiedTests, RunLocalTests, RunAllTestsInOrg |
| `--tests, -t` | No | Apex test class names (with RunSpecifiedTests) |
| `--ignore-errors` | No | Continue deploy on component errors |
| `--ignore-warnings` | No | Ignore deploy warnings |
| `--dry-run` | No | Validate without saving (same as deploy validate) |
| `--pre-destructive-changes` | No | Manifest of components to delete before deploy |
| `--post-destructive-changes` | No | Manifest of components to delete after deploy |
| `--purge-on-delete` | No | Permanently delete components (not to recycle bin) |
| `--single-package` | No | Treat source-dir as a single package |
| `--api-version` | No | Override the API version |
| `--async` | No | Run asynchronously (don't wait) |
| `--concise` | No | Show concise output |
| `--verbose` | No | Show verbose output |
| `--json` | No | Output in JSON format |

### sf project deploy validate

Same flags as `sf project deploy start`. Validates without committing the deploy to the org. After successful validation, use `sf project deploy quick` with the `--job-id` from the output.

### sf project deploy quick

| Flag | Required | Description |
|---|---|---|
| `--job-id, -i` | Yes | Job ID from a successful validation |
| `--target-org, -o` | No | Target org |
| `--wait, -w` | No | Minutes to wait |
| `--async` | No | Run asynchronously |
| `--concise` | No | Show concise output |

### sf project deploy report

| Flag | Required | Description |
|---|---|---|
| `--job-id, -i` | No | Job ID to check (defaults to most recent) |
| `--target-org, -o` | No | Target org |

### sf project deploy resume

| Flag | Required | Description |
|---|---|---|
| `--job-id, -i` | No | Job ID to resume |
| `--target-org, -o` | No | Target org |
| `--wait, -w` | No | Minutes to wait |

### sf project deploy cancel

| Flag | Required | Description |
|---|---|---|
| `--job-id, -i` | No | Job ID to cancel (defaults to most recent) |
| `--target-org, -o` | No | Target org |

### sf project retrieve start

| Flag | Required | Description |
|---|---|---|
| `--source-dir, -d` | No | Source directory path(s) to retrieve into |
| `--manifest, -x` | No | Path to package.xml manifest |
| `--metadata, -m` | No | Metadata component(s) to retrieve |
| `--target-org, -o` | No | Org to retrieve from |
| `--package-name, -n` | No | Package name(s) to retrieve |
| `--wait, -w` | No | Minutes to wait (default: 33) |
| `--api-version` | No | Override the API version |
| `--ignore-conflicts` | No | Ignore source tracking conflicts |

### sf project retrieve preview

| Flag | Required | Description |
|---|---|---|
| `--target-org, -o` | No | Org to preview retrieval from |
| `--concise` | No | Concise output |

### sf project generate

| Flag | Required | Description |
|---|---|---|
| `--name, -n` | Yes | Project name |
| `--template, -t` | No | Template: standard, empty, analytics |
| `--output-dir, -d` | No | Output directory |
| `--namespace, -s` | No | Namespace |
| `--default-package-dir, -p` | No | Default package directory (default: force-app) |
| `--manifest, -x` | No | Generate manifest (package.xml) |

### sf project generate manifest

| Flag | Required | Description |
|---|---|---|
| `--source-dir, -d` | No | Source directory to generate manifest from |
| `--metadata, -m` | No | Metadata types to include |
| `--name, -n` | No | Output file name (default: package.xml) |
| `--output-dir, -p` | No | Output directory |
| `--from-org` | No | Generate from org instead of source |
| `--type` | No | Manifest type: package, pre, post, destroy |

---

## apex — Apex Execution and Testing

### sf apex run

| Flag | Required | Description |
|---|---|---|
| `--file, -f` | No | Path to Apex file to execute |
| `--target-org, -o` | No | Target org |

If `--file` is omitted, opens an interactive prompt for Apex input (stdin).

### sf apex run test

| Flag | Required | Description |
|---|---|---|
| `--target-org, -o` | No | Target org |
| `--test-level, -l` | No | RunAllTestsInOrg, RunLocalTests, RunSpecifiedTests |
| `--class-names, -n` | No | Test class names (comma-separated) |
| `--suite-names, -s` | No | Test suite names (comma-separated) |
| `--tests, -t` | No | Test methods (ClassName.methodName) |
| `--code-coverage, -c` | No | Include code coverage results |
| `--output-dir, -d` | No | Directory for test result files |
| `--result-format, -r` | No | Format: human, tap, junit, json |
| `--wait, -w` | No | Minutes to wait (default: 10) |
| `--synchronous, -y` | No | Run tests synchronously |
| `--detailed-coverage` | No | Per-class code coverage detail |

### sf apex tail log

| Flag | Required | Description |
|---|---|---|
| `--target-org, -o` | No | Target org |
| `--debug-level` | No | Debug level name (e.g., SFDC_DevConsole) |
| `--skip-trace-flag` | No | Skip setting a trace flag |
| `--color` | No | Colorize output |

### sf apex get log

| Flag | Required | Description |
|---|---|---|
| `--log-id, -i` | No | ID of the log to retrieve |
| `--target-org, -o` | No | Target org |
| `--number, -n` | No | Number of most recent logs to get |
| `--output-dir, -d` | No | Directory to save log files |

### sf apex list log

| Flag | Required | Description |
|---|---|---|
| `--target-org, -o` | No | Target org |

### sf apex generate class

| Flag | Required | Description |
|---|---|---|
| `--name, -n` | Yes | Class name |
| `--output-dir, -d` | No | Output directory (default: current dir) |
| `--template, -t` | No | Template: DefaultApexClass, ApexException, ApexUnitTest, InboundEmailService |
| `--api-version` | No | Override API version |

### sf apex generate trigger

| Flag | Required | Description |
|---|---|---|
| `--name, -n` | Yes | Trigger name |
| `--output-dir, -d` | No | Output directory |
| `--sobject, -s` | No | SObject for the trigger |
| `--event` | No | Trigger events (e.g., before insert, after update) |
| `--api-version` | No | Override API version |

---

## data — Data Operations

### sf data query

| Flag | Required | Description |
|---|---|---|
| `--query, -q` | No | SOQL query string |
| `--file, -f` | No | File containing SOQL query |
| `--target-org, -o` | No | Target org |
| `--result-format, -r` | No | Format: human, csv, json |
| `--bulk` | No | Use Bulk API for large queries |
| `--wait, -w` | No | Minutes to wait for bulk query |
| `--all-rows` | No | Include deleted and archived records |
| `--use-tooling-api, -t` | No | Use Tooling API |
| `--perflog` | No | Log performance metrics |

### sf data search

| Flag | Required | Description |
|---|---|---|
| `--query, -q` | Yes | SOSL search query |
| `--target-org, -o` | No | Target org |
| `--result-format, -r` | No | Format: human, csv, json |

### sf data create record

| Flag | Required | Description |
|---|---|---|
| `--sobject, -s` | Yes | SObject type |
| `--values, -v` | Yes | Field values (e.g., `"Name='Acme' Industry='Tech'"`) |
| `--target-org, -o` | No | Target org |
| `--use-tooling-api, -t` | No | Use Tooling API |

### sf data update record

| Flag | Required | Description |
|---|---|---|
| `--sobject, -s` | Yes | SObject type |
| `--record-id, -i` | No | Record ID to update |
| `--where, -w` | No | WHERE clause to identify record |
| `--values, -v` | Yes | New field values |
| `--target-org, -o` | No | Target org |
| `--use-tooling-api, -t` | No | Use Tooling API |

### sf data delete record

| Flag | Required | Description |
|---|---|---|
| `--sobject, -s` | Yes | SObject type |
| `--record-id, -i` | No | Record ID to delete |
| `--where, -w` | No | WHERE clause to identify record |
| `--target-org, -o` | No | Target org |
| `--use-tooling-api, -t` | No | Use Tooling API |

### sf data upsert bulk

| Flag | Required | Description |
|---|---|---|
| `--file, -f` | Yes | Path to CSV file |
| `--sobject, -s` | Yes | SObject type |
| `--external-id, -i` | Yes | External ID field for matching |
| `--target-org, -o` | No | Target org |
| `--wait, -w` | No | Minutes to wait |
| `--async` | No | Run asynchronously |

### sf data delete bulk

| Flag | Required | Description |
|---|---|---|
| `--file, -f` | Yes | Path to CSV file with record IDs |
| `--sobject, -s` | Yes | SObject type |
| `--target-org, -o` | No | Target org |
| `--wait, -w` | No | Minutes to wait |

### sf data export tree

| Flag | Required | Description |
|---|---|---|
| `--query, -q` | Yes | SOQL query defining records to export |
| `--target-org, -o` | No | Target org |
| `--plan, -p` | No | Generate multiple files with plan |
| `--output-dir, -d` | No | Output directory |
| `--prefix` | No | Filename prefix |

### sf data import tree

| Flag | Required | Description |
|---|---|---|
| `--files, -f` | No | Data file(s) to import |
| `--plan, -p` | No | Plan file for multi-file import |
| `--target-org, -o` | No | Target org |

---

## package — Package Development

### sf package create

| Flag | Required | Description |
|---|---|---|
| `--name, -n` | Yes | Package name |
| `--package-type, -t` | Yes | Type: Managed, Unlocked |
| `--path, -r` | Yes | Package directory path |
| `--target-dev-hub, -v` | No | Dev Hub org |
| `--description, -d` | No | Package description |
| `--no-namespace, -e` | No | Create without namespace |

### sf package version create

| Flag | Required | Description |
|---|---|---|
| `--package, -p` | No | Package ID or alias |
| `--target-dev-hub, -v` | No | Dev Hub org |
| `--definition-file, -f` | No | Scratch org definition file |
| `--installation-key, -k` | No | Installation key for the version |
| `--installation-key-bypass, -x` | No | Bypass installation key |
| `--code-coverage, -c` | No | Calculate and store code coverage |
| `--version-name, -a` | No | Version name |
| `--version-number, -n` | No | Version number (Major.Minor.Patch.Build) |
| `--wait, -w` | No | Minutes to wait (default: 0) |
| `--skip-validation` | No | Skip package validation (creates beta) |

### sf package version promote

| Flag | Required | Description |
|---|---|---|
| `--package, -p` | Yes | Package version ID (04t) to promote |
| `--target-dev-hub, -v` | No | Dev Hub org |
| `--no-prompt, -n` | No | Skip confirmation prompt |

### sf package install

| Flag | Required | Description |
|---|---|---|
| `--package, -p` | Yes | Package version ID (04t) or alias |
| `--target-org, -o` | No | Org to install into |
| `--installation-key, -k` | No | Installation key |
| `--wait, -w` | No | Minutes to wait (default: 10) |
| `--publish-wait` | No | Minutes to wait for package to become available |
| `--no-prompt, -b` | No | Skip confirmation |
| `--security-type, -s` | No | Security type: AllUsers, AdminsOnly |
| `--upgrade-type, -t` | No | Upgrade type: DeprecateOnly, Mixed, Delete |
| `--apex-compile, -a` | No | Compile: all, package |

### sf package installed list

| Flag | Required | Description |
|---|---|---|
| `--target-org, -o` | No | Target org |

---

## agent — Agentforce / AI Agent Management

### sf agent create

| Flag | Required | Description |
|---|---|---|
| `--target-org, -o` | No | Target org |

> Note: `sf agent` commands are actively evolving. Run `sf agent <command> --help` for the latest flags.

### sf agent generate spec

| Flag | Required | Description |
|---|---|---|
| `--output-dir, -d` | No | Output directory |
| `--target-org, -o` | No | Target org |

### sf agent generate test

| Flag | Required | Description |
|---|---|---|
| `--spec-file, -f` | Yes | Agent spec file |
| `--output-dir, -d` | No | Output directory |
| `--target-org, -o` | No | Target org |

### sf agent test run

| Flag | Required | Description |
|---|---|---|
| `--name, -n` | No | Agent test name |
| `--target-org, -o` | No | Target org |
| `--wait, -w` | No | Minutes to wait |
| `--result-format, -r` | No | Output format |

### sf agent preview

| Flag | Required | Description |
|---|---|---|
| `--name, -n` | No | Agent name |
| `--target-org, -o` | No | Target org |

---

## config — Configuration

### sf config set

| Flag | Required | Description |
|---|---|---|
| (positional) | Yes | Key=value pairs (e.g., `target-org=myOrg`) |
| `--global, -g` | No | Set globally (all projects) |

**Common config keys:**

| Key | Description |
|---|---|
| `target-org` | Default org for commands |
| `target-dev-hub` | Default Dev Hub org |
| `org-api-version` | Default API version |
| `org-isv-debugger-sid` | ISV debugger session ID |
| `org-isv-debugger-url` | ISV debugger URL |
| `org-max-query-limit` | Max SOQL query results |
| `org-instance-url` | Default instance URL |

### sf config list

No flags. Lists all set config values (local and global).

### sf config get

| Flag | Required | Description |
|---|---|---|
| (positional) | Yes | Config key(s) to get |

### sf config unset

| Flag | Required | Description |
|---|---|---|
| (positional) | Yes | Config key(s) to unset |
| `--global, -g` | No | Unset globally |

---

## alias — Alias Management

### sf alias set

| Flag | Required | Description |
|---|---|---|
| (positional) | Yes | Alias=value pairs (e.g., `myOrg=user@example.com`) |

### sf alias list

No flags. Lists all aliases.

### sf alias unset

| Flag | Required | Description |
|---|---|---|
| (positional) | Yes | Alias name(s) to remove |

---

## sobject — SObject Metadata

### sf sobject describe

| Flag | Required | Description |
|---|---|---|
| `--sobject, -s` | Yes | SObject API name |
| `--target-org, -o` | No | Target org |
| `--use-tooling-api, -t` | No | Use Tooling API |

### sf sobject list

| Flag | Required | Description |
|---|---|---|
| `--sobject-type, -s` | No | Type filter: all, custom, standard |
| `--target-org, -o` | No | Target org |

---

## api — Direct API Calls

### sf api request rest

| Flag | Required | Description |
|---|---|---|
| (positional) | Yes | REST API URL path (e.g., `/services/data/vXX.0/sobjects`) |
| `--target-org, -o` | No | Target org |
| `--method` | No | HTTP method: GET, POST, PATCH, PUT, DELETE (default: GET) |
| `--body` | No | Request body (file path or inline JSON) |
| `--header, -H` | No | HTTP headers |
| `--stream-to-file` | No | Stream large response to file |

### sf api request graphql

| Flag | Required | Description |
|---|---|---|
| `--body, -b` | Yes | GraphQL query (file path or inline) |
| `--target-org, -o` | No | Target org |

---

## lightning — Component Generation

### sf lightning generate component

| Flag | Required | Description |
|---|---|---|
| `--name, -n` | Yes | Component name |
| `--type, -t` | No | Type: lwc, aura (default: lwc) |
| `--output-dir, -d` | No | Output directory |
| `--template` | No | Template name |
| `--api-version` | No | Override API version |

### sf lightning generate event

| Flag | Required | Description |
|---|---|---|
| `--name, -n` | Yes | Event name |
| `--output-dir, -d` | No | Output directory |
| `--api-version` | No | Override API version |

### sf lightning generate interface

| Flag | Required | Description |
|---|---|---|
| `--name, -n` | Yes | Interface name |
| `--output-dir, -d` | No | Output directory |
| `--api-version` | No | Override API version |

---

## schema — Metadata Schema Generation

### sf schema generate sobject

| Flag | Required | Description |
|---|---|---|
| `--label, -l` | Yes | SObject label |
| `--output-dir, -d` | No | Output directory |
| `--use-default-features` | No | Use default SObject features |

### sf schema generate field

| Flag | Required | Description |
|---|---|---|
| `--label, -l` | Yes | Field label |
| `--object` | Yes | Parent SObject |
| `--output-dir, -d` | No | Output directory |

### sf schema generate tab

| Flag | Required | Description |
|---|---|---|
| `--object` | Yes | SObject for the tab |
| `--directory, -d` | No | Output directory |
| `--icon, -i` | No | Tab icon number |

### sf schema generate platformevent

| Flag | Required | Description |
|---|---|---|
| `--label, -l` | Yes | Platform event label |
| `--output-dir, -d` | No | Output directory |

---

## plugins — Plugin Management

### sf plugins install

| Flag | Required | Description |
|---|---|---|
| (positional) | Yes | Plugin name (e.g., `@salesforce/plugin-packaging`) |
| `--force` | No | Force install without confirmation |

### sf plugins uninstall

| Flag | Required | Description |
|---|---|---|
| (positional) | Yes | Plugin name to uninstall |

### sf plugins update

No required flags. Updates all installed plugins.

### sf plugins link

| Flag | Required | Description |
|---|---|---|
| (positional) | Yes | Path to local plugin directory |

---

## Utility Commands

### sf doctor

Diagnoses CLI configuration issues. No required flags. Checks: Node.js version, CLI version, plugin compatibility, config validity.

### sf info releasenotes display

| Flag | Required | Description |
|---|---|---|
| `--version, -v` | No | Show notes for a specific version |

### sf update

| Flag | Required | Description |
|---|---|---|
| `--channel` | No | Update channel: stable, stable-rc, latest, latest-rc, nightly |

### sf autocomplete

| Flag | Required | Description |
|---|---|---|
| (positional) | No | Shell: bash, zsh, powershell |

---

## Global Flags (Available on All Commands)

| Flag | Description |
|---|---|
| `--json` | Output result in JSON format |
| `--flags-dir` | Import flag values from a directory |
| `--help` | Show command help |
