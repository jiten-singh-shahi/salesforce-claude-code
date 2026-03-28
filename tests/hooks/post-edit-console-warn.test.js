#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const scriptPath = path.join(pluginRoot, 'scripts', 'hooks', 'post-edit-console-warn.js');

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

function runScript(input) {
  const result = spawnSync('node', [scriptPath], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    timeout: 10000,
  });
  return { stdout: result.stdout || '', stderr: result.stderr || '', exitCode: result.status };
}

test('post-edit-console-warn.js: script exists', () => {
  assert.ok(fs.existsSync(scriptPath), 'post-edit-console-warn.js not found');
});

test('post-edit-console-warn.js: warns about console.log in JS file', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-cw-'));
  const jsFile = path.join(tmpDir, 'component.js');
  fs.writeFileSync(jsFile, 'console.log("debug");\nconst x = 1;\n');

  try {
    const input = { tool_input: { file_path: jsFile } };
    const result = runScript(input);
    assert.ok(result.stderr.includes('WARNING'), 'Should warn about console.log');
    assert.ok(result.stderr.includes('console.log'), 'Should mention console.log');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('post-edit-console-warn.js: no warning for clean JS file', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-cw2-'));
  const jsFile = path.join(tmpDir, 'clean.js');
  fs.writeFileSync(jsFile, 'const x = 1;\nconst y = 2;\n');

  try {
    const input = { tool_input: { file_path: jsFile } };
    const result = runScript(input);
    assert.ok(!result.stderr.includes('WARNING'), 'Should not warn for clean file');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('post-edit-console-warn.js: ignores non-JS files', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-cw3-'));
  const clsFile = path.join(tmpDir, 'MyClass.cls');
  fs.writeFileSync(clsFile, 'public class MyClass { }');

  try {
    const input = { tool_input: { file_path: clsFile } };
    const result = runScript(input);
    assert.ok(!result.stderr.includes('WARNING'), 'Should not check Apex files');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('post-edit-console-warn.js: passes through input', () => {
  const input = { tool_input: { file_path: '/nonexistent/file.md' } };
  const result = runScript(input);
  assert.strictEqual(result.stdout, JSON.stringify(input), 'Should pass through stdin');
});

test('post-edit-console-warn.js: handles missing file gracefully', () => {
  const input = { tool_input: { file_path: '/nonexistent/file.js' } };
  const result = runScript(input);
  assert.ok(result.exitCode === 0, 'Should not crash on missing file');
});

console.log(`\npost-edit-console-warn.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
