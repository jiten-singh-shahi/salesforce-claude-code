#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const scriptPath = path.join(pluginRoot, 'scripts', 'hooks', 'suggest-compact.js');

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

function runScript(env) {
  const result = spawnSync('node', [scriptPath], {
    input: '{}',
    encoding: 'utf8',
    timeout: 10000,
    env: { ...process.env, ...env },
  });
  return { stdout: result.stdout || '', stderr: result.stderr || '', exitCode: result.status };
}

test('suggest-compact.js: script exists', () => {
  assert.ok(fs.existsSync(scriptPath), 'suggest-compact.js not found');
});

test('suggest-compact.js: exits 0 on normal run', () => {
  const sessionId = `test-compact-${Date.now()}`;
  const result = runScript({ CLAUDE_SESSION_ID: sessionId });
  assert.strictEqual(result.exitCode, 0, 'Should exit 0');
  // Clean up counter file
  const counterFile = path.join(os.tmpdir(), `scc-tool-count-${sessionId}`);
  try { fs.unlinkSync(counterFile); } catch { /* ignore */ }
});

test('suggest-compact.js: increments counter file', () => {
  const sessionId = `test-inc-${Date.now()}`;
  const counterFile = path.join(os.tmpdir(), `scc-tool-count-${sessionId}`);
  try {
    // Run once
    runScript({ CLAUDE_SESSION_ID: sessionId });
    const count1 = parseInt(fs.readFileSync(counterFile, 'utf8').trim(), 10);
    assert.strictEqual(count1, 1, 'First run should set count to 1');

    // Run again
    runScript({ CLAUDE_SESSION_ID: sessionId });
    const count2 = parseInt(fs.readFileSync(counterFile, 'utf8').trim(), 10);
    assert.strictEqual(count2, 2, 'Second run should set count to 2');
  } finally {
    try { fs.unlinkSync(counterFile); } catch { /* ignore */ }
  }
});

test('suggest-compact.js: suggests compact at threshold', () => {
  const sessionId = `test-thresh-${Date.now()}`;
  const counterFile = path.join(os.tmpdir(), `scc-tool-count-${sessionId}`);
  try {
    // Pre-set counter to threshold - 1
    fs.writeFileSync(counterFile, '4');
    const result = runScript({ CLAUDE_SESSION_ID: sessionId, COMPACT_THRESHOLD: '5' });
    assert.ok(result.stderr.includes('tool calls reached'), 'Should suggest compact at threshold');
    assert.ok(result.stderr.includes('/compact'), 'Should mention /compact');
  } finally {
    try { fs.unlinkSync(counterFile); } catch { /* ignore */ }
  }
});

test('suggest-compact.js: no message below threshold', () => {
  const sessionId = `test-below-${Date.now()}`;
  const counterFile = path.join(os.tmpdir(), `scc-tool-count-${sessionId}`);
  try {
    // Pre-set counter to 2
    fs.writeFileSync(counterFile, '2');
    const result = runScript({ CLAUDE_SESSION_ID: sessionId, COMPACT_THRESHOLD: '50' });
    assert.ok(!result.stderr.includes('tool calls reached'), 'Should not suggest below threshold');
  } finally {
    try { fs.unlinkSync(counterFile); } catch { /* ignore */ }
  }
});

test('suggest-compact.js: reminder every 25 calls after threshold', () => {
  const sessionId = `test-reminder-${Date.now()}`;
  const counterFile = path.join(os.tmpdir(), `scc-tool-count-${sessionId}`);
  try {
    // Pre-set counter to threshold + 24 (next run will be threshold + 25)
    fs.writeFileSync(counterFile, '74');
    const result = runScript({ CLAUDE_SESSION_ID: sessionId, COMPACT_THRESHOLD: '50' });
    assert.ok(result.stderr.includes('good checkpoint'), 'Should remind at 25-call intervals');
  } finally {
    try { fs.unlinkSync(counterFile); } catch { /* ignore */ }
  }
});

test('suggest-compact.js: sanitizes session ID', () => {
  const sessionId = 'test/../../../etc/passwd';
  const result = runScript({ CLAUDE_SESSION_ID: sessionId });
  assert.strictEqual(result.exitCode, 0, 'Should handle malicious session ID safely');
});

console.log(`\nsuggest-compact.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
