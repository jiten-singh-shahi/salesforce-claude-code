'use strict';

/**
 * hooks-adapter.js — Transforms SCC hooks from Claude Code format to Cursor format.
 *
 * Claude Code hooks use:
 *   - PascalCase event names (PreToolUse, PostToolUse, SessionStart)
 *   - Nested structure: { matcher, hooks: [{ type, command, async, timeout }] }
 *   - Regex matchers on tool names
 *   - ${CLAUDE_PLUGIN_ROOT} path variable
 *   - run-with-flags.js profile gating wrapper
 *   - 4 hook types: command, http, prompt, agent
 *
 * Cursor hooks use:
 *   - camelCase event names (preToolUse, beforeShellExecution, afterFileEdit)
 *   - Flat structure: { command, timeout, matcher, failClosed, loop_limit }
 *   - Tool-specific events instead of matchers (beforeShellExecution vs PreToolUse+Bash)
 *   - Relative paths from project root
 *   - No profile gating
 *   - 2 hook types: command, prompt
 *   - version: 1 required
 */

// ── Event mapping ────────────────────────────────────────────────────────────

/**
 * Map Claude Code event+matcher → Cursor event.
 * Some Claude Code events with tool matchers map to Cursor-specific events.
 */
const EVENT_MAP = {
  SessionStart: 'sessionStart',
  SessionEnd: 'sessionEnd',
  PreCompact: 'preCompact',
  Stop: 'stop',
  PostToolUseFailure: 'postToolUseFailure',
};

/**
 * PreToolUse matcher → Cursor event mapping.
 * Claude Code uses PreToolUse + matcher; Cursor has tool-specific events.
 */
const PRE_TOOL_USE_MAP = {
  Bash: 'beforeShellExecution',
};

/**
 * PostToolUse matcher → Cursor event mapping.
 */
const POST_TOOL_USE_MAP = {
  Bash: 'afterShellExecution',
  Edit: 'afterFileEdit',
  Write: 'afterFileEdit',
};

// Cursor hook types (command and prompt only; http and agent are Claude Code only)
const CURSOR_SUPPORTED_TYPES = new Set(['command', 'prompt']);

// ── Path remapping ───────────────────────────────────────────────────────────

/**
 * Strip the run-with-flags.js wrapper and extract the actual script command.
 * Claude Code: node "${CLAUDE_PLUGIN_ROOT}/scripts/hooks/run-with-flags.js" <id> <profile> "${CLAUDE_PLUGIN_ROOT}/scripts/hooks/<script>.js"
 * Cursor:      node scripts/hooks/<script>.js
 *
 * Also handles run-with-flags-shell.sh for bash hooks.
 */
function remapCommand(command) {
  // Pattern 1: node "...run-with-flags.js" <id> <profile> ".../<script>.js"
  const runWithFlagsMatch = command.match(
    /node\s+"?\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/hooks\/run-with-flags\.js"?\s+\S+\s+\S+\s+"?\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/hooks\/([^"]+)"?/
  );
  if (runWithFlagsMatch) {
    return `node scripts/hooks/${runWithFlagsMatch[1]}`;
  }

  // Pattern 2: bash "...run-with-flags-shell.sh" <id> "scripts/hooks/<script>" <profiles>
  const shellFlagsMatch = command.match(
    /bash\s+"?\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/hooks\/run-with-flags-shell\.sh"?\s+\S+\s+"?scripts\/hooks\/([^"]+)"?\s+\S+/
  );
  if (shellFlagsMatch) {
    return `bash scripts/hooks/${shellFlagsMatch[1]}`;
  }

  // Pattern 3: Direct node "${CLAUDE_PLUGIN_ROOT}/scripts/hooks/<script>.js"
  const directMatch = command.match(
    /node\s+"?\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/hooks\/([^"]+)"?/
  );
  if (directMatch) {
    return `node scripts/hooks/${directMatch[1]}`;
  }

  // Pattern 4: npx commands (pass through as-is)
  if (command.startsWith('npx ')) {
    return command;
  }

  // Fallback: replace ${CLAUDE_PLUGIN_ROOT}/ with empty
  return command.replace(/\$\{CLAUDE_PLUGIN_ROOT\}\//g, '');
}

// ── Security classification ──────────────────────────────────────────────────

/**
 * Determine if a hook should use failClosed: true in Cursor.
 * Security-critical hooks should block on failure rather than fail-open.
 */
const FAIL_CLOSED_HOOKS = new Set([
  'mcp-health-check',
  'block-no-verify',
]);

function shouldFailClosed(command) {
  return [...FAIL_CLOSED_HOOKS].some(hook => command.includes(hook));
}

// ── Core transform ──────────────────────────────────────────────────────────

/**
 * Resolve the Cursor event name for a Claude Code event + matcher combination.
 */
function resolveCursorEvent(claudeEvent, matcher) {
  // Direct mapping (no tool-specific routing needed)
  if (EVENT_MAP[claudeEvent]) {
    return EVENT_MAP[claudeEvent];
  }

  // PreToolUse: check if matcher maps to a Cursor-specific event
  if (claudeEvent === 'PreToolUse') {
    if (matcher && PRE_TOOL_USE_MAP[matcher]) {
      return PRE_TOOL_USE_MAP[matcher];
    }
    return 'preToolUse';
  }

  // PostToolUse: check if matcher maps to a Cursor-specific event
  if (claudeEvent === 'PostToolUse') {
    if (matcher && POST_TOOL_USE_MAP[matcher]) {
      return POST_TOOL_USE_MAP[matcher];
    }
    return 'postToolUse';
  }

  // Fallback: camelCase the event name
  return claudeEvent.charAt(0).toLowerCase() + claudeEvent.slice(1);
}

/**
 * Transform a single Claude Code hook entry to a Cursor hook entry.
 * @param {object} hook - Claude Code hook { type, command, async, timeout }
 * @param {string} groupMatcher - The matcher from the parent group
 * @param {string} cursorEvent - The resolved Cursor event name
 * @returns {object|null} - Cursor hook entry, or null if unsupported
 */
function transformHookEntry(hook, groupMatcher, cursorEvent) {
  // Skip unsupported hook types (http, agent)
  const hookType = hook.type || 'command';
  if (!CURSOR_SUPPORTED_TYPES.has(hookType)) {
    return null;
  }

  const entry = {};

  // Command (required)
  if (hookType === 'command') {
    entry.command = remapCommand(hook.command);
  } else if (hookType === 'prompt') {
    entry.type = 'prompt';
    entry.prompt = hook.prompt;
  }

  // Timeout (if specified)
  if (hook.timeout) {
    entry.timeout = hook.timeout;
  }

  // Note: Claude Code 'async' field is dropped — Cursor does not support it.
  // Claude Code 'if' field is dropped — Cursor uses matcher against command text instead.
  // Claude Code 'statusMessage' is dropped — Cursor does not support it.

  // failClosed for security-critical hooks
  if (hookType === 'command' && shouldFailClosed(hook.command)) {
    entry.failClosed = true;
  }

  // Matcher: only add if the Cursor event supports it AND the Claude Code
  // matcher wasn't already consumed by event routing (Bash → beforeShellExecution)
  const toolSpecificEvents = new Set([
    'beforeShellExecution', 'afterShellExecution',
    'afterFileEdit',
  ]);

  if (groupMatcher && !toolSpecificEvents.has(cursorEvent)) {
    // For preToolUse/postToolUse, the matcher maps to Cursor's tool type format
    // Claude Code uses "Edit|Write", Cursor uses "Write" (tool names)
    const cursorMatcher = mapMatcherToCursor(groupMatcher);
    if (cursorMatcher) {
      entry.matcher = cursorMatcher;
    }
  }

  // For beforeShellExecution, pass through the original matcher as command filter
  if (cursorEvent === 'beforeShellExecution' && groupMatcher && groupMatcher !== 'Bash') {
    entry.matcher = groupMatcher;
  }

  // loop_limit for stop hooks (Cursor default is 5, Claude Code default is null/unlimited)
  if (cursorEvent === 'stop') {
    entry.loop_limit = 3;
  }

  return entry;
}

/**
 * Map Claude Code regex matcher to Cursor tool matcher format.
 * Cursor matchers: Shell, Read, Write, Grep, Delete, Task, MCP:<tool>
 */
function mapMatcherToCursor(claudeMatcher) {
  if (!claudeMatcher || claudeMatcher === '') return null;

  const mappings = {
    Bash: 'Shell',
    'Edit|Write': 'Write',
    Edit: 'Write',
    Write: 'Write',
  };

  return mappings[claudeMatcher] || claudeMatcher;
}

/**
 * Transform Claude Code hooks.json to Cursor hooks.json format.
 * @param {object} claudeHooks - Parsed Claude Code hooks.json
 * @returns {object} - Cursor-format hooks.json
 */
function transformHooks(claudeHooks) {
  const cursorHooks = {};
  const sourceHooks = claudeHooks.hooks || {};

  for (const [claudeEvent, groups] of Object.entries(sourceHooks)) {
    for (const group of groups) {
      const matcher = group.matcher || '';
      const cursorEvent = resolveCursorEvent(claudeEvent, matcher);

      if (!cursorHooks[cursorEvent]) {
        cursorHooks[cursorEvent] = [];
      }

      const hooks = group.hooks || [];
      for (const hook of hooks) {
        const entry = transformHookEntry(hook, matcher, cursorEvent);
        if (entry) {
          cursorHooks[cursorEvent].push(entry);
        }
      }
    }
  }

  return {
    version: 1,
    hooks: cursorHooks,
  };
}

module.exports = { transformHooks, remapCommand, resolveCursorEvent, transformHookEntry };
