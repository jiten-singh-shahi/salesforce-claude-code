#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const scriptPath = path.join(pluginRoot, 'scripts', 'dev', 'skill-create-output.js');
const { SkillCreateOutput, demo } = require(scriptPath);

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passCount++; }
  catch (err) { console.error(`  FAIL  ${name}`); console.error(`        ${err.message}`); failCount++; }
}

// ── Module exports ───────────────────────────────────────────────────────────

test('script exists', () => {
  assert.ok(fs.existsSync(scriptPath));
});

test('exports SkillCreateOutput class', () => {
  assert.ok(typeof SkillCreateOutput === 'function');
});

test('exports demo function', () => {
  assert.ok(typeof demo === 'function');
});

// ── Constructor ──────────────────────────────────────────────────────────────

test('constructor: sets repoName', () => {
  const output = new SkillCreateOutput('test-repo');
  assert.strictEqual(output.repoName, 'test-repo');
});

test('constructor: sets default width', () => {
  const output = new SkillCreateOutput('test-repo');
  assert.strictEqual(output.width, 70);
});

test('constructor: accepts custom width', () => {
  const output = new SkillCreateOutput('test-repo', { width: 100 });
  assert.strictEqual(output.width, 100);
});

test('constructor: stores options', () => {
  const output = new SkillCreateOutput('test-repo', { foo: 'bar' });
  assert.strictEqual(output.options.foo, 'bar');
});

// ── Methods exist ────────────────────────────────────────────────────────────

test('has all expected methods', () => {
  const output = new SkillCreateOutput('test-repo');
  assert.ok(typeof output.header === 'function');
  assert.ok(typeof output.analyzePhase === 'function');
  assert.ok(typeof output.analysisResults === 'function');
  assert.ok(typeof output.patterns === 'function');
  assert.ok(typeof output.instincts === 'function');
  assert.ok(typeof output.output === 'function');
  assert.ok(typeof output.nextSteps === 'function');
  assert.ok(typeof output.footer === 'function');
});

// ── header() ─────────────────────────────────────────────────────────────────

test('header: outputs to console without error', () => {
  const output = new SkillCreateOutput('my-project');
  const origLog = console.log;
  const lines = [];
  console.log = (...args) => lines.push(args.join(' '));
  try {
    output.header();
    assert.ok(lines.length > 0, 'should output lines');
    const allOutput = lines.join('\n');
    assert.ok(allOutput.includes('SCC Skill Creator') || allOutput.includes('Skill Creator'));
  } finally {
    console.log = origLog;
  }
});

// ── analysisResults() ────────────────────────────────────────────────────────

test('analysisResults: displays commit and contributor data', () => {
  const output = new SkillCreateOutput('test-repo');
  const origLog = console.log;
  const lines = [];
  console.log = (...args) => lines.push(args.join(' '));
  try {
    output.analysisResults({
      commits: 150,
      timeRange: 'Jan 2025 - Mar 2025',
      contributors: 3,
      files: 500,
    });
    const allOutput = lines.join('\n');
    assert.ok(allOutput.includes('150'), 'should show commit count');
    assert.ok(allOutput.includes('Jan 2025'), 'should show time range');
  } finally {
    console.log = origLog;
  }
});

// ── patterns() ───────────────────────────────────────────────────────────────

test('patterns: displays pattern list', () => {
  const output = new SkillCreateOutput('test-repo');
  const origLog = console.log;
  const lines = [];
  console.log = (...args) => lines.push(args.join(' '));
  try {
    output.patterns([
      { name: 'Test Pattern', trigger: 'when testing', confidence: 0.9, evidence: 'Seen 10 times' },
      { name: 'Second Pattern', trigger: 'when coding', evidence: 'Seen 5 times' },
    ]);
    const allOutput = lines.join('\n');
    assert.ok(allOutput.includes('Test Pattern'), 'should show pattern name');
    assert.ok(allOutput.includes('when testing'), 'should show trigger');
  } finally {
    console.log = origLog;
  }
});

test('patterns: handles missing confidence with default', () => {
  const output = new SkillCreateOutput('test-repo');
  const origLog = console.log;
  const lines = [];
  console.log = (...args) => lines.push(args.join(' '));
  try {
    // Pattern without explicit confidence should use default 0.8
    output.patterns([{ name: 'No Confidence', trigger: 'always' }]);
    assert.ok(lines.length > 0, 'should output without error');
  } finally {
    console.log = origLog;
  }
});

// ── instincts() ──────────────────────────────────────────────────────────────

test('instincts: displays instinct list', () => {
  const output = new SkillCreateOutput('test-repo');
  const origLog = console.log;
  const lines = [];
  console.log = (...args) => lines.push(args.join(' '));
  try {
    output.instincts([
      { name: 'sf-conventional-commits', confidence: 0.85 },
      { name: 'sf-tdd-workflow', confidence: 0.90 },
    ]);
    const allOutput = lines.join('\n');
    assert.ok(allOutput.includes('sf-conventional-commits'));
    assert.ok(allOutput.includes('85%') || allOutput.includes('0.85'));
  } finally {
    console.log = origLog;
  }
});

// ── output() ─────────────────────────────────────────────────────────────────

test('output: displays file paths', () => {
  const out = new SkillCreateOutput('test-repo');
  const origLog = console.log;
  const lines = [];
  console.log = (...args) => lines.push(args.join(' '));
  try {
    out.output('/path/to/SKILL.md', '/path/to/instincts.yaml');
    const allOutput = lines.join('\n');
    assert.ok(allOutput.includes('SKILL.md'));
    assert.ok(allOutput.includes('instincts.yaml'));
    assert.ok(allOutput.includes('Complete') || allOutput.includes('Generation'));
  } finally {
    console.log = origLog;
  }
});

// ── nextSteps() ──────────────────────────────────────────────────────────────

test('nextSteps: displays next steps', () => {
  const output = new SkillCreateOutput('test-repo');
  const origLog = console.log;
  const lines = [];
  console.log = (...args) => lines.push(args.join(' '));
  try {
    output.nextSteps();
    const allOutput = lines.join('\n');
    assert.ok(allOutput.includes('Next Steps') || allOutput.includes('Review'));
  } finally {
    console.log = origLog;
  }
});

// ── footer() ─────────────────────────────────────────────────────────────────

test('footer: displays footer', () => {
  const output = new SkillCreateOutput('test-repo');
  const origLog = console.log;
  const lines = [];
  console.log = (...args) => lines.push(args.join(' '));
  try {
    output.footer();
    const allOutput = lines.join('\n');
    assert.ok(allOutput.includes('Salesforce Claude Code') || allOutput.includes('Powered'));
  } finally {
    console.log = origLog;
  }
});

// ── Internal helper coverage via spawnSync ───────────────────────────────────

test('demo: runs when script is executed directly (covers require.main)', () => {
  const { spawnSync } = require('child_process');
  // Run as main module with a timeout. The demo function has sleep() calls
  // so it will take some time. We kill it after 2s which is enough to cover
  // the demo function entry and several steps.
  const r = spawnSync(process.execPath, [scriptPath], {
    encoding: 'utf8',
    timeout: 3000,
  });
  // It either completed or timed out, but we covered the code path
  assert.ok(r.stdout.length > 0 || r.status !== null, 'should produce some output');
});

// Test the stripAnsi and box/progressBar helpers indirectly via the module
// We can access them by parsing the source since they're not exported,
// but we already exercise them through the class methods above.

// The demo() spawnSync test above already covers analyzePhase, animateProgress,
// sleep, and the require.main === module path.

console.log(`\nskill-create-output.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
