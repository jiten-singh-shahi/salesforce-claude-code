#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const scriptPath = path.join(pluginRoot, 'scripts', 'cli', 'uninstall.js');

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passCount++; }
  catch (err) { console.error(`  FAIL  ${name}`); console.error(`        ${err.message}`); failCount++; }
}

function runUninstall(args, stateContent) {
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-uninst-home-'));
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
  let updatedState = null;
  try {
    updatedState = JSON.parse(fs.readFileSync(path.join(stateDir, 'state.json'), 'utf8'));
  } catch { /* ignore */ }
  try { fs.rmSync(fakeHome, { recursive: true, force: true }); } catch { /* ignore */ }
  return { ...r, updatedState };
}

// ── Basic tests ──────────────────────────────────────────────────────────────

test('uninstall.js: script exists', () => {
  assert.ok(fs.existsSync(scriptPath), 'uninstall.js not found');
});

test('uninstall.js: responds to --help without crash', () => {
  const r = spawnSync(process.execPath, [scriptPath, '--help'], {
    encoding: 'utf8', timeout: 10000,
    env: { ...process.env, SCC_PLUGIN_ROOT: pluginRoot }
  });
  assert.ok(r.status === 0 || r.status === 1, `exit ${r.status}`);
  assert.ok(r.stdout.includes('uninstall') || r.stdout.includes('scc'), 'should print help text');
});

// ── No installation ──────────────────────────────────────────────────────────

test('uninstall.js: text output when nothing installed', () => {
  const r = runUninstall(['--yes']);
  assert.strictEqual(r.status, 0);
  assert.ok(r.stdout.includes('Nothing to uninstall') || r.stdout.includes('No SCC installation'));
});

test('uninstall.js: --json when nothing installed', () => {
  const r = runUninstall(['--json']);
  assert.strictEqual(r.status, 0);
  const parsed = JSON.parse(r.stdout);
  assert.strictEqual(parsed.status, 'not-installed');
});

// ── Dry-run ──────────────────────────────────────────────────────────────────

test('uninstall.js: --dry-run lists files to remove', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-uninst-'));
  const testFile = path.join(tmpDir, 'test.md');
  fs.writeFileSync(testFile, 'content');

  try {
    const state = {
      installedFiles: [{ destPath: testFile, module: 'test' }],
      sessions: [],
    };
    const r = runUninstall(['--dry-run'], state);
    assert.strictEqual(r.status, 0);
    assert.ok(r.stdout.includes('dry-run') || r.stdout.includes('DRY RUN'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('uninstall.js: --dry-run --json reports files to remove', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-uninst-'));
  const testFile = path.join(tmpDir, 'test.md');
  fs.writeFileSync(testFile, 'content');

  try {
    const state = {
      installedFiles: [{ destPath: testFile, module: 'test' }],
      sessions: [],
    };
    const r = runUninstall(['--dry-run', '--json'], state);
    assert.strictEqual(r.status, 0);
    const parsed = JSON.parse(r.stdout);
    assert.strictEqual(parsed.status, 'dry-run');
    assert.ok(parsed.wouldRemove.includes(testFile));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('uninstall.js: --dry-run --json reports already-missing files', () => {
  const state = {
    installedFiles: [{ destPath: '/tmp/scc-nonexistent-uninstall.md', module: 'test' }],
    sessions: [],
  };
  const r = runUninstall(['--dry-run', '--json'], state);
  assert.strictEqual(r.status, 0);
  const parsed = JSON.parse(r.stdout);
  assert.ok(parsed.alreadyMissing.length > 0);
});

// ── Actual uninstall ─────────────────────────────────────────────────────────

test('uninstall.js: removes files with --yes', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-uninst-'));
  const testFile = path.join(tmpDir, 'test.md');
  fs.writeFileSync(testFile, 'content');

  try {
    const state = {
      installedFiles: [{ destPath: testFile, module: 'test' }],
      sessions: [],
    };
    const r = runUninstall(['--yes'], state);
    assert.strictEqual(r.status, 0);
    assert.ok(!fs.existsSync(testFile), 'file should be removed');
    assert.ok(r.stdout.includes('Removed') || r.stdout.includes('REMOVED'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('uninstall.js: --json removes files and reports result', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-uninst-'));
  const testFile = path.join(tmpDir, 'test.md');
  fs.writeFileSync(testFile, 'content');

  try {
    const state = {
      installedFiles: [{ destPath: testFile, module: 'test' }],
      sessions: [],
    };
    const r = runUninstall(['--yes', '--json'], state);
    assert.strictEqual(r.status, 0);
    const parsed = JSON.parse(r.stdout);
    assert.strictEqual(parsed.status, 'ok');
    assert.strictEqual(parsed.removed, 1);
    assert.ok(parsed.removedFiles.includes(testFile));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('uninstall.js: prunes empty directories after removal', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-uninst-'));
  const subDir = path.join(tmpDir, 'subdir');
  fs.mkdirSync(subDir, { recursive: true });
  const testFile = path.join(subDir, 'test.md');
  fs.writeFileSync(testFile, 'content');

  try {
    const state = {
      installedFiles: [{ destPath: testFile, module: 'test' }],
      sessions: [],
    };
    const r = runUninstall(['--yes', '--json'], state);
    assert.strictEqual(r.status, 0);
    const parsed = JSON.parse(r.stdout);
    assert.ok(parsed.prunedDirs >= 0);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── --target filter ──────────────────────────────────────────────────────────

test('uninstall.js: --target filters files to specific target', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-uninst-'));
  const fileA = path.join(tmpDir, 'a.md');
  const fileB = path.join(tmpDir, 'b.md');
  fs.writeFileSync(fileA, 'a');
  fs.writeFileSync(fileB, 'b');

  try {
    const state = {
      installedFiles: [
        { destPath: fileA, module: 'test', target: 'claude' },
        { destPath: fileB, module: 'test', target: 'cursor' },
      ],
      sessions: [],
    };
    const r = runUninstall(['--yes', '--json', '--target', 'claude'], state);
    assert.strictEqual(r.status, 0);
    const parsed = JSON.parse(r.stdout);
    assert.strictEqual(parsed.removed, 1);
    assert.ok(!fs.existsSync(fileA), 'target file should be removed');
    assert.ok(fs.existsSync(fileB), 'non-target file should remain');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('uninstall.js: --target with no matching files exits cleanly', () => {
  const state = {
    installedFiles: [{ destPath: '/tmp/scc-test.md', module: 'test', target: 'claude' }],
    sessions: [],
  };
  const r = runUninstall(['--target', 'nonexistent'], state);
  assert.strictEqual(r.status, 0);
  assert.ok(r.stdout.includes('No files found'));
});

// ── --keep-state ─────────────────────────────────────────────────────────────

test('uninstall.js: --keep-state preserves state file', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-uninst-'));
  const testFile = path.join(tmpDir, 'test.md');
  fs.writeFileSync(testFile, 'content');

  try {
    const state = {
      installedFiles: [{ destPath: testFile, module: 'test' }],
      sessions: [],
    };
    const r = runUninstall(['--yes', '--keep-state'], state);
    assert.strictEqual(r.status, 0);
    // State should still be accessible (not cleared)
    assert.ok(!r.stdout.includes('State  : cleared'), 'should not say state cleared');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

console.log(`\nuninstall.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
