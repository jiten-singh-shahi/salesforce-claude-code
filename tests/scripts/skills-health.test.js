#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const scriptPath = path.join(pluginRoot, 'scripts', 'dev', 'skills-health.js');
const { scanSkills, analyzeSkill, renderDashboard, parseArgs } = require(scriptPath);

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

test('exports expected functions', () => {
  assert.ok(typeof scanSkills === 'function');
  assert.ok(typeof analyzeSkill === 'function');
  assert.ok(typeof renderDashboard === 'function');
  assert.ok(typeof parseArgs === 'function');
});

// ── parseArgs ────────────────────────────────────────────────────────────────

test('parseArgs: defaults', () => {
  const result = parseArgs(['node', 'script.js']);
  assert.strictEqual(result.json, false);
  assert.strictEqual(result.panel, null);
});

test('parseArgs: --json flag', () => {
  const result = parseArgs(['node', 'script.js', '--json']);
  assert.strictEqual(result.json, true);
});

test('parseArgs: --panel flag', () => {
  const result = parseArgs(['node', 'script.js', '--panel', 'completeness']);
  assert.strictEqual(result.panel, 'completeness');
});

// ── scanSkills ───────────────────────────────────────────────────────────────

test('scanSkills: returns empty for non-existent dir', () => {
  const result = scanSkills('/tmp/scc-nonexistent-skills-dir-99999');
  assert.ok(Array.isArray(result));
  assert.strictEqual(result.length, 0);
});

test('scanSkills: finds .md files in directory', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-skills-'));
  fs.writeFileSync(path.join(tmpDir, 'skill-a.md'), '# Skill A\n## When to Use\n## How It Works\n## Examples\n');
  fs.writeFileSync(path.join(tmpDir, 'skill-b.md'), '# Skill B\n');
  fs.writeFileSync(path.join(tmpDir, 'not-a-skill.txt'), 'skip me');

  try {
    const result = scanSkills(tmpDir);
    assert.strictEqual(result.length, 2, 'should find 2 md files');
    assert.ok(result.some(s => s.name === 'skill-a'));
    assert.ok(result.some(s => s.name === 'skill-b'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('scanSkills: finds SKILL.md in subdirectories', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-skills-'));
  const subDir = path.join(tmpDir, 'my-skill');
  fs.mkdirSync(subDir);
  fs.writeFileSync(path.join(subDir, 'SKILL.md'), '# Skill\n## When to Use\n## How It Works\n## Examples\n');

  try {
    const result = scanSkills(tmpDir);
    assert.ok(result.some(s => s.name === 'my-skill'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('scanSkills: finds .md files in subdirectories (not SKILL.md)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-skills-'));
  const subDir = path.join(tmpDir, 'category');
  fs.mkdirSync(subDir);
  fs.writeFileSync(path.join(subDir, 'sub-skill.md'), '# Sub Skill\n');

  try {
    const result = scanSkills(tmpDir);
    assert.ok(result.some(s => s.name === 'category/sub-skill'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── analyzeSkill ─────────────────────────────────────────────────────────────

test('analyzeSkill: complete skill with all required sections', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-skill-'));
  const skillFile = path.join(tmpDir, 'complete-skill.md');
  fs.writeFileSync(skillFile, [
    '# Complete Skill',
    '',
    '## When to Use',
    'Use this when testing.',
    '',
    '## How It Works',
    'It works by testing.',
    '',
    '## Examples',
    'Example 1.',
  ].join('\n'));

  try {
    const result = analyzeSkill(skillFile, 'complete-skill.md');
    assert.strictEqual(result.name, 'complete-skill');
    assert.strictEqual(result.complete, true);
    assert.deepStrictEqual(result.missingSections, []);
    assert.ok(result.sizeKB > 0);
    assert.ok(typeof result.daysSinceModified === 'number');
    assert.ok(typeof result.lastModified === 'string');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('analyzeSkill: incomplete skill missing sections', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-skill-'));
  const skillFile = path.join(tmpDir, 'incomplete-skill.md');
  fs.writeFileSync(skillFile, [
    '# Incomplete Skill',
    '',
    '## When to Use',
    'Use this when testing.',
  ].join('\n'));

  try {
    const result = analyzeSkill(skillFile, 'incomplete-skill.md');
    assert.strictEqual(result.complete, false);
    assert.ok(result.missingSections.includes('How It Works'));
    assert.ok(result.missingSections.includes('Examples'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('analyzeSkill: detects staleness', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-skill-'));
  const skillFile = path.join(tmpDir, 'fresh-skill.md');
  fs.writeFileSync(skillFile, '# Fresh\n');

  try {
    const result = analyzeSkill(skillFile, 'fresh-skill.md');
    // Just created, so days since modified should be 0 or 1
    assert.ok(result.daysSinceModified <= 1);
    assert.strictEqual(result.stale, false);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('analyzeSkill: strips .md from name', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-skill-'));
  const skillFile = path.join(tmpDir, 'my-skill.md');
  fs.writeFileSync(skillFile, '# Skill\n');

  try {
    const result = analyzeSkill(skillFile, 'my-skill.md');
    assert.strictEqual(result.name, 'my-skill');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── renderDashboard ──────────────────────────────────────────────────────────

test('renderDashboard: renders full dashboard', () => {
  const skills = [
    { name: 'skill-a', complete: true, missingSections: [], sizeKB: 2.5, daysSinceModified: 5, stale: false, lastModified: '2026-03-17' },
    { name: 'skill-b', complete: false, missingSections: ['How It Works'], sizeKB: 1.0, daysSinceModified: 45, stale: true, lastModified: '2026-02-05' },
  ];

  const dashboard = renderDashboard(skills, null);
  assert.ok(dashboard.includes('Skill Health Dashboard'));
  assert.ok(dashboard.includes('Inventory: 2'));
  assert.ok(dashboard.includes('Complete:'));
  assert.ok(dashboard.includes('skill-b'));
  assert.ok(dashboard.includes('How It Works'));
  assert.ok(dashboard.includes('Size Distribution'));
  assert.ok(dashboard.includes('Stale Skills'));
  assert.ok(dashboard.includes('Recommendations'));
});

test('renderDashboard: inventory panel only', () => {
  const skills = [
    { name: 'skill-a', complete: true, missingSections: [], sizeKB: 2.5, daysSinceModified: 5, stale: false, lastModified: '2026-03-17' },
  ];
  const dashboard = renderDashboard(skills, 'inventory');
  assert.ok(dashboard.includes('Inventory'));
  assert.ok(!dashboard.includes('Size Distribution'));
  assert.ok(!dashboard.includes('Stale Skills'));
});

test('renderDashboard: completeness panel only', () => {
  const skills = [
    { name: 'skill-a', complete: false, missingSections: ['Examples'], sizeKB: 1, daysSinceModified: 1, stale: false },
  ];
  const dashboard = renderDashboard(skills, 'completeness');
  assert.ok(dashboard.includes('Incomplete'));
  assert.ok(dashboard.includes('Examples'));
});

test('renderDashboard: size panel only', () => {
  const skills = [
    { name: 'skill-a', complete: true, missingSections: [], sizeKB: 5.5, daysSinceModified: 1, stale: false },
  ];
  const dashboard = renderDashboard(skills, 'size');
  assert.ok(dashboard.includes('Size Distribution'));
  assert.ok(dashboard.includes('5.5'), 'should include size value');
});

test('renderDashboard: staleness panel only', () => {
  const skills = [
    { name: 'old-skill', complete: true, missingSections: [], sizeKB: 1, daysSinceModified: 60, stale: true },
  ];
  const dashboard = renderDashboard(skills, 'staleness');
  assert.ok(dashboard.includes('Stale Skills'));
  assert.ok(dashboard.includes('old-skill'));
});

test('renderDashboard: handles empty skills', () => {
  const dashboard = renderDashboard([], null);
  assert.ok(dashboard.includes('0 skills'));
});

test('renderDashboard: size panel shows top 10 and more count', () => {
  const skills = Array.from({ length: 15 }, (_, i) => ({
    name: `skill-${i}`,
    complete: true,
    missingSections: [],
    sizeKB: 15 - i,
    daysSinceModified: 1,
    stale: false,
  }));
  const dashboard = renderDashboard(skills, 'size');
  assert.ok(dashboard.includes('and 5 more'));
});

// ── CLI via spawnSync ────────────────────────────────────────────────────────

test('skills-health.js: --json on real skills dir', () => {
  const r = spawnSync(process.execPath, [scriptPath, '--json'], {
    encoding: 'utf8',
    timeout: 15000,
    env: { ...process.env, SCC_PLUGIN_ROOT: pluginRoot },
  });
  assert.strictEqual(r.status, 0);
  const parsed = JSON.parse(r.stdout);
  assert.ok(typeof parsed.total === 'number');
  assert.ok(typeof parsed.complete === 'number');
  assert.ok(Array.isArray(parsed.skills));
});

test('skills-health.js: --panel inventory', () => {
  const r = spawnSync(process.execPath, [scriptPath, '--panel', 'inventory'], {
    encoding: 'utf8',
    timeout: 15000,
    env: { ...process.env, SCC_PLUGIN_ROOT: pluginRoot },
  });
  assert.strictEqual(r.status, 0);
  assert.ok(r.stdout.includes('Inventory'));
});

console.log(`\nskills-health.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
