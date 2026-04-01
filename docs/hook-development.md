# Hook Development Guide

This guide covers how to develop, modify, and test hooks in Salesforce Claude Code (SCC). Hooks are lifecycle scripts that run automatically at specific points during a Claude Code session, providing validation, warnings, quality checks, and session management.

## Hook Lifecycle Events

SCC hooks fire at seven lifecycle points defined in `hooks/hooks.json`:

| Event | When It Fires | Use Cases |
|---|---|---|
| **SessionStart** | When a new Claude Code session begins | Display project context, detect SF CLI version, list connected orgs |
| **PreToolUse** | Before any tool executes (Read, Write, Edit, Bash, etc.) | Block dangerous commands, validate SF CLI usage, warn before destructive operations |
| **PostToolUse** | After a tool executes successfully | Check governor limits on edited Apex, warn about console.log, run quality gates |
| **PostToolUseFailure** | After a tool execution fails | Track MCP failures, attempt server reconnection |
| **PreCompact** | Before context window compaction | Save session state so critical information survives compaction |
| **Stop** | When the agent stops (user presses Escape or task completes) | Summarize changes, check for leftover console.log, persist session, track costs |
| **SessionEnd** | When the session fully terminates | Mark session end in state store |

## Hook File Structure

Every hook consists of two parts: an entry in `hooks/hooks.json` and a script file in `scripts/hooks/`.

### hooks.json Entry

Each lifecycle event contains an array of hook definitions:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/hooks/run-with-flags.js\" governor-check standard \"${CLAUDE_PLUGIN_ROOT}/scripts/hooks/governor-check.js\"",
            "async": true,
            "timeout": 10
          }
        ],
        "description": "Check edited Apex files for governor limit violations (SOQL/DML in loops)"
      }
    ]
  }
}
```

**Fields:**

- `matcher` — Which tool triggers this hook. Values: `"Bash"`, `"Edit"`, `"Write"`, `"Read"`, `"Edit|Write"` (regex OR), `"*"` (all tools). Only used in `PreToolUse`, `PostToolUse`, and `PostToolUseFailure`.
- `hooks[].type` — Always `"command"` for script-based hooks.
- `hooks[].command` — The shell command to execute. Use `${CLAUDE_PLUGIN_ROOT}` for the plugin root path.
- `hooks[].async` — When `true`, the hook runs without blocking the agent. Most hooks should be async.
- `hooks[].timeout` — Maximum execution time in seconds. The hook is killed if it exceeds this.
- `description` — Human-readable description of what the hook does. Required by CI validation.

### Hook Script Structure

Hook scripts are Node.js CommonJS modules in `scripts/hooks/`. There are two patterns:

**Modern pattern (recommended) -- exports a `run()` function:**

```javascript
#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function run(rawInput) {
  try {
    const input = JSON.parse(rawInput);
    const filePath = String(input.tool_input?.file_path || '');

    // Your hook logic here
    if (shouldWarn(filePath)) {
      process.stderr.write('[SCC MyHook] Warning: something detected\n');
    }
  } catch {
    // Always handle errors gracefully -- never crash
  }
  return rawInput; // Pass stdin through to stdout unchanged
}

// Support both direct execution and require()
if (require.main === module) {
  const MAX_STDIN = 1024 * 1024;
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => {
    if (raw.length < MAX_STDIN) {
      raw += chunk.substring(0, MAX_STDIN - raw.length);
    }
  });
  process.stdin.on('end', () => {
    const result = run(raw);
    process.stdout.write(result);
  });
}

module.exports = { run };
```

**Legacy pattern -- reads stdin directly (still supported):**

```javascript
#!/usr/bin/env node
'use strict';

const readline = require('readline');

const MAX_STDIN = 1024 * 1024;
let rawInput = '';
const rl = readline.createInterface({ input: process.stdin });
rl.on('line', line => {
  if (rawInput.length < MAX_STDIN) rawInput += line + '\n';
});

rl.on('close', () => {
  let input = {};
  try {
    input = JSON.parse(rawInput.trim() || '{}');
  } catch {
    process.exit(0);
  }

  // Your hook logic here
  process.exit(0);
});
```

**Key conventions:**

- Output warnings/diagnostics to **stderr** (`process.stderr.write()`) -- these are shown to the user.
- Output the passthrough data to **stdout** (`process.stdout.write()`) -- this is the hook's return value.
- Always return the original stdin data unless you intend to modify the tool input/output.
- Exit with code 0 on success or non-fatal warnings. A non-zero exit code blocks the tool execution (for PreToolUse hooks) or signals failure.

## Profile Gating with run-with-flags.js

Most hooks are wrapped with `run-with-flags.js` to control which hooks run based on the user's profile setting. This prevents aggressive hooks from running on users who want a lightweight experience.

### Profile Levels

| Profile | Level | Description |
|---|---|---|
| `minimal` | 1 | Only essential hooks (session markers, cost tracking, pre-compact state saving) |
| `standard` | 2 | Default. All quality checks, governor detection, SF CLI validation, session persistence |
| `strict` | 3 | Everything in standard plus auto-formatting, type-checking, tmux reminders, sfdx-scanner |

### How Profile Gating Works

The `run-with-flags.js` wrapper takes three arguments:

```
node run-with-flags.js <hook-name> <min-profile> <script-path>
```

- `hook-name` -- A unique identifier for the hook (used in `SCC_DISABLED_HOOKS`).
- `min-profile` -- The minimum profile required to run this hook (`minimal`, `standard`, or `strict`).
- `script-path` -- Absolute path to the hook script.

The wrapper:

1. Reads stdin (the tool input/output JSON).
2. Checks if the hook is disabled via `SCC_DISABLED_HOOKS`.
3. Checks if the current `SCC_HOOK_PROFILE` meets the minimum level.
4. If the hook should run, it either `require()`s the script (if it exports `run()`) or spawns it as a child process.
5. If the hook should be skipped, it passes stdin through to stdout unchanged.

### hooks.json Example with Profile Gating

```json
{
  "matcher": "Edit",
  "hooks": [
    {
      "type": "command",
      "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/hooks/run-with-flags.js\" post-edit-format strict \"${CLAUDE_PLUGIN_ROOT}/scripts/hooks/post-edit-format.js\"",
      "async": true,
      "timeout": 15
    }
  ],
  "description": "Auto-format edited files with Prettier (strict profile only)"
}
```

This hook only runs when `SCC_HOOK_PROFILE=strict`.

### Hooks Without Profile Gating

Some hooks run unconditionally (no `run-with-flags.js` wrapper):

- `session-start.js` -- Always displays project context.
- `pre-tool-use.js` -- Always validates SF CLI commands.
- `stop-hook.js` -- Always summarizes changes.
- `block-no-verify` (npm package) -- Always blocks `--no-verify` flag.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SCC_HOOK_PROFILE` | `standard` | Controls which hooks run. Values: `minimal`, `standard`, `strict`. |
| `SCC_DISABLED_HOOKS` | (empty) | Comma-separated list of hook names to skip. Example: `governor-check,quality-gate`. |
| `CLAUDE_PLUGIN_ROOT` | Auto-detected | Root directory of the SCC plugin installation. Set automatically during install. |

### Setting the Profile

```bash
# In your shell profile (.zshrc, .bashrc)
export SCC_HOOK_PROFILE=strict

# Or per-session
SCC_HOOK_PROFILE=minimal claude

# Disable specific hooks
export SCC_DISABLED_HOOKS=post-edit-format,pre-bash-tmux-reminder
```

## How to Create a New Hook

Follow these steps to add a new hook to SCC.

### Step 1 -- Write the Hook Script

Create a new file in `scripts/hooks/`. Use the modern `run()` export pattern:

```javascript
#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const MAX_STDIN = 1024 * 1024;

function log(msg) {
  process.stderr.write(`${msg}\n`);
}

/**
 * Main hook logic. Receives raw stdin JSON, returns it unchanged.
 */
function run(rawInput) {
  try {
    const input = JSON.parse(rawInput);
    const filePath = String(input.tool_input?.file_path || '');

    // Example: check if the file is an Apex class
    if (!filePath.endsWith('.cls') && !filePath.endsWith('.trigger')) {
      return rawInput;
    }

    // Read and analyze the file
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      // ... your analysis logic ...

      if (issuesFound) {
        log('\n[SCC MyHook] Issues detected:');
        log('  [WARNING] Description of the issue');
        log('    Fix: How to resolve it\n');
      }
    }
  } catch {
    // Graceful failure -- never crash
  }
  return rawInput;
}

if (require.main === module) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => {
    if (raw.length < MAX_STDIN) {
      raw += chunk.substring(0, MAX_STDIN - raw.length);
    }
  });
  process.stdin.on('end', () => {
    const result = run(raw);
    process.stdout.write(result);
  });
}

module.exports = { run };
```

### Step 2 -- Add the Entry to hooks.json

Edit `hooks/hooks.json` and add your hook under the appropriate lifecycle event:

```json
{
  "matcher": "Edit",
  "hooks": [
    {
      "type": "command",
      "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/hooks/run-with-flags.js\" my-hook-name standard \"${CLAUDE_PLUGIN_ROOT}/scripts/hooks/my-hook.js\"",
      "async": true,
      "timeout": 10
    }
  ],
  "description": "Short description of what this hook does"
}
```

Choose the right lifecycle event:

- **PreToolUse** -- For validation/warnings before the action happens.
- **PostToolUse** -- For analysis/checks after the action succeeds.
- **PostToolUseFailure** -- For error recovery after the action fails.
- **Stop** -- For session-end summaries and cleanup.

### Step 3 -- Write Tests

Create a test file at `tests/hooks/my-hook.test.js`. Follow the pattern used by existing tests:

```javascript
#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const hookPath = path.join(pluginRoot, 'scripts', 'hooks', 'my-hook.js');

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  FAIL  ${name}`);
    console.error(`        ${err.message}`);
    failCount++;
  }
}

test('my-hook.js: module exists', () => {
  assert.ok(fs.existsSync(hookPath), 'my-hook.js not found');
});

if (fs.existsSync(hookPath)) {
  const myHook = require(hookPath);

  test('my-hook.js: exports run function', () => {
    assert.ok(typeof myHook.run === 'function', 'Should export run()');
  });

  test('my-hook.js: handles empty input gracefully', () => {
    const result = myHook.run('{}');
    assert.ok(typeof result === 'string');
  });

  test('my-hook.js: detects the target condition', () => {
    // Create a temp file, run the hook, check stderr output
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-test-'));
    const testFile = path.join(tmpDir, 'TestClass.cls');
    fs.writeFileSync(testFile, 'public class TestClass { /* bad pattern */ }');

    const captured = [];
    const origWrite = process.stderr.write;
    process.stderr.write = (msg) => { captured.push(msg); };
    try {
      const input = JSON.stringify({ tool_input: { file_path: testFile } });
      myHook.run(input);
    } finally {
      process.stderr.write = origWrite;
      fs.rmSync(tmpDir, { recursive: true });
    }
    const output = captured.join('');
    assert.ok(output.includes('expected warning text'), 'Should detect the target condition');
  });
}

console.log(`\nmy-hook.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
```

### Step 4 -- Update the Cursor Mirror

For Cursor IDE parity, add a corresponding hook in `.cursor/hooks/`. Cursor hooks use different lifecycle names but the adapter layer (`adapter.js`) maps them.

| Claude Code Event | Cursor Equivalent |
|---|---|
| SessionStart | `session-start.js` |
| PreToolUse (Bash) | `before-shell-execution.js` |
| PreToolUse (Write/Edit) | `before-read-file.js` / `before-submit-prompt.js` |
| PostToolUse (Write/Edit) | `after-file-edit.js` / `after-tab-file-edit.js` |
| PostToolUse (Bash) | `after-shell-execution.js` |
| PreToolUse (MCP) | `before-mcp-execution.js` |
| PostToolUse (MCP) | `after-mcp-execution.js` |
| Stop | `stop.js` |
| SessionEnd | `session-end.js` |
| PreCompact | `pre-compact.js` |

### Step 5 -- Run CI Validation

```bash
node scripts/ci/validate-hooks.js
```

This validator checks that:

- `hooks/hooks.json` is valid JSON and conforms to `schemas/hooks.schema.json`.
- Every script referenced in hooks.json actually exists on disk.
- Every hook entry has a `description` field.

### Step 6 -- Run the Full Test Suite

```bash
node tests/run-all.js
```

## Matcher Patterns for Tool-Specific Hooks

Matchers use regex-style patterns to target specific tools:

| Matcher | Targets |
|---|---|
| `"Bash"` | Shell/terminal command execution |
| `"Edit"` | File edit operations |
| `"Write"` | File write (create new file) operations |
| `"Read"` | File read operations |
| `"Edit\|Write"` | Either Edit or Write (regex OR syntax) |
| `"*"` | All tool invocations |

**Matcher-less hooks** (no `matcher` field) fire unconditionally for that lifecycle event. This is used for `SessionStart`, `PreCompact`, `Stop`, and `SessionEnd` events.

## Timeout Configuration

Every hook should specify a `timeout` value (in seconds) to prevent runaway scripts from blocking the agent.

**Guidelines:**

| Hook Type | Recommended Timeout |
|---|---|
| Simple file checks (regex, lint) | 5-10 seconds |
| File analysis (AST parsing, governor checks) | 10-15 seconds |
| External tool invocation (Prettier, TypeScript compiler) | 15-30 seconds |
| Network operations (MCP health checks) | 10-15 seconds |
| Scanner/static analysis (sfdx-scanner PMD) | 30-45 seconds |

If a hook exceeds its timeout, `run-with-flags.js` kills the process and writes a timeout message to stderr. The agent continues normally.

## Stdin/Stdout Protocol

Claude Code passes JSON to hooks via stdin and reads their response from stdout.

**PreToolUse stdin:**

```json
{
  "tool_name": "Bash",
  "tool_input": {
    "command": "sf project deploy start --source-dir force-app/"
  }
}
```

**PostToolUse stdin:**

```json
{
  "tool_name": "Edit",
  "tool_input": {
    "file_path": "/path/to/AccountService.cls",
    "old_string": "...",
    "new_string": "..."
  },
  "tool_output": "File edited successfully"
}
```

**Stdout:** Return the original stdin JSON unchanged (passthrough). For PreToolUse hooks that need to block execution, exit with a non-zero code.

**Stderr:** Write diagnostic messages, warnings, and recommendations. These are displayed to the user in the Claude Code interface.

## Best Practices

1. **Fast execution.** Hooks run on every tool invocation. Keep execution under 100ms for common-path hooks. Use early returns when the hook does not apply (wrong file type, wrong tool, etc.).

2. **Graceful failure.** Never let a hook crash or throw an unhandled exception. Wrap all logic in try/catch. A broken hook should fail silently, not break the user's workflow.

3. **No blocking on async hooks.** Set `"async": true` for all hooks except those that must block tool execution (like `block-no-verify`). Blocking hooks freeze the agent until they complete.

4. **Limit stdin reads.** Cap stdin reads at 1MB (`MAX_STDIN = 1024 * 1024`) to prevent memory issues with large tool outputs.

5. **Use stderr for output.** All user-facing messages go to stderr. Stdout is reserved for the passthrough protocol.

6. **Prefix messages.** Always prefix stderr output with `[SCC HookName]` so users can identify which hook produced the message.

7. **Respect profiles.** Use `run-with-flags.js` for any hook that is not universally needed. Assign the lowest profile level that makes sense:
   - `minimal` -- Essential infrastructure (session markers, cost tracking).
   - `standard` -- Quality and safety checks most developers want.
   - `strict` -- Aggressive checks for teams with strict standards.

8. **Test with temp files.** Hook tests should create temporary files, run the hook, and clean up. Never depend on files existing in the repo.

9. **Keep hooks stateless.** Hooks should not write to shared files or maintain global state between invocations. Use environment variables or the SCC state store for persistence.

10. **Document the hook.** Every hooks.json entry requires a `description`. Make it concise but clear about what the hook checks and what action it takes.

## Shell-Based Hooks

Some hooks use `run-with-flags-shell.sh` instead of the Node.js wrapper, for hooks written as shell scripts:

```json
{
  "matcher": "*",
  "hooks": [{
    "type": "command",
    "command": "bash \"${CLAUDE_PLUGIN_ROOT}/scripts/hooks/run-with-flags-shell.sh\" \"pre:observe\" \"scripts/hooks/learning-observe.sh\" \"standard,strict\"",
    "async": true,
    "timeout": 10
  }],
  "description": "Capture tool use observations for continuous learning"
}
```

The shell wrapper follows the same profile-gating logic but for Bash scripts. The third argument is a comma-separated list of profiles that should run the hook.

## Existing Hooks Reference

### SessionStart

- **session-start.js** -- Detects sfdx-project.json, SF CLI version, connected orgs. Runs unconditionally.

### PreToolUse

- **block-no-verify** -- Blocks `--no-verify` flag on git commands. No profile gating.
- **mcp-health-check.js** -- Checks MCP server health before MCP tool calls. Standard profile.
- **observe.sh** -- Captures tool use events for continuous learning. Standard/strict profiles.
- **pre-tool-use.js** -- Validates SF CLI commands (deprecation/danger warnings). No profile gating.
- **doc-file-warning.js** -- Warns about non-standard documentation files (Write matcher). Standard profile.
- **sfdx-validate.js** -- Validates SFDX commands for best practices. Standard profile.
- **pre-bash-git-push-reminder.js** -- Reminds to review changes before git push. Standard profile.
- **sfdx-scanner-check.js** -- Runs sfdx-scanner PMD analysis before deploy/push. Standard/strict profiles.
- **pre-bash-tmux-reminder.js** -- Suggests tmux for long-running SF CLI commands. Strict profile.
- **suggest-compact.js** -- Tracks tool call count, suggests compaction. Standard profile.

### PostToolUse

- **observe.sh** -- Captures tool results for continuous learning. Standard/strict profiles.
- **post-write.js** -- Reminds about test coverage after Apex/LWC file writes. No profile gating.
- **quality-gate.js** -- Runs quality checks on edited Apex/LWC files. Standard profile.
- **governor-check.js** -- Checks for governor limit violations (SOQL/DML in loops). Standard profile.
- **post-edit-console-warn.js** -- Warns about console.log in JS/LWC files. Standard profile.
- **post-edit-format.js** -- Auto-formats with Prettier. Strict profile.
- **post-edit-typecheck.js** -- Type-checks TypeScript/LWC files. Strict profile.
- **post-bash-build-complete.js** -- Detects build/deploy completion. Standard profile.
- **post-bash-pr-created.js** -- Detects PR creation and logs review command. Standard profile.

### PostToolUseFailure

- **mcp-health-check.js** -- Tracks failed MCP calls, marks unhealthy servers. Standard profile.

### PreCompact

- **pre-compact.js** -- Saves session state before context compaction. Minimal profile.

### Stop

- **stop-hook.js** -- Summarizes Salesforce changes and suggests next steps. No profile gating.
- **check-console-log.js** -- Checks for console.log in modified files. Standard profile.
- **session-end.js** -- Persists session summary. Standard profile.
- **cost-tracker.js** -- Tracks token usage and estimated costs. Minimal profile.
- **evaluate-session.js** -- Evaluates session for extractable patterns. Standard profile.

### SessionEnd

- **session-end-marker.js** -- Non-blocking session end lifecycle marker. Minimal profile.
