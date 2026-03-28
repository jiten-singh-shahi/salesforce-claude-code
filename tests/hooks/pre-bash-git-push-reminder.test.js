#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const scriptPath = path.join(pluginRoot, 'scripts', 'hooks', 'pre-bash-git-push-reminder.js');

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

test('pre-bash-git-push-reminder.js: script exists', () => {
  assert.ok(fs.existsSync(scriptPath), 'pre-bash-git-push-reminder.js not found');
});

test('pre-bash-git-push-reminder.js: warns on git push', () => {
  const input = { tool_input: { command: 'git push origin main' } };
  const result = runScript(input);
  assert.ok(result.stderr.includes('Review changes'), 'Should warn to review before push');
});

test('pre-bash-git-push-reminder.js: warns on git push with flags', () => {
  const input = { tool_input: { command: 'git push -u origin feature-branch' } };
  const result = runScript(input);
  assert.ok(result.stderr.includes('Review changes'), 'Should warn for push with flags');
});

test('pre-bash-git-push-reminder.js: ignores non-push commands', () => {
  const input = { tool_input: { command: 'git status' } };
  const result = runScript(input);
  assert.ok(!result.stderr.includes('Review changes'), 'Should not warn for git status');
});

test('pre-bash-git-push-reminder.js: ignores non-git commands', () => {
  const input = { tool_input: { command: 'npm install' } };
  const result = runScript(input);
  assert.ok(!result.stderr.includes('Review changes'), 'Should not warn for npm install');
});

test('pre-bash-git-push-reminder.js: passes through input', () => {
  const input = { tool_input: { command: 'ls' } };
  const result = runScript(input);
  assert.strictEqual(result.stdout, JSON.stringify(input), 'Should pass through stdin');
});

console.log(`\npre-bash-git-push-reminder.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
