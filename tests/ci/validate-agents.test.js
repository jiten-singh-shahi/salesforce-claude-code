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

// Valid description: 100+ chars, 3+ SF keywords, "Use when" clause, "Do NOT" clause
const VALID_DESC = 'Use when reviewing Apex classes, triggers, or SOQL queries in a Salesforce org for governor limit compliance. Do NOT use for LWC.';
const VALID_BODY = [
  '## When to Use',
  '',
  'Use this agent when reviewing Salesforce code for quality.',
  '',
  '## Workflow',
  '',
  '### Step 1 — Scan',
  'Read all Apex files.',
  '',
  '### Step 2 — Report',
  'Generate findings report.',
  '',
  '## Escalation',
  '',
  'Ask user before modifying production code.',
].join('\n');

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
    writeAgent(agentsDir, 'sf-test-agent.md', [
      '---',
      'name: sf-test-agent',
      `description: "${VALID_DESC}"`,
      'tools: ["Read", "Grep", "Edit"]',
      'model: sonnet',
      'origin: SCC',
      '---',
      VALID_BODY,
    ].join('\n'));
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 0, `Expected pass but got: ${result.stderr || result.stdout}`);
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
    const output = result.stderr + result.stdout;
    assert.ok(output.includes('missing YAML frontmatter'));
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
      `description: "${VALID_DESC}"`,
      'tools: ["Read"]',
      'model: sonnet',
      'origin: SCC',
      '---',
      VALID_BODY,
    ].join('\n'));
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1);
    const output = result.stderr + result.stdout;
    assert.ok(output.includes('name is required'));
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
      'name: no-desc',
      'tools: ["Read"]',
      'model: sonnet',
      'origin: SCC',
      '---',
      VALID_BODY,
    ].join('\n'));
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1);
    const output = result.stderr + result.stdout;
    assert.ok(output.includes('description is required'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: description too short ───────────────────────────────────────────

test('fails when description is too short (< 100 chars)', () => {
  const tmp = makeTmpDir();
  try {
    const agentsDir = path.join(tmp, 'agents');
    writeAgent(agentsDir, 'short-desc.md', [
      '---',
      'name: short-desc',
      'description: Too short',
      'tools: ["Read"]',
      'model: sonnet',
      'origin: SCC',
      '---',
      VALID_BODY,
    ].join('\n'));
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1);
    const output = result.stderr + result.stdout;
    assert.ok(output.includes('description too short'));
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
      'name: no-tools',
      `description: "${VALID_DESC}"`,
      'model: sonnet',
      'origin: SCC',
      '---',
      VALID_BODY,
    ].join('\n'));
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1);
    const output = result.stderr + result.stdout;
    assert.ok(output.includes('tools is required'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: tools is not an array → error ───────────────────────────────────

test('fails when tools is a plain string (not array syntax)', () => {
  const tmp = makeTmpDir();
  try {
    const agentsDir = path.join(tmp, 'agents');
    writeAgent(agentsDir, 'string-tools.md', [
      '---',
      'name: string-tools',
      `description: "${VALID_DESC}"`,
      'tools: some-string-value',
      'model: sonnet',
      'origin: SCC',
      '---',
      VALID_BODY,
    ].join('\n'));
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1);
    const output = result.stderr + result.stdout;
    assert.ok(output.includes('tools must be an array'));
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
      'name: no-model',
      `description: "${VALID_DESC}"`,
      'tools: ["Read"]',
      'origin: SCC',
      '---',
      VALID_BODY,
    ].join('\n'));
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1);
    const output = result.stderr + result.stdout;
    assert.ok(output.includes('model is required'));
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
      'name: bad-model',
      `description: "${VALID_DESC}"`,
      'tools: ["Read"]',
      'model: gpt4',
      'origin: SCC',
      '---',
      VALID_BODY,
    ].join('\n'));
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1);
    const output = result.stderr + result.stdout;
    assert.ok(output.includes('must be one of'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: origin missing → error ──────────────────────────────────────────

test('fails when origin is missing', () => {
  const tmp = makeTmpDir();
  try {
    const agentsDir = path.join(tmp, 'agents');
    writeAgent(agentsDir, 'no-origin.md', [
      '---',
      'name: no-origin',
      `description: "${VALID_DESC}"`,
      'tools: ["Read"]',
      'model: sonnet',
      '---',
      VALID_BODY,
    ].join('\n'));
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1);
    const output = result.stderr + result.stdout;
    assert.ok(output.includes('origin is required'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: origin wrong value → error ──────────────────────────────────────

test('fails when origin is not SCC', () => {
  const tmp = makeTmpDir();
  try {
    const agentsDir = path.join(tmp, 'agents');
    writeAgent(agentsDir, 'wrong-origin.md', [
      '---',
      'name: wrong-origin',
      `description: "${VALID_DESC}"`,
      'tools: ["Read"]',
      'model: sonnet',
      'origin: OTHER',
      '---',
      VALID_BODY,
    ].join('\n'));
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1);
    const output = result.stderr + result.stdout;
    assert.ok(output.includes('must be "SCC"'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: body too short → error ──────────────────────────────────────────

test('fails when agent body content is too short', () => {
  const tmp = makeTmpDir();
  try {
    const agentsDir = path.join(tmp, 'agents');
    writeAgent(agentsDir, 'short-body.md', [
      '---',
      'name: short-body',
      `description: "${VALID_DESC}"`,
      'tools: ["Read"]',
      'model: sonnet',
      'origin: SCC',
      '---',
      'Short.',
    ].join('\n'));
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1);
    const output = result.stderr + result.stdout;
    assert.ok(output.includes('body too short'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

console.log(`\nvalidate-agents.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
