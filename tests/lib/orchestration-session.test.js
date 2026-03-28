#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const modPath = path.join(pluginRoot, 'scripts', 'lib', 'orchestration-session.js');
const mod = require(modPath);

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passCount++; }
  catch (err) { console.error(`  FAIL  ${name}`); console.error(`        ${err.message}`); failCount++; }
}

// ── normalizeText (stripCodeTicks) ───────────────────────────────────────────

test('normalizeText: strips backticks from value', () => {
  assert.strictEqual(mod.normalizeText('`hello`'), 'hello');
});

test('normalizeText: trims whitespace', () => {
  assert.strictEqual(mod.normalizeText('  hello  '), 'hello');
});

test('normalizeText: returns non-string as-is', () => {
  assert.strictEqual(mod.normalizeText(42), 42);
  assert.strictEqual(mod.normalizeText(null), null);
  assert.strictEqual(mod.normalizeText(undefined), undefined);
});

test('normalizeText: does not strip single backtick', () => {
  // A string with just one backtick isn't a code span
  assert.strictEqual(mod.normalizeText('`'), '`');
});

test('normalizeText: preserves content without backticks', () => {
  assert.strictEqual(mod.normalizeText('plain text'), 'plain text');
});

// ── parseWorkerStatus ────────────────────────────────────────────────────────

test('parseWorkerStatus: parses all fields', () => {
  const content = [
    '# Status: worker-1',
    '',
    '- State: running',
    '- Updated: 2026-03-22T10:00:00Z',
    '- Branch: `feature-branch`',
    '- Worktree: `/tmp/wt`',
    '- Task file: `/tmp/task.md`',
    '- Handoff file: `/tmp/handoff.md`',
  ].join('\n');

  const result = mod.parseWorkerStatus(content);
  assert.strictEqual(result.state, 'running');
  assert.strictEqual(result.updated, '2026-03-22T10:00:00Z');
  assert.strictEqual(result.branch, 'feature-branch');
  assert.strictEqual(result.worktree, '/tmp/wt');
  assert.strictEqual(result.taskFile, '/tmp/task.md');
  assert.strictEqual(result.handoffFile, '/tmp/handoff.md');
});

test('parseWorkerStatus: returns null fields for empty content', () => {
  const result = mod.parseWorkerStatus('');
  assert.strictEqual(result.state, null);
  assert.strictEqual(result.updated, null);
  assert.strictEqual(result.branch, null);
  assert.strictEqual(result.worktree, null);
});

test('parseWorkerStatus: handles non-string input', () => {
  const result = mod.parseWorkerStatus(null);
  assert.strictEqual(result.state, null);
});

test('parseWorkerStatus: ignores non-matching lines', () => {
  const content = [
    'Some random text',
    '## Section',
    'More text',
  ].join('\n');
  const result = mod.parseWorkerStatus(content);
  assert.strictEqual(result.state, null);
});

// ── parseWorkerTask ──────────────────────────────────────────────────────────

test('parseWorkerTask: extracts objective', () => {
  const content = [
    '# Worker Task: w1',
    '',
    '## Objective',
    'Build the API endpoint',
    '',
    '## Completion',
    'Report results.',
  ].join('\n');

  const result = mod.parseWorkerTask(content);
  assert.strictEqual(result.objective, 'Build the API endpoint');
});

test('parseWorkerTask: extracts seed paths', () => {
  const content = [
    '# Worker Task: w1',
    '',
    '## Seeded Local Overlays',
    '- `src/config.json`',
    '- `lib/utils.js`',
    '',
    '## Objective',
    'Do something',
  ].join('\n');

  const result = mod.parseWorkerTask(content);
  assert.deepStrictEqual(result.seedPaths, ['src/config.json', 'lib/utils.js']);
});

test('parseWorkerTask: returns empty arrays for missing sections', () => {
  const result = mod.parseWorkerTask('# Just a heading');
  assert.strictEqual(result.objective, '');
  assert.deepStrictEqual(result.seedPaths, []);
});

// ── parseWorkerHandoff ───────────────────────────────────────────────────────

test('parseWorkerHandoff: extracts summary, validation, remaining risks', () => {
  const content = [
    '# Handoff: w1',
    '',
    '## Summary',
    '- Completed API endpoint',
    '- Added tests',
    '',
    '## Validation',
    '- All tests pass',
    '',
    '## Remaining Risks',
    '- Performance under load unknown',
  ].join('\n');

  const result = mod.parseWorkerHandoff(content);
  assert.deepStrictEqual(result.summary, ['Completed API endpoint', 'Added tests']);
  assert.deepStrictEqual(result.validation, ['All tests pass']);
  assert.deepStrictEqual(result.remainingRisks, ['Performance under load unknown']);
});

test('parseWorkerHandoff: returns empty arrays for missing sections', () => {
  const result = mod.parseWorkerHandoff('# Just a heading');
  assert.deepStrictEqual(result.summary, []);
  assert.deepStrictEqual(result.validation, []);
  assert.deepStrictEqual(result.remainingRisks, []);
});

// ── loadWorkerSnapshots ──────────────────────────────────────────────────────

test('loadWorkerSnapshots: returns empty for non-existent dir', () => {
  const result = mod.loadWorkerSnapshots('/tmp/nonexistent-scc-test-dir-99999');
  assert.deepStrictEqual(result, []);
});

test('loadWorkerSnapshots: returns empty for null dir', () => {
  const result = mod.loadWorkerSnapshots(null);
  assert.deepStrictEqual(result, []);
});

test('loadWorkerSnapshots: loads workers from coordination dir', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-snap-'));
  const w1Dir = path.join(tmpDir, 'worker-1');
  fs.mkdirSync(w1Dir, { recursive: true });

  fs.writeFileSync(path.join(w1Dir, 'status.md'), [
    '# Status: worker-1',
    '',
    '- State: completed',
    '- Branch: `feat-1`',
  ].join('\n'));

  fs.writeFileSync(path.join(w1Dir, 'task.md'), [
    '# Worker Task: worker-1',
    '',
    '## Objective',
    'Build feature',
  ].join('\n'));

  fs.writeFileSync(path.join(w1Dir, 'handoff.md'), [
    '# Handoff: worker-1',
    '',
    '## Summary',
    '- Done',
  ].join('\n'));

  try {
    const snapshots = mod.loadWorkerSnapshots(tmpDir);
    assert.strictEqual(snapshots.length, 1);
    assert.strictEqual(snapshots[0].workerSlug, 'worker-1');
    assert.strictEqual(snapshots[0].status.state, 'completed');
    assert.strictEqual(snapshots[0].status.branch, 'feat-1');
    assert.strictEqual(snapshots[0].task.objective, 'Build feature');
    assert.deepStrictEqual(snapshots[0].handoff.summary, ['Done']);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('loadWorkerSnapshots: skips directories without known files', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-snap-'));
  const emptyDir = path.join(tmpDir, 'not-a-worker');
  fs.mkdirSync(emptyDir, { recursive: true });
  fs.writeFileSync(path.join(emptyDir, 'random.txt'), 'hello');

  try {
    const snapshots = mod.loadWorkerSnapshots(tmpDir);
    assert.strictEqual(snapshots.length, 0);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── listTmuxPanes ────────────────────────────────────────────────────────────

test('listTmuxPanes: returns empty array when tmux not found (ENOENT)', () => {
  const result = mod.listTmuxPanes('nonexistent-session', {
    spawnSyncImpl: () => ({ error: { code: 'ENOENT' }, status: null }),
  });
  assert.deepStrictEqual(result, []);
});

test('listTmuxPanes: returns empty array on non-zero exit', () => {
  const result = mod.listTmuxPanes('nonexistent-session', {
    spawnSyncImpl: () => ({ status: 1, stdout: '', stderr: 'no session' }),
  });
  assert.deepStrictEqual(result, []);
});

test('listTmuxPanes: throws on non-ENOENT error', () => {
  assert.throws(() => {
    mod.listTmuxPanes('test', {
      spawnSyncImpl: () => ({ error: new Error('some error'), status: null }),
    });
  }, /some error/);
});

test('listTmuxPanes: parses pane output correctly', () => {
  const mockOutput = [
    '%0\t0\t0\torchestrator\tbash\t/tmp/repo\t1\t0\t1234',
    '%1\t0\t1\tworker-1\tclaude\t/tmp/wt1\t0\t0\t5678',
  ].join('\n');

  const result = mod.listTmuxPanes('test-session', {
    spawnSyncImpl: () => ({ status: 0, stdout: mockOutput, stderr: '' }),
  });

  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].paneId, '%0');
  assert.strictEqual(result[0].windowIndex, 0);
  assert.strictEqual(result[0].title, 'orchestrator');
  assert.strictEqual(result[0].active, true);
  assert.strictEqual(result[0].dead, false);
  assert.strictEqual(result[0].pid, 1234);
  assert.strictEqual(result[1].paneId, '%1');
  assert.strictEqual(result[1].title, 'worker-1');
  assert.strictEqual(result[1].active, false);
});

test('listTmuxPanes: handles empty stdout', () => {
  const result = mod.listTmuxPanes('test', {
    spawnSyncImpl: () => ({ status: 0, stdout: '', stderr: '' }),
  });
  assert.deepStrictEqual(result, []);
});

// ── buildSessionSnapshot ─────────────────────────────────────────────────────

test('buildSessionSnapshot: builds snapshot from coordination dir', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-bss-'));
  const w1Dir = path.join(tmpDir, 'w1');
  fs.mkdirSync(w1Dir, { recursive: true });
  fs.writeFileSync(path.join(w1Dir, 'status.md'), '- State: running\n');
  fs.writeFileSync(path.join(w1Dir, 'task.md'), '## Objective\nBuild it\n');
  fs.writeFileSync(path.join(w1Dir, 'handoff.md'), '## Summary\n- Pending\n');

  try {
    const snapshot = mod.buildSessionSnapshot({
      sessionName: 'test-session',
      coordinationDir: tmpDir,
      panes: [{ title: 'w1', paneId: '%1' }, { title: 'orchestrator', paneId: '%0' }],
    });

    assert.strictEqual(snapshot.sessionName, 'test-session');
    assert.strictEqual(snapshot.sessionActive, true);
    assert.strictEqual(snapshot.paneCount, 2);
    assert.strictEqual(snapshot.workerCount, 1);
    assert.ok(snapshot.workerStates.running === 1, 'should count running state');
    assert.ok(snapshot.workers[0].pane !== null, 'should match pane to worker');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('buildSessionSnapshot: no panes means session inactive', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-bss2-'));
  try {
    const snapshot = mod.buildSessionSnapshot({
      sessionName: 'test',
      coordinationDir: tmpDir,
      panes: [],
    });
    assert.strictEqual(snapshot.sessionActive, false);
    assert.strictEqual(snapshot.paneCount, 0);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── resolveSnapshotTarget ────────────────────────────────────────────────────

test('resolveSnapshotTarget: resolves session name', () => {
  const result = mod.resolveSnapshotTarget('my-session', '/tmp/repo');
  assert.strictEqual(result.sessionName, 'my-session');
  assert.strictEqual(result.targetType, 'session');
  assert.ok(result.coordinationDir.includes('my-session'));
});

test('resolveSnapshotTarget: resolves plan file', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-resolve-'));
  const planFile = path.join(tmpDir, 'plan.json');
  fs.writeFileSync(planFile, JSON.stringify({
    sessionName: 'file-session',
    repoRoot: '/tmp/repo',
    coordinationRoot: '/tmp/coordination',
  }));

  try {
    const result = mod.resolveSnapshotTarget(planFile, tmpDir);
    assert.strictEqual(result.sessionName, 'file-session');
    assert.strictEqual(result.targetType, 'plan');
    assert.ok(result.coordinationDir.includes('file-session'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('resolveSnapshotTarget: plan file without coordinationRoot uses default', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-resolve2-'));
  const planFile = path.join(tmpDir, 'plan.json');
  fs.writeFileSync(planFile, JSON.stringify({
    sessionName: 'test-sess',
  }));

  try {
    const result = mod.resolveSnapshotTarget(planFile, tmpDir);
    assert.strictEqual(result.sessionName, 'test-sess');
    assert.strictEqual(result.targetType, 'plan');
    assert.ok(result.coordinationDir.includes('.orchestration'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── module exports ───────────────────────────────────────────────────────────

test('module exports all expected functions', () => {
  assert.ok(typeof mod.buildSessionSnapshot === 'function');
  assert.ok(typeof mod.collectSessionSnapshot === 'function');
  assert.ok(typeof mod.listTmuxPanes === 'function');
  assert.ok(typeof mod.loadWorkerSnapshots === 'function');
  assert.ok(typeof mod.normalizeText === 'function');
  assert.ok(typeof mod.parseWorkerHandoff === 'function');
  assert.ok(typeof mod.parseWorkerStatus === 'function');
  assert.ok(typeof mod.parseWorkerTask === 'function');
  assert.ok(typeof mod.resolveSnapshotTarget === 'function');
});

console.log(`\norchestration-session.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
