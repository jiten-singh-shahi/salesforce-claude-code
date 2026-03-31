#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const validatorScript = path.join(pluginRoot, 'scripts/ci/validate-hooks.js');

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

function runValidator(envRoot) {
  return spawnSync(process.execPath, [validatorScript], {
    encoding: 'utf8',
    timeout: 15000,
    env: { ...process.env, SCC_PLUGIN_ROOT: envRoot },
  });
}

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'scc-test-hooks-'));
}

function writeHooksJson(tmp, obj) {
  const hooksDir = path.join(tmp, 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });
  fs.writeFileSync(path.join(hooksDir, 'hooks.json'), JSON.stringify(obj, null, 2));
}

function writeHooksRaw(tmp, rawStr) {
  const hooksDir = path.join(tmp, 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });
  fs.writeFileSync(path.join(hooksDir, 'hooks.json'), rawStr);
}

// ── Existing test (happy path with real data) ───────────────────────────────

test('validate-hooks.js: runs successfully', () => {
  const result = spawnSync(process.execPath, [validatorScript], {
    encoding: 'utf8',
    timeout: 15000,
    cwd: pluginRoot,
  });
  assert.strictEqual(result.status, 0, `Validator exited with code ${result.status}: ${result.stderr || result.stdout}`);
});

// ── Branch: hooks.json not found → exit(1) ──────────────────────────────────

test('exits 1 when hooks/hooks.json does not exist', () => {
  const tmp = makeTmpDir();
  try {
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('hooks/hooks.json not found'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: invalid JSON → exit(1) ─────────────────────────────────────────

test('exits 1 when hooks.json is not valid JSON', () => {
  const tmp = makeTmpDir();
  try {
    writeHooksRaw(tmp, '{not valid json!!!');
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('not valid JSON'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: root is not an object (array) → error ──────────────────────────

test('fails when root is an array', () => {
  const tmp = makeTmpDir();
  try {
    writeHooksRaw(tmp, '[]');
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('must be a JSON object') || result.stderr.includes('must have a top-level'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: missing "hooks" top-level key → error ──────────────────────────

test('fails when "hooks" key is missing', () => {
  const tmp = makeTmpDir();
  try {
    writeHooksJson(tmp, { version: 1 });
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('must have a top-level "hooks" object'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: "hooks" is an array instead of object → error ──────────────────

test('fails when "hooks" value is an array', () => {
  const tmp = makeTmpDir();
  try {
    writeHooksJson(tmp, { hooks: [] });
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('must have a top-level "hooks" object'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: valid hooks.json passes ─────────────────────────────────────────

test('passes for a valid hooks.json with command entries', () => {
  const tmp = makeTmpDir();
  try {
    writeHooksJson(tmp, {
      hooks: {
        SessionStart: [
          { type: 'command', command: 'echo hello' }
        ]
      }
    });
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 0);
    assert.ok(result.stdout.includes('PASSED'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: unknown lifecycle event → error ─────────────────────────────────

test('fails for unknown lifecycle event name', () => {
  const tmp = makeTmpDir();
  try {
    writeHooksJson(tmp, {
      hooks: {
        UnknownEvent: [
          { type: 'command', command: 'echo test' }
        ]
      }
    });
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('Unknown lifecycle event'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: event value is not an array → error ─────────────────────────────

test('fails when event hooks value is not an array', () => {
  const tmp = makeTmpDir();
  try {
    writeHooksJson(tmp, {
      hooks: {
        SessionStart: { type: 'command', command: 'echo test' }
      }
    });
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('must be an array'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: hook entry is not an object → error ─────────────────────────────

test('fails when hook entry is not an object', () => {
  const tmp = makeTmpDir();
  try {
    writeHooksJson(tmp, {
      hooks: {
        SessionStart: ['not-an-object']
      }
    });
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('must be an object'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: no command entries found → warning ──────────────────────────────

test('warns when event has no command entries', () => {
  const tmp = makeTmpDir();
  try {
    writeHooksJson(tmp, {
      hooks: {
        SessionStart: [
          { notType: 'something' }
        ]
      }
    });
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 0);
    assert.ok(result.stderr.includes('no command entries found'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: missing "type" field in nested hook → error ─────────────────────

test('fails when nested hook command entry is missing "type"', () => {
  const tmp = makeTmpDir();
  try {
    writeHooksJson(tmp, {
      hooks: {
        SessionStart: [
          { hooks: [{ command: 'echo test' }] }
        ]
      }
    });
    // The nested entry has no "type" — this triggers the missing type branch
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('missing required field "type"'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: wrong "type" value in nested hook → error ───────────────────────

test('fails when nested hook type is not "command"', () => {
  const tmp = makeTmpDir();
  try {
    writeHooksJson(tmp, {
      hooks: {
        SessionStart: [
          { hooks: [{ type: 'script', command: 'echo test' }] }
        ]
      }
    });
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('type must be "command"'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: missing "command" field → error ─────────────────────────────────

test('fails when "command" field is missing', () => {
  const tmp = makeTmpDir();
  try {
    writeHooksJson(tmp, {
      hooks: {
        SessionStart: [
          { type: 'command' }
        ]
      }
    });
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('missing required field "command"'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: "command" is not a string → error ───────────────────────────────

test('fails when "command" is not a string', () => {
  const tmp = makeTmpDir();
  try {
    writeHooksJson(tmp, {
      hooks: {
        SessionStart: [
          { type: 'command', command: 123 }
        ]
      }
    });
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('"command" must be a string'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: "command" is empty string → error ───────────────────────────────

test('fails when "command" is an empty string', () => {
  const tmp = makeTmpDir();
  try {
    writeHooksJson(tmp, {
      hooks: {
        SessionStart: [
          { type: 'command', command: '   ' }
        ]
      }
    });
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('"command" must not be empty'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: PreToolUse without matcher → warning ────────────────────────────

test('warns when PreToolUse hook has no matcher', () => {
  const tmp = makeTmpDir();
  try {
    writeHooksJson(tmp, {
      hooks: {
        PreToolUse: [
          { type: 'command', command: 'echo pre-tool' }
        ]
      }
    });
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 0);
    assert.ok(result.stderr.includes('should have a "matcher"'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: PostToolUse without matcher → warning ───────────────────────────

test('warns when PostToolUse hook has no matcher', () => {
  const tmp = makeTmpDir();
  try {
    writeHooksJson(tmp, {
      hooks: {
        PostToolUse: [
          { type: 'command', command: 'echo post-tool' }
        ]
      }
    });
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 0);
    assert.ok(result.stderr.includes('should have a "matcher"'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: PreToolUse WITH matcher → no warning ────────────────────────────

test('does not warn when PreToolUse hook has a matcher', () => {
  const tmp = makeTmpDir();
  try {
    writeHooksJson(tmp, {
      hooks: {
        PreToolUse: [
          { type: 'command', command: 'echo pre-tool', matcher: 'Bash' }
        ]
      }
    });
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 0);
    assert.ok(!result.stderr.includes('should have a "matcher"'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: nested format (Format B) with hooks array ───────────────────────

test('validates nested hook format (hooks array within entry)', () => {
  const tmp = makeTmpDir();
  try {
    writeHooksJson(tmp, {
      hooks: {
        PreToolUse: [
          {
            matcher: 'Bash',
            hooks: [
              { type: 'command', command: 'echo nested-hook' }
            ]
          }
        ]
      }
    });
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 0);
    assert.ok(result.stdout.includes('PASSED'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: referenced script does not exist → error ──────────────────────

test('fails when referenced script does not exist on disk', () => {
  const tmp = makeTmpDir();
  try {
    writeHooksJson(tmp, {
      hooks: {
        SessionStart: [
          {
            hooks: [
              { type: 'command', command: `node "\${CLAUDE_PLUGIN_ROOT}/scripts/hooks/nonexistent-hook.js"` }
            ]
          }
        ]
      }
    });
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('referenced script not found'));
    assert.ok(result.stderr.includes('nonexistent-hook.js'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: referenced script exists → passes ─────────────────────────────

test('passes when referenced script exists on disk', () => {
  const tmp = makeTmpDir();
  try {
    // Create the script file
    const scriptsDir = path.join(tmp, 'scripts', 'hooks');
    fs.mkdirSync(scriptsDir, { recursive: true });
    fs.writeFileSync(path.join(scriptsDir, 'my-hook.js'), '// hook');

    writeHooksJson(tmp, {
      hooks: {
        SessionStart: [
          {
            hooks: [
              { type: 'command', command: `node "\${CLAUDE_PLUGIN_ROOT}/scripts/hooks/my-hook.js"` }
            ]
          }
        ]
      }
    });
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 0);
    assert.ok(result.stdout.includes('PASSED'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

console.log(`\nvalidate-hooks.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
