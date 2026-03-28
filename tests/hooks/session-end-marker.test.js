#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const scriptPath = path.join(pluginRoot, 'scripts', 'hooks', 'session-end-marker.js');

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

// --- File existence ---
test('session-end-marker.js: script exists', () => {
  assert.ok(fs.existsSync(scriptPath), 'session-end-marker.js not found');
});

// --- Test run() export directly ---
test('exports a run function', () => {
  const mod = require(scriptPath);
  assert.strictEqual(typeof mod.run, 'function', 'Should export run()');
});

test('run() returns input unchanged', () => {
  const mod = require(scriptPath);
  assert.strictEqual(mod.run('hello world'), 'hello world');
});

test('run() returns empty string for undefined input', () => {
  const mod = require(scriptPath);
  assert.strictEqual(mod.run(undefined), '');
});

test('run() returns empty string for null input', () => {
  const mod = require(scriptPath);
  assert.strictEqual(mod.run(null), '');
});

test('run() returns empty string for empty string input', () => {
  const mod = require(scriptPath);
  assert.strictEqual(mod.run(''), '');
});

test('run() returns JSON string input unchanged', () => {
  const mod = require(scriptPath);
  const jsonStr = JSON.stringify({ tool_input: { command: 'test' } });
  assert.strictEqual(mod.run(jsonStr), jsonStr);
});

test('run() returns multiline input unchanged', () => {
  const mod = require(scriptPath);
  const multiline = 'line1\nline2\nline3';
  assert.strictEqual(mod.run(multiline), multiline);
});

// --- CLI (spawnSync) passthrough ---
test('CLI mode passes stdin to stdout', () => {
  const input = 'test input data';
  const result = spawnSync('node', [scriptPath], {
    input,
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.strictEqual(result.stdout, input, 'CLI mode should pass through stdin');
  assert.strictEqual(result.status, 0, 'Should exit 0');
});

test('CLI mode passes JSON stdin to stdout', () => {
  const input = JSON.stringify({ session_id: '123', transcript_path: '/tmp/test.json' });
  const result = spawnSync('node', [scriptPath], {
    input,
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.strictEqual(result.stdout, input, 'CLI mode should pass through JSON stdin');
});

test('CLI mode handles empty stdin', () => {
  const result = spawnSync('node', [scriptPath], {
    input: '',
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.strictEqual(result.stdout, '', 'CLI mode should handle empty stdin');
  assert.strictEqual(result.status, 0);
});

test('CLI mode handles large input within limit', () => {
  const input = 'x'.repeat(1000);
  const result = spawnSync('node', [scriptPath], {
    input,
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.strictEqual(result.stdout, input, 'CLI mode should handle large input');
});

console.log(`\nsession-end-marker.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
