#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const scriptPath = path.join(pluginRoot, 'scripts', 'hooks', 'check-hook-enabled.js');

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

function runScript(args = [], envOverrides = {}) {
  const baseEnv = { ...process.env };
  delete baseEnv.SCC_HOOK_PROFILE;
  delete baseEnv.SCC_DISABLED_HOOKS;
  const env = { ...baseEnv, ...envOverrides };

  const result = spawnSync('node', [scriptPath, ...args], {
    encoding: 'utf8',
    timeout: 10000,
    env,
  });
  return { stdout: result.stdout || '', stderr: result.stderr || '', exitCode: result.status };
}

// --- File existence ---
test('check-hook-enabled.js: script exists', () => {
  assert.ok(fs.existsSync(scriptPath), 'check-hook-enabled.js not found');
});

// --- No arguments: defaults to "yes" ---
test('returns "yes" when no hookId provided', () => {
  const result = runScript([]);
  assert.strictEqual(result.stdout, 'yes', 'Should return yes when no hookId given');
  assert.strictEqual(result.exitCode, 0);
});

// --- Standard profile (default) with standard,strict profiles ---
test('returns "yes" for hook in standard profile (default)', () => {
  const result = runScript(['my-hook', 'standard,strict']);
  assert.strictEqual(result.stdout, 'yes', 'standard profile should match standard,strict');
});

// --- Strict profile ---
test('returns "yes" for hook in strict profile when profile is strict', () => {
  const result = runScript(['my-hook', 'strict'], { SCC_HOOK_PROFILE: 'strict' });
  assert.strictEqual(result.stdout, 'yes', 'strict profile should match strict');
});

test('returns "no" for strict-only hook when profile is standard', () => {
  const result = runScript(['my-hook', 'strict']);
  assert.strictEqual(result.stdout, 'no', 'standard profile should not match strict-only');
});

// --- Minimal profile ---
test('returns "yes" for hook in minimal profile when profile is minimal', () => {
  const result = runScript(['my-hook', 'minimal'], { SCC_HOOK_PROFILE: 'minimal' });
  assert.strictEqual(result.stdout, 'yes', 'minimal profile should match minimal');
});

test('returns "no" for standard,strict hook when profile is minimal', () => {
  const result = runScript(['my-hook', 'standard,strict'], { SCC_HOOK_PROFILE: 'minimal' });
  assert.strictEqual(result.stdout, 'no', 'minimal profile should not match standard,strict');
});

// --- Disabled hooks ---
test('returns "no" when hook is explicitly disabled', () => {
  const result = runScript(['my-hook', 'standard,strict'], { SCC_DISABLED_HOOKS: 'my-hook' });
  assert.strictEqual(result.stdout, 'no', 'Should return no when hook is disabled');
});

test('returns "no" when hook is in disabled list among others', () => {
  const result = runScript(['my-hook', 'standard,strict'], { SCC_DISABLED_HOOKS: 'other-hook,my-hook,another' });
  assert.strictEqual(result.stdout, 'no', 'Should return no when in disabled list');
});

test('returns "yes" when different hook is disabled', () => {
  const result = runScript(['my-hook', 'standard,strict'], { SCC_DISABLED_HOOKS: 'other-hook' });
  assert.strictEqual(result.stdout, 'yes', 'Should return yes when different hook is disabled');
});

// --- Invalid profile falls back to standard ---
test('falls back to standard for invalid profile', () => {
  const result = runScript(['my-hook', 'standard,strict'], { SCC_HOOK_PROFILE: 'invalid-profile' });
  assert.strictEqual(result.stdout, 'yes', 'Invalid profile should fall back to standard');
});

// --- No profiles CSV provided (defaults to standard,strict) ---
test('returns "yes" with no profiles CSV for standard profile', () => {
  const result = runScript(['my-hook']);
  assert.strictEqual(result.stdout, 'yes', 'Default profiles should include standard');
});

console.log(`\ncheck-hook-enabled.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
