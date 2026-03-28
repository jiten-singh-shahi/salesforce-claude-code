#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const scriptPath = path.join(pluginRoot, 'scripts', 'hooks', 'pre-write-doc-warn.js');
const docWarningPath = path.join(pluginRoot, 'scripts', 'hooks', 'doc-file-warning.js');

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

function runScript(input) {
  const result = spawnSync('node', [scriptPath], {
    input: typeof input === 'string' ? input : JSON.stringify(input),
    encoding: 'utf8',
    timeout: 10000,
  });
  return { stdout: result.stdout || '', stderr: result.stderr || '', exitCode: result.status };
}

// --- File existence ---
test('pre-write-doc-warn.js: script exists', () => {
  assert.ok(fs.existsSync(scriptPath), 'pre-write-doc-warn.js not found');
});

test('pre-write-doc-warn.js: references doc-file-warning.js', () => {
  const content = fs.readFileSync(scriptPath, 'utf8');
  assert.ok(content.includes('doc-file-warning'), 'Should require doc-file-warning.js');
});

test('doc-file-warning.js dependency exists', () => {
  assert.ok(fs.existsSync(docWarningPath), 'doc-file-warning.js should exist');
});

// --- Behavior is same as doc-file-warning (since it just requires it) ---
test('warns for non-standard .md file', () => {
  const input = { tool_input: { file_path: 'random-notes.md' } };
  const result = runScript(input);
  assert.ok(result.stderr.includes('WARNING'), 'Should warn for non-standard .md');
  assert.strictEqual(result.exitCode, 0);
});

test('does not warn for README.md', () => {
  const input = { tool_input: { file_path: 'README.md' } };
  const result = runScript(input);
  assert.ok(!result.stderr.includes('WARNING'), 'Should not warn for README.md');
  assert.strictEqual(result.exitCode, 0);
});

test('does not warn for non-doc files', () => {
  const input = { tool_input: { file_path: 'src/app.js' } };
  const result = runScript(input);
  assert.ok(!result.stderr.includes('WARNING'), 'Should not warn for .js files');
});

test('passes through stdin to stdout', () => {
  const input = { tool_input: { file_path: 'src/app.js' } };
  const result = runScript(input);
  assert.strictEqual(result.stdout, JSON.stringify(input), 'Should pass through stdin');
});

test('handles invalid JSON gracefully', () => {
  const result = runScript('not valid json');
  assert.strictEqual(result.exitCode, 0, 'Should exit 0 on invalid JSON');
});

test('allows docs/ directory files', () => {
  const input = { tool_input: { file_path: 'docs/api-guide.md' } };
  const result = runScript(input);
  assert.ok(!result.stderr.includes('WARNING'), 'Should not warn for docs/ files');
});

console.log(`\npre-write-doc-warn.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
