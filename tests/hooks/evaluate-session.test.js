#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const scriptPath = path.join(pluginRoot, 'scripts', 'hooks', 'evaluate-session.js');

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

// Helper to run the script with given stdin
function runScript(stdin, env) {
  return spawnSync(process.execPath, [scriptPath], {
    input: stdin || '',
    encoding: 'utf8',
    timeout: 15000,
    env: { ...process.env, ...env },
  });
}

test('evaluate-session.js: script exists', () => {
  assert.ok(fs.existsSync(scriptPath), 'evaluate-session.js not found');
});

// ── Tests: exit behavior with no transcript ──

test('evaluate-session.js: exits 0 with empty stdin (no transcript)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-es-'));
  try {
    const result = runScript('', { HOME: tmpDir });
    assert.strictEqual(result.status, 0);
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('evaluate-session.js: exits 0 with invalid JSON stdin', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-es2-'));
  try {
    const result = runScript('not valid json', { HOME: tmpDir });
    assert.strictEqual(result.status, 0);
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('evaluate-session.js: exits 0 when transcript_path is missing from input', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-es3-'));
  try {
    const result = runScript(JSON.stringify({ other_field: 'value' }), { HOME: tmpDir });
    assert.strictEqual(result.status, 0);
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('evaluate-session.js: exits 0 when transcript file does not exist', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-es4-'));
  try {
    const input = JSON.stringify({ transcript_path: '/nonexistent/transcript.jsonl' });
    const result = runScript(input, { HOME: tmpDir });
    assert.strictEqual(result.status, 0);
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

// ── Tests: short session skipping ──

test('evaluate-session.js: skips short sessions (< minSessionLength)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-es5-'));
  try {
    // Create a transcript with only 3 user messages (default min is 10)
    const transcriptFile = path.join(tmpDir, 'transcript.jsonl');
    const lines = [];
    for (let i = 0; i < 3; i++) {
      lines.push(JSON.stringify({ type: 'user', content: `msg ${i}` }));
    }
    fs.writeFileSync(transcriptFile, lines.join('\n'));

    const input = JSON.stringify({ transcript_path: transcriptFile });
    const result = runScript(input, { HOME: tmpDir });

    assert.strictEqual(result.status, 0);
    const stderr = result.stderr || '';
    assert.ok(stderr.includes('Session too short') || stderr.includes('3 messages'),
      'Should log that session is too short');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('evaluate-session.js: processes sessions with enough messages', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-es6-'));
  try {
    // Create a transcript with 15 user messages (> default min of 10)
    const transcriptFile = path.join(tmpDir, 'transcript.jsonl');
    const lines = [];
    for (let i = 0; i < 15; i++) {
      lines.push(JSON.stringify({ "type": "user", content: `message ${i}` }));
    }
    fs.writeFileSync(transcriptFile, lines.join('\n'));

    const input = JSON.stringify({ transcript_path: transcriptFile });
    const result = runScript(input, { HOME: tmpDir });

    assert.strictEqual(result.status, 0);
    const stderr = result.stderr || '';
    assert.ok(stderr.includes('15 messages'), 'Should report message count');
    assert.ok(stderr.includes('evaluate for extractable patterns'),
      'Should signal for evaluation');
    assert.ok(stderr.includes('learned'), 'Should mention learned skills path');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

// ── Tests: learned skills directory creation ──

test('evaluate-session.js: creates learned skills directory', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-es7-'));
  try {
    const learnedDir = path.join(tmpDir, '.claude', 'skills', 'learned');

    // Create a transcript with enough messages
    const transcriptFile = path.join(tmpDir, 'transcript.jsonl');
    const lines = [];
    for (let i = 0; i < 12; i++) {
      lines.push(JSON.stringify({ "type": "user", content: `msg ${i}` }));
    }
    fs.writeFileSync(transcriptFile, lines.join('\n'));

    const input = JSON.stringify({ transcript_path: transcriptFile });
    runScript(input, { HOME: tmpDir });

    assert.ok(fs.existsSync(learnedDir), 'Should create learned skills directory');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

// ── Tests: config loading ──

test('evaluate-session.js: uses default minSessionLength when no config exists', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-es8-'));
  try {
    // Create transcript with 9 messages (just under default min of 10)
    const transcriptFile = path.join(tmpDir, 'transcript.jsonl');
    const lines = [];
    for (let i = 0; i < 9; i++) {
      lines.push(JSON.stringify({ "type": "user", content: `msg ${i}` }));
    }
    fs.writeFileSync(transcriptFile, lines.join('\n'));

    const input = JSON.stringify({ transcript_path: transcriptFile });
    const result = runScript(input, { HOME: tmpDir });

    assert.strictEqual(result.status, 0);
    const stderr = result.stderr || '';
    assert.ok(stderr.includes('too short'), 'Should skip with 9 messages (default min 10)');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('evaluate-session.js: exactly at min session length still skips (< not <=)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-es9-'));
  try {
    // Exactly 10 user messages — default min is 10, condition is < 10, so should NOT skip
    const transcriptFile = path.join(tmpDir, 'transcript.jsonl');
    const lines = [];
    for (let i = 0; i < 10; i++) {
      lines.push(JSON.stringify({ "type": "user", content: `msg ${i}` }));
    }
    fs.writeFileSync(transcriptFile, lines.join('\n'));

    const input = JSON.stringify({ transcript_path: transcriptFile });
    const result = runScript(input, { HOME: tmpDir });

    assert.strictEqual(result.status, 0);
    const stderr = result.stderr || '';
    assert.ok(stderr.includes('10 messages'), 'Should process session with exactly 10 messages');
    assert.ok(stderr.includes('evaluate'), 'Should signal evaluation');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

// ── Tests: CLAUDE_TRANSCRIPT_PATH env var fallback ──

test('evaluate-session.js: falls back to CLAUDE_TRANSCRIPT_PATH env var', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-es10-'));
  try {
    const transcriptFile = path.join(tmpDir, 'transcript.jsonl');
    const lines = [];
    for (let i = 0; i < 12; i++) {
      lines.push(JSON.stringify({ "type": "user", content: `msg ${i}` }));
    }
    fs.writeFileSync(transcriptFile, lines.join('\n'));

    // Pass invalid JSON as stdin so it falls back to env var
    const result = runScript('invalid-json-so-fallback', {
      HOME: tmpDir,
      CLAUDE_TRANSCRIPT_PATH: transcriptFile,
    });

    assert.strictEqual(result.status, 0);
    const stderr = result.stderr || '';
    assert.ok(stderr.includes('12 messages'), 'Should process via env var fallback');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

// ── Tests: message counting with different transcript formats ──

test('evaluate-session.js: counts user messages with "type":"user" pattern', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-es11-'));
  try {
    const transcriptFile = path.join(tmpDir, 'transcript.jsonl');
    // Mix of user and non-user messages
    const lines = [];
    for (let i = 0; i < 12; i++) {
      lines.push(JSON.stringify({ "type": "user", content: `user msg ${i}` }));
      lines.push(JSON.stringify({ type: 'assistant', content: `response ${i}` }));
    }
    fs.writeFileSync(transcriptFile, lines.join('\n'));

    const input = JSON.stringify({ transcript_path: transcriptFile });
    const result = runScript(input, { HOME: tmpDir });

    assert.strictEqual(result.status, 0);
    const stderr = result.stderr || '';
    // Should count only user messages (12), not assistant messages
    assert.ok(stderr.includes('12 messages'), 'Should count only user messages');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('evaluate-session.js: handles transcript with no user messages', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-es12-'));
  try {
    const transcriptFile = path.join(tmpDir, 'transcript.jsonl');
    const lines = [
      JSON.stringify({ type: 'assistant', content: 'I am a response' }),
      JSON.stringify({ type: 'tool_use', tool_name: 'Read' }),
    ];
    fs.writeFileSync(transcriptFile, lines.join('\n'));

    const input = JSON.stringify({ transcript_path: transcriptFile });
    const result = runScript(input, { HOME: tmpDir });

    assert.strictEqual(result.status, 0);
    const stderr = result.stderr || '';
    assert.ok(stderr.includes('too short') || !stderr.includes('evaluate'),
      'Should skip session with 0 user messages');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('evaluate-session.js: handles empty transcript file', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-es13-'));
  try {
    const transcriptFile = path.join(tmpDir, 'transcript.jsonl');
    fs.writeFileSync(transcriptFile, '');

    const input = JSON.stringify({ transcript_path: transcriptFile });
    const result = runScript(input, { HOME: tmpDir });

    assert.strictEqual(result.status, 0);
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

// ── Test: getLearnedSkillsDir uses HOME or USERPROFILE ──

test('evaluate-session.js: learned skills path uses HOME env var', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-es14-'));
  try {
    const transcriptFile = path.join(tmpDir, 'transcript.jsonl');
    const lines = [];
    for (let i = 0; i < 11; i++) {
      lines.push(JSON.stringify({ "type": "user", content: `msg ${i}` }));
    }
    fs.writeFileSync(transcriptFile, lines.join('\n'));

    const input = JSON.stringify({ transcript_path: transcriptFile });
    const result = runScript(input, { HOME: tmpDir });

    const stderr = result.stderr || '';
    const expectedPath = path.join(tmpDir, '.claude', 'skills', 'learned');
    assert.ok(stderr.includes(expectedPath) || stderr.includes('.claude'),
      'Should reference learned skills in HOME dir');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

console.log(`\nevaluate-session.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
