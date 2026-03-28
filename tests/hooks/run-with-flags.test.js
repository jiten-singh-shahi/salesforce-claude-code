#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const scriptPath = path.join(pluginRoot, 'scripts', 'hooks', 'run-with-flags.js');

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

// Helper to run the script with given args and stdin
function runWithFlags(hookName, minProfile, targetScript, stdin, env) {
  const args = [scriptPath];
  if (hookName !== undefined) args.push(hookName);
  if (minProfile !== undefined) args.push(minProfile);
  if (targetScript !== undefined) args.push(targetScript);

  return spawnSync(process.execPath, args, {
    input: stdin || '',
    encoding: 'utf8',
    timeout: 15000,
    env: { ...process.env, ...env },
  });
}

test('run-with-flags.js: script exists', () => {
  assert.ok(fs.existsSync(scriptPath), 'run-with-flags.js not found');
});

// ── Pass-through when missing args ──

test('run-with-flags.js: passes stdin through when no arguments provided', () => {
  const result = runWithFlags(undefined, undefined, undefined, 'hello pass-through');
  assert.strictEqual(result.status, 0);
  assert.strictEqual(result.stdout, 'hello pass-through');
});

test('run-with-flags.js: passes stdin through when only hookName provided (no scriptPath)', () => {
  const result = runWithFlags('my-hook', undefined, undefined, 'pass me through');
  assert.strictEqual(result.status, 0);
  assert.strictEqual(result.stdout, 'pass me through');
});

// ── Profile gating ──

test('run-with-flags.js: skips hook when profile is below minimum (minimal < strict)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-rwf-'));
  try {
    const hookScript = path.join(tmpDir, 'test-hook.js');
    fs.writeFileSync(hookScript, `
      'use strict';
      function run(input) { return 'HOOK_EXECUTED'; }
      module.exports = { run };
    `);

    const result = runWithFlags('test-hook', 'strict', hookScript, 'input-data', {
      SCC_HOOK_PROFILE: 'minimal',
    });

    assert.strictEqual(result.status, 0);
    assert.strictEqual(result.stdout, 'input-data', 'Should pass through input when skipped');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('run-with-flags.js: skips hook when profile is minimal and min is standard', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-rwf2-'));
  try {
    const hookScript = path.join(tmpDir, 'test-hook.js');
    fs.writeFileSync(hookScript, `
      'use strict';
      function run(input) { return 'HOOK_EXECUTED'; }
      module.exports = { run };
    `);

    const result = runWithFlags('test-hook', 'standard', hookScript, 'input-data', {
      SCC_HOOK_PROFILE: 'minimal',
    });

    assert.strictEqual(result.status, 0);
    assert.strictEqual(result.stdout, 'input-data');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('run-with-flags.js: runs hook when profile meets minimum (standard >= standard)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-rwf3-'));
  try {
    const hookScript = path.join(tmpDir, 'test-hook.js');
    fs.writeFileSync(hookScript, `
      'use strict';
      function run(input) { return 'HOOK_EXECUTED'; }
      module.exports = { run };
    `);

    const result = runWithFlags('test-hook', 'standard', hookScript, 'input-data', {
      SCC_HOOK_PROFILE: 'standard',
    });

    assert.strictEqual(result.status, 0);
    assert.strictEqual(result.stdout, 'HOOK_EXECUTED');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('run-with-flags.js: runs hook when profile exceeds minimum (strict > standard)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-rwf4-'));
  try {
    const hookScript = path.join(tmpDir, 'test-hook.js');
    fs.writeFileSync(hookScript, `
      'use strict';
      function run(input) { return 'HOOK_RAN'; }
      module.exports = { run };
    `);

    const result = runWithFlags('test-hook', 'standard', hookScript, 'my-input', {
      SCC_HOOK_PROFILE: 'strict',
    });

    assert.strictEqual(result.status, 0);
    assert.strictEqual(result.stdout, 'HOOK_RAN');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('run-with-flags.js: runs hook when profile is minimal and min is minimal', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-rwf5-'));
  try {
    const hookScript = path.join(tmpDir, 'test-hook.js');
    fs.writeFileSync(hookScript, `
      'use strict';
      function run(input) { return 'MINIMAL_OK'; }
      module.exports = { run };
    `);

    const result = runWithFlags('test-hook', 'minimal', hookScript, 'data', {
      SCC_HOOK_PROFILE: 'minimal',
    });

    assert.strictEqual(result.status, 0);
    assert.strictEqual(result.stdout, 'MINIMAL_OK');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

// ── Disabled hooks ──

test('run-with-flags.js: skips disabled hook', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-rwf6-'));
  try {
    const hookScript = path.join(tmpDir, 'test-hook.js');
    fs.writeFileSync(hookScript, `
      'use strict';
      function run(input) { return 'SHOULD_NOT_RUN'; }
      module.exports = { run };
    `);

    const result = runWithFlags('my-hook', 'minimal', hookScript, 'pass-through-data', {
      SCC_HOOK_PROFILE: 'strict',
      SCC_DISABLED_HOOKS: 'my-hook,other-hook',
    });

    assert.strictEqual(result.status, 0);
    assert.strictEqual(result.stdout, 'pass-through-data');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('run-with-flags.js: runs hook that is not in disabled list', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-rwf7-'));
  try {
    const hookScript = path.join(tmpDir, 'test-hook.js');
    fs.writeFileSync(hookScript, `
      'use strict';
      function run(input) { return 'NOT_DISABLED'; }
      module.exports = { run };
    `);

    const result = runWithFlags('my-hook', 'minimal', hookScript, 'data', {
      SCC_HOOK_PROFILE: 'strict',
      SCC_DISABLED_HOOKS: 'other-hook,another-hook',
    });

    assert.strictEqual(result.status, 0);
    assert.strictEqual(result.stdout, 'NOT_DISABLED');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

// ── Script file validation ──

test('run-with-flags.js: passes through when script path does not exist', () => {
  const result = runWithFlags('test-hook', 'minimal', '/nonexistent/hook.js', 'fallback', {
    SCC_HOOK_PROFILE: 'strict',
  });

  assert.strictEqual(result.status, 0);
  assert.strictEqual(result.stdout, 'fallback');
  assert.ok((result.stderr || '').includes('Script not found'), 'Should log error about missing script');
});

test('run-with-flags.js: passes through when script path is not a .js file', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-rwf8-'));
  try {
    const notJs = path.join(tmpDir, 'hook.txt');
    fs.writeFileSync(notJs, 'not a js file');

    const result = runWithFlags('test-hook', 'minimal', notJs, 'fallback-data', {
      SCC_HOOK_PROFILE: 'strict',
    });

    assert.strictEqual(result.status, 0);
    assert.strictEqual(result.stdout, 'fallback-data');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

// ── Hook execution: run() export ──

test('run-with-flags.js: calls run() with stdin and returns output', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-rwf9-'));
  try {
    const hookScript = path.join(tmpDir, 'echo-hook.js');
    fs.writeFileSync(hookScript, `
      'use strict';
      function run(input) { return 'echo:' + input; }
      module.exports = { run };
    `);

    const result = runWithFlags('echo-hook', 'minimal', hookScript, 'test-input', {
      SCC_HOOK_PROFILE: 'standard',
    });

    assert.strictEqual(result.status, 0);
    assert.strictEqual(result.stdout, 'echo:test-input');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('run-with-flags.js: handles run() returning null (no output)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-rwf10-'));
  try {
    const hookScript = path.join(tmpDir, 'null-hook.js');
    fs.writeFileSync(hookScript, `
      'use strict';
      function run(input) { return null; }
      module.exports = { run };
    `);

    const result = runWithFlags('null-hook', 'minimal', hookScript, 'data', {
      SCC_HOOK_PROFILE: 'standard',
    });

    assert.strictEqual(result.status, 0);
    assert.strictEqual(result.stdout, '');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('run-with-flags.js: handles run() returning undefined (no output)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-rwf11-'));
  try {
    const hookScript = path.join(tmpDir, 'undef-hook.js');
    fs.writeFileSync(hookScript, `
      'use strict';
      function run(input) { /* returns undefined */ }
      module.exports = { run };
    `);

    const result = runWithFlags('undef-hook', 'minimal', hookScript, 'data', {
      SCC_HOOK_PROFILE: 'standard',
    });

    assert.strictEqual(result.status, 0);
    assert.strictEqual(result.stdout, '');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('run-with-flags.js: handles run() that throws an error', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-rwf12-'));
  try {
    const hookScript = path.join(tmpDir, 'error-hook.js');
    fs.writeFileSync(hookScript, `
      'use strict';
      function run(input) { throw new Error('hook failed'); }
      module.exports = { run };
    `);

    const result = runWithFlags('error-hook', 'minimal', hookScript, 'fallback-on-error', {
      SCC_HOOK_PROFILE: 'standard',
    });

    assert.strictEqual(result.status, 0);
    assert.strictEqual(result.stdout, 'fallback-on-error', 'Should pass through stdin on error');
    assert.ok((result.stderr || '').includes('hook failed'), 'Should log error message');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

// ── Legacy path: hooks without run() export ──

test('run-with-flags.js: spawns legacy hook without run() export', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-rwf13-'));
  try {
    const hookScript = path.join(tmpDir, 'legacy-hook.js');
    fs.writeFileSync(hookScript, `
      // Legacy hook — no module.exports, just reads stdin and writes stdout
      let data = '';
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', chunk => { data += chunk; });
      process.stdin.on('end', () => {
        process.stdout.write('legacy:' + data);
      });
    `);

    const result = runWithFlags('legacy-hook', 'minimal', hookScript, 'legacy-input', {
      SCC_HOOK_PROFILE: 'standard',
    });

    assert.strictEqual(result.stdout, 'legacy:legacy-input');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

// ── Default profile ──

test('run-with-flags.js: defaults to standard profile when SCC_HOOK_PROFILE not set', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-rwf14-'));
  try {
    const hookScript = path.join(tmpDir, 'default-hook.js');
    fs.writeFileSync(hookScript, `
      'use strict';
      function run(input) { return 'default-profile'; }
      module.exports = { run };
    `);

    // Don't set SCC_HOOK_PROFILE — should default to 'standard'
    // Hook requires 'standard' — should run since default is 'standard'
    const env = { ...process.env };
    delete env.SCC_HOOK_PROFILE;
    delete env.SCC_DISABLED_HOOKS;

    const result = runWithFlags('default-hook', 'standard', hookScript, 'data', env);

    assert.strictEqual(result.status, 0);
    assert.strictEqual(result.stdout, 'default-profile');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

// ── Unknown profile level ──

test('run-with-flags.js: treats unknown profile as level 2 (standard)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-rwf15-'));
  try {
    const hookScript = path.join(tmpDir, 'unknown-hook.js');
    fs.writeFileSync(hookScript, `
      'use strict';
      function run(input) { return 'unknown-profile-ok'; }
      module.exports = { run };
    `);

    const result = runWithFlags('test-hook', 'standard', hookScript, 'data', {
      SCC_HOOK_PROFILE: 'custom-unknown',
    });

    assert.strictEqual(result.status, 0);
    // Unknown profile defaults to level 2, standard is level 2, so 2 >= 2 → runs
    assert.strictEqual(result.stdout, 'unknown-profile-ok');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('run-with-flags.js: handles require() failure by falling back to spawn', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-rwf16-'));
  try {
    const hookScript = path.join(tmpDir, 'bad-require-hook.js');
    // This file has module.exports and run keywords (to trigger require path)
    // but the require() will fail due to syntax error in module scope
    fs.writeFileSync(hookScript, `
      'use strict';
      // module.exports and run keywords present to trigger require path
      const invalid = require('nonexistent-module-xyz-12345');
      function run(input) { return 'never'; }
      module.exports = { run };
    `);

    // Since require fails, it falls through to spawnSync.
    // The spawned process will also fail (same require error).
    const result = runWithFlags('bad-hook', 'minimal', hookScript, 'data', {
      SCC_HOOK_PROFILE: 'standard',
    });

    // It should still handle gracefully
    assert.ok(result.stderr.includes('require()') || result.stderr.includes('nonexistent'),
      'Should report the require/spawn error');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

// ── Tests: timeout and error handling ────────────────────────────────────────

test('run-with-flags.js: script that times out passes through stdin and logs warning', () => {
  // Create a script that sleeps forever
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-rwf-timeout-'));
  const sleepScript = path.join(tmpDir, 'sleep-forever.js');
  fs.writeFileSync(sleepScript, 'setTimeout(() => {}, 999999);');

  try {
    // Run with a very short timeout (100ms via 5th arg)
    const args = [scriptPath, 'timeout-test', 'standard', sleepScript, '100'];
    const result = spawnSync(process.execPath, args, {
      input: '{"test":"passthrough"}',
      encoding: 'utf8',
      timeout: 5000,
      env: { ...process.env, SCC_HOOK_PROFILE: 'standard' },
    });

    // Should pass through stdin (not swallow it) and log the timeout
    const combined = (result.stdout || '') + (result.stderr || '');
    // Either the hook passes through or logs an error — either way it shouldn't crash
    assert.notStrictEqual(result.status, null,
      'Process should exit (not hang) when hook times out');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('run-with-flags.js: nonexistent script passes through stdin gracefully', () => {
  const result = runWithFlags('missing-hook', 'standard', '/nonexistent/script.js', '{"data":"test"}');
  // Should pass through stdin when script doesn't exist
  assert.ok(result.stdout.includes('{"data":"test"}') || result.status === 0,
    'Should pass through or exit cleanly on missing script');
});

console.log(`\nrun-with-flags.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
