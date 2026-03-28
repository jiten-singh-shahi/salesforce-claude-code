#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const scriptPath = path.join(pluginRoot, 'scripts', 'dev', 'orchestration-status.js');
const mod = require(scriptPath);

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passCount++; }
  catch (err) { console.error(`  FAIL  ${name}`); console.error(`        ${err.message}`); failCount++; }
}

// ── Module basics ────────────────────────────────────────────────────────────

test('script exists', () => {
  assert.ok(fs.existsSync(scriptPath));
});

test('exports main function', () => {
  assert.ok(typeof mod.main === 'function');
});

// ── CLI usage ────────────────────────────────────────────────────────────────

test('exits 1 with usage when no target given', () => {
  const r = spawnSync(process.execPath, [scriptPath], {
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.strictEqual(r.status, 1);
  assert.ok(r.stdout.includes('Usage') || r.stderr.includes('Usage'));
});

// ── Session name target ──────────────────────────────────────────────────────

test('outputs JSON snapshot for session name target', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-os-'));
  const coordDir = path.join(tmpDir, '.claude', 'orchestration', 'my-session');
  const workerDir = path.join(coordDir, 'worker-1');
  fs.mkdirSync(workerDir, { recursive: true });
  fs.writeFileSync(path.join(workerDir, 'status.md'), '- State: completed\n- Branch: `feat-1`\n');
  fs.writeFileSync(path.join(workerDir, 'task.md'), '## Objective\nBuild feature\n');
  fs.writeFileSync(path.join(workerDir, 'handoff.md'), '## Summary\n- Done\n');

  try {
    const r = spawnSync(process.execPath, [scriptPath, 'my-session'], {
      encoding: 'utf8',
      timeout: 10000,
      cwd: tmpDir,
    });
    assert.strictEqual(r.status, 0, `exit ${r.status}, stderr: ${r.stderr}`);
    const parsed = JSON.parse(r.stdout);
    assert.strictEqual(parsed.sessionName, 'my-session');
    assert.strictEqual(parsed.workerCount, 1);
    assert.ok(Array.isArray(parsed.workers));
    assert.strictEqual(parsed.workers[0].workerSlug, 'worker-1');
    assert.strictEqual(parsed.workers[0].status.state, 'completed');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── Plan file target ─────────────────────────────────────────────────────────

test('outputs JSON snapshot for plan file target', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-os-'));
  const coordDir = path.join(tmpDir, '.orchestration', 'plan-session');
  const workerDir = path.join(coordDir, 'alpha');
  fs.mkdirSync(workerDir, { recursive: true });
  fs.writeFileSync(path.join(workerDir, 'status.md'), '- State: running\n');
  fs.writeFileSync(path.join(workerDir, 'task.md'), '## Objective\nDo task\n');
  fs.writeFileSync(path.join(workerDir, 'handoff.md'), '## Summary\n- In progress\n');

  const planFile = path.join(tmpDir, 'plan.json');
  fs.writeFileSync(planFile, JSON.stringify({
    sessionName: 'plan-session',
    repoRoot: tmpDir,
    coordinationRoot: path.join(tmpDir, '.orchestration'),
  }));

  try {
    const r = spawnSync(process.execPath, [scriptPath, planFile], {
      encoding: 'utf8',
      timeout: 10000,
      cwd: tmpDir,
    });
    assert.strictEqual(r.status, 0, `exit ${r.status}, stderr: ${r.stderr}`);
    const parsed = JSON.parse(r.stdout);
    assert.strictEqual(parsed.sessionName, 'plan-session');
    assert.strictEqual(parsed.targetType, 'plan');
    assert.strictEqual(parsed.workerCount, 1);
    assert.strictEqual(parsed.workers[0].status.state, 'running');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── --write flag ─────────────────────────────────────────────────────────────

test('--write saves snapshot to file', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-os-'));
  const coordDir = path.join(tmpDir, '.claude', 'orchestration', 'write-test');
  fs.mkdirSync(coordDir, { recursive: true });
  const outputFile = path.join(tmpDir, 'output.json');

  try {
    const r = spawnSync(process.execPath, [scriptPath, 'write-test', '--write', outputFile], {
      encoding: 'utf8',
      timeout: 10000,
      cwd: tmpDir,
    });
    assert.strictEqual(r.status, 0, `exit ${r.status}, stderr: ${r.stderr}`);
    assert.ok(fs.existsSync(outputFile), 'output file should be created');
    const written = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
    assert.strictEqual(written.sessionName, 'write-test');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── Empty coordination dir ───────────────────────────────────────────────────

test('handles empty coordination dir (no workers)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-os-'));
  const coordDir = path.join(tmpDir, '.claude', 'orchestration', 'empty-session');
  fs.mkdirSync(coordDir, { recursive: true });

  try {
    const r = spawnSync(process.execPath, [scriptPath, 'empty-session'], {
      encoding: 'utf8',
      timeout: 10000,
      cwd: tmpDir,
    });
    assert.strictEqual(r.status, 0);
    const parsed = JSON.parse(r.stdout);
    assert.strictEqual(parsed.workerCount, 0);
    assert.deepStrictEqual(parsed.workers, []);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── Multiple workers ─────────────────────────────────────────────────────────

test('handles multiple workers in coordination dir', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-os-'));
  const coordDir = path.join(tmpDir, '.claude', 'orchestration', 'multi');

  for (const name of ['api', 'frontend', 'tests']) {
    const wDir = path.join(coordDir, name);
    fs.mkdirSync(wDir, { recursive: true });
    fs.writeFileSync(path.join(wDir, 'status.md'), `- State: ${name === 'api' ? 'completed' : 'running'}\n`);
    fs.writeFileSync(path.join(wDir, 'task.md'), `## Objective\n${name} work\n`);
    fs.writeFileSync(path.join(wDir, 'handoff.md'), '## Summary\n- Pending\n');
  }

  try {
    const r = spawnSync(process.execPath, [scriptPath, 'multi'], {
      encoding: 'utf8',
      timeout: 10000,
      cwd: tmpDir,
    });
    assert.strictEqual(r.status, 0);
    const parsed = JSON.parse(r.stdout);
    assert.strictEqual(parsed.workerCount, 3);
    assert.ok(parsed.workerStates.completed === 1);
    assert.ok(parsed.workerStates.running === 2);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── Session active status ────────────────────────────────────────────────────

test('reports session as inactive when no tmux panes', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-os-'));
  const coordDir = path.join(tmpDir, '.claude', 'orchestration', 'inactive');
  fs.mkdirSync(coordDir, { recursive: true });

  try {
    const r = spawnSync(process.execPath, [scriptPath, 'inactive'], {
      encoding: 'utf8',
      timeout: 10000,
      cwd: tmpDir,
    });
    assert.strictEqual(r.status, 0);
    const parsed = JSON.parse(r.stdout);
    assert.strictEqual(parsed.sessionActive, false);
    assert.strictEqual(parsed.paneCount, 0);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

console.log(`\norchestration-status.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
