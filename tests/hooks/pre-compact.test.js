#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const scriptPath = path.join(pluginRoot, 'scripts', 'hooks', 'pre-compact.js');

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

// --- File existence ---
test('pre-compact.js: script exists', () => {
  assert.ok(fs.existsSync(scriptPath), 'pre-compact.js not found');
});

// --- Run the hook with HOME pointing to a temp dir ---
test('creates compaction-log.txt in sessions directory', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-precompact-'));
  try {
    const result = spawnSync('node', [scriptPath], {
      encoding: 'utf8',
      timeout: 10000,
      env: { ...process.env, HOME: tmpDir, USERPROFILE: tmpDir },
    });
    assert.strictEqual(result.status, 0, 'Should exit 0');
    const logPath = path.join(tmpDir, '.claude', 'sessions', 'compaction-log.txt');
    assert.ok(fs.existsSync(logPath), 'Should create compaction-log.txt');
    const content = fs.readFileSync(logPath, 'utf8');
    assert.ok(content.includes('Context compaction triggered'), 'Log should contain compaction message');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('log entry contains ISO-like timestamp', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-precompact-'));
  try {
    spawnSync('node', [scriptPath], {
      encoding: 'utf8',
      timeout: 10000,
      env: { ...process.env, HOME: tmpDir, USERPROFILE: tmpDir },
    });
    const logPath = path.join(tmpDir, '.claude', 'sessions', 'compaction-log.txt');
    const content = fs.readFileSync(logPath, 'utf8');
    // Timestamp format: [YYYY-MM-DD HH:MM:SS]
    assert.ok(/\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]/.test(content), 'Should have ISO-like timestamp');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('annotates active session files when present', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-precompact-'));
  try {
    // Pre-create a session file
    const sessionsDir = path.join(tmpDir, '.claude', 'sessions');
    fs.mkdirSync(sessionsDir, { recursive: true });
    const sessionFile = path.join(sessionsDir, 'test-session.tmp');
    fs.writeFileSync(sessionFile, 'Session data\n');

    spawnSync('node', [scriptPath], {
      encoding: 'utf8',
      timeout: 10000,
      env: { ...process.env, HOME: tmpDir, USERPROFILE: tmpDir },
    });

    const content = fs.readFileSync(sessionFile, 'utf8');
    assert.ok(content.includes('Compaction at'), 'Should annotate active session file');
    assert.ok(content.includes('Context was summarized'), 'Should note context was summarized');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('works when no session files exist', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-precompact-'));
  try {
    const result = spawnSync('node', [scriptPath], {
      encoding: 'utf8',
      timeout: 10000,
      env: { ...process.env, HOME: tmpDir, USERPROFILE: tmpDir },
    });
    assert.strictEqual(result.status, 0, 'Should exit 0 even without session files');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('writes state-saved message to stderr', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-precompact-'));
  try {
    const result = spawnSync('node', [scriptPath], {
      encoding: 'utf8',
      timeout: 10000,
      env: { ...process.env, HOME: tmpDir, USERPROFILE: tmpDir },
    });
    assert.ok(result.stderr.includes('[SCC PreCompact] State saved'), 'Should output state-saved message to stderr');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('appends to existing compaction log', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-precompact-'));
  try {
    // Run twice
    spawnSync('node', [scriptPath], {
      encoding: 'utf8',
      timeout: 10000,
      env: { ...process.env, HOME: tmpDir, USERPROFILE: tmpDir },
    });
    spawnSync('node', [scriptPath], {
      encoding: 'utf8',
      timeout: 10000,
      env: { ...process.env, HOME: tmpDir, USERPROFILE: tmpDir },
    });
    const logPath = path.join(tmpDir, '.claude', 'sessions', 'compaction-log.txt');
    const content = fs.readFileSync(logPath, 'utf8');
    const matches = content.match(/Context compaction triggered/g);
    assert.strictEqual(matches.length, 2, 'Should append (not overwrite) log entries');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('only annotates first session file when multiple exist', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-precompact-'));
  try {
    const sessionsDir = path.join(tmpDir, '.claude', 'sessions');
    fs.mkdirSync(sessionsDir, { recursive: true });
    // Create two session files
    fs.writeFileSync(path.join(sessionsDir, 'a-session.tmp'), 'Session A\n');
    fs.writeFileSync(path.join(sessionsDir, 'b-session.tmp'), 'Session B\n');

    spawnSync('node', [scriptPath], {
      encoding: 'utf8',
      timeout: 10000,
      env: { ...process.env, HOME: tmpDir, USERPROFILE: tmpDir },
    });

    // The script annotates sessionFiles[0] (first alphabetically from readdirSync)
    const contentA = fs.readFileSync(path.join(sessionsDir, 'a-session.tmp'), 'utf8');
    assert.ok(contentA.includes('Compaction at'), 'Should annotate first session file');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

console.log(`\npre-compact.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
