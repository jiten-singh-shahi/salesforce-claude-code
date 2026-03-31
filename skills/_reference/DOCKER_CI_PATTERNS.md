<!-- Source: https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_ci.htm -->
<!-- Last verified: API v66.0 — 2026-03-29 -->

# Docker & CI Patterns — Salesforce Reference

## Docker Images

| Image | Status | Notes |
|---|---|---|
| `salesforce/cli` (Docker Hub) | Active | Weekly releases; tags: `latest`, `latest-rc`, `{version}-full`, `{version}-slim` |
| `salesforce/salesforcedx` | Deprecated | Do not use; migrate to `salesforce/cli` |
| `node:20-slim` + `npm i -g @salesforce/cli` | Recommended alternative | Full control over base image; smaller footprint |

### Image Tag Variants

| Tag | Contents |
|---|---|
| `latest` | Current stable release (retagged weekly from `latest-rc`) |
| `latest-rc` | Release candidate (published each week) |
| `{version}-full` | Full Node.js LTS + `sf` installed via npm |
| `{version}-slim` | Minimal image, smaller footprint |

### Release Cadence

- New `latest-rc` image published **weekly**
- Retagged to `latest` the following week
- Versioned tags match CLI version (e.g., `2.70.7-slim`)

## CI Authentication Methods

| Method | Command | Best For |
|---|---|---|
| JWT Bearer Flow | `sf org login jwt --client-id $KEY --jwt-key-file server.key --username $USER` | CI/CD (headless, no browser) |
| SFDX Auth URL | `sf org login sfdx-url --sfdx-url-file auth.txt` | CI/CD (simpler setup) |
| Web Login | `sf org login web` | Local dev only (requires browser) |

JWT Bearer Flow is the **recommended** method for CI pipelines.

## CI Pipeline Structure

Salesforce recommends splitting CI into two jobs:

| Job | Tools | Purpose |
|---|---|---|
| Job 1: Lint & LWC Tests | Node.js, ESLint, Jest, Prettier | Format, lint, and unit-test LWC |
| Job 2: Deploy & Apex Tests | Salesforce CLI, Scratch Org | Deploy metadata, run Apex tests |

## Core CLI Commands for CI

| Command | Purpose |
|---|---|
| `sf org login jwt ...` | Authenticate to DevHub (headless) |
| `sf org login sfdx-url --sfdx-url-file auth.txt --set-default-dev-hub` | Auth via stored URL |
| `sf org create scratch --definition-file config/project-scratch-def.json --alias ci --duration-days 1` | Create ephemeral scratch org |
| `sf project deploy start --target-org ci` | Deploy source to scratch org |
| `sf apex run test --test-level RunLocalTests --code-coverage --result-format human --target-org ci` | Run Apex tests with coverage |
| `sf org delete scratch --target-org ci --no-prompt` | Cleanup scratch org |
| `sf code-analyzer run --target force-app --format table` | Static analysis (Code Analyzer) |

## Scratch Org Lifecycle in CI

| Step | Duration | Notes |
|---|---|---|
| Create | ~60-120s | Use `--duration-days 1` for auto-cleanup |
| Deploy | Varies | Full source push |
| Test | Varies | `RunLocalTests` excludes managed package tests |
| Delete | ~10s | Always run in `if: always()` / `post` block |

## Supported CI Platforms

| Platform | Sample Repos / Docs |
|---|---|
| GitHub Actions | `forcedotcom/sfdx-github-actions` |
| Jenkins | Salesforce DX Developer Guide: CI with Jenkins |
| CircleCI | Salesforce DX Developer Guide: CI with CircleCI |
| GitLab CI | Community examples; same CLI commands |
| Bitbucket Pipelines | Community examples; same CLI commands |

## GitHub Actions Workflow Pattern

```yaml
name: Salesforce CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    container:
      image: node:20-slim
    steps:
      - uses: actions/checkout@v4
      - run: npm install -g @salesforce/cli
      - name: Auth DevHub
        run: |
          echo "${{ secrets.SFDX_AUTH_URL }}" > auth.txt
          sf org login sfdx-url --sfdx-url-file auth.txt --set-default-dev-hub
      - name: Create Scratch Org
        run: sf org create scratch --definition-file config/project-scratch-def.json --alias ci --duration-days 1
      - name: Deploy
        run: sf project deploy start --target-org ci
      - name: Test
        run: sf apex run test --test-level RunLocalTests --code-coverage --result-format human --target-org ci
      - name: Cleanup
        if: always()
        run: |
          rm -f auth.txt server.key
          sf org delete scratch --target-org ci --no-prompt
```

## Security Hardening

| Practice | Implementation |
|---|---|
| Non-root user | `RUN adduser --system appuser` then `USER appuser` |
| Credential cleanup | `rm -f auth.txt server.key` after auth |
| Secret storage | GitHub Secrets / CI vault; never commit credentials |
| Auth volume | Named volume for `.sf` directory (dev only, not CI) |

## Cache Optimization

| Strategy | Implementation |
|---|---|
| Layer ordering | Install CLI first (rarely changes), copy source last |
| npm cache (GitHub Actions) | `actions/cache@v4` with `~/.npm` path, key on `package-lock.json` hash |
| Dependency install | `npm ci --omit=dev` for production builds |
| Multi-stage build | Stage 1: build + lint + scan; Stage 2: runtime with `sf` only |

## Best Practices

| Practice | Reason |
|---|---|
| Use `node:20-slim` + npm install | `salesforce/cli` images may lag; full control over base |
| Pin image versions (`node:20.19-slim`) | Reproducible builds |
| `--duration-days 1` for CI scratch orgs | Auto-cleanup if delete step fails |
| Always delete scratch orgs in `if: always()` | Prevent DevHub scratch org limit exhaustion |
| Store auth URLs / JWT keys as CI secrets | Never commit credentials |
| Run Code Analyzer in Docker | Consistent static analysis across machines |
| Multi-stage builds | Smaller final image; lint/scan in build stage only |
| Non-root container user | Security hardening for production |
