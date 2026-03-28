#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const scriptPath = path.join(pluginRoot, 'scripts', 'dev', 'list-installed.js');

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passCount++; }
  catch (err) { console.error(`  FAIL  ${name}`); console.error(`        ${err.message}`); failCount++; }
}

function runListInstalled(args, stateContent) {
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-list-home-'));
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

test('list-installed.js: script exists', () => {
  assert.ok(fs.existsSync(scriptPath));
});

test('list-installed.js: responds to --help', () => {
  const r = spawnSync(process.execPath, [scriptPath, '--help'], {
    encoding: 'utf8', timeout: 10000,
    env: { ...process.env, SCC_PLUGIN_ROOT: pluginRoot }
  });
  assert.ok(r.status === 0 || r.status === 1);
  assert.ok(r.stdout.includes('list') || r.stdout.includes('scc'));
});

// ── No installation ──────────────────────────────────────────────────────────

test('list-installed.js: text when not installed', () => {
  const r = runListInstalled([]);
  assert.strictEqual(r.status, 0);
  assert.ok(r.stdout.includes('No SCC content'));
});

test('list-installed.js: --json when not installed', () => {
  const r = runListInstalled(['--json']);
  assert.strictEqual(r.status, 0);
  const parsed = JSON.parse(r.stdout);
  assert.strictEqual(parsed.installed, false);
  assert.deepStrictEqual(parsed.files, []);
});

// ── With installation ────────────────────────────────────────────────────────

test('list-installed.js: --json lists files with presence info', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-list-'));
  const testFile = path.join(tmpDir, 'test.md');
  fs.writeFileSync(testFile, 'content');

  try {
    const state = {
      installedFiles: [{ destPath: testFile, module: 'agents', installedAt: '2026-01-01' }],
      sessions: [],
      lastProfile: 'standard',
      lastTarget: 'claude',
      lastInstalledAt: '2026-01-01T00:00:00Z',
    };
    const r = runListInstalled(['--json'], state);
    assert.strictEqual(r.status, 0);
    const parsed = JSON.parse(r.stdout);
    assert.strictEqual(parsed.totalFiles, 1);
    assert.strictEqual(parsed.files[0].present, true);
    assert.strictEqual(parsed.files[0].module, 'agents');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('list-installed.js: --json marks missing files as not present', () => {
  const state = {
    installedFiles: [{ destPath: '/tmp/scc-nonexistent-list.md', module: 'agents' }],
    sessions: [],
    lastProfile: 'standard',
    lastTarget: 'claude',
    lastInstalledAt: '2026-01-01T00:00:00Z',
  };
  const r = runListInstalled(['--json'], state);
  assert.strictEqual(r.status, 0);
  const parsed = JSON.parse(r.stdout);
  assert.strictEqual(parsed.files[0].present, false);
});

test('list-installed.js: --missing only shows missing files', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-list-'));
  const presentFile = path.join(tmpDir, 'present.md');
  fs.writeFileSync(presentFile, 'content');

  try {
    const state = {
      installedFiles: [
        { destPath: presentFile, module: 'agents' },
        { destPath: '/tmp/scc-nonexistent-list-missing.md', module: 'skills' },
      ],
      sessions: [],
      lastProfile: 'standard',
      lastTarget: 'claude',
      lastInstalledAt: '2026-01-01T00:00:00Z',
    };
    const r = runListInstalled(['--missing', '--json'], state);
    assert.strictEqual(r.status, 0);
    const parsed = JSON.parse(r.stdout);
    assert.ok(parsed.files.every(f => !f.present), 'should only show missing files');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('list-installed.js: --missing reports all present when none missing', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-list-'));
  const presentFile = path.join(tmpDir, 'present.md');
  fs.writeFileSync(presentFile, 'content');

  try {
    const state = {
      installedFiles: [{ destPath: presentFile, module: 'agents' }],
      sessions: [],
      lastProfile: 'standard',
      lastTarget: 'claude',
      lastInstalledAt: '2026-01-01T00:00:00Z',
    };
    const r = runListInstalled(['--missing'], state);
    assert.strictEqual(r.status, 0);
    assert.ok(r.stdout.includes('All installed files are present') || r.stdout.includes('[OK]'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('list-installed.js: groups by module (default)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-list-'));
  const file1 = path.join(tmpDir, 'a.md');
  const file2 = path.join(tmpDir, 'b.md');
  fs.writeFileSync(file1, 'a');
  fs.writeFileSync(file2, 'b');

  try {
    const state = {
      installedFiles: [
        { destPath: file1, module: 'agents' },
        { destPath: file2, module: 'skills' },
      ],
      sessions: [],
      lastProfile: 'standard',
      lastTarget: 'claude',
      lastInstalledAt: '2026-01-01T00:00:00Z',
    };
    const r = runListInstalled([], state);
    assert.strictEqual(r.status, 0);
    assert.ok(r.stdout.includes('agents'));
    assert.ok(r.stdout.includes('skills'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('list-installed.js: --group-by content-type groups by content type', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-list-'));
  const file1 = path.join(tmpDir, '.claude', 'agents', 'a.md');
  const file2 = path.join(tmpDir, '.claude', 'skills', 'b.md');
  fs.mkdirSync(path.dirname(file1), { recursive: true });
  fs.mkdirSync(path.dirname(file2), { recursive: true });
  fs.writeFileSync(file1, 'a');
  fs.writeFileSync(file2, 'b');

  try {
    const state = {
      installedFiles: [
        { destPath: file1, module: 'agents' },
        { destPath: file2, module: 'skills' },
      ],
      sessions: [],
      lastProfile: 'standard',
      lastTarget: 'claude',
      lastInstalledAt: '2026-01-01T00:00:00Z',
    };
    const r = runListInstalled(['--group-by', 'content-type'], state);
    assert.strictEqual(r.status, 0);
    assert.ok(r.stdout.includes('agents'));
    assert.ok(r.stdout.includes('skills'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('list-installed.js: unknown --group-by falls back to flat list', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-list-'));
  const file1 = path.join(tmpDir, 'a.md');
  fs.writeFileSync(file1, 'a');

  try {
    const state = {
      installedFiles: [{ destPath: file1, module: 'test' }],
      sessions: [],
      lastProfile: 'standard',
      lastTarget: 'claude',
      lastInstalledAt: '2026-01-01T00:00:00Z',
    };
    const r = runListInstalled(['--group-by', 'flat'], state);
    assert.strictEqual(r.status, 0);
    assert.ok(r.stdout.includes(file1));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('list-installed.js: shows total count and missing count', () => {
  const state = {
    installedFiles: [
      { destPath: '/tmp/scc-nonexistent-list-count.md', module: 'test' },
    ],
    sessions: [],
    lastProfile: 'standard',
    lastTarget: 'claude',
    lastInstalledAt: '2026-01-01T00:00:00Z',
  };
  const r = runListInstalled([], state);
  assert.ok(r.stdout.includes('Total:'));
  assert.ok(r.stdout.includes('missing') || r.stdout.includes('MISSING'));
});

console.log(`\nlist-installed.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
