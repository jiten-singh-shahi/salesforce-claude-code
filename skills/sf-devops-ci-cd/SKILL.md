---
name: sf-devops-ci-cd
description: >-
  Use when setting up Salesforce CI/CD pipelines. GitHub Actions, JWT auth,
  scratch org workflows, sandbox promotion, and deployment automation.
origin: SCC
user-invocable: false
disable-model-invocation: true
---

# Salesforce DevOps and CI/CD

Reference: @../_reference/DEPLOYMENT_CHECKLIST.md, @../_reference/DOCKER_CI_PATTERNS.md

## When to Use

- Setting up GitHub Actions CI/CD pipelines for Salesforce projects
- Configuring JWT authentication for non-interactive CI/CD deployments
- Implementing scratch-org-per-branch development workflows
- Automating deployments across sandbox, staging, and production environments
- Troubleshooting SF CLI v2 deploy, retrieve, or test commands

---

## SF CLI v2 Key Commands Reference

### Org Management

```bash
sf org login web --alias myOrg                          # Browser-based login
sf org login jwt --client-id <id> --jwt-key-file server.key --username user@org.com --alias ci-org
sf org list                                             # List all authenticated orgs
sf org open --target-org myOrg                          # Open org in browser
sf org create scratch --definition-file config/project-scratch-def.json --alias myScratch --duration-days 7
sf org delete scratch --target-org myScratch --no-prompt
sf org display --target-org myOrg                       # Show org details including access token
```

### Source Deploy and Retrieve

```bash
sf project deploy start --source-dir force-app --target-org myOrg
sf project deploy start --manifest manifest/package.xml --target-org myOrg
sf project deploy validate --manifest manifest/package.xml --target-org myOrg
sf project deploy quick --job-id <id> --target-org myOrg
sf project retrieve start --source-dir force-app --target-org myOrg
sf project deploy start --source-dir force-app --test-level RunLocalTests --target-org myOrg
```

### Apex Execution and Testing

```bash
sf apex run --file scripts/apex/setup.apex --target-org myOrg
sf apex run test --test-level RunLocalTests --result-format human --target-org myOrg
sf apex run test --class-names AccountServiceTest --result-format json --target-org myOrg
sf apex run test --test-level RunAllTestsInOrg --code-coverage --result-format json --output-dir results/
sf apex tail log --target-org myOrg                     # Stream live debug logs
```

---

## JWT Authentication Setup

JWT auth enables non-interactive CI/CD authentication without browser prompts.

### Step 1: Create Connected App in Salesforce

1. Setup > App Manager > New Connected App
2. Enable OAuth Settings
3. Callback URL: `http://localhost:1717/OauthRedirect`
4. Selected OAuth Scopes: `api`, `refresh_token`, `offline_access`
5. Enable "Use digital signatures"
6. Upload your certificate (.crt file)
7. Manage > Edit Policies > IP Relaxation: Relax IP restrictions
8. Note the Consumer Key (Client ID)

### Step 2: Generate Certificate and Private Key

```bash
openssl genrsa -out server.key 2048
openssl req -new -key server.key -out server.csr
openssl x509 -req -days 3650 -in server.csr -signkey server.key -out server.crt
base64 -i server.key | tr -d '\n'   # Encode for GitHub Secrets storage
```

### Step 3: Configure GitHub Secrets

- `SALESFORCE_JWT_SECRET_KEY` -- base64-encoded server.key content
- `SALESFORCE_CONSUMER_KEY` -- Connected App Consumer Key
- `SALESFORCE_USERNAME` -- target org username

---

## Complete GitHub Actions CI/CD Workflow

```yaml
# .github/workflows/ci.yml
name: Salesforce CI/CD

on:
  push:
    branches: [develop, staging, main]
  pull_request:
    branches: [develop, staging, main]

jobs:
  validate-pr:
    name: Validate Pull Request
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Install SF CLI
        run: npm install -g @salesforce/cli

      - name: Authenticate to sandbox
        env:
          JWT_SECRET_KEY: ${{ secrets.SALESFORCE_JWT_SECRET_KEY }}
          CONSUMER_KEY: ${{ secrets.SALESFORCE_CONSUMER_KEY }}
          USERNAME: ${{ secrets.SALESFORCE_USERNAME_SANDBOX }}
        run: |
          echo "$JWT_SECRET_KEY" | base64 --decode > server.key
          sf org login jwt \
            --client-id "$CONSUMER_KEY" \
            --jwt-key-file server.key \
            --username "$USERNAME" \
            --alias validation-org \
            --set-default
          rm server.key

      - name: Validate deployment
        run: |
          sf project deploy validate \
            --source-dir force-app \
            --test-level RunLocalTests \
            --target-org validation-org \
            --wait 30

  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    environment: production
    steps:
      - uses: actions/checkout@v4

      - name: Install SF CLI
        run: npm install -g @salesforce/cli

      - name: Authenticate to Production
        env:
          JWT_SECRET_KEY: ${{ secrets.SALESFORCE_PROD_JWT_SECRET_KEY }}
          CONSUMER_KEY: ${{ secrets.SALESFORCE_PROD_CONSUMER_KEY }}
          USERNAME: ${{ secrets.SALESFORCE_PROD_USERNAME }}
        run: |
          echo "$JWT_SECRET_KEY" | base64 --decode > server.key
          sf org login jwt \
            --client-id "$CONSUMER_KEY" \
            --jwt-key-file server.key \
            --username "$USERNAME" \
            --instance-url https://login.salesforce.com \
            --alias prod \
            --set-default
          rm server.key

      - name: Validate deployment
        id: validate
        run: |
          VALIDATION_RESULT=$(sf project deploy validate \
            --source-dir force-app \
            --test-level RunLocalTests \
            --target-org prod \
            --wait 60 \
            --json)
          echo "VALIDATION_JOB_ID=$(echo "$VALIDATION_RESULT" | jq -r '.result.id')" >> "$GITHUB_ENV"

      - name: Quick deploy
        run: |
          sf project deploy quick \
            --job-id "$VALIDATION_JOB_ID" \
            --target-org prod \
            --wait 10
```

> Do not use `--use-most-recent` for quick deploy in multi-team orgs. Another team's deployment between validate and quick-deploy invalidates the job. Always pass `--job-id` explicitly.

---

## Branch Strategy

```
feature/ABC-123-account-service
        |
        v
   develop  ---- CI: validate + deploy to dev sandbox
        |
        v
   staging  ---- CI: validate + deploy to staging sandbox (RunLocalTests)
        |
        v
    main     ---- CI: deploy to production (RunLocalTests)
```

- `feature/*` -- individual work, scratch org per developer
- `develop` -- integration branch, auto-deploys to dev sandbox
- `staging` -- pre-production, mirrors production as closely as possible
- `main` -- production. Requires pull request review + CI green

---

## Scratch Org Per-Branch Workflow (CI)

```yaml
test-in-scratch-org:
  name: Test in Scratch Org
  runs-on: ubuntu-latest
  if: startsWith(github.ref, 'refs/heads/feature/')
  steps:
    - uses: actions/checkout@v4

    - name: Install SF CLI and authenticate Dev Hub
      env:
        JWT_SECRET_KEY: ${{ secrets.DEVHUB_JWT_SECRET_KEY }}
        CONSUMER_KEY: ${{ secrets.DEVHUB_CONSUMER_KEY }}
        USERNAME: ${{ secrets.DEVHUB_USERNAME }}
      run: |
        npm install -g @salesforce/cli
        echo "$JWT_SECRET_KEY" | base64 --decode > server.key
        sf org login jwt \
          --client-id "$CONSUMER_KEY" \
          --jwt-key-file server.key \
          --username "$USERNAME" \
          --alias devhub \
          --set-default-dev-hub
        rm server.key

    - name: Create scratch org
      run: |
        sf org create scratch \
          --definition-file config/project-scratch-def.json \
          --alias ci-scratch \
          --set-default \
          --duration-days 1 \
          --no-ancestors

    - name: Push source and run tests
      run: |
        sf project deploy start --source-dir force-app --target-org ci-scratch
        sf apex run test \
          --test-level RunLocalTests \
          --result-format human \
          --code-coverage \
          --target-org ci-scratch

    - name: Delete scratch org
      if: always()
      run: sf org delete scratch --target-org ci-scratch --no-prompt
```

---

## Deployment Test Level Strategy

| Environment  | Test Level             | Rationale                           |
|-------------|------------------------|-------------------------------------|
| Feature CI  | RunLocalTests          | Fast feedback, catches regressions  |
| Dev Sandbox | RunLocalTests          | Full local test suite               |
| Staging     | RunLocalTests          | Near-production confidence          |
| Production  | RunLocalTests          | Required by Salesforce (75% min)    |
| Full release | RunAllTestsInOrg      | Complete org-wide regression        |

---

## Change Detection: Deploy Only Changed Metadata

```bash
#!/bin/bash
# scripts/get-changed-metadata.sh
BASE_BRANCH=${1:-main}
CHANGED_FILES=$(git diff --name-only origin/$BASE_BRANCH...HEAD)

SF_CHANGED=$(echo "$CHANGED_FILES" | grep "^force-app/")
if [ -z "$SF_CHANGED" ]; then
    echo "No Salesforce metadata changes detected"
    exit 0
fi

# Use sfdx-git-delta plugin
# Verify command syntax with: sf sgd --help
sf sgd:source:delta \
    --to HEAD \
    --from origin/$BASE_BRANCH \
    --output-dir changed-sources \
    --generate-delta

# Deploy only changed sources
TEST_CLASSES=$(cat changed-sources/test-classes.txt 2>/dev/null | tr '\n' ',' | sed 's/,$//')
if [ -n "$TEST_CLASSES" ]; then
    sf project deploy start \
        --source-dir changed-sources/force-app \
        --test-level RunSpecifiedTests \
        --tests "$TEST_CLASSES" \
        --target-org $TARGET_ORG
else
    sf project deploy start \
        --source-dir changed-sources/force-app \
        --test-level RunLocalTests \
        --target-org $TARGET_ORG
fi
```

Install sfdx-git-delta plugin:

```bash
sf plugins install sfdx-git-delta
```

---

## Related

- **Constraints**: `sf-deployment-constraints` -- deployment safety rules
