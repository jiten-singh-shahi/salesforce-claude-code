# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.2](https://github.com/jiten-singh-shahi/salesforce-claude-code/compare/scc-universal-v1.2.1...scc-universal-v1.2.2) (2026-04-06)


### Bug Fixes

* remove stale /skill-name invocations for pattern skills ([#21](https://github.com/jiten-singh-shahi/salesforce-claude-code/issues/21)) ([148e5c4](https://github.com/jiten-singh-shahi/salesforce-claude-code/commit/148e5c49d29f30e8ba98b3361d0e9163bf2808e0))

## [1.2.1](https://github.com/jiten-singh-shahi/salesforce-claude-code/compare/scc-universal-v1.2.0...scc-universal-v1.2.1) (2026-04-03)


### Bug Fixes

* correct install paths for both Claude Code and Cursor targets ([#18](https://github.com/jiten-singh-shahi/salesforce-claude-code/issues/18)) ([c2b195a](https://github.com/jiten-singh-shahi/salesforce-claude-code/commit/c2b195a851b5aababf7ced44d81e58c5b51a7488))

## [1.2.0](https://github.com/jiten-singh-shahi/salesforce-claude-code/compare/scc-universal-v1.1.0...scc-universal-v1.2.0) (2026-04-03)

### Features

* hooks adapter, cross-harness compatibility, and install fixes ([#16](https://github.com/jiten-singh-shahi/salesforce-claude-code/issues/16)) ([a80c81d](https://github.com/jiten-singh-shahi/salesforce-claude-code/commit/a80c81d1e8f708141760135d10a58cfca09a4990))

## [1.1.0](https://github.com/jiten-singh-shahi/salesforce-claude-code/compare/scc-universal-v1.0.0...scc-universal-v1.1.0) (2026-04-03)

### Features

* add 27 specialized Salesforce agents ([8ea9c9b](https://github.com/jiten-singh-shahi/salesforce-claude-code/commit/8ea9c9bd526aa116315221ed32c926560f6dd605))
* add ESLint, markdownlint, validators, and tests to pre-commit hook ([09a5f83](https://github.com/jiten-singh-shahi/salesforce-claude-code/commit/09a5f83bfd1416fef4104fba10e101a808b4dc37))
* add hook script existence validation to CI ([a751dba](https://github.com/jiten-singh-shahi/salesforce-claude-code/commit/a751dba8e9443917c1211617445f3ec8773b7f26))
* add hooks, scripts, CLI infrastructure, and installers ([9b53e0a](https://github.com/jiten-singh-shahi/salesforce-claude-code/commit/9b53e0acfc55e835303460aa74a7772298adb6a7))
* add schemas, install manifests, and MCP configurations ([d722ee7](https://github.com/jiten-singh-shahi/salesforce-claude-code/commit/d722ee7f748807e5ccad61bd3a3d670784db4345))
* add usage examples and assets ([b6b2a8f](https://github.com/jiten-singh-shahi/salesforce-claude-code/commit/b6b2a8f4d4bdc053b5dea820939e8f6eb1e292ae))
* align agents and skills with upgraded CI requirements ([7d6b7fd](https://github.com/jiten-singh-shahi/salesforce-claude-code/commit/7d6b7fd079b74f171809532873091d4f71d7c690))
* create learning-observe.sh hook for continuous learning ([dcebb04](https://github.com/jiten-singh-shahi/salesforce-claude-code/commit/dcebb041d2ecf2846326b68757e8732afda9250a))
* expand sf-e2e-runner agent from 4.4KB to 10.6KB ([a6aca4d](https://github.com/jiten-singh-shahi/salesforce-claude-code/commit/a6aca4d8e10563650692f662cb3d35446cb3484e))
* pre-release consolidation for v0.1.0 ([a2dab5d](https://github.com/jiten-singh-shahi/salesforce-claude-code/commit/a2dab5d4d2b1e2f1f852030b7f7ccbfcf4e7d52f))
* upgrade CI validators with stricter agent and skill checks ([0b8b314](https://github.com/jiten-singh-shahi/salesforce-claude-code/commit/0b8b314dc7200b5c849b6efc16284ec60c9c1a1c))

### Bug Fixes

* align plugin manifests, author metadata, and documentation URL ([e29fa78](https://github.com/jiten-singh-shahi/salesforce-claude-code/commit/e29fa782bfc9f82bb27d90bc6d51685aefc9dd10))
* ci-validate-skill ([382ab96](https://github.com/jiten-singh-shahi/salesforce-claude-code/commit/382ab969041fe37c79b4c15b45ebd916a30df47d))
* regenerate package-lock.json to remove phantom @types/sf-debug ([cb5a338](https://github.com/jiten-singh-shahi/salesforce-claude-code/commit/cb5a338061149eda026a111a5e81cbca8cf14153))
* resolve all markdownlint errors across skills and reference files ([579ee44](https://github.com/jiten-singh-shahi/salesforce-claude-code/commit/579ee447db4665fb7244ef16fc8375e02c3108b8))
* resolve ESLint errors blocking CI ([8b821cd](https://github.com/jiten-singh-shahi/salesforce-claude-code/commit/8b821cd385af8a02529c154bb7289c99e16e002a))
* update install manifests and remove stale hook reference ([c4ce4df](https://github.com/jiten-singh-shahi/salesforce-claude-code/commit/c4ce4dfba53988092336c399d8f314d8dbe03e09))
* update stale references, fix invocability, remove broken hook ([1718184](https://github.com/jiten-singh-shahi/salesforce-claude-code/commit/1718184354225a811ee5d6271acb6d64c39ab36f))

## 1.0.0 (2026-04-03)

### Features

* add 27 specialized Salesforce agents ([8ea9c9b](https://github.com/jiten-singh-shahi/salesforce-claude-code/commit/8ea9c9bd526aa116315221ed32c926560f6dd605))
* add ESLint, markdownlint, validators, and tests to pre-commit hook ([09a5f83](https://github.com/jiten-singh-shahi/salesforce-claude-code/commit/09a5f83bfd1416fef4104fba10e101a808b4dc37))
* add hook script existence validation to CI ([a751dba](https://github.com/jiten-singh-shahi/salesforce-claude-code/commit/a751dba8e9443917c1211617445f3ec8773b7f26))
* add hooks, scripts, CLI infrastructure, and installers ([9b53e0a](https://github.com/jiten-singh-shahi/salesforce-claude-code/commit/9b53e0acfc55e835303460aa74a7772298adb6a7))
* add schemas, install manifests, and MCP configurations ([d722ee7](https://github.com/jiten-singh-shahi/salesforce-claude-code/commit/d722ee7f748807e5ccad61bd3a3d670784db4345))
* add usage examples and assets ([b6b2a8f](https://github.com/jiten-singh-shahi/salesforce-claude-code/commit/b6b2a8f4d4bdc053b5dea820939e8f6eb1e292ae))
* align agents and skills with upgraded CI requirements ([7d6b7fd](https://github.com/jiten-singh-shahi/salesforce-claude-code/commit/7d6b7fd079b74f171809532873091d4f71d7c690))
* create learning-observe.sh hook for continuous learning ([dcebb04](https://github.com/jiten-singh-shahi/salesforce-claude-code/commit/dcebb041d2ecf2846326b68757e8732afda9250a))
* expand sf-e2e-runner agent from 4.4KB to 10.6KB ([a6aca4d](https://github.com/jiten-singh-shahi/salesforce-claude-code/commit/a6aca4d8e10563650692f662cb3d35446cb3484e))
* pre-release consolidation for v0.1.0 ([a2dab5d](https://github.com/jiten-singh-shahi/salesforce-claude-code/commit/a2dab5d4d2b1e2f1f852030b7f7ccbfcf4e7d52f))
* upgrade CI validators with stricter agent and skill checks ([0b8b314](https://github.com/jiten-singh-shahi/salesforce-claude-code/commit/0b8b314dc7200b5c849b6efc16284ec60c9c1a1c))

### Bug Fixes

* align plugin manifests, author metadata, and documentation URL ([e29fa78](https://github.com/jiten-singh-shahi/salesforce-claude-code/commit/e29fa782bfc9f82bb27d90bc6d51685aefc9dd10))
* ci-validate-skill ([382ab96](https://github.com/jiten-singh-shahi/salesforce-claude-code/commit/382ab969041fe37c79b4c15b45ebd916a30df47d))
* regenerate package-lock.json to remove phantom @types/sf-debug ([cb5a338](https://github.com/jiten-singh-shahi/salesforce-claude-code/commit/cb5a338061149eda026a111a5e81cbca8cf14153))
* resolve all markdownlint errors across skills and reference files ([579ee44](https://github.com/jiten-singh-shahi/salesforce-claude-code/commit/579ee447db4665fb7244ef16fc8375e02c3108b8))
* resolve ESLint errors blocking CI ([8b821cd](https://github.com/jiten-singh-shahi/salesforce-claude-code/commit/8b821cd385af8a02529c154bb7289c99e16e002a))
* update install manifests and remove stale hook reference ([c4ce4df](https://github.com/jiten-singh-shahi/salesforce-claude-code/commit/c4ce4dfba53988092336c399d8f314d8dbe03e09))
* update stale references, fix invocability, remove broken hook ([1718184](https://github.com/jiten-singh-shahi/salesforce-claude-code/commit/1718184354225a811ee5d6271acb6d64c39ab36f))

## [Unreleased]

### Changed — Architecture Refactor

* **Agents: 25 → 17** — Lean full-stack domain agents that design, build, test, AND review
  * New orchestrator: `sf-architect` (bookend pattern — runs at start and end, enforces TDD)
  * New domain agents: `sf-apex-agent`, `sf-lwc-agent`, `sf-flow-agent`, `sf-admin-agent`, `sf-integration-agent`, `sf-agentforce-agent`
  * New cross-domain: `sf-review-agent` (security + performance + E2E), `sf-bugfix-agent`
  * Kept legacy review-only: `sf-aura-reviewer`, `sf-visualforce-reviewer`
  * 6 platform agents unchanged
* **Skills: invocability change** — 28 pattern skills changed from user-invocable to model-invocable (agents read them on demand via Read tool)
* **Agent prompt size: 4-10KB → 1-2KB** — Agents are lean workflow orchestrators, skills carry domain knowledge
* **"Use PROACTIVELY" in descriptions** — Enables Claude Code auto-delegation without user asking
* Added proactive delegation check to agent and skill CI validators
* Rewritten sf-help for new 17-agent architecture
* Updated install manifests for new agent filenames
* Added install smoke test job to CI pipeline
* Added SECURITY.md, PR template, hardened .gitignore
* Pre-commit hook now mirrors CI: build + ESLint + markdownlint + validators + tests
