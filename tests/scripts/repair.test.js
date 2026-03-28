#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const scriptPath = path.join(pluginRoot, 'scripts', 'dev', 'repair.js');
const { simpleHash } = require(path.join(pluginRoot, 'scripts', 'lib', 'utils.js'));

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passCount++; }
  catch (err) { console.error(`  FAIL  ${name}`); console.error(`        ${err.message}`); failCount++; }
}

function runRepair(args, stateContent) {
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-repair-home-'));
  const stateDir = path.join(fakeHome, '.scc');
  fs.mkdirSync(stateDir, { recursive: true });
  if (stateContent) {
    fs.writeFileSync(path.join(stateDir, 'state.json'), JSON.stringify(stateContent), 'utf8');
  }
  const r = spawnSync(process.execPath, [scriptPath, ...args], {
    encoding: 'utf8',
    timeout: 15000,
    env: { ...process.env, SCC_PLUGIN_ROOT: pluginRoot, HOME: fakeHome },
  });
  // Read the state file back if it exists
  let updatedState = null;
  try {
    updatedState = JSON.parse(fs.readFileSync(path.join(stateDir, 'state.json'), 'utf8'));
  } catch { /* ignore */ }
  try { fs.rmSync(fakeHome, { recursive: true, force: true }); } catch { /* ignore */ }
  return { ...r, updatedState };
}

// ── Basic tests ──────────────────────────────────────────────────────────────

test('repair.js: script exists', () => {
  assert.ok(fs.existsSync(scriptPath), 'repair.js not found');
});

test('repair.js: responds to --help without crash', () => {
  const r = spawnSync(process.execPath, [scriptPath, '--help'], {
    encoding: 'utf8', timeout: 10000,
    env: { ...process.env, SCC_PLUGIN_ROOT: pluginRoot }
  });
  assert.ok(r.status === 0 || r.status === 1, `exit ${r.status}`);
  assert.ok(r.stdout.includes('repair') || r.stdout.includes('scc'), 'should print help text');
});

// ── No installation ──────────────────────────────────────────────────────────

test('repair.js: text output when nothing installed', () => {
  const r = runRepair([]);
  assert.strictEqual(r.status, 0);
  assert.ok(r.stdout.includes('No SCC installation found'), 'should report not installed');
});

test('repair.js: --json when nothing installed', () => {
  const r = runRepair(['--json']);
  assert.strictEqual(r.status, 0);
  const parsed = JSON.parse(r.stdout);
  assert.strictEqual(parsed.status, 'not-installed');
});

// ── All healthy ──────────────────────────────────────────────────────────────

test('repair.js: reports healthy when all files present', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-rep-'));
  const testFile = path.join(tmpDir, 'test.md');
  fs.writeFileSync(testFile, 'hello world');
  const hash = simpleHash(testFile);

  try {
    const state = {
      installedFiles: [{ destPath: testFile, srcPath: testFile, hash, module: 'test' }],
      sessions: [],
    };
    const r = runRepair([], state);
    assert.strictEqual(r.status, 0);
    assert.ok(r.stdout.includes('Nothing to repair') || r.stdout.includes('[OK]'), 'should report healthy');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('repair.js: --json reports healthy', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-rep-'));
  const testFile = path.join(tmpDir, 'test.md');
  fs.writeFileSync(testFile, 'hello world');
  const hash = simpleHash(testFile);

  try {
    const state = {
      installedFiles: [{ destPath: testFile, srcPath: testFile, hash, module: 'test' }],
      sessions: [],
    };
    const r = runRepair(['--json'], state);
    assert.strictEqual(r.status, 0);
    const parsed = JSON.parse(r.stdout);
    assert.strictEqual(parsed.status, 'healthy');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── Dry-run repair of missing file ───────────────────────────────────────────

test('repair.js: --dry-run lists missing file to restore', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-rep-'));
  const srcFile = path.join(tmpDir, 'source.md');
  const destFile = path.join(tmpDir, 'dest.md');
  fs.writeFileSync(srcFile, 'source content');

  try {
    const state = {
      installedFiles: [{ destPath: destFile, srcPath: srcFile, hash: 'abc', module: 'test' }],
      sessions: [],
    };
    const r = runRepair(['--dry-run'], state);
    assert.strictEqual(r.status, 0);
    assert.ok(r.stdout.includes('dry-run') || r.stdout.includes('DRY RUN'), 'should show dry-run');
    assert.ok(r.stdout.includes('Would restore') || r.stdout.includes('would-restore') || r.stdout.includes('Would repair'), 'should mention would restore');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('repair.js: --dry-run --json reports dry-run status', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-rep-'));
  const srcFile = path.join(tmpDir, 'source.md');
  const destFile = path.join(tmpDir, 'dest.md');
  fs.writeFileSync(srcFile, 'source content');

  try {
    const state = {
      installedFiles: [{ destPath: destFile, srcPath: srcFile, hash: 'abc', module: 'test' }],
      sessions: [],
    };
    const r = runRepair(['--dry-run', '--json'], state);
    assert.strictEqual(r.status, 0);
    const parsed = JSON.parse(r.stdout);
    assert.strictEqual(parsed.status, 'dry-run');
    assert.strictEqual(parsed.repaired, 1);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── Actual repair ────────────────────────────────────────────────────────────

test('repair.js: repairs missing file by copying from source', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-rep-'));
  const srcFile = path.join(tmpDir, 'source.md');
  const destFile = path.join(tmpDir, 'subdir', 'dest.md');
  fs.writeFileSync(srcFile, 'source content');

  try {
    const state = {
      installedFiles: [{ destPath: destFile, srcPath: srcFile, hash: 'abc', module: 'test' }],
      sessions: [],
      lastProfile: 'standard',
      lastTarget: 'claude',
      lastInstalledAt: '2026-01-01T00:00:00Z',
    };
    const r = runRepair([], state);
    assert.strictEqual(r.status, 0);
    assert.ok(fs.existsSync(destFile), 'dest file should be restored');
    assert.strictEqual(fs.readFileSync(destFile, 'utf8'), 'source content');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── Cannot repair ────────────────────────────────────────────────────────────

test('repair.js: reports cannot-repair when source missing', () => {
  const state = {
    installedFiles: [{ destPath: '/tmp/scc-nonexistent-dest.md', srcPath: '/tmp/scc-nonexistent-src.md', hash: 'abc', module: 'test' }],
    sessions: [],
  };
  const r = runRepair(['--json'], state);
  // Should still exit 0 (no errors in repair, just unrepairable)
  const parsed = JSON.parse(r.stdout);
  assert.strictEqual(parsed.cannotRepair, 1);
});

test('repair.js: reports cannot-repair when no srcPath', () => {
  const state = {
    installedFiles: [{ destPath: '/tmp/scc-nonexistent-dest.md', hash: 'abc', module: 'test' }],
    sessions: [],
  };
  const r = runRepair(['--json'], state);
  const parsed = JSON.parse(r.stdout);
  assert.strictEqual(parsed.cannotRepair, 1);
});

// ── Filters: --missing and --drifted ─────────────────────────────────────────

test('repair.js: --missing only repairs missing files', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-rep-'));
  const srcMissing = path.join(tmpDir, 'source-missing.md');
  const srcDrifted = path.join(tmpDir, 'source-drifted.md');
  const destDrifted = path.join(tmpDir, 'dest-drifted.md');
  fs.writeFileSync(srcMissing, 'missing source');
  fs.writeFileSync(srcDrifted, 'original drifted');
  fs.writeFileSync(destDrifted, 'changed content');

  try {
    const state = {
      installedFiles: [
        { destPath: '/tmp/scc-nonexist-missing.md', srcPath: srcMissing, hash: 'abc', module: 'test' },
        { destPath: destDrifted, srcPath: srcDrifted, hash: 'wrong-hash', module: 'test' },
      ],
      sessions: [],
    };
    const r = runRepair(['--missing', '--dry-run', '--json'], state);
    assert.strictEqual(r.status, 0);
    const parsed = JSON.parse(r.stdout);
    // Should only repair the missing file, not the drifted one
    assert.strictEqual(parsed.repaired, 1);
    assert.ok(parsed.repairedFiles.every(f => f.status === 'missing'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('repair.js: --drifted only repairs drifted files', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-rep-'));
  const srcDrifted = path.join(tmpDir, 'source-drifted.md');
  const destDrifted = path.join(tmpDir, 'dest-drifted.md');
  fs.writeFileSync(srcDrifted, 'original content');
  fs.writeFileSync(destDrifted, 'changed content');

  try {
    const state = {
      installedFiles: [
        { destPath: '/tmp/scc-nonexist-for-drifted-test.md', srcPath: '/tmp/scc-src-nonexist.md', hash: 'abc', module: 'test' },
        { destPath: destDrifted, srcPath: srcDrifted, hash: 'wrong-hash', module: 'test' },
      ],
      sessions: [],
    };
    const r = runRepair(['--drifted', '--dry-run', '--json'], state);
    assert.strictEqual(r.status, 0);
    const parsed = JSON.parse(r.stdout);
    assert.strictEqual(parsed.repaired, 1);
    assert.ok(parsed.repairedFiles.every(f => f.status === 'drifted'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

console.log(`\nrepair.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
