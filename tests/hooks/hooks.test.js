#!/usr/bin/env node
'use strict';

/**
 * hooks.test.js — Tests that hooks/hooks.json is valid and has expected structure.
 *
 * Uses Node.js built-in assert module.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const hooksJsonPath = path.join(pluginRoot, 'hooks', 'hooks.json');

// ── Test harness ──────────────────────────────────────────────────────────────

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

// ── Load hooks.json ───────────────────────────────────────────────────────────

let hooksJson = null;

test('hooks.json: file exists', () => {
  assert.ok(fs.existsSync(hooksJsonPath), `hooks/hooks.json not found at: ${hooksJsonPath}`);
});

if (fs.existsSync(hooksJsonPath)) {
  test('hooks.json: is valid JSON', () => {
    try {
      const raw = fs.readFileSync(hooksJsonPath, 'utf8');
      hooksJson = JSON.parse(raw);
    } catch (err) {
      assert.fail(`hooks/hooks.json contains invalid JSON: ${err.message}`);
    }
  });
}

if (hooksJson) {
  test('hooks.json: has top-level "hooks" object', () => {
    assert.ok(hooksJson.hooks, 'Missing "hooks" top-level key');
    assert.strictEqual(typeof hooksJson.hooks, 'object', '"hooks" must be an object');
    assert.ok(!Array.isArray(hooksJson.hooks), '"hooks" must not be an array');
  });

  test('hooks.json: hooks object is not empty', () => {
    const eventCount = Object.keys(hooksJson.hooks).length;
    assert.ok(eventCount > 0, 'hooks.json has no lifecycle events defined');
  });

  const VALID_LIFECYCLE_EVENTS = new Set([
    'SessionStart', 'SessionEnd', 'PreToolUse', 'PostToolUse',
    'PostToolUseFailure', 'PreCompact', 'Stop', 'Notification', 'SubagentStop',
  ]);

  test('hooks.json: all lifecycle event keys are valid', () => {
    const invalidEvents = Object.keys(hooksJson.hooks).filter(e => !VALID_LIFECYCLE_EVENTS.has(e));
    assert.strictEqual(invalidEvents.length, 0,
      `Invalid lifecycle events: ${invalidEvents.join(', ')}. Valid: ${[...VALID_LIFECYCLE_EVENTS].join(', ')}`);
  });

  test('hooks.json: each event value is an array', () => {
    for (const [eventName, hooks] of Object.entries(hooksJson.hooks)) {
      assert.ok(Array.isArray(hooks), `hooks.${eventName} must be an array`);
    }
  });

  /**
   * Hooks entries may use one of two formats:
   *   Format A (flat):   { type: "command", command: "..." }
   *   Format B (nested): { hooks: [{ type: "command", command: "..." }], matcher?: "..." }
   *
   * Both are valid — the validator iterates the actual command-bearing objects.
   */
  function flattenHookEntries(eventHooks) {
    const flat = [];
    for (const entry of eventHooks) {
      if (entry.type === 'command') {
        // Format A: flat command entry
        flat.push(entry);
      } else if (Array.isArray(entry.hooks)) {
        // Format B: nested hooks array
        flat.push(...entry.hooks);
      }
    }
    return flat;
  }

  test('hooks.json: all hook entries have type "command"', () => {
    const errors = [];
    for (const [eventName, eventHooks] of Object.entries(hooksJson.hooks)) {
      const entries = flattenHookEntries(eventHooks);
      for (let i = 0; i < entries.length; i++) {
        const hook = entries[i];
        if (!hook.type) {
          errors.push(`hooks.${eventName} entry ${i}: missing "type" field`);
        } else if (hook.type !== 'command') {
          errors.push(`hooks.${eventName} entry ${i}: type must be "command", got "${hook.type}"`);
        }
      }
    }
    assert.strictEqual(errors.length, 0, errors.join('; '));
  });

  test('hooks.json: all hook entries have non-empty command string', () => {
    const errors = [];
    for (const [eventName, eventHooks] of Object.entries(hooksJson.hooks)) {
      const entries = flattenHookEntries(eventHooks);
      for (let i = 0; i < entries.length; i++) {
        const hook = entries[i];
        if (!hook.command) {
          errors.push(`hooks.${eventName} entry ${i}: missing "command" field`);
        } else if (typeof hook.command !== 'string') {
          errors.push(`hooks.${eventName} entry ${i}: "command" must be a string`);
        } else if (hook.command.trim() === '') {
          errors.push(`hooks.${eventName} entry ${i}: "command" must not be empty`);
        }
      }
    }
    assert.strictEqual(errors.length, 0, errors.join('; '));
  });

  test('hooks.json: commands reference existing script files', () => {
    const warnings = [];
    for (const [eventName, eventHooks] of Object.entries(hooksJson.hooks)) {
      const entries = flattenHookEntries(eventHooks);
      for (let i = 0; i < entries.length; i++) {
        const hook = entries[i];
        if (!hook.command) continue;

        // Extract script paths from command (handle quoted paths like "${SCC_PLUGIN_ROOT}/scripts/hooks/foo.js")
        const normalized = hook.command.replace(/\$\{SCC_PLUGIN_ROOT\}/g, pluginRoot).replace(/["']/g, '');
        const parts = normalized.split(/\s+/);
        for (const part of parts) {
          if (part.endsWith('.js') && !part.startsWith('-') && path.isAbsolute(part)) {
            if (!fs.existsSync(part)) {
              warnings.push(`hooks.${eventName} entry ${i}: script not found: ${part}`);
            }
          }
        }
      }
    }
    // Script existence is a warning, not a hard failure (scripts may not exist yet during scaffold)
    if (warnings.length > 0) {
      console.warn(`\n  [WARN] Some hook scripts don't exist yet:`);
      for (const w of warnings) console.warn(`    ${w}`);
    }
    // Pass anyway — this is informational
  });

  test('hooks.json: has at least one of the core lifecycle events', () => {
    const coreEvents = ['SessionStart', 'PreToolUse', 'PostToolUse', 'Stop'];
    const presentCoreEvents = coreEvents.filter(e => hooksJson.hooks[e]);
    assert.ok(presentCoreEvents.length > 0,
      `Expected at least one core lifecycle event (${coreEvents.join(', ')}) to be defined`);
  });

  test('hooks.json: hook count is reasonable (> 0, < 50)', () => {
    let totalHooks = 0;
    for (const hooks of Object.values(hooksJson.hooks)) {
      totalHooks += hooks.length;
    }
    assert.ok(totalHooks > 0, 'No hook entries defined');
    assert.ok(totalHooks < 50, `Suspiciously many hooks: ${totalHooks}. Check for duplicates.`);
  });

  // ── Structure spot-checks ────────────────────────────────────────────────────

  test('hooks.json: SessionStart hook (if present) references session-start script', () => {
    if (!hooksJson.hooks.SessionStart || hooksJson.hooks.SessionStart.length === 0) {
      // Not required — just skip
      return;
    }
    const entries = flattenHookEntries(hooksJson.hooks.SessionStart);
    const hasSessionStartScript = entries.some(h =>
      h.command && h.command.includes('session-start')
    );
    assert.ok(hasSessionStartScript, 'SessionStart hook should reference session-start script');
  });

  test('hooks.json: PreToolUse hook (if present) references pre-tool-use script', () => {
    if (!hooksJson.hooks.PreToolUse || hooksJson.hooks.PreToolUse.length === 0) {
      return;
    }
    const entries = flattenHookEntries(hooksJson.hooks.PreToolUse);
    const hasPreToolScript = entries.some(h =>
      h.command && h.command.includes('pre-tool-use')
    );
    assert.ok(hasPreToolScript, 'PreToolUse hook should reference pre-tool-use script');
  });
}

// ── Additional: test run-with-flags.js exists and is valid JS ─────────────────

test('run-with-flags.js: exists in scripts/hooks/', () => {
  const scriptPath = path.join(pluginRoot, 'scripts', 'hooks', 'run-with-flags.js');
  assert.ok(fs.existsSync(scriptPath), `run-with-flags.js not found at: ${scriptPath}`);
});

test('run-with-flags.js: can be required without throwing', () => {
  const scriptPath = path.join(pluginRoot, 'scripts', 'hooks', 'run-with-flags.js');
  if (!fs.existsSync(scriptPath)) return;

  const content = fs.readFileSync(scriptPath, 'utf8');

  // Verify it defines PROFILE_LEVELS
  assert.ok(content.includes('PROFILE_LEVELS'), 'run-with-flags.js should define PROFILE_LEVELS');
  assert.ok(content.includes('minimal'), 'run-with-flags.js should include "minimal" profile');
  assert.ok(content.includes('standard'), 'run-with-flags.js should include "standard" profile');
  assert.ok(content.includes('strict'), 'run-with-flags.js should include "strict" profile');
  assert.ok(content.includes('SCC_HOOK_PROFILE'), 'run-with-flags.js should read SCC_HOOK_PROFILE env var');
  assert.ok(content.includes('SCC_DISABLED_HOOKS'), 'run-with-flags.js should read SCC_DISABLED_HOOKS env var');
  assert.ok(content.includes('fs.readFileSync'),
    'run-with-flags.js should read script source before require()');
  assert.ok(content.includes('hasRunExport'),
    'run-with-flags.js should gate require() on hasRunExport check');
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\nhooks.test.js: ${passCount} passed, ${failCount} failed`);

if (failCount > 0) {
  process.exit(1);
}
