#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const hookPath = path.join(pluginRoot, 'scripts', 'hooks', 'sfdx-scanner-check.js');

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

test('sfdx-scanner-check.js: module exists', () => {
  assert.ok(fs.existsSync(hookPath), 'sfdx-scanner-check.js not found');
});

if (fs.existsSync(hookPath)) {
  const hook = require(hookPath);

  test('sfdx-scanner-check.js: exports run function', () => {
    assert.ok(typeof hook.run === 'function', 'Should export run()');
  });

  test('sfdx-scanner-check.js: handles empty input gracefully', () => {
    const result = hook.run('{}');
    assert.ok(typeof result === 'string');
  });

  test('sfdx-scanner-check.js: handles invalid JSON gracefully', () => {
    const result = hook.run('not json');
    assert.ok(typeof result === 'string');
  });

  test('sfdx-scanner-check.js: ignores non-push/deploy commands', () => {
    const input = JSON.stringify({ tool_input: { command: 'ls -la' } });
    const result = hook.run(input);
    assert.ok(typeof result === 'string');
    assert.strictEqual(result, input);
  });

  test('sfdx-scanner-check.js: ignores git status (not push)', () => {
    const input = JSON.stringify({ tool_input: { command: 'git status' } });
    const result = hook.run(input);
    assert.strictEqual(result, input);
  });

  test('sfdx-scanner-check.js: returns input passthrough on git push (scanner likely not installed in test)', () => {
    // In test env, sf scanner is likely not installed, so graceful degradation
    const input = JSON.stringify({ tool_input: { command: 'git push origin main' } });
    const result = hook.run(input);
    assert.ok(typeof result === 'string', 'Should return string');
    // Should not throw, should return the input
    assert.strictEqual(result, input);
  });

  test('sfdx-scanner-check.js: returns input passthrough on sf deploy (scanner likely not installed in test)', () => {
    const input = JSON.stringify({ tool_input: { command: 'sf project deploy start --target-org myorg' } });
    const result = hook.run(input);
    assert.ok(typeof result === 'string', 'Should return string');
    assert.strictEqual(result, input);
  });
}

console.log(`\nsfdx-scanner-check.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
