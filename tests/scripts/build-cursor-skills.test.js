#!/usr/bin/env node
'use strict';

/**
 * build-cursor-skills.test.js — Tests for scripts/dev/build-cursor-skills.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const { parseFrontmatter, getPluginRoot } = require('../../scripts/lib/utils');

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

const pluginRoot = getPluginRoot();
const buildScript = path.join(pluginRoot, 'scripts', 'dev', 'build-cursor-skills.js');
const srcSkillsDir = path.join(pluginRoot, 'skills');
const destSkillsDir = path.join(pluginRoot, '.cursor', 'skills');

// SCC-specific fields that should NOT appear in Cursor output
const SCC_ONLY_FIELDS = ['origin', 'user-invocable', 'allowed-tools', 'context', 'agent', 'hooks', 'paths', 'shell', 'effort', 'model', 'argument-hint'];

// ── Run the build ──────────────────────────────────────────────────────────────

test('build-cursor-skills.js: runs without error', () => {
  execFileSync(process.execPath, [buildScript], {
    cwd: pluginRoot,
    env: { ...process.env, SCC_PLUGIN_ROOT: pluginRoot },
    encoding: 'utf8',
    timeout: 30000,
  });
  assert.ok(fs.existsSync(destSkillsDir), '.cursor/skills/ should exist after build');
});

// ── Validate output ────────────────────────────────────────────────────────────

test('build-cursor-skills.js: generates skills for all source skill directories', () => {
  const srcEntries = fs.readdirSync(srcSkillsDir, { withFileTypes: true })
    .filter(e => e.isDirectory() && fs.existsSync(path.join(srcSkillsDir, e.name, 'SKILL.md')));
  const destEntries = fs.readdirSync(destSkillsDir, { withFileTypes: true })
    .filter(e => e.isDirectory());

  assert.strictEqual(destEntries.length, srcEntries.length,
    `Expected ${srcEntries.length} skills, got ${destEntries.length}`);
});

test('build-cursor-skills.js: every output skill has valid Cursor frontmatter', () => {
  const destEntries = fs.readdirSync(destSkillsDir, { withFileTypes: true })
    .filter(e => e.isDirectory());

  for (const entry of destEntries) {
    const skillMd = path.join(destSkillsDir, entry.name, 'SKILL.md');
    assert.ok(fs.existsSync(skillMd), `${entry.name}/SKILL.md should exist`);

    const content = fs.readFileSync(skillMd, 'utf8');
    const { frontmatter } = parseFrontmatter(content);

    assert.ok(frontmatter.name, `${entry.name}: name is required`);
    assert.ok(frontmatter.description, `${entry.name}: description is required`);
  }
});

test('build-cursor-skills.js: no SCC-specific fields in output', () => {
  const destEntries = fs.readdirSync(destSkillsDir, { withFileTypes: true })
    .filter(e => e.isDirectory());

  for (const entry of destEntries) {
    const skillMd = path.join(destSkillsDir, entry.name, 'SKILL.md');
    const content = fs.readFileSync(skillMd, 'utf8');
    const { frontmatter } = parseFrontmatter(content);

    for (const field of SCC_ONLY_FIELDS) {
      assert.strictEqual(frontmatter[field], undefined,
        `${entry.name}: should not have SCC-only field '${field}'`);
    }
  }
});

test('build-cursor-skills.js: supporting directories are copied', () => {
  // Check continuous-learning-v2 which has scripts/ and config.json
  const clv2Dest = path.join(destSkillsDir, 'continuous-learning-v2');
  if (fs.existsSync(clv2Dest)) {
    const clv2Src = path.join(srcSkillsDir, 'continuous-learning-v2');
    const srcHasScripts = fs.existsSync(path.join(clv2Src, 'scripts'));
    if (srcHasScripts) {
      assert.ok(fs.existsSync(path.join(clv2Dest, 'scripts')),
        'continuous-learning-v2/scripts/ should be copied');
    }
  }
});

test('build-cursor-skills.js: clean build removes stale files', () => {
  // Create a stale skill in dest
  const staleDir = path.join(destSkillsDir, 'stale-skill-that-should-not-exist');
  fs.mkdirSync(staleDir, { recursive: true });
  fs.writeFileSync(path.join(staleDir, 'SKILL.md'), '---\nname: stale\ndescription: should be removed\n---\nStale');

  // Re-run build
  execFileSync(process.execPath, [buildScript], {
    cwd: pluginRoot,
    env: { ...process.env, SCC_PLUGIN_ROOT: pluginRoot },
    encoding: 'utf8',
    timeout: 30000,
  });

  assert.ok(!fs.existsSync(staleDir), 'Stale skill should be removed on clean build');
});

// ── Report ─────────────────────────────────────────────────────────────────────

console.log(`\nBuild cursor-skills tests: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
