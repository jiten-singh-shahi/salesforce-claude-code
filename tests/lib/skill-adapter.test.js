#!/usr/bin/env node
'use strict';

/**
 * skill-adapter.test.js — Unit tests for scripts/lib/skill-adapter.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { transformSkill, transformSkillDir, CURSOR_ALLOWED_FIELDS } = require('../../scripts/lib/skill-adapter');
const { parseFrontmatter } = require('../../scripts/lib/utils');

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

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'scc-skill-adapter-'));
}

// ── transformSkill tests ──────────────────────────────────────────────────────

test('transformSkill: keeps name and description', () => {
  const input = `---\nname: sf-help\ndescription: Helps with stuff\norigin: SCC\nuser-invocable: true\n---\n# Body\n\nContent here.`;
  const output = transformSkill(input);
  const { frontmatter } = parseFrontmatter(output);
  assert.strictEqual(frontmatter.name, 'sf-help');
  assert.strictEqual(frontmatter.description, 'Helps with stuff');
});

test('transformSkill: strips user-invocable field', () => {
  const input = `---\nname: test\ndescription: Test skill\nuser-invocable: true\n---\nBody`;
  const output = transformSkill(input);
  const { frontmatter } = parseFrontmatter(output);
  assert.strictEqual(frontmatter['user-invocable'], undefined);
});

test('transformSkill: strips origin field', () => {
  const input = `---\nname: test\ndescription: Test skill\norigin: SCC\n---\nBody`;
  const output = transformSkill(input);
  const { frontmatter } = parseFrontmatter(output);
  assert.strictEqual(frontmatter.origin, undefined);
});

test('transformSkill: strips Claude-only fields', () => {
  const input = `---\nname: test\ndescription: Test skill\nallowed-tools: Read, Grep\ncontext: fork\nagent: Explore\nhooks: something\npaths: "**/*.cls"\nshell: bash\neffort: high\nmodel: sonnet\nargument-hint: [file]\n---\nBody`;
  const output = transformSkill(input);
  const { frontmatter } = parseFrontmatter(output);
  assert.strictEqual(frontmatter.name, 'test');
  assert.strictEqual(frontmatter.description, 'Test skill');
  assert.strictEqual(frontmatter['allowed-tools'], undefined);
  assert.strictEqual(frontmatter.context, undefined);
  assert.strictEqual(frontmatter.agent, undefined);
  assert.strictEqual(frontmatter.hooks, undefined);
  assert.strictEqual(frontmatter.paths, undefined);
  assert.strictEqual(frontmatter.shell, undefined);
  assert.strictEqual(frontmatter.effort, undefined);
  assert.strictEqual(frontmatter.model, undefined);
  assert.strictEqual(frontmatter['argument-hint'], undefined);
});

test('transformSkill: preserves Cursor-native fields', () => {
  const input = `---\nname: test\ndescription: Test\nlicense: MIT\n---\nBody`;
  const output = transformSkill(input);
  const { frontmatter } = parseFrontmatter(output);
  assert.strictEqual(frontmatter.license, 'MIT');
});

test('transformSkill: body content passes through unchanged', () => {
  const body = '# My Skill\n\n## When to Use\n\nUse this when you need help.\n\n```apex\nSystem.debug(\'hello\');\n```\n';
  const input = `---\nname: test\ndescription: Test skill\norigin: SCC\n---\n${body}`;
  const output = transformSkill(input);
  const { body: outputBody } = parseFrontmatter(output);
  assert.strictEqual(outputBody, body);
});

test('transformSkill: handles content with no frontmatter', () => {
  const input = '# Just a heading\n\nSome content here.';
  const output = transformSkill(input);
  assert.strictEqual(output, input);
});

test('transformSkill: handles empty frontmatter', () => {
  const input = `---\n---\nBody content`;
  const output = transformSkill(input);
  assert.ok(output.includes('Body content'));
});

// ── transformSkillDir tests ────────────────────────────────────────────────────

test('transformSkillDir: transforms SKILL.md and copies supporting files', () => {
  const tmpSrc = makeTmpDir();
  const tmpDest = makeTmpDir();

  // Create source skill directory
  const srcSkill = path.join(tmpSrc, 'my-skill');
  fs.mkdirSync(srcSkill);
  fs.writeFileSync(path.join(srcSkill, 'SKILL.md'), '---\nname: my-skill\ndescription: A test skill for validation purposes\norigin: SCC\nuser-invocable: true\n---\n# My Skill\n\n## When to Use\n\nUse for testing.');

  // Create supporting files
  const scriptsDir = path.join(srcSkill, 'scripts');
  fs.mkdirSync(scriptsDir);
  fs.writeFileSync(path.join(scriptsDir, 'helper.sh'), '#!/bin/bash\necho hello');
  fs.writeFileSync(path.join(srcSkill, 'config.json'), '{"version": 1}');

  const destSkill = path.join(tmpDest, 'my-skill');
  transformSkillDir(srcSkill, destSkill);

  // SKILL.md should be transformed
  const transformed = fs.readFileSync(path.join(destSkill, 'SKILL.md'), 'utf8');
  const { frontmatter } = parseFrontmatter(transformed);
  assert.strictEqual(frontmatter.name, 'my-skill');
  assert.strictEqual(frontmatter.origin, undefined, 'origin should be stripped');
  assert.strictEqual(frontmatter['user-invocable'], undefined, 'user-invocable should be stripped');

  // Supporting files should be copied as-is
  assert.ok(fs.existsSync(path.join(destSkill, 'scripts', 'helper.sh')));
  assert.ok(fs.existsSync(path.join(destSkill, 'config.json')));
  assert.strictEqual(fs.readFileSync(path.join(destSkill, 'config.json'), 'utf8'), '{"version": 1}');

  // Cleanup
  fs.rmSync(tmpSrc, { recursive: true, force: true });
  fs.rmSync(tmpDest, { recursive: true, force: true });
});

test('transformSkillDir: throws for missing source directory', () => {
  assert.throws(() => {
    transformSkillDir('/nonexistent/path', '/tmp/dest');
  }, /Source skill directory not found/);
});

// ── CURSOR_ALLOWED_FIELDS tests ────────────────────────────────────────────────

test('CURSOR_ALLOWED_FIELDS: includes expected Cursor fields', () => {
  assert.ok(CURSOR_ALLOWED_FIELDS.has('name'));
  assert.ok(CURSOR_ALLOWED_FIELDS.has('description'));
  assert.ok(CURSOR_ALLOWED_FIELDS.has('disable-model-invocation'));
  assert.ok(CURSOR_ALLOWED_FIELDS.has('license'));
  assert.ok(CURSOR_ALLOWED_FIELDS.has('compatibility'));
  assert.ok(CURSOR_ALLOWED_FIELDS.has('metadata'));
});

test('CURSOR_ALLOWED_FIELDS: does not include Claude-only fields', () => {
  assert.ok(!CURSOR_ALLOWED_FIELDS.has('origin'));
  assert.ok(!CURSOR_ALLOWED_FIELDS.has('user-invocable'));
  assert.ok(!CURSOR_ALLOWED_FIELDS.has('allowed-tools'));
  assert.ok(!CURSOR_ALLOWED_FIELDS.has('context'));
  assert.ok(!CURSOR_ALLOWED_FIELDS.has('agent'));
  assert.ok(!CURSOR_ALLOWED_FIELDS.has('hooks'));
  assert.ok(!CURSOR_ALLOWED_FIELDS.has('paths'));
  assert.ok(!CURSOR_ALLOWED_FIELDS.has('shell'));
  assert.ok(!CURSOR_ALLOWED_FIELDS.has('effort'));
  assert.ok(!CURSOR_ALLOWED_FIELDS.has('model'));
});

// ── Report ─────────────────────────────────────────────────────────────────────

console.log(`\nSkill adapter tests: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
