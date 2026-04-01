# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Migrated 6 orchestration skills to agents per Law 4 ("Agents sequence, skills teach"):
  - `verification-loop` → `sf-verification-runner` agent
  - `blueprint` → `sf-blueprint-planner` agent
  - `deep-research` → `deep-researcher` agent
  - `eval-harness` → `eval-runner` agent
  - `continuous-learning-v2` → `learning-engine` agent
  - `skill-stocktake` → merged into `sf-harness-optimizer` agent
- Hook path `skills/continuous-learning-v2/hooks/observe.sh` → `scripts/hooks/learning-observe.sh`
- Consolidated to 25 agents and 55 skills (35 user-invocable, 20 auto-activating)
- Removed phantom agents: sf-planner, sf-soql-optimizer, sf-chief-of-staff, sf-data-architect, sf-harness-optimizer, sf-docs-lookup (agent), sf-devops-guide, sf-deployment-guide
- Removed phantom skills: sf-package-development, sf-docker-patterns, sf-metadata-migrations, sf-scratch-org-workflow, sf-reporting-dashboards
- Upgraded CI validators: description limits 100-250 chars, SF keyword requirements, body structure checks, readonly/tools consistency
- Aligned CI validators (validate-agents.js, validate-skills.js) with architect Python validators (validate_agent.py, validate_skill.py)
- Renamed `### Constraints` → `### Guardrails` in 12 action skills to prevent constraint misclassification
- Fixed install manifests to remove stale references and add missing constraint skills
- Added release-please config for auto-bumping all plugin manifest versions
- Removed premature docs/releases/ directory (release-please generates release notes)
