#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const scriptPath = path.join(pluginRoot, 'scripts', 'hooks', 'pre-tool-use.js');

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

test('pre-tool-use.js: script exists', () => {
  assert.ok(fs.existsSync(scriptPath), 'pre-tool-use.js not found');
});

test('pre-tool-use.js: exits 0 for non-Bash tool', () => {
  const result = runScript({ tool_name: 'Read', tool_input: { file_path: '/tmp/test.js' } });
  assert.strictEqual(result.exitCode, 0, 'Should exit 0 for non-Bash tools');
  assert.ok(!result.stderr.includes('WARNING'), 'Should not warn for non-Bash tools');
});

test('pre-tool-use.js: exits 0 for non-SF commands', () => {
  const result = runScript({ tool_name: 'Bash', tool_input: { command: 'npm test' } });
  assert.strictEqual(result.exitCode, 0, 'Should exit 0 for non-SF commands');
  assert.ok(!result.stderr.includes('DEPRECATED'), 'Should not warn for non-SF commands');
});

test('pre-tool-use.js: warns about deprecated sfdx commands', () => {
  const result = runScript({
    tool_name: 'Bash',
    tool_input: { command: 'sfdx force:source:deploy -p force-app' },
  });
  assert.strictEqual(result.exitCode, 0, 'Should exit 0 (non-blocking)');
  assert.ok(result.stderr.includes('DEPRECATED'), 'Should flag deprecated command');
  assert.ok(result.stderr.includes('sf project deploy start'), 'Should suggest SF CLI equivalent');
});

test('pre-tool-use.js: warns about production deployments', () => {
  const result = runScript({
    tool_name: 'Bash',
    tool_input: { command: 'sf project deploy start --target-org production-org' },
  });
  assert.strictEqual(result.exitCode, 0, 'Should exit 0');
  assert.ok(result.stderr.includes('PRODUCTION') || result.stderr.includes('WARNING'), 'Should warn about production');
});

test('pre-tool-use.js: warns about org delete', () => {
  const result = runScript({
    tool_name: 'Bash',
    tool_input: { command: 'sf org delete scratch --target-org my-scratch' },
  });
  assert.strictEqual(result.exitCode, 0, 'Should exit 0');
  assert.ok(result.stderr.includes('WARNING') || result.stderr.includes('delete'), 'Should warn about org deletion');
});

test('pre-tool-use.js: warns about bulk delete', () => {
  const result = runScript({
    tool_name: 'Bash',
    tool_input: { command: 'sf data delete bulk --sobject Account' },
  });
  assert.strictEqual(result.exitCode, 0, 'Should exit 0');
  assert.ok(result.stderr.includes('WARNING') || result.stderr.includes('Bulk delete'), 'Should warn about bulk delete');
});

test('pre-tool-use.js: warns about --no-track-source', () => {
  const result = runScript({
    tool_name: 'Bash',
    tool_input: { command: 'sf project deploy start --no-track-source' },
  });
  assert.strictEqual(result.exitCode, 0, 'Should exit 0');
  assert.ok(result.stderr.includes('WARNING') || result.stderr.includes('tracking'), 'Should warn about no source tracking');
});

test('pre-tool-use.js: handles empty input gracefully', () => {
  const result = spawnSync('node', [scriptPath], {
    input: '{}',
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.strictEqual(result.status, 0, 'Should exit 0 on empty input');
});

test('pre-tool-use.js: handles invalid JSON gracefully', () => {
  const result = spawnSync('node', [scriptPath], {
    input: 'not json',
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.strictEqual(result.status, 0, 'Should exit 0 on invalid JSON');
});

test('pre-tool-use.js: includes migration docs link', () => {
  const result = runScript({
    tool_name: 'Bash',
    tool_input: { command: 'sfdx force:apex:execute -f script.apex' },
  });
  assert.ok(result.stderr.includes('salesforcecli/migration') || result.stderr.includes('DOCS'), 'Should include docs link');
});

console.log(`\npre-tool-use.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
