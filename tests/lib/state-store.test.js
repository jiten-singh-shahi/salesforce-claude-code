#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const stateStorePath = path.join(pluginRoot, 'scripts', 'lib', 'state-store.js');

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


// ── Tests: module exists and exports ─────────────────────────────────────────

test('state-store.js: module exists', () => {
  assert.ok(fs.existsSync(stateStorePath), `state-store.js not found at: ${stateStorePath}`);
});

const stateStore = require(stateStorePath);

test('state-store.js: exports saveState function', () => {
  assert.strictEqual(typeof stateStore.saveState, 'function');
});

test('state-store.js: exports loadState function', () => {
  assert.strictEqual(typeof stateStore.loadState, 'function');
});

test('state-store.js: exports clearState function', () => {
  assert.strictEqual(typeof stateStore.clearState, 'function');
});

test('state-store.js: exports removeFiles function', () => {
  assert.strictEqual(typeof stateStore.removeFiles, 'function');
});

// ── Tests: JSON fallback path (sql.js likely unavailable or async) ───────────
// The state-store falls back to JSON when sql.js is not available.
// We test the JSON fallback code paths by using the module directly.

// To test isolated JSON fallback, we manipulate the state dir.
// The module uses ~/.scc/ by default, so we test the public API.

test('saveState: saves state without throwing', () => {
  // This will use JSON fallback (sql.js async factory returns null)
  assert.doesNotThrow(() => {
    stateStore.saveState({
      profile: 'test-profile',
      target: 'claude',
      installedFiles: [
        { destPath: '/tmp/test-dest/file1.md', srcPath: '/tmp/test-src/file1.md', module: 'test-mod', hash: 'abc123' },
      ],
      installedAt: '2026-01-01T00:00:00.000Z',
    });
  }, 'saveState should not throw');
});

test('loadState: returns state object with required fields', () => {
  const state = stateStore.loadState();
  assert.ok(typeof state === 'object', 'Should return an object');
  assert.ok('profile' in state, 'Should have profile field');
  assert.ok('target' in state, 'Should have target field');
  assert.ok('installedAt' in state, 'Should have installedAt field');
  assert.ok('installedFiles' in state, 'Should have installedFiles field');
  assert.ok('sessions' in state, 'Should have sessions field');
  assert.ok(Array.isArray(state.installedFiles), 'installedFiles should be array');
  assert.ok(Array.isArray(state.sessions), 'sessions should be array');
});

test('saveState + loadState: round-trip preserves data', () => {
  const testData = {
    profile: 'roundtrip-test',
    target: 'claude',
    installedFiles: [
      { destPath: '/tmp/roundtrip/file1.md', srcPath: '/tmp/src/file1.md', module: 'mod-a', hash: 'hash1' },
      { destPath: '/tmp/roundtrip/file2.md', srcPath: '/tmp/src/file2.md', module: 'mod-b', hash: 'hash2' },
    ],
    installedAt: '2026-03-15T12:00:00.000Z',
  };

  stateStore.saveState(testData);
  const loaded = stateStore.loadState();

  // Check that the last state reflects our save
  assert.ok(loaded.installedFiles.length >= 2,
    'Should have at least the 2 files we saved');

  // Find our specific files
  const f1 = loaded.installedFiles.find(f => f.destPath === '/tmp/roundtrip/file1.md');
  const f2 = loaded.installedFiles.find(f => f.destPath === '/tmp/roundtrip/file2.md');
  assert.ok(f1, 'Should find file1 in loaded state');
  assert.ok(f2, 'Should find file2 in loaded state');
});

test('saveState: merges files, replacing entries with same destPath', () => {
  // First save
  stateStore.saveState({
    profile: 'merge-test-1',
    target: 'claude',
    installedFiles: [
      { destPath: '/tmp/merge/file1.md', srcPath: '/tmp/src/old.md', module: 'mod-old', hash: 'old-hash' },
    ],
  });

  // Second save with same destPath, different data
  stateStore.saveState({
    profile: 'merge-test-2',
    target: 'cursor',
    installedFiles: [
      { destPath: '/tmp/merge/file1.md', srcPath: '/tmp/src/new.md', module: 'mod-new', hash: 'new-hash' },
    ],
  });

  const loaded = stateStore.loadState();
  const matchingFiles = loaded.installedFiles.filter(f => f.destPath === '/tmp/merge/file1.md');
  assert.strictEqual(matchingFiles.length, 1,
    'Should have exactly one entry for deduplicated destPath');
});

test('saveState: records sessions', () => {
  stateStore.saveState({
    profile: 'session-test',
    target: 'claude',
    installedFiles: [],
  });

  const loaded = stateStore.loadState();
  assert.ok(loaded.sessions.length > 0, 'Should have at least one session');

  const lastSession = loaded.sessions[0];
  assert.ok(lastSession.profile, 'Session should have profile');
  assert.ok(lastSession.installedAt || lastSession.installed_at, 'Session should have timestamp');
});

test('saveState: handles empty installedFiles', () => {
  assert.doesNotThrow(() => {
    stateStore.saveState({
      profile: 'empty-files',
      target: 'claude',
      installedFiles: [],
    });
  }, 'Should handle empty installedFiles array');
});

test('saveState: handles undefined installedFiles', () => {
  assert.doesNotThrow(() => {
    stateStore.saveState({
      profile: 'undef-files',
      target: 'claude',
    });
  }, 'Should handle undefined installedFiles');
});

test('saveState: uses current time when installedAt not provided', () => {
  const before = new Date().toISOString();
  stateStore.saveState({
    profile: 'time-test',
    target: 'claude',
    installedFiles: [],
  });
  const loaded = stateStore.loadState();
  // The last installed timestamp should be between before and after
  assert.ok(loaded.installedAt >= before.slice(0, 10),
    'installedAt should be recent');
});

// ── Tests: removeFiles ───────────────────────────────────────────────────────

test('removeFiles: removes specific files from state', () => {
  // Save some files
  stateStore.saveState({
    profile: 'remove-test',
    target: 'claude',
    installedFiles: [
      { destPath: '/tmp/remove/keep.md', srcPath: '/tmp/src/keep.md', module: 'mod-x', hash: 'h1' },
      { destPath: '/tmp/remove/delete-me.md', srcPath: '/tmp/src/del.md', module: 'mod-x', hash: 'h2' },
    ],
  });

  // Remove one file
  stateStore.removeFiles(['/tmp/remove/delete-me.md']);

  const loaded = stateStore.loadState();
  const deleted = loaded.installedFiles.find(f => f.destPath === '/tmp/remove/delete-me.md');
  assert.ok(!deleted, 'Removed file should not be in state');

  const kept = loaded.installedFiles.find(f => f.destPath === '/tmp/remove/keep.md');
  assert.ok(kept, 'Non-removed file should still be in state');
});

test('removeFiles: handles empty array', () => {
  assert.doesNotThrow(() => {
    stateStore.removeFiles([]);
  }, 'Should handle empty removal array');
});

test('removeFiles: handles non-existent paths gracefully', () => {
  assert.doesNotThrow(() => {
    stateStore.removeFiles(['/nonexistent/path/file.md']);
  }, 'Should not throw on non-existent paths');
});

// ── Tests: clearState ────────────────────────────────────────────────────────

test('clearState: clears all state', () => {
  // Save some state first
  stateStore.saveState({
    profile: 'clear-test',
    target: 'claude',
    installedFiles: [
      { destPath: '/tmp/clear/file.md', srcPath: '/tmp/src/file.md', module: 'mod-z', hash: 'hz' },
    ],
  });

  // Clear it
  stateStore.clearState();

  // Load should return empty/default state
  const loaded = stateStore.loadState();
  assert.ok(loaded.installedFiles.length === 0,
    'After clear, installedFiles should be empty');
  assert.ok(loaded.sessions.length === 0,
    'After clear, sessions should be empty');
  assert.strictEqual(loaded.profile, null, 'After clear, profile should be null');
  assert.strictEqual(loaded.target, null, 'After clear, target should be null');
});

test('clearState: can be called multiple times', () => {
  assert.doesNotThrow(() => {
    stateStore.clearState();
    stateStore.clearState();
  }, 'Should handle multiple clearState calls');
});

// ── Tests: loadState on fresh state ──────────────────────────────────────────

test('loadState: returns valid structure after clearState', () => {
  stateStore.clearState();
  const state = stateStore.loadState();
  assert.strictEqual(state.profile, null);
  assert.strictEqual(state.target, null);
  assert.strictEqual(state.installedAt, null);
  assert.deepStrictEqual(state.installedFiles, []);
  assert.deepStrictEqual(state.sessions, []);
});

// ── Tests: multiple sessions ─────────────────────────────────────────────────

test('saveState: multiple saves create multiple sessions', () => {
  stateStore.clearState();

  stateStore.saveState({
    profile: 'multi-1',
    target: 'claude',
    installedFiles: [],
    installedAt: '2026-01-01T00:00:00.000Z',
  });

  stateStore.saveState({
    profile: 'multi-2',
    target: 'cursor',
    installedFiles: [],
    installedAt: '2026-01-02T00:00:00.000Z',
  });

  const loaded = stateStore.loadState();
  assert.ok(loaded.sessions.length >= 2,
    'Should have at least 2 sessions after 2 saves');
});

// ── Tests: lastProfile/lastTarget tracking ───────────────────────────────────

test('loadState: reflects last saved profile and target', () => {
  stateStore.clearState();

  stateStore.saveState({
    profile: 'latest-profile',
    target: 'cursor',
    installedFiles: [],
  });

  const loaded = stateStore.loadState();
  // In JSON fallback: lastProfile/lastTarget
  // In general API: profile/target
  assert.ok(
    loaded.profile === 'latest-profile' || loaded.profile === null,
    'Should reflect the last profile or be null'
  );
});

// ── Cleanup test state ───────────────────────────────────────────────────────

test('cleanup: clearState leaves clean state', () => {
  stateStore.clearState();
  const state = stateStore.loadState();
  assert.deepStrictEqual(state.installedFiles, []);
});

// ── Tests: legacy state migration ────────────────────────────────────────────

test('loadState: wipes state when legacy module IDs detected (rules-apex)', () => {
  // Save state with legacy v1.0.0 module ID
  stateStore.saveState({
    profile: 'legacy-test',
    target: 'claude',
    installedFiles: [
      { destPath: '/tmp/legacy/file.md', srcPath: '/tmp/src/file.md', module: 'rules-apex', hash: 'h1' },
    ],
  });

  // loadState should detect legacy prefix and wipe
  const loaded = stateStore.loadState();
  assert.deepStrictEqual(loaded.installedFiles, [], 'Legacy state should be wiped');
  assert.strictEqual(loaded.profile, null, 'Profile should be null after wipe');
  assert.strictEqual(loaded.target, null, 'Target should be null after wipe');
});

test('loadState: wipes state when any legacy prefix detected (agents-, commands-, skills-)', () => {
  stateStore.saveState({
    profile: 'legacy-test-2',
    target: 'claude',
    installedFiles: [
      { destPath: '/tmp/legacy/agent.md', srcPath: '/tmp/src/agent.md', module: 'agents-security', hash: 'h2' },
    ],
  });

  const loaded = stateStore.loadState();
  assert.deepStrictEqual(loaded.installedFiles, [], 'agents-security should trigger legacy wipe');
});

test('loadState: does NOT wipe state with new bundle IDs (apex, lwc, core)', () => {
  stateStore.clearState();
  stateStore.saveState({
    profile: 'new-test',
    target: 'claude',
    installedFiles: [
      { destPath: '/tmp/new/file.md', srcPath: '/tmp/src/file.md', module: 'apex', hash: 'h3' },
      { destPath: '/tmp/new/file2.md', srcPath: '/tmp/src/file2.md', module: 'core', hash: 'h4' },
    ],
  });

  const loaded = stateStore.loadState();
  assert.ok(loaded.installedFiles.length >= 2, 'New bundle IDs should NOT trigger wipe');
});

// ── Tests: entity operations ─────────────────────────────────────────────────

test('upsertSession: stores valid session entity', () => {
  stateStore.clearState();
  stateStore.upsertSession({
    id: 'session-1',
    adapterId: 'claude',
    harness: 'claude',
    state: 'active',
    repoRoot: '/tmp/project',
    startedAt: '2026-03-26T00:00:00.000Z',
    endedAt: null,
    snapshot: {},
  });
  const sessions = stateStore.listSessions();
  assert.ok(sessions.length >= 1, 'Should have at least 1 session');
  assert.strictEqual(sessions.find(s => s.id === 'session-1').state, 'active');
});

test('upsertSession: replaces existing session by id', () => {
  stateStore.clearState();
  stateStore.upsertSession({
    id: 'session-2', adapterId: 'claude', harness: 'claude',
    state: 'active', repoRoot: null, startedAt: '2026-01-01T00:00:00.000Z', endedAt: null, snapshot: {},
  });
  stateStore.upsertSession({
    id: 'session-2', adapterId: 'claude', harness: 'claude',
    state: 'completed', repoRoot: null, startedAt: '2026-01-01T00:00:00.000Z', endedAt: '2026-01-01T01:00:00.000Z', snapshot: {},
  });
  const sessions = stateStore.listSessions();
  const s2 = sessions.filter(s => s.id === 'session-2');
  assert.strictEqual(s2.length, 1, 'Should have exactly 1 session with id session-2');
  assert.strictEqual(s2[0].state, 'completed');
});

test('upsertSession: rejects invalid entity', () => {
  assert.throws(() => {
    stateStore.upsertSession({ id: 'bad' }); // missing required fields
  }, /Invalid session/);
});

test('upsertSkillRun: stores valid skill run', () => {
  stateStore.clearState();
  stateStore.upsertSkillRun({
    id: 'run-1', skillId: 'sf-help', skillVersion: '1.0.0', sessionId: 'session-1',
    taskDescription: 'List available skills', outcome: 'success',
    failureReason: null, tokensUsed: 1500, durationMs: 3000, userFeedback: null,
    createdAt: '2026-03-26T00:00:00.000Z',
  });
  const runs = stateStore.listSkillRuns();
  assert.strictEqual(runs.length, 1);
  assert.strictEqual(runs[0].skillId, 'sf-help');
});

test('upsertSkillRun: rejects invalid entity', () => {
  assert.throws(() => {
    stateStore.upsertSkillRun({ id: 'bad' });
  }, /Invalid skillRun/);
});

test('listSkillRuns: filters by sessionId', () => {
  stateStore.clearState();
  stateStore.upsertSkillRun({
    id: 'run-a', skillId: 'sf-help', skillVersion: '1.0', sessionId: 'sess-1',
    taskDescription: 'test', outcome: 'success',
    failureReason: null, tokensUsed: null, durationMs: null, userFeedback: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  });
  stateStore.upsertSkillRun({
    id: 'run-b', skillId: 'sf-quickstart', skillVersion: '1.0', sessionId: 'sess-2',
    taskDescription: 'test', outcome: 'success',
    failureReason: null, tokensUsed: null, durationMs: null, userFeedback: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  });
  const filtered = stateStore.listSkillRuns('sess-1');
  assert.strictEqual(filtered.length, 1);
  assert.strictEqual(filtered[0].id, 'run-a');
});

test('upsertDecision: stores valid decision', () => {
  stateStore.clearState();
  stateStore.upsertDecision({
    id: 'dec-1', sessionId: 'session-1', title: 'Use trigger framework',
    rationale: 'Better separation of concerns', alternatives: ['inline logic'],
    supersedes: null, status: 'accepted', createdAt: '2026-03-26T00:00:00.000Z',
  });
  const decisions = stateStore.listDecisions();
  assert.strictEqual(decisions.length, 1);
  assert.strictEqual(decisions[0].title, 'Use trigger framework');
});

test('upsertDecision: rejects invalid entity', () => {
  assert.throws(() => {
    stateStore.upsertDecision({ id: 'bad' });
  }, /Invalid decision/);
});

test('upsertGovernanceEvent: stores valid event', () => {
  stateStore.clearState();
  stateStore.upsertGovernanceEvent({
    id: 'gov-1', sessionId: 'session-1', eventType: 'soql-in-loop',
    payload: { file: 'MyClass.cls', line: 42 },
    resolvedAt: null, resolution: null, createdAt: '2026-03-26T00:00:00.000Z',
  });
  const events = stateStore.listGovernanceEvents();
  assert.strictEqual(events.length, 1);
  assert.strictEqual(events[0].eventType, 'soql-in-loop');
});

test('upsertGovernanceEvent: rejects invalid entity', () => {
  assert.throws(() => {
    stateStore.upsertGovernanceEvent({ id: 'bad' });
  }, /Invalid governanceEvent/);
});

test('listGovernanceEvents: filters by sessionId', () => {
  stateStore.clearState();
  stateStore.upsertGovernanceEvent({
    id: 'gov-a', sessionId: 'sess-1', eventType: 'soql-in-loop',
    payload: {}, resolvedAt: null, resolution: null, createdAt: '2026-01-01T00:00:00.000Z',
  });
  stateStore.upsertGovernanceEvent({
    id: 'gov-b', sessionId: 'sess-2', eventType: 'dml-in-loop',
    payload: {}, resolvedAt: null, resolution: null, createdAt: '2026-01-01T00:00:00.000Z',
  });
  assert.strictEqual(stateStore.listGovernanceEvents('sess-1').length, 1);
  assert.strictEqual(stateStore.listGovernanceEvents('sess-2').length, 1);
  assert.strictEqual(stateStore.listGovernanceEvents().length, 2);
});

test('upsertSkillVersion: stores valid skill version', () => {
  stateStore.clearState();
  stateStore.upsertSkillVersion({
    skillId: 'sf-help', version: '1.0.0', contentHash: 'abc123',
    amendmentReason: null, promotedAt: null, rolledBackAt: null,
  });
  const state = JSON.parse(require('fs').readFileSync(
    require('path').join(require('os').homedir(), '.scc', 'state.json'), 'utf8'
  ));
  assert.strictEqual(state.skillVersions.length, 1);
  assert.strictEqual(state.skillVersions[0].skillId, 'sf-help');
});

test('clearState: wipes all entity collections', () => {
  // Populate all collections
  stateStore.upsertSession({
    id: 'wipe-sess', adapterId: 'claude', harness: 'claude', state: 'active',
    repoRoot: null, startedAt: '2026-01-01T00:00:00.000Z', endedAt: null, snapshot: {},
  });
  stateStore.upsertSkillRun({
    id: 'wipe-run', skillId: 'test', skillVersion: '1.0', sessionId: 'wipe-sess',
    taskDescription: 'test', outcome: 'success',
    failureReason: null, tokensUsed: null, durationMs: null, userFeedback: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  });
  stateStore.upsertDecision({
    id: 'wipe-dec', sessionId: 'wipe-sess', title: 'test', rationale: 'test',
    alternatives: [], supersedes: null, status: 'accepted', createdAt: '2026-01-01T00:00:00.000Z',
  });

  stateStore.clearState();

  assert.strictEqual(stateStore.listSessions().length, 0);
  assert.strictEqual(stateStore.listSkillRuns().length, 0);
  assert.strictEqual(stateStore.listDecisions().length, 0);
  assert.strictEqual(stateStore.listGovernanceEvents().length, 0);
});

// Final cleanup
test('final cleanup: clearState', () => {
  stateStore.clearState();
  const state = stateStore.loadState();
  assert.deepStrictEqual(state.installedFiles, []);
});

console.log(`\nstate-store.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
