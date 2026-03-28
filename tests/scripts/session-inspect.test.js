#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const scriptPath = path.join(pluginRoot, 'scripts', 'dev', 'session-inspect.js');
const mod = require(scriptPath);

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

// ── Module exports ───────────────────────────────────────────────────────────

test('session-inspect.js: script exists', () => {
  assert.ok(fs.existsSync(scriptPath), 'session-inspect.js not found');
});

test('session-inspect.js: exports expected functions', () => {
  assert.ok(typeof mod.parseArgs === 'function', 'Should export parseArgs');
  assert.ok(typeof mod.parseSessionFile === 'function', 'Should export parseSessionFile');
  assert.ok(typeof mod.listSessionFiles === 'function', 'Should export listSessionFiles');
  assert.ok(typeof mod.main === 'function', 'Should export main');
});

// ── parseArgs ────────────────────────────────────────────────────────────────

test('parseArgs: extracts target', () => {
  const result = mod.parseArgs(['node', 'script.js', 'claude:latest']);
  assert.strictEqual(result.target, 'claude:latest');
  assert.strictEqual(result.writePath, null);
});

test('parseArgs: extracts --write path', () => {
  const result = mod.parseArgs(['node', 'script.js', 'claude:latest', '--write', '/tmp/out.json']);
  assert.strictEqual(result.target, 'claude:latest');
  assert.strictEqual(result.writePath, '/tmp/out.json');
});

test('parseArgs: handles no arguments', () => {
  const result = mod.parseArgs(['node', 'script.js']);
  assert.strictEqual(result.target, undefined);
});

test('parseArgs: handles list as target', () => {
  const result = mod.parseArgs(['node', 'script.js', 'list']);
  assert.strictEqual(result.target, 'list');
});

test('parseArgs: handles file path as target', () => {
  const result = mod.parseArgs(['node', 'script.js', '/tmp/session.tmp']);
  assert.strictEqual(result.target, '/tmp/session.tmp');
});

// ── parseSessionFile ─────────────────────────────────────────────────────────

test('parseSessionFile: extracts all metadata fields', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-inspect-'));
  const sessionFile = path.join(tmpDir, '2026-03-18-abc12345-session.tmp');
  fs.writeFileSync(sessionFile, [
    '# Session Summary',
    '',
    '**Date:** 2026-03-18',
    '**Started:** 10:00:00',
    '**Last Updated:** 11:30:00',
    '**Project:** my-sf-project',
    '**Branch:** feature/sf-apex-tests',
    '',
    '### Tasks',
    '- Write Apex controller',
    '- Create Jest tests for LWC',
    '',
    '### Files Modified',
    '- force-app/main/default/classes/MyController.cls',
    '- force-app/main/default/lwc/myComponent/myComponent.js',
    '',
    '### Tools Used',
    'Write, Edit, Bash, Read',
    '',
    '**[Compaction at 2026-03-18T10:30:00]** -- Context was summarized',
    '**[Compaction at 2026-03-18T11:00:00]** -- Context was summarized',
  ].join('\n'));

  try {
    const result = mod.parseSessionFile(sessionFile);
    assert.strictEqual(result.date, '2026-03-18');
    assert.strictEqual(result.started, '10:00:00');
    assert.strictEqual(result.lastUpdated, '11:30:00');
    assert.strictEqual(result.project, 'my-sf-project');
    assert.strictEqual(result.branch, 'feature/sf-apex-tests');
    assert.deepStrictEqual(result.tasks, ['Write Apex controller', 'Create Jest tests for LWC']);
    assert.deepStrictEqual(result.filesModified, [
      'force-app/main/default/classes/MyController.cls',
      'force-app/main/default/lwc/myComponent/myComponent.js',
    ]);
    assert.deepStrictEqual(result.toolsUsed, ['Write', 'Edit', 'Bash', 'Read']);
    assert.strictEqual(result.compactionCount, 2);
    assert.strictEqual(result.filename, '2026-03-18-abc12345-session.tmp');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('parseSessionFile: handles minimal content', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-inspect-'));
  const sessionFile = path.join(tmpDir, 'minimal-session.tmp');
  fs.writeFileSync(sessionFile, '# Session\nSome content without structured fields\n');

  try {
    const result = mod.parseSessionFile(sessionFile);
    assert.strictEqual(result.date, null);
    assert.strictEqual(result.project, null);
    assert.strictEqual(result.branch, null);
    assert.strictEqual(result.compactionCount, 0);
    assert.strictEqual(result.tasks, undefined);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('parseSessionFile: handles file with tasks but no files modified', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-inspect-'));
  const sessionFile = path.join(tmpDir, 'partial-session.tmp');
  fs.writeFileSync(sessionFile, [
    '**Date:** 2026-03-20',
    '**Project:** test',
    '',
    '### Tasks',
    '- First task',
    '- Second task',
    '',
    '---',
  ].join('\n'));

  try {
    const result = mod.parseSessionFile(sessionFile);
    assert.strictEqual(result.date, '2026-03-20');
    assert.deepStrictEqual(result.tasks, ['First task', 'Second task']);
    assert.strictEqual(result.filesModified, undefined);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── listSessionFiles ─────────────────────────────────────────────────────────

test('listSessionFiles: returns empty for non-existent dir', () => {
  const origHome = process.env.HOME;
  try {
    process.env.HOME = '/tmp/scc-nonexistent-home-dir-12345';
    const files = mod.listSessionFiles();
    assert.ok(Array.isArray(files));
    assert.strictEqual(files.length, 0);
  } finally {
    if (origHome !== undefined) process.env.HOME = origHome;
    else delete process.env.HOME;
  }
});

test('listSessionFiles: finds session files sorted in reverse', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-inspect-'));
  const sessionsDir = path.join(tmpDir, '.claude', 'sessions');
  fs.mkdirSync(sessionsDir, { recursive: true });
  fs.writeFileSync(path.join(sessionsDir, 'aaa-session.tmp'), 'session a');
  fs.writeFileSync(path.join(sessionsDir, 'bbb-session.tmp'), 'session b');
  fs.writeFileSync(path.join(sessionsDir, 'not-a-session.txt'), 'skip me');

  const origHome = process.env.HOME;
  try {
    process.env.HOME = tmpDir;
    const files = mod.listSessionFiles();
    assert.ok(Array.isArray(files));
    assert.strictEqual(files.length, 2, 'should find 2 session files');
    assert.ok(files.every(f => f.endsWith('-session.tmp')));
    // Reverse sorted
    assert.strictEqual(files[0], 'bbb-session.tmp');
    assert.strictEqual(files[1], 'aaa-session.tmp');
  } finally {
    if (origHome !== undefined) process.env.HOME = origHome;
    else delete process.env.HOME;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── CLI via spawnSync ────────────────────────────────────────────────────────

test('session-inspect.js: exits 1 with usage when no target', () => {
  const r = spawnSync(process.execPath, [scriptPath], {
    encoding: 'utf8',
    timeout: 10000,
    env: { ...process.env, HOME: '/tmp/scc-fake-home-inspect' },
  });
  assert.strictEqual(r.status, 1);
  assert.ok(r.stdout.includes('Usage'));
});

test('session-inspect.js: inspects a file target and writes output', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-inspect-'));
  const sessionFile = path.join(tmpDir, 'test-session.tmp');
  const outputFile = path.join(tmpDir, 'output.json');
  fs.writeFileSync(sessionFile, [
    '**Date:** 2026-03-22',
    '**Project:** sf-test',
  ].join('\n'));

  try {
    const r = spawnSync(process.execPath, [scriptPath, sessionFile, '--write', outputFile], {
      encoding: 'utf8',
      timeout: 10000,
      env: { ...process.env, HOME: tmpDir },
    });
    assert.strictEqual(r.status, 0);
    assert.ok(fs.existsSync(outputFile), 'should write output file');
    const written = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
    assert.strictEqual(written.date, '2026-03-22');
    assert.strictEqual(written.project, 'sf-test');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('session-inspect.js: exits 1 for non-existent file target', () => {
  const r = spawnSync(process.execPath, [scriptPath, '/tmp/nonexistent-session-file-12345.tmp'], {
    encoding: 'utf8',
    timeout: 10000,
    env: { ...process.env, HOME: '/tmp/scc-fake-home-inspect' },
  });
  assert.strictEqual(r.status, 1);
  assert.ok(r.stderr.includes('File not found') || r.stderr.includes('Error'));
});

test('session-inspect.js: list target shows sessions list', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-inspect-'));
  const sessionsDir = path.join(tmpDir, '.claude', 'sessions');
  fs.mkdirSync(sessionsDir, { recursive: true });
  fs.writeFileSync(path.join(sessionsDir, 'test-session.tmp'), '**Date:** 2026-01-01\n');

  try {
    const r = spawnSync(process.execPath, [scriptPath, 'list'], {
      encoding: 'utf8',
      timeout: 10000,
      env: { ...process.env, HOME: tmpDir },
    });
    assert.strictEqual(r.status, 0);
    const parsed = JSON.parse(r.stdout);
    assert.ok(Array.isArray(parsed.sessions));
    assert.ok(parsed.sessions.length >= 1);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('session-inspect.js: list target with no sessions', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-inspect-'));

  try {
    const r = spawnSync(process.execPath, [scriptPath, 'list'], {
      encoding: 'utf8',
      timeout: 10000,
      env: { ...process.env, HOME: tmpDir },
    });
    assert.strictEqual(r.status, 0);
    const parsed = JSON.parse(r.stdout);
    assert.strictEqual(parsed.sessions.length, 0);
    assert.ok(parsed.message);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

console.log(`\nsession-inspect.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
