#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const validatorScript = path.join(pluginRoot, 'scripts/ci/validate-agents.js');

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
  return fs.mkdtempSync(path.join(os.tmpdir(), 'scc-test-agents-'));
}

function writeAgent(agentsDir, filename, content) {
  fs.mkdirSync(agentsDir, { recursive: true });
  fs.writeFileSync(path.join(agentsDir, filename), content);
}

// ── Existing tests (happy path with real data) ──────────────────────────────

test('validate-agents.js: runs successfully', () => {
  const result = spawnSync(process.execPath, [validatorScript], {
    encoding: 'utf8',
    timeout: 15000,
    cwd: pluginRoot,
  });
  assert.strictEqual(result.status, 0, `Validator exited with code ${result.status}: ${result.stderr || result.stdout}`);
});

test('validate-agents.js: reports agent count in output', () => {
  const result = spawnSync(process.execPath, [validatorScript], {
    encoding: 'utf8',
    timeout: 15000,
    cwd: pluginRoot,
  });
  assert.ok(result.stdout.includes('agent(s) validated') || result.stdout.includes('PASSED'),
    'Should report validation results');
});

// ── Branch: agents/ directory not found → exit(1) ───────────────────────────

test('exits 1 when agents/ directory does not exist', () => {
  const tmp = makeTmpDir();
  try {
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('agents/ directory not found'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: no .md files in agents/ → exit(0) with warning ──────────────────

test('exits 0 with warning when agents/ has no .md files', () => {
  const tmp = makeTmpDir();
  try {
    fs.mkdirSync(path.join(tmp, 'agents'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'agents', 'readme.txt'), 'not a markdown file');
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 0);
    assert.ok(result.stderr.includes('No .md files found'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: valid agent passes validation ───────────────────────────────────

test('passes for a valid agent file', () => {
  const tmp = makeTmpDir();
  try {
    const agentsDir = path.join(tmp, 'agents');
    writeAgent(agentsDir, 'test-agent.md', [
      '---',
      'name: Test Agent',
      'description: A test agent that does many useful things for testing',
      'tools: ["Read", "Grep"]',
      'model: sonnet',
      'origin: SCC',
      '---',
      '# Test Agent',
      '',
      'This is the body content for the test agent.',
    ].join('\n'));
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 0);
    assert.ok(result.stdout.includes('PASSED'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: missing frontmatter entirely ────────────────────────────────────

test('fails when agent has no frontmatter', () => {
  const tmp = makeTmpDir();
  try {
    const agentsDir = path.join(tmp, 'agents');
    writeAgent(agentsDir, 'bad-agent.md', '# Just a heading\n\nNo frontmatter here.');
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('missing YAML frontmatter'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: missing name ────────────────────────────────────────────────────

test('fails when frontmatter.name is missing', () => {
  const tmp = makeTmpDir();
  try {
    const agentsDir = path.join(tmp, 'agents');
    writeAgent(agentsDir, 'no-name.md', [
      '---',
      'description: A valid description that is long enough for testing purposes',
      'tools: ["Read"]',
      'model: sonnet',
      '---',
      '# Agent body content here',
    ].join('\n'));
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('name is required'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: missing description ─────────────────────────────────────────────

test('fails when frontmatter.description is missing', () => {
  const tmp = makeTmpDir();
  try {
    const agentsDir = path.join(tmp, 'agents');
    writeAgent(agentsDir, 'no-desc.md', [
      '---',
      'name: Test',
      'tools: ["Read"]',
      'model: sonnet',
      '---',
      '# Agent body content here',
    ].join('\n'));
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('description is required'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: description too short ───────────────────────────────────────────

test('fails when description is too short', () => {
  const tmp = makeTmpDir();
  try {
    const agentsDir = path.join(tmp, 'agents');
    writeAgent(agentsDir, 'short-desc.md', [
      '---',
      'name: Test',
      'description: Too short',
      'tools: ["Read"]',
      'model: sonnet',
      '---',
      '# Agent body content here',
    ].join('\n'));
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('at least 20 characters'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: tools missing ───────────────────────────────────────────────────

test('fails when frontmatter.tools is missing', () => {
  const tmp = makeTmpDir();
  try {
    const agentsDir = path.join(tmp, 'agents');
    writeAgent(agentsDir, 'no-tools.md', [
      '---',
      'name: Test Agent',
      'description: A valid description that is long enough for testing',
      'model: sonnet',
      '---',
      '# Agent body content here',
    ].join('\n'));
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('tools is required'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: tools is not an array (parsed as string) → error ────────────────

test('fails when tools is a plain string (not array syntax)', () => {
  const tmp = makeTmpDir();
  try {
    const agentsDir = path.join(tmp, 'agents');
    writeAgent(agentsDir, 'string-tools.md', [
      '---',
      'name: Test Agent',
      'description: A valid description that is long enough for testing',
      'tools: some-string-value',
      'model: sonnet',
      'origin: SCC',
      '---',
      '# Agent body content here',
    ].join('\n'));
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('tools must be an array'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: model missing ───────────────────────────────────────────────────

test('fails when frontmatter.model is missing', () => {
  const tmp = makeTmpDir();
  try {
    const agentsDir = path.join(tmp, 'agents');
    writeAgent(agentsDir, 'no-model.md', [
      '---',
      'name: Test Agent',
      'description: A valid description that is long enough for testing',
      'tools: ["Read"]',
      '---',
      '# Agent body content here',
    ].join('\n'));
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('model is required'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: invalid model value ─────────────────────────────────────────────

test('fails when model is an invalid value', () => {
  const tmp = makeTmpDir();
  try {
    const agentsDir = path.join(tmp, 'agents');
    writeAgent(agentsDir, 'bad-model.md', [
      '---',
      'name: Test Agent',
      'description: A valid description that is long enough for testing',
      'tools: ["Read"]',
      'model: gpt4',
      '---',
      '# Agent body content here',
    ].join('\n'));
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('must be one of'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: valid extended model names (claude-opus-4, etc.) ────────────────

test('passes for extended model names like claude-sonnet-4', () => {
  const tmp = makeTmpDir();
  try {
    const agentsDir = path.join(tmp, 'agents');
    writeAgent(agentsDir, 'extended-model.md', [
      '---',
      'name: Test Agent',
      'description: A valid description that is long enough for testing',
      'tools: ["Read"]',
      'model: claude-sonnet-4',
      'origin: SCC',
      '---',
      '# Agent body content here with enough text',
    ].join('\n'));
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 0);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: origin warning — missing ────────────────────────────────────────

test('warns when origin is missing', () => {
  const tmp = makeTmpDir();
  try {
    const agentsDir = path.join(tmp, 'agents');
    writeAgent(agentsDir, 'no-origin.md', [
      '---',
      'name: Test Agent',
      'description: A valid description that is long enough for testing',
      'tools: ["Read"]',
      'model: sonnet',
      '---',
      '# Agent body content here',
    ].join('\n'));
    const result = runValidator(tmp);
    // Missing origin is a warning, not an error
    assert.strictEqual(result.status, 0);
    assert.ok(result.stderr.includes('origin is missing'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: origin warning — wrong value ────────────────────────────────────

test('warns when origin is not SCC', () => {
  const tmp = makeTmpDir();
  try {
    const agentsDir = path.join(tmp, 'agents');
    writeAgent(agentsDir, 'wrong-origin.md', [
      '---',
      'name: Test Agent',
      'description: A valid description that is long enough for testing',
      'tools: ["Read"]',
      'model: sonnet',
      'origin: OTHER',
      '---',
      '# Agent body content here',
    ].join('\n'));
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 0);
    assert.ok(result.stderr.includes('expected "SCC"'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: body content too short → warning ────────────────────────────────

test('warns when agent body content is very short', () => {
  const tmp = makeTmpDir();
  try {
    const agentsDir = path.join(tmp, 'agents');
    writeAgent(agentsDir, 'short-body.md', [
      '---',
      'name: Test Agent',
      'description: A valid description that is long enough for testing',
      'tools: ["Read"]',
      'model: sonnet',
      'origin: SCC',
      '---',
      'Short.',
    ].join('\n'));
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 0);
    assert.ok(result.stderr.includes('body content is very short'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

console.log(`\nvalidate-agents.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
