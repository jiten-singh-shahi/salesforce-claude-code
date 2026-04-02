# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed — Architecture Refactor

- **Agents: 25 → 17** — Lean full-stack domain agents that design, build, test, AND review
  - New orchestrator: `sf-architect` (bookend pattern — runs at start and end, enforces TDD)
  - New domain agents: `sf-apex-agent`, `sf-lwc-agent`, `sf-flow-agent`, `sf-admin-agent`, `sf-integration-agent`, `sf-agentforce-agent`
  - New cross-domain: `sf-review-agent` (security + performance + E2E), `sf-bugfix-agent`
  - Kept legacy review-only: `sf-aura-reviewer`, `sf-visualforce-reviewer`
  - 6 platform agents unchanged
- **Skills: invocability change** — 28 pattern skills changed from user-invocable to model-invocable (agents read them on demand via Read tool)
- **Agent prompt size: 4-10KB → 1-2KB** — Agents are lean workflow orchestrators, skills carry domain knowledge
- **"Use PROACTIVELY" in descriptions** — Enables Claude Code auto-delegation without user asking
- Added proactive delegation check to agent and skill CI validators
- Rewritten sf-help for new 17-agent architecture
- Updated install manifests for new agent filenames
- Added install smoke test job to CI pipeline
- Added SECURITY.md, PR template, hardened .gitignore
- Pre-commit hook now mirrors CI: build + ESLint + markdownlint + validators + tests
