#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const scriptPath = path.join(pluginRoot, 'scripts', 'hooks', 'doc-file-warning.js');

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
test('doc-file-warning.js: script exists', () => {
  assert.ok(fs.existsSync(scriptPath), 'doc-file-warning.js not found');
});

// --- Allowed doc paths (should NOT warn) ---
test('allows non-markdown/txt files', () => {
  const input = { tool_input: { file_path: 'src/main.js' } };
  const result = runScript(input);
  assert.ok(!result.stderr.includes('WARNING'), 'Should not warn for .js files');
  assert.strictEqual(result.exitCode, 0);
});

test('allows README.md', () => {
  const input = { tool_input: { file_path: 'README.md' } };
  const result = runScript(input);
  assert.ok(!result.stderr.includes('WARNING'), 'Should not warn for README.md');
});

test('allows CLAUDE.md', () => {
  const input = { tool_input: { file_path: 'CLAUDE.md' } };
  const result = runScript(input);
  assert.ok(!result.stderr.includes('WARNING'), 'Should not warn for CLAUDE.md');
});

test('allows CONTRIBUTING.md', () => {
  const input = { tool_input: { file_path: 'CONTRIBUTING.md' } };
  const result = runScript(input);
  assert.ok(!result.stderr.includes('WARNING'), 'Should not warn for CONTRIBUTING.md');
});

test('allows CHANGELOG.md', () => {
  const input = { tool_input: { file_path: 'CHANGELOG.md' } };
  const result = runScript(input);
  assert.ok(!result.stderr.includes('WARNING'), 'Should not warn for CHANGELOG.md');
});

test('allows LICENSE.md', () => {
  const input = { tool_input: { file_path: 'LICENSE.md' } };
  const result = runScript(input);
  assert.ok(!result.stderr.includes('WARNING'), 'Should not warn for LICENSE.md');
});

test('allows SKILL.md', () => {
  const input = { tool_input: { file_path: 'SKILL.md' } };
  const result = runScript(input);
  assert.ok(!result.stderr.includes('WARNING'), 'Should not warn for SKILL.md');
});

test('allows MEMORY.md', () => {
  const input = { tool_input: { file_path: 'MEMORY.md' } };
  const result = runScript(input);
  assert.ok(!result.stderr.includes('WARNING'), 'Should not warn for MEMORY.md');
});

test('allows WORKLOG.md', () => {
  const input = { tool_input: { file_path: 'WORKLOG.md' } };
  const result = runScript(input);
  assert.ok(!result.stderr.includes('WARNING'), 'Should not warn for WORKLOG.md');
});

test('allows .claude/commands/ paths', () => {
  const input = { tool_input: { file_path: '.claude/commands/my-cmd.md' } };
  const result = runScript(input);
  assert.ok(!result.stderr.includes('WARNING'), 'Should not warn for .claude/commands/');
});

test('allows .claude/plans/ paths', () => {
  const input = { tool_input: { file_path: '.claude/plans/plan.md' } };
  const result = runScript(input);
  assert.ok(!result.stderr.includes('WARNING'), 'Should not warn for .claude/plans/');
});

test('allows .claude/projects/ paths', () => {
  const input = { tool_input: { file_path: '.claude/projects/proj.md' } };
  const result = runScript(input);
  assert.ok(!result.stderr.includes('WARNING'), 'Should not warn for .claude/projects/');
});

test('allows docs/ directory', () => {
  const input = { tool_input: { file_path: 'docs/guide.md' } };
  const result = runScript(input);
  assert.ok(!result.stderr.includes('WARNING'), 'Should not warn for docs/');
});

test('allows skills/ directory', () => {
  const input = { tool_input: { file_path: 'skills/my-skill.md' } };
  const result = runScript(input);
  assert.ok(!result.stderr.includes('WARNING'), 'Should not warn for skills/');
});

test('allows .history/ directory', () => {
  const input = { tool_input: { file_path: '.history/old.md' } };
  const result = runScript(input);
  assert.ok(!result.stderr.includes('WARNING'), 'Should not warn for .history/');
});

test('allows memory/ directory', () => {
  const input = { tool_input: { file_path: 'memory/notes.md' } };
  const result = runScript(input);
  assert.ok(!result.stderr.includes('WARNING'), 'Should not warn for memory/');
});

test('allows .plan.md suffix', () => {
  const input = { tool_input: { file_path: 'my-feature.plan.md' } };
  const result = runScript(input);
  assert.ok(!result.stderr.includes('WARNING'), 'Should not warn for .plan.md files');
});

// --- Non-allowed doc paths (should WARN) ---
test('warns for random .md file in root', () => {
  const input = { tool_input: { file_path: 'random-notes.md' } };
  const result = runScript(input);
  assert.ok(result.stderr.includes('WARNING'), 'Should warn for non-standard .md');
  assert.ok(result.stderr.includes('random-notes.md'), 'Should include the file path');
  assert.ok(result.stderr.includes('consolidating'), 'Should suggest consolidating');
});

test('warns for random .txt file', () => {
  const input = { tool_input: { file_path: 'notes.txt' } };
  const result = runScript(input);
  assert.ok(result.stderr.includes('WARNING'), 'Should warn for .txt files');
});

test('warns for .md in non-standard subdirectory', () => {
  const input = { tool_input: { file_path: 'src/notes.md' } };
  const result = runScript(input);
  assert.ok(result.stderr.includes('WARNING'), 'Should warn for .md in src/');
});

// --- Passthrough behavior ---
test('passes through stdin to stdout', () => {
  const input = { tool_input: { file_path: 'src/main.js' } };
  const result = runScript(input);
  assert.strictEqual(result.stdout, JSON.stringify(input), 'Should pass through stdin');
});

test('passes through stdin even when warning', () => {
  const input = { tool_input: { file_path: 'random.md' } };
  const result = runScript(input);
  assert.strictEqual(result.stdout, JSON.stringify(input), 'Should pass through stdin on warning');
});

// --- Edge cases ---
test('handles empty file_path gracefully', () => {
  const input = { tool_input: { file_path: '' } };
  const result = runScript(input);
  assert.ok(!result.stderr.includes('WARNING'), 'Should not warn for empty path');
  assert.strictEqual(result.exitCode, 0);
});

test('handles missing tool_input gracefully', () => {
  const input = {};
  const result = runScript(input);
  assert.ok(!result.stderr.includes('WARNING'), 'Should not warn for missing tool_input');
  assert.strictEqual(result.exitCode, 0);
});

test('handles invalid JSON gracefully', () => {
  const result = runScript('not-json');
  assert.strictEqual(result.exitCode, 0, 'Should exit 0 on invalid JSON');
});

test('handles backslash paths (Windows-style)', () => {
  const input = { tool_input: { file_path: 'docs\\guide.md' } };
  const result = runScript(input);
  assert.ok(!result.stderr.includes('WARNING'), 'Should normalize backslash paths');
});

test('case insensitive readme check', () => {
  const input = { tool_input: { file_path: 'readme.md' } };
  const result = runScript(input);
  assert.ok(!result.stderr.includes('WARNING'), 'Should allow case-insensitive README.md');
});

test('exits with code 0 always', () => {
  const input = { tool_input: { file_path: 'random.md' } };
  const result = runScript(input);
  assert.strictEqual(result.exitCode, 0, 'Should always exit 0 (warn only, never block)');
});

console.log(`\ndoc-file-warning.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
