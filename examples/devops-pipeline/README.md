# CI/CD Pipeline for Salesforce

End-to-end DevOps pipeline with scratch org creation, source deployment, test execution, PMD scanning, and production deployment using GitHub Actions. Targets API version 66.0 (Spring '26).

## When to Use This Pattern

- Setting up continuous integration for a Salesforce DX project
- Automating test execution and code quality checks on every pull request
- Building a repeatable deployment pipeline from development to production
- Enforcing quality gates before merging code changes

## Structure

```text
.github/
  workflows/
    ci.yml                    # Pull request validation pipeline
    deploy-production.yml     # Production deployment pipeline
scripts/
  scratch-org-setup.sh        # Scratch org creation and data load
  run-tests.sh                # Test execution with coverage reporting
config/
  project-scratch-def.json    # Scratch org definition
sfdx-project.json             # Project configuration
```

## Scratch Org Creation Script

```bash
#!/bin/bash
# scripts/scratch-org-setup.sh
# Creates a scratch org, pushes source, assigns permission sets, and loads data.

set -euo pipefail

ORG_ALIAS="${1:-ci-scratch}"
DURATION="${2:-1}"

echo "==> Creating scratch org: ${ORG_ALIAS} (duration: ${DURATION} days)"
sf org create scratch \
    --definition-file config/project-scratch-def.json \
    --alias "${ORG_ALIAS}" \
    --duration-days "${DURATION}" \
    --set-default \
    --wait 10

echo "==> Pushing source to scratch org"
sf project deploy start --target-org "${ORG_ALIAS}" --wait 30

echo "==> Assigning permission sets"
sf org assign permset \
    --name AppAdmin \
    --target-org "${ORG_ALIAS}"

sf org assign permset \
    --name IntegrationUser \
    --target-org "${ORG_ALIAS}"

echo "==> Loading sample data"
sf data import tree \
    --files data/Account.json,data/Contact.json,data/Opportunity.json \
    --target-org "${ORG_ALIAS}"

echo "==> Scratch org ready: ${ORG_ALIAS}"
sf org open --target-org "${ORG_ALIAS}"
```

## Scratch Org Definition

```json
{
    "orgName": "SCC CI Scratch Org",
    "edition": "Developer",
    "features": ["EnableSetPasswordInApi", "Communities", "ServiceCloud"],
    "settings": {
        "lightningExperienceSettings": {
            "enableS1DesktopEnabled": true
        },
        "securitySettings": {
            "passwordPolicies": {
                "enableSetPasswordInApi": true
            }
        },
        "languageSettings": {
            "enableTranslationWorkbench": true
        }
    }
}
```

## Test Execution Script

```bash
#!/bin/bash
# scripts/run-tests.sh
# Runs all Apex tests with coverage and fails if coverage is below threshold.

set -euo pipefail

ORG_ALIAS="${1:-ci-scratch}"
COVERAGE_THRESHOLD="${2:-75}"

echo "==> Running all Apex tests with code coverage"
sf apex run test \
    --target-org "${ORG_ALIAS}" \
    --code-coverage \
    --result-format human \
    --output-dir test-results \
    --wait 30 \
    --test-level RunLocalTests

echo "==> Checking coverage threshold (${COVERAGE_THRESHOLD}%)"
COVERAGE=$(cat test-results/test-result-codecoverage.json \
    | python3 -c "
import json, sys
data = json.load(sys.stdin)
total_lines = sum(r.get('totalLines', 0) for r in data)
covered_lines = sum(r.get('totalCovered', 0) for r in data)
pct = (covered_lines / total_lines * 100) if total_lines > 0 else 0
print(f'{pct:.1f}')
")

echo "==> Overall coverage: ${COVERAGE}%"

if (( $(echo "${COVERAGE} < ${COVERAGE_THRESHOLD}" | bc -l) )); then
    echo "ERROR: Coverage ${COVERAGE}% is below threshold ${COVERAGE_THRESHOLD}%"
    exit 1
fi

echo "==> Coverage check passed"
```

## PMD Scanning Integration

```bash
#!/bin/bash
# Run SFDX Scanner with PMD rules as a CI gate

set -euo pipefail

echo "==> Running PMD security and best practices scan"
sf scanner run \
    --target "force-app/main/default/classes/**/*.cls" \
    --category "Security,Best Practices,Performance" \
    --engine pmd \
    --format json \
    --outfile scanner-results.json \
    --severity-threshold 2

VIOLATIONS=$(cat scanner-results.json | python3 -c "
import json, sys
data = json.load(sys.stdin)
count = len(data) if isinstance(data, list) else 0
print(count)
")

echo "==> Found ${VIOLATIONS} violation(s)"

if [ "${VIOLATIONS}" -gt 0 ]; then
    echo "==> Violations found. See scanner-results.json for details."
    sf scanner run \
        --target "force-app/main/default/classes/**/*.cls" \
        --category "Security,Best Practices,Performance" \
        --engine pmd \
        --format table \
        --severity-threshold 2
    exit 1
fi

echo "==> PMD scan passed"
```

## GitHub Actions: Pull Request Validation

```yaml
# .github/workflows/ci.yml
name: Salesforce CI

on:
  pull_request:
    branches: [main, develop]
    paths:
      - 'force-app/**'
      - 'config/**'
      - 'sfdx-project.json'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Install Salesforce CLI
        run: npm install -g @salesforce/cli

      - name: Install SFDX Scanner
        run: sf plugins install @salesforce/sfdx-scanner

      - name: Authenticate Dev Hub
        run: |
          echo "${SFDX_AUTH_URL}" > auth.txt
          sf org login sfdx-url --sfdx-url-file auth.txt --alias devhub --set-default-dev-hub
          rm auth.txt
        env:
          SFDX_AUTH_URL: ${{ secrets.SFDX_DEVHUB_AUTH_URL }}

      - name: Create Scratch Org
        run: |
          sf org create scratch \
            --definition-file config/project-scratch-def.json \
            --alias ci-scratch \
            --duration-days 1 \
            --set-default \
            --wait 15

      - name: Deploy Source
        run: sf project deploy start --target-org ci-scratch --wait 30

      - name: Run Apex Tests
        run: |
          sf apex run test \
            --target-org ci-scratch \
            --code-coverage \
            --result-format human \
            --output-dir test-results \
            --wait 30 \
            --test-level RunLocalTests

      - name: Upload Test Results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: apex-test-results
          path: test-results/

      - name: Run PMD Scanner
        run: |
          sf scanner run \
            --target "force-app/main/default/classes/**/*.cls" \
            --category "Security,Best Practices" \
            --engine pmd \
            --format table \
            --severity-threshold 2

      - name: Delete Scratch Org
        if: always()
        run: sf org delete scratch --target-org ci-scratch --no-prompt
```

## GitHub Actions: Production Deployment

```yaml
# .github/workflows/deploy-production.yml
name: Deploy to Production

on:
  push:
    branches: [main]
    paths:
      - 'force-app/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Install Salesforce CLI
        run: npm install -g @salesforce/cli

      - name: Authenticate Production
        run: |
          echo "${SFDX_AUTH_URL}" > auth.txt
          sf org login sfdx-url --sfdx-url-file auth.txt --alias production
          rm auth.txt
        env:
          SFDX_AUTH_URL: ${{ secrets.SFDX_PROD_AUTH_URL }}

      - name: Validate Deployment (Check Only)
        run: |
          sf project deploy start \
            --target-org production \
            --test-level RunLocalTests \
            --dry-run \
            --wait 60

      - name: Deploy to Production
        run: |
          sf project deploy start \
            --target-org production \
            --test-level RunLocalTests \
            --wait 60

      - name: Verify Deployment
        run: |
          sf project deploy report --target-org production
```

## Key Principles

- Every pull request validates in a fresh scratch org to catch deployment issues early
- Tests run with `RunLocalTests` to avoid executing managed package tests
- PMD scanning gates the pipeline: violations above a severity threshold fail the build
- Production deployments use a `--dry-run` validation step before the real deploy
- Scratch orgs are deleted after each CI run to conserve limits
- Auth URLs are stored as encrypted GitHub Secrets, never committed to source

## Common Pitfalls

- Not deleting scratch orgs in CI, which exhausts the daily scratch org limit
- Hardcoding the Dev Hub username instead of using auth URL files
- Skipping `RunLocalTests` in validation, then discovering test failures during real deploy
- Forgetting to install required plugins (scanner) in the CI environment
- Not setting `--wait` timeouts, causing CI jobs to hang indefinitely
- Storing SFDX auth URLs or tokens in the repository instead of secrets

## SCC Skills

- `/sf-deployment` -- validate and deploy metadata to a target org
- `/sf-devops-ci-cd` -- CI/CD pipeline patterns with scratch orgs
- `/sf-build-fix` -- diagnose and fix deployment failures
- `/sf-apex-testing` -- run Apex tests with coverage analysis
