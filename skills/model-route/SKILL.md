---
name: model-route
description: >-
  Use when selecting Claude model tier for Salesforce development tasks. Recommend haiku, sonnet,
  or opus based on Apex complexity, deploy risk, and budget.
origin: SCC
user-invocable: true
---

# Model Route — Task-to-Model Tier Recommendation

Recommend the best model tier for the current task by complexity and budget.

## When to Use

- Before starting a task where model choice significantly affects quality or cost
- When deciding between haiku, sonnet, and opus for a Salesforce development task
- When the user wants cost-conscious model selection guidance
- When routing sub-agent work to the appropriate model tier

## Usage

`/model-route [task-description] [--budget low|med|high]`

## Routing Heuristic

- `haiku`: deterministic, low-risk mechanical changes
- `sonnet`: default for implementation and refactors
- `opus`: architecture, deep review, ambiguous requirements

> Model names (haiku, sonnet, opus) refer to the current Claude model mapped to that tier in your Claude Code configuration.

## Output Format

- recommended model
- confidence level
- why this model fits
- fallback model if first attempt fails

## Salesforce Routing Examples

### Opus — Complex Reasoning Tasks

Use `opus` when the task requires deep understanding of Salesforce architecture, security implications, or governor limit analysis across multiple execution paths.

| Task | Why Opus |
|------|----------|
| Governor limit audit across trigger/flow/batch chains | Must trace cumulative DML/SOQL across async boundaries, understand order of execution, and reason about worst-case heap/CPU scenarios |
| Security review of `@RestResource` or `with sharing`/`without sharing` decisions | Requires nuanced reasoning about record access, CRUD/FLS enforcement, SOQL injection vectors, and org-wide defaults |
| Architecture review for large-scale data model changes | Must evaluate cascade effects on triggers, flows, validation rules, sharing rules, and downstream integrations |

### Haiku — Mechanical / Low-Risk Tasks

Use `haiku` when the task is deterministic, well-scoped, and unlikely to have subtle correctness issues.

| Task | Why Haiku |
|------|-----------|
| Formatting LWC components (fix indentation, add missing `@api` decorators) | Purely mechanical — no logic changes, just style compliance |
| Simple Apex fixes (rename a variable, fix a typo in a label, add a missing null check) | Single-line or few-line changes with obvious correctness |
| Adding `<meta.xml>` boilerplate or updating `apiVersion` across components | Repetitive, pattern-based edits with no ambiguity |

### Sonnet — Balanced Implementation Tasks

Use `sonnet` (default) for standard development work that requires understanding but follows well-known patterns.

| Task | Why Sonnet |
|------|------------|
| Code review of an Apex trigger handler or service class | Needs to understand patterns and spot issues, but follows standard review criteria |
| Generating Apex test classes with `@TestSetup`, mocking, and assertions | Requires understanding the class under test, but test generation follows repeatable patterns |
| Implementing a new LWC component with wire adapters and error handling | Standard implementation work — needs context awareness but not deep architectural reasoning |

## Arguments

- `[task-description]` optional free-text
- `--budget low|med|high` optional

## Examples

```
/model-route Review the sharing model for the new Patient__c object hierarchy
/model-route Fix the CSS alignment on the accountDashboard LWC --budget low
/model-route Generate test coverage for OpportunityTriggerHandler
/model-route Audit all SOQL queries in force-app for governor limit risks --budget high
```
