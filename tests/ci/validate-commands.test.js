#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const validatorScript = path.join(pluginRoot, 'scripts/ci/validate-commands.js');

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

function runValidator(envRoot) {
  return spawnSync(process.execPath, [validatorScript], {
    encoding: 'utf8',
    timeout: 15000,
    env: { ...process.env, SCC_PLUGIN_ROOT: envRoot },
  });
}

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'scc-test-commands-'));
}

function writeCommand(commandsDir, filename, content) {
  fs.mkdirSync(commandsDir, { recursive: true });
  fs.writeFileSync(path.join(commandsDir, filename), content);
}

// ── Existing test (happy path with real data) ───────────────────────────────

test('validate-commands.js: runs successfully', () => {
  const result = spawnSync(process.execPath, [validatorScript], {
    encoding: 'utf8',
    timeout: 15000,
    cwd: pluginRoot,
  });
  assert.strictEqual(result.status, 0, `Validator exited with code ${result.status}: ${result.stderr || result.stdout}`);
});

// ── Branch: commands/ directory not found → exit(0) gracefully ───────────────

test('exits 0 when commands/ directory does not exist', () => {
  const tmp = makeTmpDir();
  try {
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 0);
    assert.ok(result.stdout.includes('no commands/ directory'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: no .md files → exit(0) with warning ────────────────────────────

test('exits 0 with warning when commands/ has no .md files', () => {
  const tmp = makeTmpDir();
  try {
    fs.mkdirSync(path.join(tmp, 'commands'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'commands', 'readme.txt'), 'not markdown');
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 0);
    assert.ok(result.stderr.includes('No .md files found'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: valid command passes ────────────────────────────────────────────

test('passes for a valid command file', () => {
  const tmp = makeTmpDir();
  try {
    const cmdsDir = path.join(tmp, 'commands');
    writeCommand(cmdsDir, 'my-command.md', [
      '---',
      'description: A comprehensive command that performs important operations',
      '---',
      '## Usage',
      '',
      'Run this command to do something useful and important.',
      'It supports multiple modes and has many features for developers.',
    ].join('\n'));
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 0);
    assert.ok(result.stdout.includes('PASSED'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: missing description → error ─────────────────────────────────────

test('fails when description frontmatter is missing', () => {
  const tmp = makeTmpDir();
  try {
    const cmdsDir = path.join(tmp, 'commands');
    writeCommand(cmdsDir, 'no-desc.md', [
      '---',
      'name: No Desc',
      '---',
      '## Usage',
      '',
      'This command body has enough content to be valid.',
      'It includes usage instructions and examples for developers.',
    ].join('\n'));
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('missing required frontmatter field: description'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: description too short → error ───────────────────────────────────

test('fails when description is too short (< 20 chars)', () => {
  const tmp = makeTmpDir();
  try {
    const cmdsDir = path.join(tmp, 'commands');
    writeCommand(cmdsDir, 'short-desc.md', [
      '---',
      'description: Too short',
      '---',
      '## Usage',
      '',
      'This command body has enough content to be valid.',
      'It includes usage instructions and examples for developers.',
    ].join('\n'));
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('at least 20 characters'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: body too short → error ──────────────────────────────────────────

test('fails when command body is too short (< 30 chars)', () => {
  const tmp = makeTmpDir();
  try {
    const cmdsDir = path.join(tmp, 'commands');
    writeCommand(cmdsDir, 'short-body.md', [
      '---',
      'description: A comprehensive command that performs important operations',
      '---',
      'Short.',
    ].join('\n'));
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('body is too short'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: no examples/usage section → warning ────────────────────────────

test('warns when command body has no examples or usage section', () => {
  const tmp = makeTmpDir();
  try {
    const cmdsDir = path.join(tmp, 'commands');
    writeCommand(cmdsDir, 'no-examples.md', [
      '---',
      'description: A comprehensive command that performs important operations',
      '---',
      '## Overview',
      '',
      'This command does something important.',
      'It performs critical operations for developers working on Salesforce projects.',
    ].join('\n'));
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 0);
    assert.ok(result.stderr.includes('no examples or usage section'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: body with "example" keyword → no warning ────────────────────────

test('does not warn when body contains "example"', () => {
  const tmp = makeTmpDir();
  try {
    const cmdsDir = path.join(tmp, 'commands');
    writeCommand(cmdsDir, 'with-example.md', [
      '---',
      'description: A comprehensive command that performs important operations',
      '---',
      '## Overview',
      '',
      'Here is an example of how to use this command.',
      'It performs critical operations for developers working on projects.',
    ].join('\n'));
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 0);
    // Should NOT trigger the "no examples" warning for this file
    assert.ok(!result.stderr.includes('with-example.md'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: multiple errors in one file ─────────────────────────────────────

test('reports multiple errors for a badly formed command', () => {
  const tmp = makeTmpDir();
  try {
    const cmdsDir = path.join(tmp, 'commands');
    writeCommand(cmdsDir, 'bad.md', '# Bad\nNo frontmatter.');
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('FAILED'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

console.log(`\nvalidate-commands.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
