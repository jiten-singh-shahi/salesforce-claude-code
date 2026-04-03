---
name: sf-quickstart
description: >-
  Use when setting up SCC on a Salesforce project. Detect Apex, LWC, or mixed
  project type, recommend configuration, install appropriate profile.
origin: SCC
user-invocable: true
---

# SCC Quickstart — Interactive Onboarding

Interactive onboarding for Salesforce Claude Code. Detects your project setup and recommends the right SCC configuration.

## When to Use

- When setting up SCC for the first time on a Salesforce project
- When onboarding a new developer to an existing Salesforce org or project
- When you need to detect the project's tech stack and recommend the right SCC install profile
- When verifying that SCC is properly installed and configured
- When switching projects and need to reconfigure SCC for a different project type

## Workflow

### Step 1 — Detect Project Context

Check for Salesforce project markers:

```bash
# Core project file (required for SF project)
cat sfdx-project.json 2>/dev/null

# Scratch org definition
cat config/project-scratch-def.json 2>/dev/null

# Deployment config
cat .forceignore 2>/dev/null | head -5

# Node.js tooling
cat package.json 2>/dev/null | grep -A5 '"scripts"'

# SF CLI version
sf --version 2>/dev/null
```

If `sfdx-project.json` does not exist, this is not a Salesforce project. Report that and suggest running `/sf-help` for general SCC guidance.

### Step 2 — Analyze Tech Stack

Scan the project to detect what technologies are in use:

```bash
# Apex classes (not test classes)
find force-app -name "*.cls" 2>/dev/null | grep -v -E '(Test\.cls$|_Test\.cls$|TestUtils|TestData|TestFactory|TestHelper)' | wc -l

# Apex test classes
find force-app -name "*.cls" 2>/dev/null | grep -E '(Test\.cls$|_Test\.cls$|TestUtils|TestData|TestFactory|TestHelper)' | wc -l

# Apex triggers
find force-app -name "*.trigger" 2>/dev/null | wc -l

# LWC components
find force-app -path "*/lwc/*" -name "*.js" -not -name "*.test.js" 2>/dev/null | wc -l

# Aura components
find force-app -path "*/aura/*" -name "*.cmp" 2>/dev/null | wc -l

# Visualforce pages
find force-app -name "*.page" 2>/dev/null | wc -l

# Flows
find force-app -name "*.flow-meta.xml" 2>/dev/null | wc -l

# Custom objects
find force-app -name "*.object-meta.xml" 2>/dev/null | wc -l
```

> Naive test detection with `find force-app -name "*Test.cls"` misses patterns like `*_Test.cls`, `TestUtils.cls`, `TestDataFactory.cls`, and `TestHelper.cls`. The commands above catch all standard patterns.

### Step 3 — Recommend Install Profile

Based on detection results, recommend the best SCC profile:

| Detected Stack | Recommended Profile | Command |
|---------------|--------------------|---------|
| Apex + LWC + Flows + triggers | `all` | `npx scc-universal install all` |
| Primarily Apex (classes + triggers) | `apex` | `npx scc-universal install apex` |
| Primarily LWC with some Apex | `lwc` | `npx scc-universal install lwc` |

**Profile details:**

| Profile | Agents | Skills (user-invocable) | Rules | Hooks |
|---------|--------|------------------------|-------|-------|
| `apex` | 12 | 22 (14) | common + apex + soql | all |
| `lwc` | 10 | 18 (12) | common + lwc | all |
| `all` | 27 | 45 (26) | all domains | all |

### Step 4 — Suggest First Commands

Based on the project state, suggest 3-5 commands to start with:

| Project State | Suggested Action |
|--------------|-----------------|
| No test classes found | `sf-tdd-workflow` skill -- start writing tests |
| Triggers without handler classes | `sf-trigger-frameworks` skill -- refactor to handler pattern |
| Low test coverage | `sf-apex-testing` skill -- analyze gaps |
| Deployment files present | `sf-deployment` skill -- pre-deployment check |
| Security review needed | `sf-security` skill -- full security audit |
| Build errors | `sf-build-fix` -- fix build and deployment errors |
| Any project | `/sf-help` -- browse all available commands and skills |

### Step 5 — Verify SCC Installation

Check that SCC is properly configured:

```bash
# Check hooks are loaded
test -f .claude/settings.json && grep -q '"hooks"' .claude/settings.json 2>/dev/null && echo "Hooks: ACTIVE (in settings.json)" || echo "Hooks: MISSING (run npx scc-universal install)"

# Check hook profile
echo "Hook Profile: ${SCC_HOOK_PROFILE:-standard (default)}"

# Check for governor-check hook
grep -q "governor-check" .claude/settings.json 2>/dev/null && echo "Governor Check: ACTIVE" || echo "Governor Check: MISSING"

# Check for quality-gate hook
grep -q "quality-gate" .claude/settings.json 2>/dev/null && echo "Quality Gate: ACTIVE" || echo "Quality Gate: MISSING"
```

### Step 6 — Report

Present findings in this format:

```text
SCC Quickstart Report
======================================

Project: my-salesforce-app
SF CLI:  @salesforce/cli/2.x.x

Tech Stack Detected:
  Apex Classes:    45 (32 test classes)
  Apex Triggers:    8
  LWC Components:  12
  Aura Components:  3 (consider migration)
  Flows:            6
  Custom Objects:  15

Recommended Profile: all
  -> npx scc-universal install all

SCC Status:
  Hooks:         ACTIVE (standard profile)
  Governor Check: ACTIVE
  Quality Gate:  ACTIVE

Suggested Next Steps:
  1. sf-trigger-frameworks skill -- 3 triggers without handler classes detected
  2. sf-apex-testing skill -- Current coverage unknown, run analysis
  3. sf-security skill -- Verify CRUD/FLS before next deployment
  4. /sf-help -- Browse all available commands and skills
```

## Examples

```
sf-quickstart
sf-quickstart Set up SCC for my new Salesforce DX project
sf-quickstart What SCC profile should I use for an ISV package?
```

## Related

- **Constraints**: (none -- this is an onboarding workflow)
