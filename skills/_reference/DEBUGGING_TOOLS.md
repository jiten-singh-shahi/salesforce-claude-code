<!-- Source: https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_debugging.htm -->
<!-- Last verified: API v66.0 — 2026-03-29 -->
<!-- WARNING: Web fetch of canonical URL failed (LWR client-side rendering). Facts below extracted from sf-debugging skill. -->

# Debugging Tools — Reference

## Debug Log Limits

| Limit | Value |
|-------|-------|
| Maximum debug log size | **20 MB** (truncated from middle if exceeded) |
| Maximum SOQL queries per transaction | 100 |
| Maximum DML statements per transaction | 150 |
| Maximum DML rows per transaction | 10,000 |
| Maximum SOSL queries per transaction | 20 |
| Maximum query rows per transaction | 50,000 |
| Maximum CPU time (sync) | 10,000 ms |
| Maximum heap size (sync) | 6,000,000 bytes (6 MB) |

## Debug Log Categories and Levels

| Category | Available Levels | What It Logs |
|----------|-----------------|--------------|
| `APEX_CODE` | NONE, ERROR, WARN, INFO, DEBUG, FINE, FINER, FINEST | Apex statements, `System.debug()` |
| `APEX_PROFILING` | NONE, INFO, FINE | Limits usage, performance timing |
| `CALLOUT` | NONE, INFO, FINE | HTTP callout request/response |
| `DB` | NONE, INFO, FINE, FINER | SOQL, SOSL, DML operations |
| `SYSTEM` | NONE, DEBUG, FINE | System events (async jobs, etc.) |
| `VALIDATION` | NONE, INFO | Validation rule evaluation |
| `WORKFLOW` | NONE, INFO | Workflow rules, Process Builder |
| `VISUALFORCE` | NONE, INFO, FINE, FINER, FINEST | Visualforce page rendering |
| `NBA` | NONE, INFO | Einstein Next Best Action |

## Recommended Debug Level Presets

| Scenario | APEX_CODE | APEX_PROFILING | CALLOUT | DB | SYSTEM |
|----------|-----------|---------------|---------|-----|--------|
| Standard Debugging | DEBUG | INFO | INFO | INFO | DEBUG |
| Performance Investigation | FINE | FINE | FINE | FINE | FINE |
| Callout Debugging | DEBUG | — | FINE | INFO | — |

## Debug Log Access Methods

| Method | Command / Steps |
|--------|----------------|
| SF CLI: Stream live | `sf apex tail log --target-org myOrg` |
| SF CLI: With debug level | `sf apex tail log --target-org myOrg --debug-level SFDC_DevConsole` |
| SF CLI: Get specific log | `sf apex get log --log-id 07L... --target-org myOrg` |
| SF CLI: List logs | `sf apex list log --target-org myOrg` |
| SF CLI: Run anonymous Apex | `sf apex run --file scripts/apex/debug-script.apex --target-org myOrg` |
| Setup UI | Setup > Debug Logs > New (Monitored Users) |
| Developer Console | Debug > Change Log Levels |

## Critical Log Markers

| Marker | Meaning |
|--------|---------|
| `SOQL_EXECUTE_BEGIN` | SOQL query started (count toward 100 limit) |
| `SOQL_EXECUTE_END` | SOQL query completed (includes row count) |
| `DML_BEGIN` / `DML_END` | DML operation (count toward 150 limit) |
| `CUMULATIVE_LIMIT_USAGE` | Limits summary at transaction end |
| `FATAL_ERROR` | Uncaught exception |
| `EXCEPTION_THROWN` | Any exception (caught or uncaught) |
| `USER_DEBUG` | `System.debug()` output |
| `HEAP_ALLOCATE` | Large memory allocation |
| `EXECUTION_STARTED` / `EXECUTION_FINISHED` | Transaction boundaries |
| `CODE_UNIT_STARTED` | Trigger, class, or anonymous Apex entry |

## Developer Console Features

| Feature | Shortcut / Access |
|---------|-------------------|
| Execute Anonymous Apex | Ctrl+E / Cmd+E |
| Query Editor | Tab in Developer Console |
| Query Plan (Explain) | "Query Plan" button in Query Editor |
| Checkpoints (heap inspection) | Debug > Add/Remove Checkpoint on a code line |
| Checkpoint Inspector | Debug > Checkpoint Inspector |

## SOQL Query Plan (Explain Plan)

| Cost Value | Meaning |
|-----------|---------|
| Cost < 1 | Uses index — efficient |
| Cost >= 1 | Full table scan — potentially slow for LDV |
| Leading Operation: `TableScan` | No suitable index found |
| Leading Operation: `Index` | Index used — efficient |

## VS Code Debuggers

| Debugger | Cost | How It Works | Requirements |
|----------|------|-------------|-------------|
| Apex Replay Debugger | Free | Replays `.log` files in VS Code | Salesforce Extension Pack |
| Interactive Apex Debugger | Paid | Live breakpoints, real-time inspection | Performance/Unlimited Edition or Enterprise add-on |

### Apex Replay Debugger Steps

1. Install Salesforce Extension Pack in VS Code
2. Capture a debug log (CLI, Dev Console, or Setup)
3. Open `.log` file in VS Code
4. Command Palette: "SFDX: Launch Apex Replay Debugger with Current File"
5. Set breakpoints in `.cls` files
6. Step through execution, inspect variables and call stack

### Interactive Debugger Availability

| Edition | Available |
|---------|-----------|
| Performance Edition | Yes |
| Unlimited Edition | Yes |
| Enterprise Edition | Add-on only |
| Developer Edition | No |
| Sandbox (without entitlement) | No |

## Common Errors: Root Causes

| Error | Root Cause | Fix Pattern |
|-------|-----------|-------------|
| `Too many SOQL queries: 101` | SOQL inside a loop | Bulk-query outside loop, use Map for lookup |
| `Apex CPU time limit exceeded` | O(n^2) loops, string ops | Use Map for O(1) lookup; move to async |
| `NullPointerException` | Unchecked null reference | Null-safe operator `?.` (API 56.0+) or manual null check |
| `UNABLE_TO_LOCK_ROW` | Concurrent updates on same record | Retry via Queueable, `FOR UPDATE`, reduce batch size |
| `MIXED_DML_OPERATION` | Setup + non-setup DML in same transaction | Separate with `@future` |
| `Too many DML rows: 10001` | DML on > 10,000 rows | Use Batch Apex |
| `Callout from triggers` | Sync callout in trigger context | Use `@future(callout=true)` |

## Flow Debugging

| Feature | Access |
|---------|--------|
| Flow Debug Mode | Flow Builder > Debug button (top right) |
| Rollback option | Checkbox to undo DML during debug |
| Input variables | Set before running debug |

## LWC Debugging

| Tool | Purpose |
|------|---------|
| Browser DevTools (`console.group`, `console.error`) | Component-level logging |
| Lightning Debug Mode | Setup > Session Settings (slower, better errors) |
| Salesforce Inspector Reloaded (Chrome) | Metadata browsing, SOQL runner, API inspector |
