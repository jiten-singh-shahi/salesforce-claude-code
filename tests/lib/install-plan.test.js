#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const scriptPath = path.join(pluginRoot, 'scripts', 'dev', 'install-plan.js');

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

function run(args = []) {
  return execFileSync(process.execPath, [scriptPath, ...args], {
    encoding: 'utf8',
    env: { ...process.env, SCC_PLUGIN_ROOT: pluginRoot },
    timeout: 30000,
    maxBuffer: 10 * 1024 * 1024,
  });
}

function runExpectFail(args = []) {
  try {
    run(args);
    return { exitCode: 0, stderr: '' };
  } catch (err) {
    return { exitCode: err.status, stderr: err.stderr || '' };
  }
}

// ── File existence ──

test('install-plan.js: script exists', () => {
  assert.ok(fs.existsSync(scriptPath), 'install-plan.js not found');
});

// ── Help flag ──

test('install-plan.js: --help prints usage and exits 0', () => {
  const output = run(['--help']);
  assert.ok(output.includes('scc plan'), 'Should print usage');
  assert.ok(output.includes('--profile'), 'Should mention --profile');
  assert.ok(output.includes('--json'), 'Should mention --json');
});

test('install-plan.js: -h prints usage', () => {
  const output = run(['-h']);
  assert.ok(output.includes('scc plan'), 'Should print usage');
});

// ── Human-readable output ──

test('install-plan.js: default args produce plan output', () => {
  const output = run([]);
  assert.ok(output.includes('SCC Install Plan'), 'Should show plan header');
  assert.ok(output.includes('Profile'), 'Should show profile');
  assert.ok(output.includes('Target'), 'Should show target');
  assert.ok(output.includes('Modules'), 'Should show module count');
  assert.ok(output.includes('Total:'), 'Should show total line');
});

test('install-plan.js: --profile apex shows plan', () => {
  const output = run(['--profile', 'apex']);
  assert.ok(output.includes('apex'), 'Should mention apex profile');
  assert.ok(output.includes('Total:'), 'Should show total');
});

test('install-plan.js: --profile core shows plan', () => {
  const output = run(['--profile', 'apex']);
  assert.ok(output.includes('apex'), 'Should mention core profile');
});

// ── JSON output ──

test('install-plan.js: --json produces valid JSON', () => {
  const output = run(['--json', '--profile', 'apex']);
  const parsed = JSON.parse(output);
  assert.ok(parsed, 'Should be valid JSON');
});

test('install-plan.js: --json output has expected fields', () => {
  const output = run(['--json', '--profile', 'apex']);
  const parsed = JSON.parse(output);
  assert.strictEqual(parsed.profile, 'apex', 'Profile should be core');
  assert.strictEqual(parsed.target, 'claude', 'Default target should be claude');
  assert.ok(typeof parsed.totalFiles === 'number', 'totalFiles should be a number');
  assert.ok(typeof parsed.missingFiles === 'number', 'missingFiles should be a number');
  assert.ok(Array.isArray(parsed.modules), 'modules should be an array');
});

test('install-plan.js: --json --profile apex', () => {
  const output = run(['--json', '--profile', 'apex']);
  const parsed = JSON.parse(output);
  assert.strictEqual(parsed.profile, 'apex', 'Should use apex profile');
  assert.ok(parsed.modules.length > 0, 'Should have modules');
});

// ── Invalid args ──

test('install-plan.js: --profile invalid exits non-zero', () => {
  const { exitCode } = runExpectFail(['--profile', 'nonexistent']);
  assert.ok(exitCode !== 0, 'Should exit with non-zero for invalid profile');
});

test('install-plan.js: --target invalid exits non-zero', () => {
  const { exitCode } = runExpectFail(['--target', 'nonexistent']);
  assert.ok(exitCode !== 0, 'Should exit with non-zero for invalid target');
});

console.log(`\ninstall-plan.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
