#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const validatorScript = path.join(pluginRoot, 'scripts/ci/validate-skills.js');

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
  return fs.mkdtempSync(path.join(os.tmpdir(), 'scc-test-skills-'));
}

// ── Existing test (happy path with real data) ───────────────────────────────

test('validate-skills.js: runs successfully', () => {
  const result = spawnSync(process.execPath, [validatorScript], {
    encoding: 'utf8',
    timeout: 15000,
    cwd: pluginRoot,
  });
  assert.strictEqual(result.status, 0, `Validator exited with code ${result.status}: ${result.stderr || result.stdout}`);
});

// ── Branch: skills/ directory not found → exit(1) ───────────────────────────

test('exits 1 when skills/ directory does not exist', () => {
  const tmp = makeTmpDir();
  try {
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('skills/ directory not found'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: no skill files found → exit(0) with warning ────────────────────

test('exits 0 with warning when skills/ is empty', () => {
  const tmp = makeTmpDir();
  try {
    fs.mkdirSync(path.join(tmp, 'skills'), { recursive: true });
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 0);
    assert.ok(result.stderr.includes('No skill files found'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: valid dir-based skill with SKILL.md ─────────────────────────────

test('passes for a valid directory-based skill with SKILL.md', () => {
  const tmp = makeTmpDir();
  try {
    const skillDir = path.join(tmp, 'skills', 'my-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), [
      '---',
      'name: My Skill',
      'description: A comprehensive test skill that does many useful things for validation',
      'origin: SCC',
      '---',
      '## When to Use',
      '',
      'Use this skill when you need to do something specific and important.',
      'This body content is long enough to pass the 50-character minimum requirement for skill body.',
    ].join('\n'));
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 0);
    assert.ok(result.stdout.includes('PASSED'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: valid flat .md skill ────────────────────────────────────────────

test('passes for a valid flat .md skill', () => {
  const tmp = makeTmpDir();
  try {
    const skillsDir = path.join(tmp, 'skills');
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.writeFileSync(path.join(skillsDir, 'flat-skill.md'), [
      '---',
      'name: Flat Skill',
      'description: A comprehensive flat skill that does many useful things for validation',
      'origin: SCC',
      '---',
      '## When to Use',
      '',
      'Use this skill when you need to do something specific and important.',
      'This body content is long enough to pass the 50-character minimum requirement for skill body.',
    ].join('\n'));
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 0);
    assert.ok(result.stdout.includes('PASSED'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: directory with index.md instead of SKILL.md → warning ───────────

test('warns when skill directory uses index.md instead of SKILL.md', () => {
  const tmp = makeTmpDir();
  try {
    const skillDir = path.join(tmp, 'skills', 'index-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'index.md'), [
      '---',
      'name: Index Skill',
      'description: A comprehensive index skill that does many useful things for validation',
      'origin: SCC',
      '---',
      '## When to Use',
      '',
      'Use this skill when you need to do something specific and important.',
      'This body content is long enough to pass the 50-character minimum requirement for skill body.',
    ].join('\n'));
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 0);
    assert.ok(result.stderr.includes('uses index.md instead of SKILL.md'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: directory with README.md ────────────────────────────────────────

test('accepts skill directory with README.md', () => {
  const tmp = makeTmpDir();
  try {
    const skillDir = path.join(tmp, 'skills', 'readme-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'README.md'), [
      '---',
      'name: Readme Skill',
      'description: A comprehensive readme skill that does many useful things for validation',
      'origin: SCC',
      '---',
      '## Usage',
      '',
      'Use this skill when you need to do something specific and important.',
      'This body content is long enough to pass the 50-character minimum requirement for skill body.',
    ].join('\n'));
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 0);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: directory with one arbitrary .md file (no SKILL.md) → warning ───

test('warns when skill directory has a single non-SKILL.md file', () => {
  const tmp = makeTmpDir();
  try {
    const skillDir = path.join(tmp, 'skills', 'other-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'guide.md'), [
      '---',
      'name: Other Skill',
      'description: A comprehensive other skill that does many useful things for validation',
      'origin: SCC',
      '---',
      '## When to Use',
      '',
      'Use this skill when you need to do something specific and important.',
      'This body content is long enough to pass the 50-character minimum requirement for skill body.',
    ].join('\n'));
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 0);
    assert.ok(result.stderr.includes('no SKILL.md found, using guide.md'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: directory with multiple .md files but no SKILL.md → error ───────

test('fails when skill directory has multiple .md files but no SKILL.md', () => {
  const tmp = makeTmpDir();
  try {
    const skillDir = path.join(tmp, 'skills', 'multi-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'a.md'), 'file a');
    fs.writeFileSync(path.join(skillDir, 'b.md'), 'file b');
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('multiple .md files found but no SKILL.md'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: directory with no .md files → error ─────────────────────────────

test('fails when skill directory has no .md files', () => {
  const tmp = makeTmpDir();
  try {
    const skillDir = path.join(tmp, 'skills', 'empty-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'data.json'), '{}');
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('directory has no .md files'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: missing name ────────────────────────────────────────────────────

test('fails when skill frontmatter.name is missing', () => {
  const tmp = makeTmpDir();
  try {
    const skillsDir = path.join(tmp, 'skills');
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.writeFileSync(path.join(skillsDir, 'no-name.md'), [
      '---',
      'description: A comprehensive skill that does many useful things for validation',
      'origin: SCC',
      '---',
      '## When to Use',
      '',
      'Use this skill when you need to do something specific and important.',
      'This body content is long enough to pass the 50-character minimum requirement for skill body.',
    ].join('\n'));
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('name is required'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: missing description ─────────────────────────────────────────────

test('fails when skill frontmatter.description is missing', () => {
  const tmp = makeTmpDir();
  try {
    const skillsDir = path.join(tmp, 'skills');
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.writeFileSync(path.join(skillsDir, 'no-desc.md'), [
      '---',
      'name: No Desc Skill',
      'origin: SCC',
      '---',
      '## When to Use',
      '',
      'Use this skill when you need to do something specific and important.',
      'This body content is long enough to pass the 50-character minimum requirement for skill body.',
    ].join('\n'));
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('description is required'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: description too short ───────────────────────────────────────────

test('fails when description is too short (< 30 chars)', () => {
  const tmp = makeTmpDir();
  try {
    const skillsDir = path.join(tmp, 'skills');
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.writeFileSync(path.join(skillsDir, 'short-desc.md'), [
      '---',
      'name: Short Desc',
      'description: Too short desc',
      'origin: SCC',
      '---',
      '## When to Use',
      '',
      'Use this skill when you need to do something specific and important.',
      'This body content is long enough to pass the 50-character minimum requirement for skill body.',
    ].join('\n'));
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('at least 30 characters'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: body too short ──────────────────────────────────────────────────

test('fails when skill body is too short', () => {
  const tmp = makeTmpDir();
  try {
    const skillsDir = path.join(tmp, 'skills');
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.writeFileSync(path.join(skillsDir, 'short-body.md'), [
      '---',
      'name: Short Body Skill',
      'description: A comprehensive skill that does many useful things for validation',
      'origin: SCC',
      '---',
      'Short.',
    ].join('\n'));
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('body content is too short'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: no "When to Use" section ────────────────────────────────────────

test('fails when skill has no "When to Use" or "Usage" section', () => {
  const tmp = makeTmpDir();
  try {
    const skillsDir = path.join(tmp, 'skills');
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.writeFileSync(path.join(skillsDir, 'no-usage.md'), [
      '---',
      'name: No Usage Skill',
      'description: A comprehensive skill that does many useful things for validation',
      'origin: SCC',
      '---',
      '## Overview',
      '',
      'This skill does something but does not document when to invoke it.',
      'This body content is long enough to pass the 50-character minimum requirement for skill body validation.',
    ].join('\n'));
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes('no "When to Use" section found'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: origin warning — missing ────────────────────────────────────────

test('warns when origin is missing', () => {
  const tmp = makeTmpDir();
  try {
    const skillsDir = path.join(tmp, 'skills');
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.writeFileSync(path.join(skillsDir, 'no-origin.md'), [
      '---',
      'name: No Origin Skill',
      'description: A comprehensive skill that does many useful things for validation',
      '---',
      '## When to Use',
      '',
      'Use this skill when you need to do something specific and important.',
      'This body content is long enough to pass the 50-character minimum requirement for skill body.',
    ].join('\n'));
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 0);
    assert.ok(result.stderr.includes('origin is missing'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: origin wrong value → warning ────────────────────────────────────

test('warns when origin is not SCC', () => {
  const tmp = makeTmpDir();
  try {
    const skillsDir = path.join(tmp, 'skills');
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.writeFileSync(path.join(skillsDir, 'bad-origin.md'), [
      '---',
      'name: Bad Origin Skill',
      'description: A comprehensive skill that does many useful things for validation',
      'origin: OTHER',
      '---',
      '## When to Use',
      '',
      'Use this skill when you need to do something specific and important.',
      'This body content is long enough to pass the 50-character minimum requirement for skill body.',
    ].join('\n'));
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 0);
    assert.ok(result.stderr.includes('expected "SCC"'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

console.log(`\nvalidate-skills.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
