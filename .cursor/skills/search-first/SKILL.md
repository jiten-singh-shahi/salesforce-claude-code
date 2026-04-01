---
name: search-first
description: >-
  Use when researching existing Salesforce tools, Apex libraries, or metadata patterns before writing custom code. Search-first workflow with agent. Do NOT use for implementing code — only for discovery and evaluation.
---

# /search-first — Research Before You Code

Systematizes the "search for existing solutions before implementing" workflow.

## When to Use

- Before writing any custom utility, library, or integration code
- When evaluating whether to use npm, AppExchange, or MCP packages for a requirement
- When starting a new feature that likely has existing open-source or platform solutions
- When deciding between adopting, extending, composing, or building custom code
- When the user asks to "add X functionality" and you're about to write net-new code

## Workflow

```
+---------------------------------------------+
|  1. NEED ANALYSIS                           |
|     Define what functionality is needed      |
|     Identify language/framework constraints  |
+---------------------------------------------+
|  2. PARALLEL SEARCH (general-purpose agent)  |
|     +----------+ +----------+ +----------+  |
|     |  npm /   | |  MCP /   | |  GitHub / |  |
|     |  AppExch | |  Skills  | |  Web      |  |
|     +----------+ +----------+ +----------+  |
+---------------------------------------------+
|  3. EVALUATE                                |
|     Score candidates (functionality, maint, |
|     community, docs, license, deps)         |
+---------------------------------------------+
|  4. DECIDE                                  |
|     +---------+  +----------+  +---------+  |
|     |  Adopt  |  |  Extend  |  |  Build   |  |
|     | as-is   |  |  /Wrap   |  |  Custom  |  |
|     +---------+  +----------+  +---------+  |
+---------------------------------------------+
|  5. IMPLEMENT                               |
|     Install package / Configure MCP /       |
|     Write minimal custom code               |
+---------------------------------------------+
```

## Decision Matrix

| Signal | Action |
|--------|--------|
| Exact match, well-maintained, MIT/Apache | **Adopt** — install and use directly |
| Partial match, good foundation | **Extend** — install + write thin wrapper |
| Multiple weak matches | **Compose** — combine 2-3 small packages |
| Nothing suitable found | **Build** — write custom, but informed by research |

## How to Use

### Quick Mode (inline)

Before writing a utility or adding functionality, mentally run through:

0. Does this already exist in the repo? -> `rg` through relevant modules/tests first
1. Is this a common problem? -> Search npm/AppExchange
2. Is there an MCP for this? -> Check `~/.claude/settings.json` and search
3. Is there a skill for this? -> Check `~/.claude/skills/`
4. Is there a GitHub implementation/template? -> Run GitHub code search

### Full Mode (agent)

For non-trivial functionality, launch a general-purpose agent:

```
Task(subagent_type="general-purpose", prompt="
  Research existing tools for: [DESCRIPTION]
  Language/framework: [LANG]
  Constraints: [ANY]

  Search: npm/AppExchange, MCP servers, Claude Code skills, GitHub
  Return: Structured comparison with recommendation
")
```

## Salesforce-Specific Tool Discovery

| Category | Tools to Check | Notes |
|----------|---------------|-------|
| **Testing** | ApexMocks, FFLib, at4dx, Apex Replay Debugger | FFLib is the industry standard |
| **CI/CD** | CumulusCI, sfdx-git-delta, sf scanner, GitHub Actions | sfdx-git-delta for delta deployments |
| **Data** | SFDX Data Loader, DLRS (Declarative Lookup Rollup Summary), DataWeave | DLRS replaces rollup trigger code |
| **Security** | Shield Platform Encryption, Event Monitoring, SF Code Analyzer | Scanner catches PMD violations |
| **Documentation** | ApexDox, SfApexDoc | Auto-generate Apex docs |
| **MCP** | @salesforce/mcp (official), community MCP servers | Check official first |
| **Package Mgmt** | CumulusCI, SFDX Package commands | For managed/unlocked packages |

### MCP Server Evaluation

Before building custom tooling, check if an MCP server handles it:

1. **@salesforce/mcp** (official) — orgs, metadata, data, testing, code-analysis, LWC, DevOps
2. **Community MCP servers** — search npm for `mcp` + your domain
3. **Build custom only if** — no existing server covers your specific business logic

### Salesforce Decision Examples

**Scenario 1: "We need rollup summary fields on lookup relationships"**

```
Search: AppExchange "rollup summary lookup"
Found: DLRS (Declarative Lookup Rollup Summaries) — 4.8★, 5000+ installs
Decision: ADOPT — install DLRS, configure declaratively
Result: Zero custom Apex code for rollup calculations
```

**Scenario 2: "We need delta deployments in CI"**

```
Search: npm "salesforce delta deployment"
Found: sfdx-git-delta — actively maintained, 1000+ stars
Decision: ADOPT — add as sf plugin, configure in GitHub Actions
Result: Deploy only changed metadata, 10x faster CI
```

**Scenario 3: "We need custom approval routing based on territory"**

```
Search: AppExchange "dynamic approval routing territory"
Found: Several packages but none match exact business rules
Decision: BUILD — custom Apex approval process with territory-based routing
Result: Custom code, but informed by research (knew no package fit)
```

## Anti-Patterns

- **Jumping to code**: Writing a utility without checking if one exists
- **Ignoring MCP**: Not checking if an MCP server already provides the capability
- **Over-customizing**: Wrapping a library so heavily it loses its benefits
- **Not checking AppExchange**: Many common patterns have managed packages with support
- **Reinventing DLRS**: Writing rollup trigger code when DLRS handles it declaratively
