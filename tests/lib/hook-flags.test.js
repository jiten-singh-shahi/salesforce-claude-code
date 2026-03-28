#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const hookFlagsPath = path.join(pluginRoot, 'scripts', 'lib', 'hook-flags.js');

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

test('hook-flags.js: module exists', () => {
  assert.ok(fs.existsSync(hookFlagsPath), 'hook-flags.js not found');
});

const hookFlags = require(hookFlagsPath);

test('hook-flags.js: exports expected functions', () => {
  assert.ok(typeof hookFlags.getHookProfile === 'function', 'Should export getHookProfile');
  assert.ok(typeof hookFlags.getDisabledHookIds === 'function', 'Should export getDisabledHookIds');
  assert.ok(typeof hookFlags.parseProfiles === 'function', 'Should export parseProfiles');
  assert.ok(typeof hookFlags.isHookEnabled === 'function', 'Should export isHookEnabled');
  assert.ok(typeof hookFlags.normalizeId === 'function', 'Should export normalizeId');
});

test('hook-flags.js: exports VALID_PROFILES set', () => {
  assert.ok(hookFlags.VALID_PROFILES instanceof Set, 'Should export VALID_PROFILES as Set');
  assert.ok(hookFlags.VALID_PROFILES.has('minimal'), 'Should include minimal');
  assert.ok(hookFlags.VALID_PROFILES.has('standard'), 'Should include standard');
  assert.ok(hookFlags.VALID_PROFILES.has('strict'), 'Should include strict');
  assert.strictEqual(hookFlags.VALID_PROFILES.size, 3, 'Should have exactly 3 profiles');
});

test('hook-flags.js: normalizeId trims and lowercases', () => {
  assert.strictEqual(hookFlags.normalizeId('  HELLO  '), 'hello');
  assert.strictEqual(hookFlags.normalizeId('MixedCase'), 'mixedcase');
  assert.strictEqual(hookFlags.normalizeId(''), '');
  assert.strictEqual(hookFlags.normalizeId(null), '');
  assert.strictEqual(hookFlags.normalizeId(undefined), '');
});

test('hook-flags.js: getHookProfile defaults to standard', () => {
  const origProfile = process.env.SCC_HOOK_PROFILE;
  delete process.env.SCC_HOOK_PROFILE;
  try {
    assert.strictEqual(hookFlags.getHookProfile(), 'standard');
  } finally {
    if (origProfile !== undefined) process.env.SCC_HOOK_PROFILE = origProfile;
  }
});

test('hook-flags.js: getHookProfile reads SCC_HOOK_PROFILE', () => {
  const origProfile = process.env.SCC_HOOK_PROFILE;
  try {
    process.env.SCC_HOOK_PROFILE = 'strict';
    assert.strictEqual(hookFlags.getHookProfile(), 'strict');
    process.env.SCC_HOOK_PROFILE = 'minimal';
    assert.strictEqual(hookFlags.getHookProfile(), 'minimal');
  } finally {
    if (origProfile !== undefined) {
      process.env.SCC_HOOK_PROFILE = origProfile;
    } else {
      delete process.env.SCC_HOOK_PROFILE;
    }
  }
});

test('hook-flags.js: getHookProfile falls back on invalid value', () => {
  const origProfile = process.env.SCC_HOOK_PROFILE;
  try {
    process.env.SCC_HOOK_PROFILE = 'invalid';
    assert.strictEqual(hookFlags.getHookProfile(), 'standard');
  } finally {
    if (origProfile !== undefined) {
      process.env.SCC_HOOK_PROFILE = origProfile;
    } else {
      delete process.env.SCC_HOOK_PROFILE;
    }
  }
});

test('hook-flags.js: getDisabledHookIds parses comma-separated list', () => {
  const origDisabled = process.env.SCC_DISABLED_HOOKS;
  try {
    process.env.SCC_DISABLED_HOOKS = 'hookA, hookB, hookC';
    const disabled = hookFlags.getDisabledHookIds();
    assert.ok(disabled instanceof Set, 'Should return a Set');
    assert.ok(disabled.has('hooka'), 'Should include hookA (lowercased)');
    assert.ok(disabled.has('hookb'), 'Should include hookB (lowercased)');
    assert.ok(disabled.has('hookc'), 'Should include hookC (lowercased)');
    assert.strictEqual(disabled.size, 3, 'Should have 3 items');
  } finally {
    if (origDisabled !== undefined) {
      process.env.SCC_DISABLED_HOOKS = origDisabled;
    } else {
      delete process.env.SCC_DISABLED_HOOKS;
    }
  }
});

test('hook-flags.js: getDisabledHookIds returns empty set when unset', () => {
  const origDisabled = process.env.SCC_DISABLED_HOOKS;
  delete process.env.SCC_DISABLED_HOOKS;
  try {
    const disabled = hookFlags.getDisabledHookIds();
    assert.strictEqual(disabled.size, 0, 'Should return empty set');
  } finally {
    if (origDisabled !== undefined) process.env.SCC_DISABLED_HOOKS = origDisabled;
  }
});

test('hook-flags.js: parseProfiles with array input', () => {
  const result = hookFlags.parseProfiles(['standard', 'strict']);
  assert.deepStrictEqual(result, ['standard', 'strict']);
});

test('hook-flags.js: parseProfiles with string input', () => {
  const result = hookFlags.parseProfiles('standard,strict');
  assert.deepStrictEqual(result, ['standard', 'strict']);
});

test('hook-flags.js: parseProfiles with null falls back to default', () => {
  const result = hookFlags.parseProfiles(null);
  assert.deepStrictEqual(result, ['standard', 'strict']);
});

test('hook-flags.js: parseProfiles filters invalid values', () => {
  const result = hookFlags.parseProfiles(['standard', 'bogus', 'strict']);
  assert.deepStrictEqual(result, ['standard', 'strict']);
});

test('hook-flags.js: isHookEnabled returns true for allowed profile', () => {
  const origProfile = process.env.SCC_HOOK_PROFILE;
  const origDisabled = process.env.SCC_DISABLED_HOOKS;
  try {
    process.env.SCC_HOOK_PROFILE = 'standard';
    delete process.env.SCC_DISABLED_HOOKS;
    assert.strictEqual(hookFlags.isHookEnabled('test-hook'), true);
  } finally {
    if (origProfile !== undefined) process.env.SCC_HOOK_PROFILE = origProfile;
    else delete process.env.SCC_HOOK_PROFILE;
    if (origDisabled !== undefined) process.env.SCC_DISABLED_HOOKS = origDisabled;
  }
});

test('hook-flags.js: isHookEnabled returns false for disabled hook', () => {
  const origProfile = process.env.SCC_HOOK_PROFILE;
  const origDisabled = process.env.SCC_DISABLED_HOOKS;
  try {
    process.env.SCC_HOOK_PROFILE = 'standard';
    process.env.SCC_DISABLED_HOOKS = 'test-hook';
    assert.strictEqual(hookFlags.isHookEnabled('test-hook'), false);
  } finally {
    if (origProfile !== undefined) process.env.SCC_HOOK_PROFILE = origProfile;
    else delete process.env.SCC_HOOK_PROFILE;
    if (origDisabled !== undefined) process.env.SCC_DISABLED_HOOKS = origDisabled;
    else delete process.env.SCC_DISABLED_HOOKS;
  }
});

test('hook-flags.js: isHookEnabled returns false for excluded profile', () => {
  const origProfile = process.env.SCC_HOOK_PROFILE;
  const origDisabled = process.env.SCC_DISABLED_HOOKS;
  try {
    process.env.SCC_HOOK_PROFILE = 'minimal';
    delete process.env.SCC_DISABLED_HOOKS;
    // Default allowed profiles are ['standard', 'strict'], so minimal should be excluded
    assert.strictEqual(hookFlags.isHookEnabled('test-hook'), false);
  } finally {
    if (origProfile !== undefined) process.env.SCC_HOOK_PROFILE = origProfile;
    else delete process.env.SCC_HOOK_PROFILE;
    if (origDisabled !== undefined) process.env.SCC_DISABLED_HOOKS = origDisabled;
  }
});

test('hook-flags.js: isHookEnabled with custom profiles option', () => {
  const origProfile = process.env.SCC_HOOK_PROFILE;
  const origDisabled = process.env.SCC_DISABLED_HOOKS;
  try {
    process.env.SCC_HOOK_PROFILE = 'minimal';
    delete process.env.SCC_DISABLED_HOOKS;
    assert.strictEqual(
      hookFlags.isHookEnabled('test-hook', { profiles: ['minimal', 'standard', 'strict'] }),
      true,
      'Should be enabled when minimal is in allowed profiles'
    );
  } finally {
    if (origProfile !== undefined) process.env.SCC_HOOK_PROFILE = origProfile;
    else delete process.env.SCC_HOOK_PROFILE;
    if (origDisabled !== undefined) process.env.SCC_DISABLED_HOOKS = origDisabled;
  }
});

console.log(`\nhook-flags.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
