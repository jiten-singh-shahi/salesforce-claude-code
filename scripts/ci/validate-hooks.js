#!/usr/bin/env node
'use strict';

/**
 * validate-hooks.js — CI validator for hooks/hooks.json.
 *
 * Validates:
 *   - File is valid JSON
 *   - Top-level structure has a "hooks" object
 *   - Lifecycle event keys are from the known set
 *   - Each hook entry has type: "command" and a non-empty command string
 */

const fs = require('fs');
const path = require('path');
const { getPluginRoot } = require('../lib/utils');
const { validateAgainstSchema, formatErrors, hasAjv } = require('../lib/schema-validator');

// Valid Claude Code hook lifecycle events
const VALID_LIFECYCLE_EVENTS = new Set([
  'SessionStart',
  'SessionEnd',
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'PreCompact',
  'Stop',
  'Notification',
  'SubagentStop',
]);

const pluginRoot = getPluginRoot();
const hooksJsonPath = path.join(pluginRoot, 'hooks', 'hooks.json');

const errors = [];
const warnings = [];

// ── File existence ────────────────────────────────────────────────────────────

if (!fs.existsSync(hooksJsonPath)) {
  console.error(`[ERROR] hooks/hooks.json not found at: ${hooksJsonPath}`);
  process.exit(1);
}

// ── Parse JSON ────────────────────────────────────────────────────────────────

let parsed;
try {
  const raw = fs.readFileSync(hooksJsonPath, 'utf8');
  parsed = JSON.parse(raw);
} catch (err) {
  console.error(`[FAIL] hooks/hooks.json is not valid JSON: ${err.message}`);
  process.exit(1);
}

// ── Schema validation (AJV) ───────────────────────────────────────────────────

const hooksSchemaPath = path.join(pluginRoot, 'schemas', 'hooks.schema.json');
if (fs.existsSync(hooksSchemaPath)) {
  const schemaResult = validateAgainstSchema(hooksSchemaPath, parsed);
  if (!schemaResult.valid) {
    for (const err of schemaResult.errors) {
      errors.push(`Schema: ${err.instancePath || '/'} ${err.message}`);
    }
  }
}

// ── Structural validation ─────────────────────────────────────────────────────

if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
  errors.push('hooks.json root must be a JSON object');
}

if (!parsed.hooks || typeof parsed.hooks !== 'object' || Array.isArray(parsed.hooks)) {
  errors.push('hooks.json must have a top-level "hooks" object');
}

if (errors.length > 0) {
  console.error(`\nHook validation FAILED:\n`);
  for (const e of errors) console.error(`  [FAIL] ${e}`);
  process.exit(1);
}

// ── Per-event validation ──────────────────────────────────────────────────────

/**
 * Hooks entries support two formats:
 *   Format A (flat):   { type: "command", command: "..." }
 *   Format B (nested): { hooks: [{ type: "command", command: "..." }], matcher?: "..." }
 * Both are valid in Claude Code.
 */
function flattenHookEntries(eventHooks) {
  const flat = [];
  for (const entry of eventHooks) {
    if (entry.type === 'command') {
      flat.push({ entry, command: entry });
    } else if (Array.isArray(entry.hooks)) {
      for (const inner of entry.hooks) {
        flat.push({ entry: inner, outerEntry: entry, command: inner });
      }
    }
  }
  return flat;
}

let hookCount = 0;

for (const [eventName, eventHooks] of Object.entries(parsed.hooks)) {
  // Validate lifecycle event name
  if (!VALID_LIFECYCLE_EVENTS.has(eventName)) {
    errors.push(`Unknown lifecycle event: "${eventName}". Valid events: ${[...VALID_LIFECYCLE_EVENTS].join(', ')}`);
    continue;
  }

  // Event value must be an array
  if (!Array.isArray(eventHooks)) {
    errors.push(`hooks.${eventName} must be an array of hook entries`);
    continue;
  }

  // Validate outer entries exist
  for (let i = 0; i < eventHooks.length; i++) {
    const outer = eventHooks[i];
    const loc = `hooks.${eventName}[${i}]`;
    if (!outer || typeof outer !== 'object') {
      errors.push(`${loc}: each hook entry must be an object`);
    }
  }

  // Validate the actual command-bearing entries (handles both flat and nested)
  const flat = flattenHookEntries(eventHooks);

  if (flat.length === 0) {
    warnings.push(`hooks.${eventName}: no command entries found`);
    continue;
  }

  for (let j = 0; j < flat.length; j++) {
    const { command: hook, outerEntry } = flat[j];
    const loc = `hooks.${eventName} command[${j}]`;

    if (!hook || typeof hook !== 'object') {
      errors.push(`${loc}: hook command entry must be an object`);
      continue;
    }

    // type must be "command"
    if (!hook.type) {
      errors.push(`${loc}: missing required field "type" (must be "command")`);
    } else if (hook.type !== 'command') {
      errors.push(`${loc}: type must be "command" (got: "${hook.type}")`);
    }

    // command must be a non-empty string
    if (!hook.command) {
      errors.push(`${loc}: missing required field "command"`);
    } else if (typeof hook.command !== 'string') {
      errors.push(`${loc}: "command" must be a string`);
    } else if (hook.command.trim() === '') {
      errors.push(`${loc}: "command" must not be empty`);
    } else {
      hookCount++;
    }

    // Optional but recommended: matcher for PreToolUse/PostToolUse
    // (matcher may be on outer entry in nested format)
    const hasMatcher = hook.matcher || (outerEntry && outerEntry.matcher);
    if ((eventName === 'PreToolUse' || eventName === 'PostToolUse') && !hasMatcher) {
      warnings.push(`${loc}: PreToolUse/PostToolUse hooks should have a "matcher" to filter by tool name`);
    }
  }
}

// ── Report ────────────────────────────────────────────────────────────────────

if (warnings.length > 0) {
  for (const w of warnings) {
    console.warn(`  [WARN] ${w}`);
  }
}

if (errors.length > 0) {
  console.error(`\nHook validation FAILED (${errors.length} error(s)):\n`);
  for (const e of errors) console.error(`  [FAIL] ${e}`);
  process.exit(1);
}

const eventCount = Object.keys(parsed.hooks).length;
console.log(`Hook validation PASSED — ${hookCount} hook(s) across ${eventCount} lifecycle event(s) validated.`);
process.exit(0);
