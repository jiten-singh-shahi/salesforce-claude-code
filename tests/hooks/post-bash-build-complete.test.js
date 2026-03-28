#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const scriptPath = path.join(pluginRoot, 'scripts', 'hooks', 'post-bash-build-complete.js');

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
    input: JSON.stringify(input),
    encoding: 'utf8',
    timeout: 10000,
  });
  return { stdout: result.stdout || '', stderr: result.stderr || '', exitCode: result.status };
}

test('post-bash-build-complete.js: script exists', () => {
  assert.ok(fs.existsSync(scriptPath), 'post-bash-build-complete.js not found');
});

test('post-bash-build-complete.js: passes through input', () => {
  const input = { tool_input: { command: 'echo hello' } };
  const result = runScript(input);
  assert.strictEqual(result.stdout, JSON.stringify(input), 'Should pass through stdin');
});

test('post-bash-build-complete.js: detects sf deploy command', () => {
  const input = { tool_input: { command: 'sf project deploy start --source-dir force-app' } };
  const result = runScript(input);
  assert.ok(result.stderr.includes('Build/deploy completed'), 'Should detect sf deploy');
});

test('post-bash-build-complete.js: detects npm build command', () => {
  const input = { tool_input: { command: 'npm run build' } };
  const result = runScript(input);
  assert.ok(result.stderr.includes('Build/deploy completed'), 'Should detect npm build');
});

test('post-bash-build-complete.js: ignores non-build commands', () => {
  const input = { tool_input: { command: 'ls -la' } };
  const result = runScript(input);
  assert.ok(!result.stderr.includes('Build/deploy'), 'Should not trigger for ls');
});

test('post-bash-build-complete.js: handles empty input', () => {
  const result = runScript({});
  assert.ok(result.exitCode === 0 || result.exitCode === null, 'Should not crash on empty input');
});

console.log(`\npost-bash-build-complete.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
