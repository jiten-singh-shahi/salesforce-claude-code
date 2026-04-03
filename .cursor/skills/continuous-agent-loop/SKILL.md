---
name: continuous-agent-loop
description: >-
  Use when building autonomous Claude Code loops for Salesforce Apex and LWC projects. Patterns from sequential pipelines to RFC-driven multi-agent DAG systems with quality gates. Do NOT use for single-shot Apex tasks.
---

# Continuous Agent Loop

Patterns, architectures, and reference implementations for running Claude Code autonomously in loops on Salesforce projects. Covers sequential `claude -p` pipelines through RFC-driven multi-agent DAG orchestration with Apex test gates.

## When to Use

- Setting up autonomous Salesforce development workflows (Apex TDD cycles, LWC iteration)
- Choosing the right loop architecture for your problem (simple deploy vs complex feature)
- Building CI/CD-style continuous development pipelines with SF CLI gates
- Running parallel agents for multi-layer Salesforce work (Apex + LWC + Integration)
- Adding quality gates (governor limits, coverage thresholds) to autonomous workflows

## Loop Selection Flow

```text
Start
  |
  +-- Need strict CI/PR control? -- yes --> continuous-pr
  |
  +-- Need RFC decomposition? -- yes --> rfc-dag
  |
  +-- Need exploratory parallel generation? -- yes --> infinite
  |
  +-- default --> sequential
```

## Loop Pattern Spectrum

| Pattern | Complexity | Best For |
|---------|-----------|----------|
| [Sequential Pipeline](#1-sequential-pipeline) | Low | Daily Apex dev steps, scripted SFDX workflows |
| [Infinite Agentic Loop](#2-infinite-agentic-loop) | Medium | Parallel Apex/LWC generation from a spec |
| [Continuous Claude PR Loop](#3-continuous-claude-pr-loop) | Medium | Multi-day Apex TDD iterations with CI gates |
| [De-Sloppify Pattern](#4-the-de-sloppify-pattern) | Add-on | Quality cleanup after any Implementer step |
| [Ralphinho / RFC-Driven DAG](#5-ralphinho--rfc-driven-dag) | High | Large Salesforce features with parallel units and merge queue |

---

## 1. Sequential Pipeline

**The simplest loop.** Chain `claude -p` calls — each is a focused step with a clear prompt.

```bash
#!/bin/bash
set -e

# Step 1: Implement with TDD
claude -p "Read docs/order-service-spec.md. Implement OrderService.cls with TDD.
Target 85% coverage. No SOQL or DML inside for loops."

# Step 2: De-sloppify
claude -p "Review changes. Remove: unnecessary null checks, tests verifying platform
behavior, System.debug statements, commented-out code.
Run 'sf apex run test --class-names OrderServiceTest' after cleanup."

# Step 3: Verify
claude -p "Run 'sf project deploy start --dry-run --source-dir force-app/main/default/classes'.
Fix any failures. Do not add new features."

# Step 4: Commit
claude -p "Commit with message: feat: add order service with test coverage"
```

**Variations:** Use `--model opus` for architecture analysis, `--model haiku` for simple fixes. Use `--allowedTools "Read,Grep,Glob"` for read-only analysis passes.

---

## 2. Infinite Agentic Loop

**Two-prompt system** for parallel sub-agents. Useful for generating multiple Apex test class variants or LWC component iterations from a spec.

```
PROMPT 1 (Orchestrator)              PROMPT 2 (Sub-Agents)
┌─────────────────────┐             ┌──────────────────────┐
│ Parse spec file      │             │ Receive full context  │
│ Scan output dir      │  deploys   │ Read assigned number  │
│ Plan iteration       │────────────│ Follow spec exactly   │
│ Assign creative dirs │  N agents  │ Generate unique output │
└─────────────────────┘             └──────────────────────┘
```

### Key Insight: Uniqueness via Assignment

Don't rely on agents to self-differentiate. The orchestrator **assigns** each agent a specific test scenario and iteration number. Batching: 1-5 simultaneously, 6-20 in batches of 5, infinite in waves of 3-5.

---

## 3. Continuous Claude PR Loop

**Production-grade shell script** that runs Claude Code in a continuous loop, creating PRs, waiting for CI (including Apex test runs), and merging automatically.

```
┌─────────────────────────────────────────────────────┐
│  1. Create branch (continuous-claude/iteration-N)   │
│  2. Run claude -p with Apex TDD prompt              │
│  3. (Optional) Reviewer pass                        │
│  4. Commit + Push + Create PR                       │
│  5. Wait for CI (sf apex run test --code-coverage)  │
│  6. CI failure? → Auto-fix pass (claude -p)         │
│  7. Merge PR (squash) → Return to main → repeat     │
│  Limit by: --max-runs N | --max-cost $X             │
└─────────────────────────────────────────────────────┘
```

### Cross-Iteration Context: SHARED_TASK_NOTES.md

The critical innovation — a file that persists across iterations:

```markdown
## Progress
- [x] OrderService.cls — 82% coverage (iteration 1)
- [ ] OrderController.cls — 45% coverage, needs work

## Next Steps
- Focus on OrderController.cls
- Named credential for external API is set up
```

Claude reads this at iteration start, updates at iteration end.

---

## 4. The De-Sloppify Pattern

**Add-on for any loop.** When you ask an LLM to implement Apex with TDD, it over-tests:

- Tests verifying Salesforce platform behavior
- Defensive null checks for schema-guaranteed fields
- Excessive try/catch blocks

**Solution:** Don't constrain the Implementer — let it be thorough. Then add a focused cleanup pass:

```bash
# Implement (thorough)
claude -p "Implement OrderService.cls with full TDD."

# De-sloppify (separate context)
claude -p "Review changes. Remove tests for platform behavior, redundant null checks,
System.debug statements, commented-out code. Run 'sf apex run test' after cleanup."
```

> Two focused agents outperform one constrained agent.

---

## 5. Ralphinho / RFC-Driven DAG

**Most sophisticated.** RFC-driven pipeline that decomposes a Salesforce feature into a dependency DAG, runs each unit through quality stages, and lands via merge queue.

```
Salesforce RFC/PRD
       │
  DECOMPOSITION (sf-architect)
  Break into: Apex → LWC → Integration → Metadata layers
       │
┌──────────────────────────────────────────────────┐
│  For each DAG layer (sequential, by dependency): │
│                                                  │
│  Quality Pipelines (parallel per unit):          │
│  Research → Plan → Implement → Test → Review     │
│  Apex: governor check + ≥75% coverage gate       │
│  LWC: Jest tests + accessibility check           │
│                                                  │
│  Merge Queue:                                    │
│  Rebase → sf deploy validate → Apex tests →      │
│  Pass → Land  |  Fail → Evict + re-enter         │
└──────────────────────────────────────────────────┘
```

### Complexity Tiers

| Tier | Pipeline Stages |
|------|----------------|
| **trivial** | implement → sf deploy validate |
| **small** | implement → apex test → code-review |
| **medium** | research → plan → implement → apex test → governor-check → review-fix |
| **large** | + sf-architect final review |

### When to Use Ralphinho vs SCC-Native

| Signal | Ralphinho | SCC-Native |
|--------|----------|------------|
| 10+ interdependent work units | Yes | No |
| Need worktree isolation | Yes | No |
| Single feature with 3 layers | No | Yes |
| Quick Apex + LWC iteration | No | Yes |

---

## Salesforce Loop Patterns

| Pattern | Loop Type | Stop Condition |
|---------|-----------|---------------|
| **Governor Fix** | sequential | No more governor violations |
| **Coverage Ramp** | sequential | All classes at 75%+ (85% target) |
| **PB→Flow Migration** | continuous-pr | All Process Builders converted |
| **Trigger Framework Migration** | sequential | All triggers use handler pattern |
| **Deployment Monitor** | infinite (30s) | Deploy succeeds/fails/cancelled |

### SF-Specific Checkpoint Format

```
── SF Checkpoint #N ────────────────────────
  Apex Tests:    142/145 passing (+3)
  Coverage:      78% → 82% (target: 85%)
  Governor:      2 violations remaining (was 8)
  Deploy:        Validates against scratch org
  Iteration:     N/max
────────────────────────────────────────────
```

---

## Choosing the Right Pattern

```
Is the task a single focused Salesforce change?
├─ Yes → Sequential Pipeline
└─ No → Is there a written RFC/spec?
         ├─ Yes → Need parallel layers?
         │        ├─ Yes → RFC-Driven DAG
         │        └─ No → Continuous Claude PR Loop
         └─ No → Need many variants from a spec?
                  ├─ Yes → Infinite Agentic Loop
                  └─ No → Sequential + De-Sloppify
```

### Combining Patterns

1. **Sequential + De-Sloppify** — Most common. Every Apex implement step gets a cleanup pass.
2. **Continuous Claude + De-Sloppify** — Add `--review-prompt` with de-sloppify directive.
3. **Any loop + Quality Gates** — Use the `sf-review-agent` agent as a gate before commits.
4. **Model routing** — `--model haiku` for simple fixes, `--model opus` for architecture.

## Anti-Patterns

1. **Infinite loops without exit conditions** — Always have max-runs, max-cost, or completion signal.
2. **No context bridge** — Use `SHARED_TASK_NOTES.md` to bridge `claude -p` invocations.
3. **Retrying same failure** — Capture failure output and feed to next attempt.
4. **Negative instructions instead of cleanup** — Don't say "don't add System.debug." Add a separate de-sloppify pass.
5. **All agents in one context** — Separate concerns into different agent processes.
6. **Ignoring deploy dependency order** — Apex before LWC before metadata.

## References

| Project | Author | SCC Context |
|---------|--------|-------------|
| Ralphinho | enitrat | Adapted for Salesforce layers |
| Infinite Agentic Loop | disler | Useful for Apex test generation |
| Continuous Claude | AnandChowdhary | Use with sf apex run test as CI gate |

## Related

- **Agent**: `loop-operator` — For monitoring and managing autonomous agent loops
