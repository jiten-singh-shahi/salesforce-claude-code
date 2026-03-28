#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const scriptPath = path.join(pluginRoot, 'scripts', 'hooks', 'post-edit-typecheck.js');

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

test('post-edit-typecheck.js: script exists', () => {
  assert.ok(fs.existsSync(scriptPath), 'post-edit-typecheck.js not found');
});

test('post-edit-typecheck.js: exports run function', () => {
  const mod = require(scriptPath);
  assert.ok(typeof mod.run === 'function', 'Should export run()');
});

test('post-edit-typecheck.js: run returns input unchanged on empty input', () => {
  const mod = require(scriptPath);
  const input = '{}';
  const result = mod.run(input);
  assert.strictEqual(result, input, 'Should return input unchanged');
});

test('post-edit-typecheck.js: run returns input unchanged on invalid JSON', () => {
  const mod = require(scriptPath);
  const input = 'not json';
  const result = mod.run(input);
  assert.strictEqual(result, input, 'Should return input unchanged on invalid JSON');
});

test('post-edit-typecheck.js: handles TS files', () => {
  const content = fs.readFileSync(scriptPath, 'utf8');
  assert.ok(content.includes('.ts'), 'Should handle .ts');
  assert.ok(content.includes('.tsx'), 'Should handle .tsx');
  assert.ok(content.includes('tsc'), 'Should run tsc');
  assert.ok(content.includes('--noEmit'), 'Should use --noEmit flag');
});

test('post-edit-typecheck.js: validates LWC structure', () => {
  const content = fs.readFileSync(scriptPath, 'utf8');
  assert.ok(content.includes('/lwc/'), 'Should detect LWC files');
  assert.ok(content.includes('export default class'), 'Should check for default class export');
  assert.ok(content.includes('LightningElement'), 'Should check for LightningElement extension');
});

test('post-edit-typecheck.js: detects missing default export in LWC', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-typecheck-'));
  const lwcDir = path.join(tmpDir, 'lwc', 'myComp');
  fs.mkdirSync(lwcDir, { recursive: true });
  const lwcFile = path.join(lwcDir, 'myComp.js');
  fs.writeFileSync(lwcFile, 'import { LightningElement } from "lwc";\nconst x = 1;\n');

  try {
    const mod = require(scriptPath);
    // Capture stderr
    const origStderrWrite = process.stderr.write;
    let stderrOutput = '';
    process.stderr.write = (chunk) => { stderrOutput += chunk; return true; };
    try {
      mod.run(JSON.stringify({ tool_input: { file_path: lwcFile } }));
    } finally {
      process.stderr.write = origStderrWrite;
    }
    assert.ok(stderrOutput.includes('Missing default class export'), 'Should detect missing default export');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('post-edit-typecheck.js: detects missing LightningElement', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-typecheck-'));
  const lwcDir = path.join(tmpDir, 'lwc', 'myComp');
  fs.mkdirSync(lwcDir, { recursive: true });
  const lwcFile = path.join(lwcDir, 'myComp.js');
  fs.writeFileSync(lwcFile, 'export default class MyComp {\n  connectedCallback() {}\n}\n');

  try {
    const mod = require(scriptPath);
    const origStderrWrite = process.stderr.write;
    let stderrOutput = '';
    process.stderr.write = (chunk) => { stderrOutput += chunk; return true; };
    try {
      mod.run(JSON.stringify({ tool_input: { file_path: lwcFile } }));
    } finally {
      process.stderr.write = origStderrWrite;
    }
    assert.ok(stderrOutput.includes('LightningElement'), 'Should detect missing LightningElement');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('post-edit-typecheck.js: passes valid LWC file', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-typecheck-'));
  const lwcDir = path.join(tmpDir, 'lwc', 'myComp');
  fs.mkdirSync(lwcDir, { recursive: true });
  const lwcFile = path.join(lwcDir, 'myComp.js');
  fs.writeFileSync(lwcFile, 'import { LightningElement } from "lwc";\nexport default class MyComp extends LightningElement {}\n');

  try {
    const mod = require(scriptPath);
    const origStderrWrite = process.stderr.write;
    let stderrOutput = '';
    process.stderr.write = (chunk) => { stderrOutput += chunk; return true; };
    try {
      mod.run(JSON.stringify({ tool_input: { file_path: lwcFile } }));
    } finally {
      process.stderr.write = origStderrWrite;
    }
    assert.ok(!stderrOutput.includes('issues'), 'Should not report issues for valid LWC');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('post-edit-typecheck.js: has 30-second timeout', () => {
  const content = fs.readFileSync(scriptPath, 'utf8');
  assert.ok(content.includes('30000'), 'Should have 30s timeout');
});

console.log(`\npost-edit-typecheck.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
