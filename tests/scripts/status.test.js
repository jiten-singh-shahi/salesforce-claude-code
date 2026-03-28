#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const scriptPath = path.join(pluginRoot, 'scripts', 'dev', 'status.js');

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passCount++; }
  catch (err) { console.error(`  FAIL  ${name}`); console.error(`        ${err.message}`); failCount++; }
}

function runStatus(args, stateContent) {
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-status-home-'));
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

test('status.js: script exists', () => {
  assert.ok(fs.existsSync(scriptPath), 'status.js not found');
});

test('status.js: responds to --help', () => {
  const r = spawnSync(process.execPath, [scriptPath, '--help'], {
    encoding: 'utf8', timeout: 10000,
    env: { ...process.env, SCC_PLUGIN_ROOT: pluginRoot }
  });
  assert.ok(r.status === 0 || r.status === 1);
  assert.ok(r.stdout.includes('status') || r.stdout.includes('scc'));
});

// ── No installation ──────────────────────────────────────────────────────────

test('status.js: text output when not installed', () => {
  const r = runStatus([]);
  assert.strictEqual(r.status, 0);
  assert.ok(r.stdout.includes('not installed') || r.stdout.includes('No SCC'));
});

test('status.js: --json when not installed', () => {
  const r = runStatus(['--json']);
  assert.strictEqual(r.status, 0);
  const parsed = JSON.parse(r.stdout);
  assert.strictEqual(parsed.installed, false);
});

// ── With installation ────────────────────────────────────────────────────────

test('status.js: shows profile and target when installed', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-stat-'));
  const testFile = path.join(tmpDir, 'test.md');
  fs.writeFileSync(testFile, 'content');

  try {
    const state = {
      installedFiles: [{ destPath: testFile, module: 'agents', target: 'claude' }],
      sessions: [],
      lastProfile: 'standard',
      lastTarget: 'claude',
      lastInstalledAt: '2026-01-01T00:00:00Z',
    };
    const r = runStatus([], state);
    assert.strictEqual(r.status, 0);
    assert.ok(r.stdout.includes('standard') || r.stdout.includes('Profile'));
    assert.ok(r.stdout.includes('HEALTHY') || r.stdout.includes('healthy'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('status.js: --json returns full status object', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-stat-'));
  const testFile = path.join(tmpDir, '.claude', 'agents', 'test.md');
  fs.mkdirSync(path.dirname(testFile), { recursive: true });
  fs.writeFileSync(testFile, 'content');

  try {
    const state = {
      installedFiles: [{ destPath: testFile, module: 'agents', target: 'claude' }],
      sessions: [{ profile: 'standard', target: 'claude', fileCount: 1, installedAt: '2026-01-01T00:00:00Z' }],
      lastProfile: 'standard',
      lastTarget: 'claude',
      lastInstalledAt: '2026-01-01T00:00:00Z',
    };
    const r = runStatus(['--json'], state);
    assert.strictEqual(r.status, 0);
    const parsed = JSON.parse(r.stdout);
    assert.strictEqual(parsed.installed, true);
    assert.strictEqual(parsed.profile, 'standard');
    assert.strictEqual(parsed.target, 'claude');
    assert.strictEqual(parsed.totalFiles, 1);
    assert.strictEqual(parsed.health, 'healthy');
    assert.ok(Array.isArray(parsed.modules));
    assert.ok(Array.isArray(parsed.contentTypes));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('status.js: --json --sessions includes session history', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-stat-'));
  const testFile = path.join(tmpDir, 'test.md');
  fs.writeFileSync(testFile, 'content');

  try {
    const state = {
      installedFiles: [{ destPath: testFile, module: 'agents' }],
      sessions: [{ profile: 'standard', target: 'claude', fileCount: 1, installedAt: '2026-01-01T00:00:00Z' }],
      lastProfile: 'standard',
      lastTarget: 'claude',
      lastInstalledAt: '2026-01-01T00:00:00Z',
    };
    const r = runStatus(['--json', '--sessions'], state);
    assert.strictEqual(r.status, 0);
    const parsed = JSON.parse(r.stdout);
    assert.ok(Array.isArray(parsed.sessions));
    assert.strictEqual(parsed.sessions.length, 1);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('status.js: --json --files includes file paths', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-stat-'));
  const testFile = path.join(tmpDir, 'test.md');
  fs.writeFileSync(testFile, 'content');

  try {
    const state = {
      installedFiles: [{ destPath: testFile, module: 'agents' }],
      sessions: [],
      lastProfile: 'standard',
      lastTarget: 'claude',
      lastInstalledAt: '2026-01-01T00:00:00Z',
    };
    const r = runStatus(['--json', '--files'], state);
    assert.strictEqual(r.status, 0);
    const parsed = JSON.parse(r.stdout);
    assert.ok(Array.isArray(parsed.files));
    assert.ok(parsed.files.includes(testFile));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('status.js: reports degraded health when files missing', () => {
  const state = {
    installedFiles: [{ destPath: '/tmp/scc-nonexistent-status.md', module: 'test' }],
    sessions: [],
    lastProfile: 'standard',
    lastTarget: 'claude',
    lastInstalledAt: '2026-01-01T00:00:00Z',
  };
  const r = runStatus([], state);
  assert.strictEqual(r.status, 0);
  assert.ok(r.stdout.includes('DEGRADED') || r.stdout.includes('degraded') || r.stdout.includes('missing'));
});

test('status.js: --json reports degraded health', () => {
  const state = {
    installedFiles: [{ destPath: '/tmp/scc-nonexistent-status.md', module: 'test' }],
    sessions: [],
    lastProfile: 'standard',
    lastTarget: 'claude',
    lastInstalledAt: '2026-01-01T00:00:00Z',
  };
  const r = runStatus(['--json'], state);
  const parsed = JSON.parse(r.stdout);
  assert.strictEqual(parsed.health, 'degraded');
  assert.strictEqual(parsed.missingFiles, 1);
});

test('status.js: text shows module counts', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-stat-'));
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
    const r = runStatus([], state);
    assert.strictEqual(r.status, 0);
    assert.ok(r.stdout.includes('agents') || r.stdout.includes('modules'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('status.js: --files shows file paths in text mode', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-stat-'));
  const testFile = path.join(tmpDir, 'test.md');
  fs.writeFileSync(testFile, 'content');

  try {
    const state = {
      installedFiles: [{ destPath: testFile, module: 'agents' }],
      sessions: [],
      lastProfile: 'standard',
      lastTarget: 'claude',
      lastInstalledAt: '2026-01-01T00:00:00Z',
    };
    const r = runStatus(['--files'], state);
    assert.strictEqual(r.status, 0);
    assert.ok(r.stdout.includes(testFile), 'should show file path');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('status.js: --files marks missing files', () => {
  const state = {
    installedFiles: [{ destPath: '/tmp/scc-nonexistent-status-files.md', module: 'test' }],
    sessions: [],
    lastProfile: 'standard',
    lastTarget: 'claude',
    lastInstalledAt: '2026-01-01T00:00:00Z',
  };
  const r = runStatus(['--files'], state);
  assert.ok(r.stdout.includes('[MISSING]'));
});

test('status.js: --sessions shows session history in text mode', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-stat-'));
  const testFile = path.join(tmpDir, 'test.md');
  fs.writeFileSync(testFile, 'content');

  try {
    const state = {
      installedFiles: [{ destPath: testFile, module: 'agents' }],
      sessions: [{ profile: 'standard', target: 'claude', fileCount: 5, installedAt: '2026-01-01T12:00:00Z' }],
      lastProfile: 'standard',
      lastTarget: 'claude',
      lastInstalledAt: '2026-01-01T12:00:00Z',
    };
    const r = runStatus(['--sessions'], state);
    assert.strictEqual(r.status, 0);
    assert.ok(r.stdout.includes('Session history') || r.stdout.includes('2026-01-01'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

console.log(`\nstatus.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
