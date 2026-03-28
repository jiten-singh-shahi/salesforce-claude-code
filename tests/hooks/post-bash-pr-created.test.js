#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const scriptPath = path.join(pluginRoot, 'scripts', 'hooks', 'post-bash-pr-created.js');

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

test('post-bash-pr-created.js: script exists', () => {
  assert.ok(fs.existsSync(scriptPath), 'post-bash-pr-created.js not found');
});

test('post-bash-pr-created.js: passes through input', () => {
  const input = { tool_input: { command: 'echo hello' } };
  const result = runScript(input);
  assert.strictEqual(result.stdout, JSON.stringify(input), 'Should pass through stdin');
});

test('post-bash-pr-created.js: detects PR creation with URL', () => {
  const input = {
    tool_input: { command: 'gh pr create --title "test"' },
    tool_output: { output: 'https://github.com/user/repo/pull/42' },
  };
  const result = runScript(input);
  assert.ok(result.stderr.includes('PR created'), 'Should detect PR creation');
  assert.ok(result.stderr.includes('pull/42'), 'Should extract PR number');
});

test('post-bash-pr-created.js: suggests review command', () => {
  const input = {
    tool_input: { command: 'gh pr create --title "test"' },
    tool_output: { output: 'https://github.com/user/repo/pull/42' },
  };
  const result = runScript(input);
  assert.ok(result.stderr.includes('gh pr review'), 'Should suggest review command');
  assert.ok(result.stderr.includes('user/repo'), 'Should include repo in review command');
});

test('post-bash-pr-created.js: ignores non-PR commands', () => {
  const input = { tool_input: { command: 'git push origin main' } };
  const result = runScript(input);
  assert.ok(!result.stderr.includes('PR created'), 'Should not trigger for git push');
});

test('post-bash-pr-created.js: handles missing PR URL', () => {
  const input = {
    tool_input: { command: 'gh pr create --title "test"' },
    tool_output: { output: 'Error: could not create PR' },
  };
  const result = runScript(input);
  assert.ok(!result.stderr.includes('PR created'), 'Should not trigger without valid URL');
});

console.log(`\npost-bash-pr-created.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
