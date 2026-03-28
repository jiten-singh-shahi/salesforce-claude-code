#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const scriptPath = path.join(pluginRoot, 'scripts', 'hooks', 'pre-bash-tmux-reminder.js');

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

function runScript(input, envOverrides = {}) {
  // Remove TMUX from env to simulate non-tmux environment (unless explicitly set)
  const baseEnv = { ...process.env };
  delete baseEnv.TMUX;
  const env = { ...baseEnv, ...envOverrides };

  const result = spawnSync('node', [scriptPath], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    timeout: 10000,
    env,
  });
  return { stdout: result.stdout || '', stderr: result.stderr || '', exitCode: result.status };
}

// --- File existence ---
test('pre-bash-tmux-reminder.js: script exists', () => {
  assert.ok(fs.existsSync(scriptPath), 'pre-bash-tmux-reminder.js not found');
});

// --- SF commands that should trigger warnings ---
test('warns on sf project deploy', () => {
  const input = { tool_input: { command: 'sf project deploy start --source-dir force-app' } };
  const result = runScript(input);
  assert.ok(result.stderr.includes('Long-running Salesforce command'), 'Should warn for sf project deploy');
  assert.ok(result.stderr.includes('tmux'), 'Should suggest tmux');
});

test('warns on sfdx force:source:deploy', () => {
  const input = { tool_input: { command: 'sfdx force:source:deploy -p force-app' } };
  const result = runScript(input);
  assert.ok(result.stderr.includes('Long-running Salesforce command'), 'Should warn for sfdx deploy');
});

test('warns on sfdx force:mdapi:deploy', () => {
  const input = { tool_input: { command: 'sfdx force:mdapi:deploy -d mdapi_output' } };
  const result = runScript(input);
  assert.ok(result.stderr.includes('Long-running Salesforce command'), 'Should warn for mdapi deploy');
});

test('warns on sf apex run test', () => {
  const input = { tool_input: { command: 'sf apex run test --code-coverage' } };
  const result = runScript(input);
  assert.ok(result.stderr.includes('Long-running Salesforce command'), 'Should warn for sf apex run test');
});

test('warns on sfdx force:apex:test:run', () => {
  const input = { tool_input: { command: 'sfdx force:apex:test:run -c' } };
  const result = runScript(input);
  assert.ok(result.stderr.includes('Long-running Salesforce command'), 'Should warn for sfdx test run');
});

test('warns on sf org create scratch', () => {
  const input = { tool_input: { command: 'sf org create scratch -f config/project-scratch-def.json' } };
  const result = runScript(input);
  assert.ok(result.stderr.includes('Long-running Salesforce command'), 'Should warn for scratch org creation');
});

test('warns on sfdx force:org:create', () => {
  const input = { tool_input: { command: 'sfdx force:org:create -f config/project-scratch-def.json' } };
  const result = runScript(input);
  assert.ok(result.stderr.includes('Long-running Salesforce command'), 'Should warn for sfdx org create');
});

test('warns on npm test', () => {
  const input = { tool_input: { command: 'npm test' } };
  const result = runScript(input);
  assert.ok(result.stderr.includes('Long-running Salesforce command'), 'Should warn for npm test');
});

test('warns on jest', () => {
  const input = { tool_input: { command: 'jest --coverage' } };
  const result = runScript(input);
  assert.ok(result.stderr.includes('Long-running Salesforce command'), 'Should warn for jest');
});

// --- Commands that should NOT trigger warnings ---
test('does not warn for git status', () => {
  const input = { tool_input: { command: 'git status' } };
  const result = runScript(input);
  assert.ok(!result.stderr.includes('Long-running'), 'Should not warn for git status');
});

test('does not warn for ls', () => {
  const input = { tool_input: { command: 'ls -la' } };
  const result = runScript(input);
  assert.ok(!result.stderr.includes('Long-running'), 'Should not warn for ls');
});

test('does not warn for sf help', () => {
  const input = { tool_input: { command: 'sf --help' } };
  const result = runScript(input);
  assert.ok(!result.stderr.includes('Long-running'), 'Should not warn for sf help');
});

// --- TMUX suppression ---
test('does not warn inside tmux', () => {
  const input = { tool_input: { command: 'sf project deploy start' } };
  const result = runScript(input, { TMUX: '/tmp/tmux-1000/default,12345,0' });
  assert.ok(!result.stderr.includes('Long-running'), 'Should not warn when TMUX env is set');
});

// --- Passthrough behavior ---
test('passes through stdin to stdout', () => {
  const input = { tool_input: { command: 'ls' } };
  const result = runScript(input);
  assert.strictEqual(result.stdout, JSON.stringify(input), 'Should pass through stdin');
});

test('passes through stdin even when warning', () => {
  const input = { tool_input: { command: 'sf project deploy start' } };
  const result = runScript(input);
  assert.strictEqual(result.stdout, JSON.stringify(input), 'Should pass through stdin on warning');
});

// --- Edge cases ---
test('handles missing command gracefully', () => {
  const input = { tool_input: {} };
  const result = runScript(input);
  assert.ok(!result.stderr.includes('Long-running'), 'Should not warn for missing command');
  assert.strictEqual(result.exitCode, 0);
});

test('handles invalid JSON gracefully', () => {
  const result = spawnSync('node', [scriptPath], {
    input: 'not-json',
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.strictEqual(result.status, 0, 'Should exit 0 on invalid JSON');
});

test('exits with code 0', () => {
  const input = { tool_input: { command: 'sf project deploy start' } };
  const result = runScript(input);
  assert.strictEqual(result.exitCode, 0, 'Should always exit 0');
});

test('stderr includes tmux new and attach commands', () => {
  const input = { tool_input: { command: 'sf project deploy start' } };
  const result = runScript(input);
  assert.ok(result.stderr.includes('tmux new -s sf-dev'), 'Should include tmux new command');
  assert.ok(result.stderr.includes('tmux attach -t sf-dev'), 'Should include tmux attach command');
});

console.log(`\npre-bash-tmux-reminder.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
