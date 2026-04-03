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

function writeSkill(skillsDir, skillName, content) {
  const dir = path.join(skillsDir, skillName);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'SKILL.md'), content);
}

// Valid description: 100+ chars, 3+ SF keywords, "Use when" clause, "Do NOT" clause
const VALID_DESC = 'Use when writing Apex classes, triggers, or SOQL queries in a Salesforce org for governor limit compliance. Do NOT use for LWC.';
const VALID_BODY = [
  '## When to Use',
  '',
  'Use this skill when you need to do something specific and important for Salesforce development.',
  'This body content is long enough to pass the 50-character minimum requirement for skill body.',
].join('\n');

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
    assert.ok(result.stderr.includes('not found') || result.stdout.includes('not found'),
      'Expected "not found" in output');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: skills/ is empty → exit(0) ────────────────────────────────────

test('exits 0 when skills/ is empty', () => {
  const tmp = makeTmpDir();
  try {
    fs.mkdirSync(path.join(tmp, 'skills'), { recursive: true });
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 0);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: valid dir-based skill with SKILL.md ─────────────────────────────

test('passes for a valid directory-based skill with SKILL.md', () => {
  const tmp = makeTmpDir();
  try {
    const skillsDir = path.join(tmp, 'skills');
    writeSkill(skillsDir, 'sf-test-skill', [
      '---',
      'name: sf-test-skill',
      `description: "${VALID_DESC}"`,
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

// ── Branch: valid flat .md skill (warns but passes) ─────────────────────────

test('passes for a valid flat .md skill', () => {
  const tmp = makeTmpDir();
  try {
    const skillsDir = path.join(tmp, 'skills');
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.writeFileSync(path.join(skillsDir, 'flat-skill.md'), [
      '---',
      'name: Flat Skill',
      `description: "${VALID_DESC}"`,
      'origin: SCC',
      '---',
      VALID_BODY,
    ].join('\n'));
    const result = runValidator(tmp);
    // Flat files get a warning but pass (0 skills validated = no errors)
    assert.strictEqual(result.status, 0);
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
    const output = result.stderr + result.stdout;
    assert.ok(output.includes('no .md files'), `Expected "no .md files" in output`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: missing name ────────────────────────────────────────────────────

test('fails when skill frontmatter.name is missing', () => {
  const tmp = makeTmpDir();
  try {
    const skillsDir = path.join(tmp, 'skills');
    writeSkill(skillsDir, 'sf-no-name', [
      '---',
      `description: "${VALID_DESC}"`,
      'origin: SCC',
      '---',
      VALID_BODY,
    ].join('\n'));
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1, `Expected fail but got: ${result.stdout}`);
    const output = result.stderr + result.stdout;
    assert.ok(output.includes('name is required'), `Expected "name is required" in: ${output}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: missing description ─────────────────────────────────────────────

test('fails when skill frontmatter.description is missing', () => {
  const tmp = makeTmpDir();
  try {
    const skillsDir = path.join(tmp, 'skills');
    writeSkill(skillsDir, 'sf-no-desc', [
      '---',
      'name: sf-no-desc',
      'origin: SCC',
      '---',
      VALID_BODY,
    ].join('\n'));
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1, `Expected fail but got: ${result.stdout}`);
    const output = result.stderr + result.stdout;
    assert.ok(output.includes('description is required'), `Expected "description is required" in: ${output}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: description too short ───────────────────────────────────────────

test('fails when description is too short (< 100 chars)', () => {
  const tmp = makeTmpDir();
  try {
    const skillsDir = path.join(tmp, 'skills');
    writeSkill(skillsDir, 'sf-short-desc', [
      '---',
      'name: sf-short-desc',
      'description: Too short desc',
      'origin: SCC',
      '---',
      VALID_BODY,
    ].join('\n'));
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1, `Expected fail but got: ${result.stdout}`);
    const output = result.stderr + result.stdout;
    assert.ok(output.includes('description too short'), `Expected "description too short" in: ${output}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: body too short ──────────────────────────────────────────────────

test('fails when skill body is too short', () => {
  const tmp = makeTmpDir();
  try {
    const skillsDir = path.join(tmp, 'skills');
    writeSkill(skillsDir, 'sf-short-body', [
      '---',
      'name: sf-short-body',
      `description: "${VALID_DESC}"`,
      'origin: SCC',
      '---',
      'Short.',
    ].join('\n'));
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1, `Expected fail but got: ${result.stdout}`);
    const output = result.stderr + result.stdout;
    assert.ok(output.includes('body is too short'), `Expected body too short error in: ${output}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: no "When to Use" section ────────────────────────────────────────

test('fails when skill has no "When to Use" section', () => {
  const tmp = makeTmpDir();
  try {
    const skillsDir = path.join(tmp, 'skills');
    writeSkill(skillsDir, 'sf-no-usage', [
      '---',
      'name: sf-no-usage',
      `description: "${VALID_DESC}"`,
      'origin: SCC',
      '---',
      '## Overview',
      '',
      'This skill does something but does not document when to invoke it.',
      'This body content is long enough to pass the 50-character minimum requirement for skill body validation.',
    ].join('\n'));
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1, `Expected fail but got: ${result.stdout}`);
    const output = result.stderr + result.stdout;
    assert.ok(output.includes('When to Use'), `Expected "When to Use" error in: ${output}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: origin missing → error ──────────────────────────────────────────

test('fails when origin is missing', () => {
  const tmp = makeTmpDir();
  try {
    const skillsDir = path.join(tmp, 'skills');
    writeSkill(skillsDir, 'sf-no-origin', [
      '---',
      'name: sf-no-origin',
      `description: "${VALID_DESC}"`,
      '---',
      VALID_BODY,
    ].join('\n'));
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1, `Expected fail but got: ${result.stdout}`);
    const output = result.stderr + result.stdout;
    assert.ok(output.includes('origin is required'), `Expected "origin is required" in: ${output}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: origin wrong value → error ──────────────────────────────────────

test('fails when origin is not SCC', () => {
  const tmp = makeTmpDir();
  try {
    const skillsDir = path.join(tmp, 'skills');
    writeSkill(skillsDir, 'sf-bad-origin', [
      '---',
      'name: sf-bad-origin',
      `description: "${VALID_DESC}"`,
      'origin: OTHER',
      '---',
      VALID_BODY,
    ].join('\n'));
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1, `Expected fail but got: ${result.stdout}`);
    const output = result.stderr + result.stdout;
    assert.ok(output.includes('must be "SCC"'), `Expected 'must be "SCC"' in: ${output}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: description too long ────────────────────────────────────────────

test('fails when description exceeds 250 chars', () => {
  const tmp = makeTmpDir();
  try {
    const skillsDir = path.join(tmp, 'skills');
    const longDesc = 'Use when writing Salesforce Apex classes and triggers for governor limit compliance and SOQL optimization in production orgs. Do NOT use for LWC. ' + 'x'.repeat(150);
    writeSkill(skillsDir, 'sf-long-desc', [
      '---',
      'name: sf-long-desc',
      `description: "${longDesc}"`,
      'origin: SCC',
      '---',
      VALID_BODY,
    ].join('\n'));
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 1, `Expected fail but got: ${result.stdout}`);
    const output = result.stderr + result.stdout;
    assert.ok(output.includes('description too long'), `Expected "description too long" in: ${output}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── Branch: warns when SF pattern skill missing "Use when" ───────────────────

test('warns when SF pattern skill has Use when but lacks proactive trigger', () => {
  const tmp = makeTmpDir();
  try {
    const skillsDir = path.join(tmp, 'skills');
    // Has "Use when" (passes WHEN clause check) but description could be stronger
    const weakDesc = 'Use when writing Apex classes or SOQL queries in a Salesforce org for governor limit compliance. Do NOT use for LWC or Flow.';
    writeSkill(skillsDir, 'sf-weak-trigger', [
      '---',
      'name: sf-weak-trigger',
      `description: "${weakDesc}"`,
      'origin: SCC',
      '---',
      VALID_BODY,
    ].join('\n'));
    const result = runValidator(tmp);
    // Should PASS (all checks pass — "Use when" is present)
    assert.strictEqual(result.status, 0, `Expected pass but got: ${result.stderr || result.stdout}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('no Use when warning for constraint skills', () => {
  const tmp = makeTmpDir();
  try {
    const skillsDir = path.join(tmp, 'skills');
    // Constraint skills are identified by -constraints suffix; they're preloaded by agents
    const constraintDesc = 'Enforce Apex governor limits and bulkification rules for Salesforce development. Use when writing Apex code. Do NOT use for LWC.';
    const constraintBody = [
      '## When to Use', '',
      'Auto-activated on Apex code changes.', '',
      '## Never Do', '',
      '- N1: Never put SOQL inside loops', '',
      '## Always Do', '',
      '- A1: Always bulkify trigger handlers', '',
      '@../_reference/GOVERNOR_LIMITS.md',
    ].join('\n');
    writeSkill(skillsDir, 'sf-test-constraints', [
      '---',
      'name: sf-test-constraints',
      `description: "${constraintDesc}"`,
      'origin: SCC',
      'user-invocable: false',
      'allowed-tools: ["Read", "Grep", "Glob"]',
      '---',
      constraintBody,
    ].join('\n'));
    // Create the referenced _reference file
    const refDir = path.join(skillsDir, '_reference');
    fs.mkdirSync(refDir, { recursive: true });
    fs.writeFileSync(path.join(refDir, 'GOVERNOR_LIMITS.md'), '# Governor Limits\n\n| Limit | Value |\n|---|---|\n| SOQL | 100 |');
    const result = runValidator(tmp);
    assert.strictEqual(result.status, 0, `Expected pass but got: ${result.stderr || result.stdout}`);
    const output = result.stderr + result.stdout;
    assert.ok(!output.includes('SF pattern skill description should'), 'Should not warn constraint skills about Use when');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

console.log(`\nvalidate-skills.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
