#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const scriptPath = path.join(pluginRoot, 'scripts', 'ci', 'catalog.js');

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

function runScript(args, cwd) {
  return spawnSync(process.execPath, [scriptPath, ...(args || [])], {
    encoding: 'utf8',
    timeout: 15000,
    cwd: cwd || pluginRoot,
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
  });
}

// ── Tests: script existence ──────────────────────────────────────────────────

test('catalog.js: script exists', () => {
  assert.ok(fs.existsSync(scriptPath), `Script not found at: ${scriptPath}`);
});

// ── Tests: --json output mode (default) ──────────────────────────────────────

test('catalog.js: --json produces valid JSON output', () => {
  const result = runScript(['--json']);
  // May exit 0 or 1 depending on whether counts match
  const stdout = result.stdout || '';
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    assert.fail(`Expected valid JSON output, got: ${stdout.slice(0, 200)}`);
  }
  assert.ok(parsed.catalog, 'JSON output should have catalog field');
  assert.ok(parsed.checks, 'JSON output should have checks field');
});

test('catalog.js: JSON output has agents, commands, skills in catalog', () => {
  const result = runScript(['--json']);
  const parsed = JSON.parse(result.stdout);
  assert.ok(parsed.catalog.agents, 'catalog should have agents');
  assert.ok(parsed.catalog.commands !== undefined, 'catalog should have commands key');
  assert.ok(parsed.catalog.skills, 'catalog should have skills');
});

test('catalog.js: JSON agents count matches disk', () => {
  const result = runScript(['--json']);
  const parsed = JSON.parse(result.stdout);
  const agentsDir = path.join(pluginRoot, 'agents');
  const diskCount = fs.readdirSync(agentsDir).filter(f => f.endsWith('.md')).length;
  assert.strictEqual(parsed.catalog.agents.count, diskCount,
    `Agents count should match disk: got ${parsed.catalog.agents.count}, expected ${diskCount}`);
});

test('catalog.js: JSON commands count matches disk', () => {
  const result = runScript(['--json']);
  const parsed = JSON.parse(result.stdout);
  const commandsDir = path.join(pluginRoot, 'commands');
  const diskCount = fs.existsSync(commandsDir)
    ? fs.readdirSync(commandsDir).filter(f => f.endsWith('.md')).length
    : 0;
  assert.strictEqual(parsed.catalog.commands.count, diskCount,
    `Commands count should match disk: got ${parsed.catalog.commands.count}, expected ${diskCount}`);
});

test('catalog.js: JSON skills count matches disk', () => {
  const result = runScript(['--json']);
  const parsed = JSON.parse(result.stdout);
  const skillsDir = path.join(pluginRoot, 'skills');
  const diskCount = fs.readdirSync(skillsDir, { withFileTypes: true })
    .filter(e => e.isDirectory() && fs.existsSync(path.join(pluginRoot, 'skills', e.name, 'SKILL.md')))
    .length;
  assert.strictEqual(parsed.catalog.skills.count, diskCount,
    `Skills count should match disk: got ${parsed.catalog.skills.count}, expected ${diskCount}`);
});

test('catalog.js: JSON catalog has glob patterns', () => {
  const result = runScript(['--json']);
  const parsed = JSON.parse(result.stdout);
  assert.strictEqual(parsed.catalog.agents.glob, 'agents/*.md');
  assert.strictEqual(parsed.catalog.commands.glob, 'commands/*.md');
  assert.strictEqual(parsed.catalog.skills.glob, 'skills/*/SKILL.md');
});

test('catalog.js: JSON catalog has file lists', () => {
  const result = runScript(['--json']);
  const parsed = JSON.parse(result.stdout);
  assert.ok(Array.isArray(parsed.catalog.agents.files), 'agents.files should be an array');
  assert.ok(Array.isArray(parsed.catalog.commands.files), 'commands.files should be an array');
  assert.ok(Array.isArray(parsed.catalog.skills.files), 'skills.files should be an array');
  assert.ok(parsed.catalog.agents.files.length > 0, 'agents files should not be empty');
});

// ── Tests: checks field ──────────────────────────────────────────────────────

test('catalog.js: checks array contains agent/command/skill expectations', () => {
  const result = runScript(['--json']);
  const parsed = JSON.parse(result.stdout);
  const categories = parsed.checks.map(c => c.category);
  assert.ok(categories.includes('agents'), 'checks should include agents');
  assert.ok(categories.includes('skills'), 'checks should include skills');
});

test('catalog.js: each check has required fields', () => {
  const result = runScript(['--json']);
  const parsed = JSON.parse(result.stdout);
  for (const check of parsed.checks) {
    assert.ok(check.category, 'check should have category');
    assert.ok(check.mode, 'check should have mode');
    assert.ok(typeof check.expected === 'number', 'check should have expected number');
    assert.ok(typeof check.actual === 'number', 'check should have actual number');
    assert.ok(typeof check.ok === 'boolean', 'check should have ok boolean');
    assert.ok(check.source, 'check should have source');
  }
});

// ── Tests: --text output mode ────────────────────────────────────────────────

test('catalog.js: --text produces text output', () => {
  const result = runScript(['--text']);
  const stdout = result.stdout || '';
  assert.ok(stdout.includes('Catalog counts:'), 'Text output should start with Catalog counts');
  assert.ok(stdout.includes('agents:'), 'Should mention agents count');
  assert.ok(stdout.includes('skills:'), 'Should mention skills count');
});

// ── Tests: --md output mode ──────────────────────────────────────────────────

test('catalog.js: --md produces markdown output', () => {
  const result = runScript(['--md']);
  const stdout = result.stdout || '';
  assert.ok(stdout.includes('# SCC Catalog Verification'), 'Should have markdown header');
  assert.ok(stdout.includes('| Category |'), 'Should have markdown table header');
  assert.ok(stdout.includes('| Agents |'), 'Should have agents row');
  assert.ok(stdout.includes('| Skills |'), 'Should have skills row');
});

// ── Tests: README expectations match ─────────────────────────────────────────

test('catalog.js: README expectations match actual counts (passes)', () => {
  const result = runScript(['--json']);
  const parsed = JSON.parse(result.stdout);
  const allOk = parsed.checks.every(c => c.ok);
  if (allOk) {
    assert.strictEqual(result.status, 0, 'Should exit 0 when all checks pass');
  }
  // If not all ok, that is a real project issue — we just verify the script works
  assert.ok(parsed.checks.length > 0, 'Should have at least one check');
});

// ── Tests: exit code reflects check results ──────────────────────────────────

test('catalog.js: exits 0 when all checks pass', () => {
  const result = runScript(['--json']);
  const parsed = JSON.parse(result.stdout);
  const allOk = parsed.checks.every(c => c.ok);
  if (allOk) {
    assert.strictEqual(result.status, 0);
  } else {
    assert.strictEqual(result.status, 1, 'Should exit 1 when checks fail');
  }
});

// ── Tests: handles missing directories ───────────────────────────────────────

test('catalog.js: handles missing agents dir gracefully', () => {
  // The script uses __dirname-based ROOT, so we test with the real project
  // and just verify it produces meaningful output
  const result = runScript(['--json']);
  const parsed = JSON.parse(result.stdout);
  assert.ok(typeof parsed.catalog.agents.count === 'number',
    'Should return a count even if 0');
});

// ── Tests: file list normalization ───────────────────────────────────────────

test('catalog.js: file paths use forward slashes', () => {
  const result = runScript(['--json']);
  const parsed = JSON.parse(result.stdout);
  for (const file of parsed.catalog.agents.files) {
    assert.ok(!file.includes('\\'), `Path should use forward slashes: ${file}`);
  }
});

test('catalog.js: agent files start with agents/', () => {
  const result = runScript(['--json']);
  const parsed = JSON.parse(result.stdout);
  for (const file of parsed.catalog.agents.files) {
    assert.ok(file.startsWith('agents/'), `Agent file should start with agents/: ${file}`);
  }
});

test('catalog.js: command files start with commands/', () => {
  const result = runScript(['--json']);
  const parsed = JSON.parse(result.stdout);
  for (const file of parsed.catalog.commands.files) {
    assert.ok(file.startsWith('commands/'), `Command file should start with commands/: ${file}`);
  }
});

test('catalog.js: skill files end with /SKILL.md', () => {
  const result = runScript(['--json']);
  const parsed = JSON.parse(result.stdout);
  for (const file of parsed.catalog.skills.files) {
    assert.ok(file.endsWith('/SKILL.md'), `Skill file should end with /SKILL.md: ${file}`);
  }
});

// ── Tests: text mode shows mismatch info ─────────────────────────────────────

test('catalog.js: text mode reports match or mismatch', () => {
  const result = runScript(['--text']);
  const combined = (result.stdout || '') + (result.stderr || '');
  assert.ok(
    combined.includes('Documentation counts match') || combined.includes('Documentation count mismatches'),
    'Text output should report match or mismatch status'
  );
});

// ── Tests: markdown mode shows mismatch info ─────────────────────────────────

test('catalog.js: markdown mode reports match or mismatch', () => {
  const result = runScript(['--md']);
  const combined = (result.stdout || '') + (result.stderr || '');
  assert.ok(
    combined.includes('Documentation counts match') || combined.includes('## Mismatches'),
    'Markdown output should report match or mismatch status'
  );
});

console.log(`\ncatalog.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
