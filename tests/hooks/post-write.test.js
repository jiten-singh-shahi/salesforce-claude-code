#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const scriptPath = path.join(pluginRoot, 'scripts', 'hooks', 'post-write.js');

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

test('post-write.js: script exists', () => {
  assert.ok(fs.existsSync(scriptPath), 'post-write.js not found');
});

test('post-write.js: exits 0 for non-Write tool', () => {
  const result = runScript({ tool_name: 'Edit', tool_input: { file_path: '/tmp/test.cls' } });
  assert.strictEqual(result.exitCode, 0, 'Should exit 0 for non-Write tools');
});

test('post-write.js: shows reminder for Apex class', () => {
  const result = runScript({
    tool_name: 'Write',
    tool_input: { file_path: '/force-app/main/default/classes/MyController.cls' },
  });
  assert.strictEqual(result.exitCode, 0, 'Should exit 0');
  assert.ok(result.stdout.includes('Apex Class Written') || result.stdout.includes('75%'), 'Should remind about Apex coverage');
});

test('post-write.js: shows reminder for Apex trigger', () => {
  const result = runScript({
    tool_name: 'Write',
    tool_input: { file_path: '/force-app/main/default/triggers/AccountTrigger.trigger' },
  });
  assert.strictEqual(result.exitCode, 0, 'Should exit 0');
  assert.ok(result.stdout.includes('Trigger Written') || result.stdout.includes('75%'), 'Should remind about trigger coverage');
});

test('post-write.js: shows reminder for LWC JS file', () => {
  const result = runScript({
    tool_name: 'Write',
    tool_input: { file_path: '/force-app/main/default/lwc/myComponent/myComponent.js' },
  });
  assert.strictEqual(result.exitCode, 0, 'Should exit 0');
  assert.ok(result.stdout.includes('LWC') || result.stdout.includes('Jest'), 'Should remind about LWC Jest tests');
});

test('post-write.js: shows reminder for LWC HTML template', () => {
  const result = runScript({
    tool_name: 'Write',
    tool_input: { file_path: '/force-app/main/default/lwc/myComponent/myComponent.html' },
  });
  assert.strictEqual(result.exitCode, 0, 'Should exit 0');
  assert.ok(result.stdout.includes('LWC') || result.stdout.includes('Template'), 'Should provide LWC template guidance');
});

test('post-write.js: shows reminder for Aura component', () => {
  const result = runScript({
    tool_name: 'Write',
    tool_input: { file_path: '/force-app/main/default/aura/myComponent/myComponentController.js' },
  });
  assert.strictEqual(result.exitCode, 0, 'Should exit 0');
  assert.ok(result.stdout.includes('Aura') || result.stdout.includes('LWC'), 'Should suggest migrating Aura to LWC');
});

test('post-write.js: shows reminder for Visualforce page', () => {
  const result = runScript({
    tool_name: 'Write',
    tool_input: { file_path: '/force-app/main/default/pages/MyPage.page' },
  });
  assert.strictEqual(result.exitCode, 0, 'Should exit 0');
  assert.ok(result.stdout.includes('Visualforce') || result.stdout.includes('controller'), 'Should remind about VF controller tests');
});

test('post-write.js: no reminder for non-SF file', () => {
  const result = runScript({
    tool_name: 'Write',
    tool_input: { file_path: '/src/index.js' },
  });
  assert.strictEqual(result.exitCode, 0, 'Should exit 0');
  assert.ok(!result.stdout.includes('SCC'), 'Should not show reminder for non-SF files');
});

test('post-write.js: handles empty file_path', () => {
  const result = runScript({ tool_name: 'Write', tool_input: {} });
  assert.strictEqual(result.exitCode, 0, 'Should exit 0 on empty file_path');
});

test('post-write.js: handles invalid JSON', () => {
  const result = spawnSync('node', [scriptPath], {
    input: 'not json',
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.strictEqual(result.status, 0, 'Should exit 0 on invalid JSON');
});

console.log(`\npost-write.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
