#!/usr/bin/env node
'use strict';

/**
 * build-cursor-agents.test.js — Tests for scripts/dev/build-cursor-agents.js
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
const buildScript = path.join(pluginRoot, 'scripts', 'dev', 'build-cursor-agents.js');
const srcAgentsDir = path.join(pluginRoot, 'agents');
const destAgentsDir = path.join(pluginRoot, '.cursor', 'agents');

const SCC_ONLY_FIELDS = ['origin', 'tools', 'disallowedTools', 'permissionMode', 'maxTurns', 'skills', 'mcpServers', 'hooks', 'memory', 'effort', 'isolation', 'initialPrompt'];
const INVALID_CURSOR_MODELS = new Set(['sonnet', 'opus', 'haiku', 'claude-sonnet', 'claude-opus', 'claude-haiku']);

// ── Run the build ──────────────────────────────────────────────────────────────

test('build-cursor-agents.js: runs without error', () => {
  execFileSync(process.execPath, [buildScript], {
    cwd: pluginRoot,
    env: { ...process.env, SCC_PLUGIN_ROOT: pluginRoot },
    encoding: 'utf8',
    timeout: 30000,
  });
  assert.ok(fs.existsSync(destAgentsDir), '.cursor/agents/ should exist after build');
});

// ── Validate output ────────────────────────────────────────────────────────────

test('build-cursor-agents.js: generates agents for all source agent files', () => {
  const srcFiles = fs.readdirSync(srcAgentsDir).filter(f => f.endsWith('.md'));
  const destFiles = fs.readdirSync(destAgentsDir).filter(f => f.endsWith('.md'));

  assert.strictEqual(destFiles.length, srcFiles.length,
    `Expected ${srcFiles.length} agents, got ${destFiles.length}`);
});

test('build-cursor-agents.js: every output agent has valid Cursor frontmatter', () => {
  const destFiles = fs.readdirSync(destAgentsDir).filter(f => f.endsWith('.md'));

  for (const file of destFiles) {
    const content = fs.readFileSync(path.join(destAgentsDir, file), 'utf8');
    const { frontmatter } = parseFrontmatter(content);

    assert.ok(frontmatter.name, `${file}: name is required`);
    assert.ok(frontmatter.description, `${file}: description is required`);
  }
});

test('build-cursor-agents.js: no SCC-specific fields in output', () => {
  const destFiles = fs.readdirSync(destAgentsDir).filter(f => f.endsWith('.md'));

  for (const file of destFiles) {
    const content = fs.readFileSync(path.join(destAgentsDir, file), 'utf8');
    const { frontmatter } = parseFrontmatter(content);

    for (const field of SCC_ONLY_FIELDS) {
      assert.strictEqual(frontmatter[field], undefined,
        `${file}: should not have SCC-only field '${field}'`);
    }
  }
});

test('build-cursor-agents.js: model values are Cursor-compatible', () => {
  const destFiles = fs.readdirSync(destAgentsDir).filter(f => f.endsWith('.md'));

  for (const file of destFiles) {
    const content = fs.readFileSync(path.join(destAgentsDir, file), 'utf8');
    const { frontmatter } = parseFrontmatter(content);

    if (frontmatter.model) {
      assert.ok(!INVALID_CURSOR_MODELS.has(frontmatter.model),
        `${file}: model '${frontmatter.model}' is not a valid Cursor model alias`);
    }
  }
});

test('build-cursor-agents.js: clean build removes stale files', () => {
  const staleFile = path.join(destAgentsDir, 'stale-agent-should-not-exist.md');
  fs.writeFileSync(staleFile, '---\nname: stale\ndescription: should be removed\n---\nStale');

  execFileSync(process.execPath, [buildScript], {
    cwd: pluginRoot,
    env: { ...process.env, SCC_PLUGIN_ROOT: pluginRoot },
    encoding: 'utf8',
    timeout: 30000,
  });

  assert.ok(!fs.existsSync(staleFile), 'Stale agent should be removed on clean build');
});

// ── Report ─────────────────────────────────────────────────────────────────────

console.log(`\nBuild cursor-agents tests: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
