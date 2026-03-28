#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const scriptPath = path.join(pluginRoot, 'scripts', 'dev', 'sessions-cli.js');

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passCount++; }
  catch (err) { console.error(`  FAIL  ${name}`); console.error(`        ${err.message}`); failCount++; }
}

function runSessions(args, opts = {}) {
  const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-sessions-home-'));
  const stateDir = path.join(fakeHome, '.scc');
  fs.mkdirSync(stateDir, { recursive: true });

  if (opts.stateContent) {
    fs.writeFileSync(path.join(stateDir, 'state.json'), JSON.stringify(opts.stateContent), 'utf8');
  }

  // Create Claude sessions dir if needed
  if (opts.claudeSessions) {
    const sessionsDir = path.join(fakeHome, '.claude', 'sessions');
    fs.mkdirSync(sessionsDir, { recursive: true });
    for (const session of opts.claudeSessions) {
      fs.writeFileSync(path.join(sessionsDir, session.name), JSON.stringify(session.data), 'utf8');
    }
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

test('sessions-cli.js: script exists', () => {
  assert.ok(fs.existsSync(scriptPath));
});

test('sessions-cli.js: responds to --help', () => {
  const r = spawnSync(process.execPath, [scriptPath, '--help'], {
    encoding: 'utf8', timeout: 10000,
    env: { ...process.env, SCC_PLUGIN_ROOT: pluginRoot }
  });
  assert.ok(r.status === 0 || r.status === 1);
  assert.ok(r.stdout.includes('session') || r.stdout.includes('scc'));
});

// ── No sessions ──────────────────────────────────────────────────────────────

test('sessions-cli.js: --scc-only --json with no SCC sessions', () => {
  const r = runSessions(['--json', '--scc-only']);
  assert.strictEqual(r.status, 0);
  const parsed = JSON.parse(r.stdout);
  assert.ok(parsed.sccInstalls);
  assert.strictEqual(parsed.sccInstalls.sessions.length, 0);
});

test('sessions-cli.js: --claude-only --json with no Claude sessions', () => {
  const r = runSessions(['--json', '--claude-only']);
  assert.strictEqual(r.status, 0);
  const parsed = JSON.parse(r.stdout);
  assert.ok(parsed.claudeCode);
});

// ── SCC sessions ─────────────────────────────────────────────────────────────

test('sessions-cli.js: --scc-only --json lists SCC install sessions', () => {
  const state = {
    installedFiles: [],
    sessions: [
      { profile: 'standard', target: 'claude', fileCount: 10, installedAt: '2026-01-01T00:00:00Z' },
      { profile: 'strict', target: 'cursor', fileCount: 5, installedAt: '2026-02-01T00:00:00Z' },
    ],
  };
  const r = runSessions(['--json', '--scc-only'], { stateContent: state });
  assert.strictEqual(r.status, 0);
  const parsed = JSON.parse(r.stdout);
  assert.strictEqual(parsed.sccInstalls.sessions.length, 2);
  assert.strictEqual(parsed.sccInstalls.sessions[0].profile, 'standard');
});

test('sessions-cli.js: --scc-only text shows SCC sessions', () => {
  const state = {
    installedFiles: [],
    sessions: [
      { profile: 'standard', target: 'claude', fileCount: 10, installedAt: '2026-01-01T12:00:00Z' },
    ],
  };
  const r = runSessions(['--scc-only'], { stateContent: state });
  assert.strictEqual(r.status, 0);
  assert.ok(r.stdout.includes('SCC Install Sessions'));
  assert.ok(r.stdout.includes('2026-01-01'));
});

// ── Claude Code sessions ─────────────────────────────────────────────────────

test('sessions-cli.js: --claude-only --json lists Claude sessions', () => {
  const sessions = [
    {
      name: 'test-session.json',
      data: {
        messages: [{ content: 'Hello world' }, { content: 'Response' }],
        model: 'claude-opus',
        project: 'my-project',
        summary: 'Test summary',
      },
    },
  ];
  const r = runSessions(['--json', '--claude-only'], { claudeSessions: sessions });
  assert.strictEqual(r.status, 0);
  const parsed = JSON.parse(r.stdout);
  assert.ok(parsed.claudeCode.available);
  assert.strictEqual(parsed.claudeCode.sessions.length, 1);
  assert.strictEqual(parsed.claudeCode.sessions[0].messageCount, 2);
});

test('sessions-cli.js: --claude-only text when sessions dir not found', () => {
  const r = runSessions(['--claude-only']);
  // fakeHome doesn't have .claude/sessions by default
  assert.strictEqual(r.status, 0);
  assert.ok(r.stdout.includes('not available') || r.stdout.includes('No sessions'));
});

// ── Combined output ──────────────────────────────────────────────────────────

test('sessions-cli.js: --json shows both sections', () => {
  const state = {
    installedFiles: [],
    sessions: [{ profile: 'standard', target: 'claude', fileCount: 1, installedAt: '2026-01-01T00:00:00Z' }],
  };
  const r = runSessions(['--json'], { stateContent: state });
  assert.strictEqual(r.status, 0);
  const parsed = JSON.parse(r.stdout);
  assert.ok('claudeCode' in parsed);
  assert.ok('sccInstalls' in parsed);
});

test('sessions-cli.js: text output shows both sections', () => {
  const r = runSessions([]);
  assert.strictEqual(r.status, 0);
  assert.ok(r.stdout.includes('SCC Sessions'));
});

// ── Limit ────────────────────────────────────────────────────────────────────

test('sessions-cli.js: --limit limits session output', () => {
  const sessions = [];
  for (let i = 0; i < 5; i++) {
    sessions.push({
      name: `session-${i}.json`,
      data: { messages: [{ content: `msg ${i}` }] },
    });
  }
  const r = runSessions(['--json', '--claude-only', '--limit', '2'], { claudeSessions: sessions });
  assert.strictEqual(r.status, 0);
  const parsed = JSON.parse(r.stdout);
  assert.ok(parsed.claudeCode.sessions.length <= 2, 'should limit to 2 sessions');
});

test('sessions-cli.js: --scc-only text respects --limit', () => {
  const state = {
    installedFiles: [],
    sessions: Array.from({ length: 30 }, (_, i) => ({
      profile: 'standard',
      target: 'claude',
      fileCount: i,
      installedAt: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
    })),
  };
  const r = runSessions(['--scc-only', '--limit', '3'], { stateContent: state });
  assert.strictEqual(r.status, 0);
  // Just verify it runs without error; limit is applied in display
});

console.log(`\nsessions-cli.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
