#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const scriptPath = path.join(pluginRoot, 'scripts', 'dev', 'orchestrate-worktrees.js');
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

test('is valid JavaScript', () => {
  const c = fs.readFileSync(scriptPath, 'utf8');
  assert.ok(c.includes('require(') || c.includes('module.exports'));
});

test('exports main function', () => {
  assert.ok(typeof mod.main === 'function');
});

// ── CLI usage ────────────────────────────────────────────────────────────────

test('exits 1 with usage when no plan path given', () => {
  const r = spawnSync(process.execPath, [scriptPath], {
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.strictEqual(r.status, 1);
  assert.ok(r.stdout.includes('Usage') || r.stderr.includes('Usage'));
});

// ── Dry-run (no --execute) ───────────────────────────────────────────────────

test('dry-run prints plan as JSON without --execute', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-ow-'));
  const planFile = path.join(tmpDir, 'plan.json');
  fs.writeFileSync(planFile, JSON.stringify({
    repoRoot: tmpDir,
    sessionName: 'test-session',
    launcherCommand: 'echo {worker_name}',
    workers: [
      { name: 'w1', task: 'Do something' },
    ],
  }));

  try {
    const r = spawnSync(process.execPath, [scriptPath, planFile], {
      encoding: 'utf8',
      timeout: 10000,
    });
    assert.strictEqual(r.status, 0, `exit ${r.status}, stderr: ${r.stderr}`);
    const parsed = JSON.parse(r.stdout);
    assert.strictEqual(parsed.sessionName, 'test-session');
    assert.ok(Array.isArray(parsed.workers));
    assert.strictEqual(parsed.workers.length, 1);
    assert.strictEqual(parsed.workers[0].workerName, 'w1');
    assert.ok(Array.isArray(parsed.commands));
    assert.ok(parsed.commands.length > 0);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('dry-run shows git and tmux commands in preview', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-ow-'));
  const planFile = path.join(tmpDir, 'plan.json');
  fs.writeFileSync(planFile, JSON.stringify({
    repoRoot: tmpDir,
    launcherCommand: 'echo {worker_name}',
    workers: [{ name: 'alpha', task: 'Task alpha' }],
  }));

  try {
    const r = spawnSync(process.execPath, [scriptPath, planFile], {
      encoding: 'utf8',
      timeout: 10000,
    });
    assert.strictEqual(r.status, 0);
    const parsed = JSON.parse(r.stdout);
    const gitCmds = parsed.commands.filter(c => c.startsWith('git'));
    const tmuxCmds = parsed.commands.filter(c => c.startsWith('tmux'));
    assert.ok(gitCmds.length > 0, 'should have git commands');
    assert.ok(tmuxCmds.length > 0, 'should have tmux commands');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── --write-only ─────────────────────────────────────────────────────────────

test('--write-only creates coordination files without tmux', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-ow-'));
  const planFile = path.join(tmpDir, 'plan.json');
  fs.writeFileSync(planFile, JSON.stringify({
    repoRoot: tmpDir,
    coordinationRoot: path.join(tmpDir, '.orchestration'),
    launcherCommand: 'echo {worker_name}',
    workers: [{ name: 'w1', task: 'Write tests' }],
  }));

  try {
    const r = spawnSync(process.execPath, [scriptPath, planFile, '--write-only'], {
      encoding: 'utf8',
      timeout: 10000,
    });
    assert.strictEqual(r.status, 0, `exit ${r.status}, stderr: ${r.stderr}`);
    assert.ok(r.stdout.includes('Wrote orchestration files'));

    // Check that coordination files were created
    const orchDir = path.join(tmpDir, '.orchestration');
    assert.ok(fs.existsSync(orchDir), 'orchestration dir should exist');

    // Find the session subdirectory
    const sessionDirs = fs.readdirSync(orchDir);
    assert.ok(sessionDirs.length > 0, 'should have session directory');

    const sessionDir = path.join(orchDir, sessionDirs[0]);
    const workerDirs = fs.readdirSync(sessionDir);
    assert.ok(workerDirs.length > 0, 'should have worker directory');

    const workerDir = path.join(sessionDir, workerDirs[0]);
    assert.ok(fs.existsSync(path.join(workerDir, 'task.md')), 'task.md should exist');
    assert.ok(fs.existsSync(path.join(workerDir, 'status.md')), 'status.md should exist');
    assert.ok(fs.existsSync(path.join(workerDir, 'handoff.md')), 'handoff.md should exist');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── Error handling ───────────────────────────────────────────────────────────

test('exits 1 with error for invalid JSON plan', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-ow-'));
  const planFile = path.join(tmpDir, 'bad.json');
  fs.writeFileSync(planFile, 'not valid json{{}');

  try {
    const r = spawnSync(process.execPath, [scriptPath, planFile], {
      encoding: 'utf8',
      timeout: 10000,
    });
    assert.strictEqual(r.status, 1);
    assert.ok(r.stderr.includes('orchestrate-worktrees') || r.stderr.includes('Error'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('exits 1 when plan has no workers', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-ow-'));
  const planFile = path.join(tmpDir, 'empty.json');
  fs.writeFileSync(planFile, JSON.stringify({
    repoRoot: tmpDir,
    launcherCommand: 'echo hi',
    workers: [],
  }));

  try {
    const r = spawnSync(process.execPath, [scriptPath, planFile], {
      encoding: 'utf8',
      timeout: 10000,
    });
    assert.strictEqual(r.status, 1);
    assert.ok(r.stderr.includes('at least one worker'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('exits 1 for nonexistent plan file', () => {
  const r = spawnSync(process.execPath, [scriptPath, '/tmp/scc-nonexistent-plan-file.json'], {
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.strictEqual(r.status, 1);
});

// ── Plan with multiple workers ───────────────────────────────────────────────

test('dry-run with multiple workers shows all workers', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-ow-'));
  const planFile = path.join(tmpDir, 'plan.json');
  fs.writeFileSync(planFile, JSON.stringify({
    repoRoot: tmpDir,
    launcherCommand: 'echo {worker_name}',
    workers: [
      { name: 'api', task: 'Build API' },
      { name: 'ui', task: 'Build UI' },
      { name: 'tests', task: 'Write tests' },
    ],
  }));

  try {
    const r = spawnSync(process.execPath, [scriptPath, planFile], {
      encoding: 'utf8',
      timeout: 10000,
    });
    assert.strictEqual(r.status, 0);
    const parsed = JSON.parse(r.stdout);
    assert.strictEqual(parsed.workers.length, 3);
    assert.ok(parsed.workers.some(w => w.workerName === 'api'));
    assert.ok(parsed.workers.some(w => w.workerName === 'ui'));
    assert.ok(parsed.workers.some(w => w.workerName === 'tests'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

console.log(`\norchestrate-worktrees.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
