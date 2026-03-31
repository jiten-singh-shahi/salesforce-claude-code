---
name: checkpoint
description: >-
  Use when saving Salesforce development progress. Create a named checkpoint via git stash before risky
  Apex deploys or org changes for easy recovery.
origin: SCC
user-invocable: true
disable-model-invocation: true
---

# Checkpoint — Named Progress Snapshots

Save current progress as a named checkpoint for easy recovery.

## When to Use

- When you want to save work-in-progress before attempting a risky change
- When starting a refactoring pass and need a safe rollback point
- When switching between tasks and want to preserve current state
- When you need to snapshot progress at key milestones during a long session
- When collaborating and want to share a recoverable state with another agent or session

## Usage

```text
checkpoint [name]
```

## Workflow

1. **Create checkpoint** — `git stash push --include-untracked -m "checkpoint: <name> [<timestamp>]"`
2. **Log metadata** — Append to `.claude/checkpoints.log`:
   - Timestamp
   - Checkpoint name
   - Files changed (count)
   - Current branch
3. **Verify** — Confirm working tree is clean after stash

## Operations

- `checkpoint save <name>` — Create new checkpoint
- `checkpoint list` — Show all checkpoints from log
- `checkpoint restore <name>` — Apply the named stash (`git stash apply`; keeps the stash entry safe). Find the stash reference via `git stash list | grep "<name>"`, then `git stash apply stash@{N}`. After verifying the restore, drop with `git stash drop stash@{N}`.
- `checkpoint verify` — Verify current state matches last checkpoint

## Examples

```
checkpoint save before-trigger-refactor
checkpoint list
checkpoint restore before-trigger-refactor
checkpoint verify
```
