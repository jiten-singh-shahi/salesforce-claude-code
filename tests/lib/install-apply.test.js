#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const scriptPath = path.join(pluginRoot, 'scripts', 'cli', 'install-apply.js');

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

function run(args = [], opts = {}) {
  return execFileSync(process.execPath, [scriptPath, ...args], {
    encoding: 'utf8',
    env: { ...process.env, SCC_PLUGIN_ROOT: pluginRoot },
    timeout: 30000,
    ...opts,
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

test('install-apply.js: script exists', () => {
  assert.ok(fs.existsSync(scriptPath), 'install-apply.js not found');
});

// ── Help flag ──

test('install-apply.js: --help prints usage and exits 0', () => {
  const output = run(['--help']);
  assert.ok(output.includes('scc install'), 'Should print usage');
  assert.ok(output.includes('--profile'), 'Should mention --profile option');
  assert.ok(output.includes('--dry-run'), 'Should mention --dry-run option');
});

test('install-apply.js: -h prints usage', () => {
  const output = run(['-h']);
  assert.ok(output.includes('scc install'), 'Should print usage');
});

// ── Dry run ──

test('install-apply.js: --dry-run with default profile completes', () => {
  const output = run(['--dry-run']);
  assert.ok(typeof output === 'string', 'Should produce output');
});

test('install-apply.js: apex shorthand with --dry-run', () => {
  const output = run(['apex', '--dry-run']);
  assert.ok(typeof output === 'string', 'Should produce output');
});

test('install-apply.js: lwc shorthand with --dry-run', () => {
  const output = run(['lwc', '--dry-run']);
  assert.ok(typeof output === 'string', 'Should produce output');
});

test('install-apply.js: all shorthand with --dry-run', () => {
  const output = run(['all', '--dry-run']);
  assert.ok(typeof output === 'string', 'Should produce output');
});

test('install-apply.js: --profile lwc --dry-run', () => {
  const output = run(['--profile', 'lwc', '--dry-run']);
  assert.ok(typeof output === 'string', 'Should produce output');
});

// ── Invalid args ──

test('install-apply.js: --profile invalid exits non-zero', () => {
  const { exitCode } = runExpectFail(['--profile', 'nonexistent', '--dry-run']);
  assert.ok(exitCode !== 0, 'Should exit with non-zero for invalid profile');
});

test('install-apply.js: --target invalid exits non-zero', () => {
  const { exitCode } = runExpectFail(['--target', 'nonexistent', '--dry-run']);
  assert.ok(exitCode !== 0, 'Should exit with non-zero for invalid target');
});

test('install-apply.js: unknown positional arg exits non-zero', () => {
  const { exitCode } = runExpectFail(['bogus-arg']);
  assert.ok(exitCode !== 0, 'Should exit with non-zero for unknown arg');
});

// ── Target flag ──

test('install-apply.js: --target claude --dry-run', () => {
  const output = run(['--target', 'claude', '--dry-run']);
  assert.ok(typeof output === 'string', 'Should produce output');
});

console.log(`\ninstall-apply.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
