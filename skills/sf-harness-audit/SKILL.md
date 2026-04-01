---
name: sf-harness-audit
description: >-
  Use when auditing SCC harness for Salesforce development completeness. Check hooks, agents, skills,
  and rules health for Apex and LWC coverage, and score each category.
origin: SCC
user-invocable: true
---

# SCC Harness Audit — Configuration Health Check

Evaluate the SCC harness configuration and suggest improvements. Checks file existence, content coverage, hook status, and rule completeness.

## When to Use

- When you want to verify that SCC is fully and correctly installed in a project
- When diagnosing issues with hooks, agents, skills, or rules not activating
- When preparing for a quality audit or compliance review of your SCC configuration
- When comparing your current installation against the full SCC profile
- When you want actionable recommendations to improve your SCC setup

## Workflow

### Step 1 — Scan Installation

Check what's installed in the current project:

```bash
# Check for SCC installation markers
ls -la .claude/hooks/ 2>/dev/null
ls -la .claude/agents/ 2>/dev/null
ls -la .claude/skills/ 2>/dev/null
```

If using SCC CLI: `npx scc status`

### Step 2 — Score Each Category

Rate each category 0-10 using these rubrics:

**Hook Coverage (0-10)**

| Score | Criteria |
|-------|----------|
| 0-3 | No hooks or only SessionStart |
| 4-6 | Quality-gate and governor-check active, but missing pre-tool-use hooks |
| 7-8 | All standard profile hooks active |
| 9-10 | Strict profile enabled, all hooks active including Code Analyzer integration |

Check: `cat .claude/hooks/hooks.json | grep -c '"command"'` to count active hooks.
Check: `echo $SCC_HOOK_PROFILE` to verify profile level.

**Agent Coverage (0-10)**

| Score | Criteria |
|-------|----------|
| 0-3 | Only platform agents (loop-operator, doc-updater) |
| 4-6 | Core domain agents (sf-architect, sf-apex-agent, sf-review-agent) |
| 7-8 | Full domain agents (+ sf-lwc-agent, sf-flow-agent, sf-integration-agent) |
| 9-10 | Complete coverage including sf-admin-agent, sf-agentforce-agent, sf-bugfix-agent |

Check: `ls .claude/agents/sf-*.md 2>/dev/null | wc -l`

**Skill Coverage (0-10)**

| Score | Criteria |
|-------|----------|
| 0-3 | Less than 10 skills |
| 4-6 | 10-20 skills, core SF patterns covered |
| 7-8 | 20-35 skills, enterprise patterns included |
| 9-10 | 35+ skills with full domain coverage |

Check: `find .claude/skills/ -name "SKILL.md" | wc -l`

**Skill Coverage (User-Invocable) (0-10)**

| Score | Criteria |
|-------|----------|
| 0-3 | Only basic skills (sf-blueprint-planner agent, sf-apex-best-practices) |
| 4-6 | Core workflow skills (sf-deployment, sf-debugging, sf-security) |
| 7-8 | Testing and security skills (sf-tdd-workflow, sf-governor-limits) |
| 9-10 | Full suite including discovery (/sf-help, /sf-quickstart) |

Check: `ls .claude/skills/sf-*/SKILL.md 2>/dev/null | wc -l`

**Security Posture (0-10)**

| Score | Criteria |
|-------|----------|
| 0-3 | No security hooks or rules |
| 4-6 | Security rules present, quality-gate active |
| 7-8 | Governor-check active, sharing model detection, CRUD/FLS rules |
| 9-10 | Strict profile, Code Analyzer integration, security-reviewer agent active |

### Step 3 — Generate Report

```text
SCC Harness Audit
══════════════════════════════════════════
  Profile:        standard
  Version:        1.0.0
  Install Target: claude

  Category Scores:
    Hook Coverage:     7/10
    Agent Coverage:    8/10
    Rule Coverage:     6/10
    Skill Coverage:    7/10
    Skill (Invocable): 8/10
    Security Posture:  7/10
    ────────────────────────
    Overall Score:     7.2/10

  Top Recommendations:
    1. [+1.0] Enable strict hook profile: export SCC_HOOK_PROFILE=strict
    2. [+0.5] Install all modules: npx scc install all
```

### Step 4 — Actionable Recommendations

For each gap, provide a specific command to fix it:

| Gap | Fix Command |
|-----|-------------|
| Missing hooks | `npx scc repair` |
| Missing domain rules | `npx scc install all` (or target: `npx scc install apex`, `npx scc install lwc`) |
| Low skill count | `npx scc install all` |
| Wrong hook profile | `export SCC_HOOK_PROFILE=strict` |
| Drifted files | `npx scc doctor` then `npx scc repair` |

## Examples

```
sf-harness-audit
sf-harness-audit Check if all Salesforce domains are covered by agents and skills
sf-harness-audit Report gaps in hook coverage and recommend improvements
sf-harness-audit Score the security posture of the current SCC installation
```

## Related

- **Skill**: `/sf-harness-audit` — This skill is the audit tool; no separate agent exists
