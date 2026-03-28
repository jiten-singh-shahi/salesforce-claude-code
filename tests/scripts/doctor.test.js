#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const scriptPath = path.join(pluginRoot, 'scripts', 'dev', 'doctor.js');

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passCount++; }
  catch (err) { console.error(`  FAIL  ${name}`); console.error(`        ${err.message}`); failCount++; }
}

/**
 * Run doctor.js with a fake HOME so state-store reads from our temp state file.
 * Write a JSON state file to $fakeHome/.scc/state.json.
 */
function runDoctor(args, stateContent) {
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-doc-home-'));
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
  try { fs.rmSync(fakeHome, { recursive: true, force: true }); } catch { /* ignore */ }
  return r;
}

// ── Basic tests ──────────────────────────────────────────────────────────────

test('doctor.js: script exists', () => {
  assert.ok(fs.existsSync(scriptPath), 'doctor.js not found');
});

test('doctor.js: is valid JavaScript', () => {
  const c = fs.readFileSync(scriptPath, 'utf8');
  assert.ok(c.includes('require(') || c.includes('process.argv'));
});

test('doctor.js: responds to --help without crash', () => {
  const r = spawnSync(process.execPath, [scriptPath, '--help'], {
    encoding: 'utf8', timeout: 10000,
    env: { ...process.env, SCC_PLUGIN_ROOT: pluginRoot }
  });
  assert.ok(r.status === 0 || r.status === 1, `exit ${r.status}`);
  assert.ok(r.stdout.includes('doctor') || r.stdout.includes('scc'), 'should print help text');
});

// ── No installation ──────────────────────────────────────────────────────────

test('doctor.js: text output when no installation', () => {
  const r = runDoctor([]);
  assert.strictEqual(r.status, 0);
  assert.ok(r.stdout.includes('No SCC installation found'), 'should report not installed');
});

test('doctor.js: --json when no installation', () => {
  const r = runDoctor(['--json']);
  assert.strictEqual(r.status, 0);
  const parsed = JSON.parse(r.stdout);
  assert.strictEqual(parsed.status, 'not-installed');
  assert.ok(parsed.message.includes('No SCC installation'));
  assert.deepStrictEqual(parsed.files, []);
});

// ── Healthy files ────────────────────────────────────────────────────────────

test('doctor.js: reports healthy when all files present', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-doc-'));
  const testFile = path.join(tmpDir, 'test.md');
  fs.writeFileSync(testFile, 'hello world');
  const { simpleHash } = require(path.join(pluginRoot, 'scripts', 'lib', 'utils.js'));
  const hash = simpleHash(testFile);

  try {
    const state = {
      installedFiles: [{ destPath: testFile, srcPath: testFile, hash, module: 'test' }],
      sessions: [],
      lastProfile: 'standard',
      lastTarget: 'claude',
      lastInstalledAt: '2026-01-01T00:00:00Z',
    };
    const r = runDoctor([], state);
    assert.strictEqual(r.status, 0);
    assert.ok(r.stdout.includes('HEALTHY'), 'should report healthy');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('doctor.js: --json reports healthy summary', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-doc-'));
  const testFile = path.join(tmpDir, 'test.md');
  fs.writeFileSync(testFile, 'hello world');
  const { simpleHash } = require(path.join(pluginRoot, 'scripts', 'lib', 'utils.js'));
  const hash = simpleHash(testFile);

  try {
    const state = {
      installedFiles: [{ destPath: testFile, srcPath: testFile, hash, module: 'test' }],
      sessions: [],
      lastProfile: 'standard',
      lastTarget: 'claude',
      lastInstalledAt: '2026-01-01T00:00:00Z',
    };
    const r = runDoctor(['--json'], state);
    assert.strictEqual(r.status, 0);
    const parsed = JSON.parse(r.stdout);
    assert.strictEqual(parsed.summary.status, 'healthy');
    assert.strictEqual(parsed.summary.healthy, 1);
    assert.strictEqual(parsed.summary.missing, 0);
    assert.strictEqual(parsed.summary.drifted, 0);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── Missing files ────────────────────────────────────────────────────────────

test('doctor.js: reports missing files with exit 1', () => {
  const state = {
    installedFiles: [{ destPath: '/tmp/scc-nonexistent-file-12345.md', srcPath: '/tmp/scc-source-12345.md', hash: 'abc', module: 'test' }],
    sessions: [],
    lastProfile: 'standard',
    lastTarget: 'claude',
    lastInstalledAt: '2026-01-01T00:00:00Z',
  };
  const r = runDoctor([], state);
  assert.strictEqual(r.status, 1, 'should exit 1 for missing files');
  assert.ok(r.stdout.includes('MISSING') || r.stdout.includes('Missing'), 'should mention missing');
});

test('doctor.js: --json reports missing files', () => {
  const state = {
    installedFiles: [{ destPath: '/tmp/scc-nonexistent-file-12345.md', srcPath: '/tmp/src.md', hash: 'abc', module: 'test' }],
    sessions: [],
    lastProfile: 'standard',
    lastTarget: 'claude',
    lastInstalledAt: '2026-01-01T00:00:00Z',
  };
  const r = runDoctor(['--json'], state);
  assert.strictEqual(r.status, 1);
  const parsed = JSON.parse(r.stdout);
  assert.strictEqual(parsed.summary.status, 'degraded');
  assert.strictEqual(parsed.summary.missing, 1);
  assert.ok(parsed.files.length > 0, 'should list missing files');
});

// ── Drifted files ────────────────────────────────────────────────────────────

test('doctor.js: reports drifted files with exit 1', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-doc-'));
  const testFile = path.join(tmpDir, 'test.md');
  fs.writeFileSync(testFile, 'original content');

  try {
    const state = {
      installedFiles: [{ destPath: testFile, srcPath: testFile, hash: 'wrong-hash', module: 'test' }],
      sessions: [],
      lastProfile: 'standard',
      lastTarget: 'claude',
      lastInstalledAt: '2026-01-01T00:00:00Z',
    };
    const r = runDoctor([], state);
    assert.strictEqual(r.status, 1, 'should exit 1 for drifted files');
    assert.ok(r.stdout.includes('DRIFTED') || r.stdout.includes('drifted'), 'should mention drifted');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('doctor.js: --json reports drifted files', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-doc-'));
  const testFile = path.join(tmpDir, 'test.md');
  fs.writeFileSync(testFile, 'original content');

  try {
    const state = {
      installedFiles: [{ destPath: testFile, srcPath: testFile, hash: 'wrong-hash', module: 'test' }],
      sessions: [],
      lastProfile: 'standard',
      lastTarget: 'claude',
      lastInstalledAt: '2026-01-01T00:00:00Z',
    };
    const r = runDoctor(['--json'], state);
    assert.strictEqual(r.status, 1);
    const parsed = JSON.parse(r.stdout);
    assert.strictEqual(parsed.summary.drifted, 1);
    assert.ok(parsed.files.some(f => f.status === 'drifted'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── Verbose mode ─────────────────────────────────────────────────────────────

test('doctor.js: --verbose shows OK for healthy files', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-doc-'));
  const testFile = path.join(tmpDir, 'test.md');
  fs.writeFileSync(testFile, 'hello world');
  const { simpleHash } = require(path.join(pluginRoot, 'scripts', 'lib', 'utils.js'));
  const hash = simpleHash(testFile);

  try {
    const state = {
      installedFiles: [{ destPath: testFile, srcPath: testFile, hash, module: 'test' }],
      sessions: [],
      lastProfile: 'standard',
      lastTarget: 'claude',
      lastInstalledAt: '2026-01-01T00:00:00Z',
    };
    const r = runDoctor(['--verbose'], state);
    assert.strictEqual(r.status, 0);
    assert.ok(r.stdout.includes('[OK]'), 'should show OK for healthy files in verbose mode');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('doctor.js: --json --verbose includes ok files', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-doc-'));
  const testFile = path.join(tmpDir, 'test.md');
  fs.writeFileSync(testFile, 'hello world');
  const { simpleHash } = require(path.join(pluginRoot, 'scripts', 'lib', 'utils.js'));
  const hash = simpleHash(testFile);

  try {
    const state = {
      installedFiles: [{ destPath: testFile, srcPath: testFile, hash, module: 'test' }],
      sessions: [],
      lastProfile: 'standard',
      lastTarget: 'claude',
      lastInstalledAt: '2026-01-01T00:00:00Z',
    };
    const r = runDoctor(['--json', '--verbose'], state);
    assert.strictEqual(r.status, 0);
    const parsed = JSON.parse(r.stdout);
    assert.ok(parsed.files.some(f => f.status === 'ok'), 'verbose json should include ok files');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('doctor.js: text output shows source for missing files', () => {
  const state = {
    installedFiles: [{ destPath: '/tmp/scc-nonexistent-file-12345.md', srcPath: '/tmp/scc-source-12345.md', hash: 'abc', module: 'test' }],
    sessions: [],
    lastProfile: 'standard',
    lastTarget: 'claude',
    lastInstalledAt: '2026-01-01T00:00:00Z',
  };
  const r = runDoctor([], state);
  assert.ok(r.stdout.includes('Source:'), 'should show source path');
});

test('doctor.js: verbose shows healthy alongside issues', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-doc-'));
  const goodFile = path.join(tmpDir, 'good.md');
  fs.writeFileSync(goodFile, 'good content');
  const { simpleHash } = require(path.join(pluginRoot, 'scripts', 'lib', 'utils.js'));
  const hash = simpleHash(goodFile);

  try {
    const state = {
      installedFiles: [
        { destPath: goodFile, srcPath: goodFile, hash, module: 'test' },
        { destPath: '/tmp/scc-nonexistent-file-verbose-test.md', srcPath: '/tmp/src.md', hash: 'abc', module: 'test' },
      ],
      sessions: [],
      lastProfile: 'standard',
      lastTarget: 'claude',
      lastInstalledAt: '2026-01-01T00:00:00Z',
    };
    const r = runDoctor(['--verbose'], state);
    assert.strictEqual(r.status, 1);
    assert.ok(r.stdout.includes('[OK]'), 'verbose should show healthy files');
    assert.ok(r.stdout.includes('[MISSING]'), 'should show missing files');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('doctor.js: shows repair hint when issues found', () => {
  const state = {
    installedFiles: [{ destPath: '/tmp/scc-nonexistent-repair-hint.md', hash: 'abc', module: 'test' }],
    sessions: [],
    lastProfile: 'standard',
    lastTarget: 'claude',
    lastInstalledAt: '2026-01-01T00:00:00Z',
  };
  const r = runDoctor([], state);
  assert.ok(r.stdout.includes('scc repair'), 'should suggest scc repair');
});

console.log(`\ndoctor.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
