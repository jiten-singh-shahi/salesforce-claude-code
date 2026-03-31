# Memory Persistence Hooks

This directory documents the memory persistence hook lifecycle used by SCC to maintain cross-session continuity for Salesforce development work.

## Overview

SCC persists session state through three coordinated hooks:

```
SessionStart
    └── session-start.js  ← Restores prior session context (org, branch, last task)

Stop / SessionEnd
    ├── session-end.js    ← Captures session summary (files changed, commands run, next steps)
    └── evaluate-session.js ← Scores session for extractable patterns, triggers learning
```

## Hook Scripts

### `scripts/hooks/session-start.js`

Runs at `SessionStart`. Reads the persisted session state from `~/.claude/sessions/<project-hash>/last-session.json` and:

- Displays detected Salesforce org (scratch org or sandbox)
- Shows the branch currently checked out
- Reminds about any open tasks from the prior session
- Prints CLI version check results

### `scripts/hooks/session-end.js`

Runs at `Stop`. Captures:

- Files modified during the session (Apex, LWC, SOQL, Flow)
- Salesforce CLI commands executed
- Test run outcomes (pass/fail counts)
- Suggested next steps for the next session

Writes to `~/.claude/sessions/<project-hash>/last-session.json`.

### `scripts/hooks/evaluate-session.js`

Runs at `Stop` after `session-end.js`. Reads the session summary and scores it for extractable patterns:

- Detects repeated workflows (e.g., always runs tests after deploy)
- Flags anti-patterns corrected during session
- Feeds signal to learning-engine observer if enabled

## Storage Layout

```
~/.claude/sessions/
  <project-hash>/
    last-session.json   ← Last session summary (restored on next SessionStart)
    history.jsonl       ← Append-only session history log
```

## Configuration

Memory persistence is always enabled. It cannot be disabled via `SCC_HOOK_PROFILE`.

To clear session state for a project:

```bash
rm ~/.claude/sessions/<project-hash>/last-session.json
```

## Profile Gating

| Hook | minimal | standard | strict |
|------|---------|----------|--------|
| session-start.js | enabled | enabled | enabled |
| session-end.js | — | enabled | enabled |
| evaluate-session.js | — | enabled | enabled |
