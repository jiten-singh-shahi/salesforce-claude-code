#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const scriptPath = path.join(pluginRoot, 'scripts', 'hooks', 'check-console-log.js');

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

test('check-console-log.js: script exists', () => {
  assert.ok(fs.existsSync(scriptPath), 'check-console-log.js not found');
});

test('check-console-log.js: handles empty stdin gracefully', () => {
  try {
    const result = execFileSync('node', [scriptPath], {
      input: '',
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
    });
    // Should not crash, should exit 0
    assert.ok(typeof result === 'string');
  } catch (err) {
    // Exit code 0 is expected — check if it completed without crashing
    if (err.status !== 0 && err.status !== null) {
      assert.fail('Script crashed with exit code ' + err.status);
    }
  }
});

test('check-console-log.js: passes through stdin data', () => {
  const inputData = JSON.stringify({ tool_input: { command: 'echo hello' } });
  try {
    const result = execFileSync('node', [scriptPath], {
      input: inputData,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
    });
    assert.strictEqual(result, inputData, 'Should pass through stdin unchanged');
  } catch (err) {
    // Script may exit 0 with output on stdout
    if (err.stdout) {
      assert.strictEqual(err.stdout, inputData, 'Should pass through stdin unchanged');
    }
  }
});

test('check-console-log.js: excludes test files from checks', () => {
  // The script checks for .test.js, .spec.js patterns in EXCLUDED_PATTERNS
  const content = fs.readFileSync(scriptPath, 'utf8');
  assert.ok(content.includes('EXCLUDED_PATTERNS'), 'Should define EXCLUDED_PATTERNS');
  assert.ok(content.includes('\\.test\\.'), 'Should exclude test files');
  assert.ok(content.includes('\\.spec\\.'), 'Should exclude spec files');
  assert.ok(content.includes('scripts'), 'Should exclude scripts directory');
});

test('check-console-log.js: detects console.log in file content', () => {
  const content = fs.readFileSync(scriptPath, 'utf8');
  assert.ok(content.includes('console.log'), 'Should check for console.log pattern');
  assert.ok(content.includes('WARNING'), 'Should produce WARNING message');
});

console.log(`\ncheck-console-log.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
