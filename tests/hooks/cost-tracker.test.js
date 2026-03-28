#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const scriptPath = path.join(pluginRoot, 'scripts', 'hooks', 'cost-tracker.js');

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

function runScript(input, env) {
  const result = spawnSync('node', [scriptPath], {
    input: typeof input === 'string' ? input : JSON.stringify(input),
    encoding: 'utf8',
    timeout: 10000,
    env: { ...process.env, ...env },
  });
  return { stdout: result.stdout || '', stderr: result.stderr || '', exitCode: result.status };
}

test('cost-tracker.js: script exists', () => {
  assert.ok(fs.existsSync(scriptPath), 'cost-tracker.js not found');
});

test('cost-tracker.js: passes through input on stdout', () => {
  const input = { usage: { input_tokens: 100, output_tokens: 50 } };
  const result = runScript(input);
  assert.strictEqual(result.exitCode, 0, 'Should exit 0');
  assert.strictEqual(result.stdout, JSON.stringify(input), 'Should pass through stdin to stdout');
});

test('cost-tracker.js: writes cost entry to metrics file', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-cost-test-'));
  const fakeHome = tmpDir;
  try {
    const input = {
      usage: { input_tokens: 1000, output_tokens: 500 },
      model: 'claude-sonnet-4-6',
    };
    const result = runScript(input, { HOME: fakeHome, CLAUDE_SESSION_ID: 'test-session-123' });
    assert.strictEqual(result.exitCode, 0, 'Should exit 0');

    const metricsFile = path.join(fakeHome, '.claude', 'metrics', 'costs.jsonl');
    assert.ok(fs.existsSync(metricsFile), 'Should create costs.jsonl');

    const line = fs.readFileSync(metricsFile, 'utf8').trim();
    const row = JSON.parse(line);
    assert.strictEqual(row.session_id, 'test-session-123', 'Should record session ID');
    assert.strictEqual(row.input_tokens, 1000, 'Should record input tokens');
    assert.strictEqual(row.output_tokens, 500, 'Should record output tokens');
    assert.ok(row.estimated_cost_usd > 0, 'Should calculate cost > 0');
    assert.ok(row.timestamp, 'Should include timestamp');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('cost-tracker.js: handles empty input gracefully', () => {
  const result = runScript('{}');
  assert.strictEqual(result.exitCode, 0, 'Should exit 0 on empty input');
});

test('cost-tracker.js: handles invalid JSON gracefully', () => {
  const result = runScript('not json at all');
  assert.strictEqual(result.exitCode, 0, 'Should exit 0 on invalid JSON');
});

test('cost-tracker.js: estimates cost for different models', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-cost-model-'));
  try {
    // Test with opus model (most expensive)
    const input = {
      usage: { input_tokens: 1000000, output_tokens: 1000000 },
      model: 'claude-opus-4-6',
    };
    runScript(input, { HOME: tmpDir, CLAUDE_SESSION_ID: 'opus-test' });

    const metricsFile = path.join(tmpDir, '.claude', 'metrics', 'costs.jsonl');
    const line = fs.readFileSync(metricsFile, 'utf8').trim();
    const row = JSON.parse(line);
    // Opus: 15/M in + 75/M out = 15 + 75 = 90
    assert.ok(row.estimated_cost_usd === 90, `Opus cost should be 90, got ${row.estimated_cost_usd}`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('cost-tracker.js: handles alternative token field names', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-cost-alt-'));
  try {
    const input = {
      token_usage: { prompt_tokens: 500, completion_tokens: 200 },
    };
    runScript(input, { HOME: tmpDir, CLAUDE_SESSION_ID: 'alt-test' });

    const metricsFile = path.join(tmpDir, '.claude', 'metrics', 'costs.jsonl');
    const line = fs.readFileSync(metricsFile, 'utf8').trim();
    const row = JSON.parse(line);
    assert.strictEqual(row.input_tokens, 500, 'Should accept prompt_tokens');
    assert.strictEqual(row.output_tokens, 200, 'Should accept completion_tokens');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

console.log(`\ncost-tracker.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
