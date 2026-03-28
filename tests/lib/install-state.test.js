#!/usr/bin/env node
'use strict';

/**
 * install-state.test.js — Unit tests for scripts/lib/install-state.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { createInstallState, readInstallState, writeInstallState } = require('../../scripts/lib/install-state');

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
  return fs.mkdtempSync(path.join(os.tmpdir(), 'scc-install-state-'));
}

// ── createInstallState tests ────────────────────────────────────────────────

test('createInstallState: creates valid state with all fields', () => {
  const state = createInstallState({
    target: { id: 'claude', root: '/tmp/project', installStatePath: '/tmp/state.json' },
    request: { profile: 'apex', modules: ['core', 'apex'], includeComponents: [], excludeComponents: [], legacyLanguages: [], legacyMode: false },
    resolution: { selectedModules: ['core', 'apex'], skippedModules: [] },
    source: { repoVersion: '1.0.0', repoCommit: 'abc123', manifestVersion: 2 },
    operations: [
      { kind: 'copy', moduleId: 'core', sourceRelativePath: 'agents/sf-planner.md', destinationPath: '.claude/agents/sf-planner.md', strategy: 'overwrite', ownership: 'scc', scaffoldOnly: false },
    ],
  });

  assert.strictEqual(state.schemaVersion, 'scc.install.v1');
  assert.ok(state.installedAt);
  assert.strictEqual(state.target.id, 'claude');
  assert.strictEqual(state.request.profile, 'apex');
  assert.strictEqual(state.resolution.selectedModules.length, 2);
  assert.strictEqual(state.operations.length, 1);
});

test('createInstallState: fills defaults for optional fields', () => {
  const state = createInstallState({
    target: { id: 'cursor', root: '/tmp', installStatePath: '/tmp/s.json' },
    request: { profile: 'full' },
    resolution: {},
    source: {},
    operations: [],
  });

  assert.strictEqual(state.request.legacyMode, false);
  assert.deepStrictEqual(state.request.modules, []);
  assert.deepStrictEqual(state.resolution.selectedModules, []);
  assert.strictEqual(state.source.manifestVersion, 2);
});

test('createInstallState: throws when operations have wrong types', () => {
  assert.throws(() => {
    createInstallState({
      target: { id: 'claude', root: '/tmp', installStatePath: '/tmp/s.json' },
      request: {},
      resolution: {},
      source: { manifestVersion: 'not-a-number' },  // should be integer
      operations: [],
    });
  }, /Invalid install-state/);
});

// ── writeInstallState + readInstallState tests ──────────────────────────────

test('writeInstallState + readInstallState: round-trip preserves data', () => {
  const tmpDir = makeTmpDir();
  const statePath = path.join(tmpDir, 'install-state.json');

  const state = createInstallState({
    target: { id: 'claude', root: '/tmp/project', installStatePath: statePath },
    request: { profile: 'apex', modules: ['core', 'apex'], includeComponents: [], excludeComponents: [], legacyLanguages: [], legacyMode: false },
    resolution: { selectedModules: ['core', 'apex'], skippedModules: ['lwc'] },
    source: { repoVersion: '1.0.0', repoCommit: null, manifestVersion: 2 },
    operations: [
      { kind: 'copy', moduleId: 'core', sourceRelativePath: 'agents/sf-planner.md', destinationPath: '.claude/agents/sf-planner.md', strategy: 'overwrite', ownership: 'scc', scaffoldOnly: false },
    ],
  });

  writeInstallState(state, statePath);
  const loaded = readInstallState(statePath);

  assert.ok(loaded);
  assert.strictEqual(loaded.schemaVersion, 'scc.install.v1');
  assert.strictEqual(loaded.target.id, 'claude');
  assert.strictEqual(loaded.request.profile, 'apex');
  assert.strictEqual(loaded.operations.length, 1);
  assert.strictEqual(loaded.operations[0].moduleId, 'core');

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('readInstallState: returns null for missing file', () => {
  const result = readInstallState('/nonexistent/path/state.json');
  assert.strictEqual(result, null);
});

test('readInstallState: returns null for invalid JSON', () => {
  const tmpDir = makeTmpDir();
  const statePath = path.join(tmpDir, 'bad.json');
  fs.writeFileSync(statePath, 'not json');

  const result = readInstallState(statePath);
  assert.strictEqual(result, null);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('readInstallState: returns null for schema-invalid data', () => {
  const tmpDir = makeTmpDir();
  const statePath = path.join(tmpDir, 'invalid.json');
  fs.writeFileSync(statePath, JSON.stringify({ invalid: true }));

  const result = readInstallState(statePath);
  assert.strictEqual(result, null);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('writeInstallState: throws for invalid state', () => {
  const tmpDir = makeTmpDir();
  const statePath = path.join(tmpDir, 'state.json');

  assert.throws(() => {
    writeInstallState({ bad: 'data' }, statePath);
  }, /Invalid install-state/);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── Report ─────────────────────────────────────────────────────────────────────

console.log(`\ninstall-state.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
