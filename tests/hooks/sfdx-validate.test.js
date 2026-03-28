#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const scriptPath = path.join(pluginRoot, 'scripts', 'hooks', 'sfdx-validate.js');

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

test('sfdx-validate.js: script exists', () => {
  assert.ok(fs.existsSync(scriptPath), 'sfdx-validate.js not found');
});

test('sfdx-validate.js: exits 0 for non-Bash tool', () => {
  const result = runScript({ tool_name: 'Write', tool_input: { file_path: '/tmp/test.cls' } });
  assert.strictEqual(result.exitCode, 0, 'Should exit 0 for non-Bash tools');
});

test('sfdx-validate.js: warns about deploy without --test-level', () => {
  const result = runScript({
    tool_name: 'Bash',
    tool_input: { command: 'sf project deploy start --source-dir force-app' },
  });
  assert.strictEqual(result.exitCode, 0, 'Should exit 0 (non-blocking)');
  assert.ok(result.stderr.includes('--test-level') || result.stderr.includes('WARNING'), 'Should warn about missing --test-level');
});

test('sfdx-validate.js: no warning when --test-level present', () => {
  const result = runScript({
    tool_name: 'Bash',
    tool_input: { command: 'sf project deploy start --source-dir force-app --test-level RunLocalTests' },
  });
  assert.ok(!result.stderr.includes('--test-level'), 'Should not warn when test-level is present');
});

test('sfdx-validate.js: warns about bulk delete', () => {
  const result = runScript({
    tool_name: 'Bash',
    tool_input: { command: 'sf data delete bulk --sobject Contact' },
  });
  assert.strictEqual(result.exitCode, 0, 'Should exit 0');
  assert.ok(result.stderr.includes('WARNING') || result.stderr.includes('dry-run'), 'Should suggest --dry-run for bulk delete');
});

test('sfdx-validate.js: info about scratch org deletion', () => {
  const result = runScript({
    tool_name: 'Bash',
    tool_input: { command: 'sf org delete scratch --target-org my-scratch' },
  });
  assert.strictEqual(result.exitCode, 0, 'Should exit 0');
  assert.ok(result.stderr.includes('INFO') || result.stderr.includes('source changes'), 'Should remind about pushing source');
});

test('sfdx-validate.js: warns about --ignore-conflicts', () => {
  const result = runScript({
    tool_name: 'Bash',
    tool_input: { command: 'sf project deploy start --ignore-conflicts --source-dir force-app' },
  });
  assert.strictEqual(result.exitCode, 0, 'Should exit 0');
  assert.ok(result.stderr.includes('--ignore-conflicts') || result.stderr.includes('WARNING'), 'Should warn about ignore-conflicts');
});

test('sfdx-validate.js: info about data import without --plan', () => {
  const result = runScript({
    tool_name: 'Bash',
    tool_input: { command: 'sf data import tree --sobject Account --files data.json' },
  });
  assert.strictEqual(result.exitCode, 0, 'Should exit 0');
  assert.ok(result.stderr.includes('--plan') || result.stderr.includes('INFO'), 'Should suggest --plan for data import');
});

test('sfdx-validate.js: warns about destructive changes', () => {
  const result = runScript({
    tool_name: 'Bash',
    tool_input: { command: 'sf project deploy start --source-dir destructiveChanges' },
  });
  assert.strictEqual(result.exitCode, 0, 'Should exit 0');
  assert.ok(result.stderr.includes('Destructive') || result.stderr.includes('WARNING'), 'Should warn about destructive changes');
});

test('sfdx-validate.js: no warnings for non-SF commands', () => {
  const result = runScript({
    tool_name: 'Bash',
    tool_input: { command: 'npm run build' },
  });
  assert.strictEqual(result.exitCode, 0, 'Should exit 0');
  assert.ok(!result.stderr.includes('WARNING') && !result.stderr.includes('INFO'), 'Should not warn for non-SF commands');
});

test('sfdx-validate.js: handles empty input', () => {
  const result = spawnSync('node', [scriptPath], {
    input: '{}',
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.strictEqual(result.status, 0, 'Should exit 0 on empty input');
});

console.log(`\nsfdx-validate.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
