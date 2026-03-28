#!/usr/bin/env node
'use strict';

/**
 * utils.test.js — Unit tests for scripts/lib/utils.js
 *
 * Uses Node.js built-in assert module (no external test frameworks).
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { parseFrontmatter, fileExists, readJson, ensureDir, copyFile, simpleHash, listFilesRecursive } = require('../../scripts/lib/utils');

// ── Test harness ──────────────────────────────────────────────────────────────

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

// ── parseFrontmatter tests ─────────────────────────────────────────────────────

test('parseFrontmatter: parses basic key-value frontmatter', () => {
  const content = `---\nname: my-agent\ndescription: Does stuff\n---\n# Body\n\nHello world`;
  const { frontmatter, body } = parseFrontmatter(content);
  assert.strictEqual(frontmatter.name, 'my-agent');
  assert.strictEqual(frontmatter.description, 'Does stuff');
  assert.ok(body.includes('Hello world'));
});

test('parseFrontmatter: parses array field (tools)', () => {
  const content = `---\nname: agent\ntools: ["Read", "Write", "Bash"]\n---\nBody here`;
  const { frontmatter } = parseFrontmatter(content);
  assert.ok(Array.isArray(frontmatter.tools), 'tools should be an array');
  assert.strictEqual(frontmatter.tools.length, 3);
  assert.ok(frontmatter.tools.includes('Read'));
  assert.ok(frontmatter.tools.includes('Bash'));
});

test('parseFrontmatter: returns empty frontmatter for content without frontmatter', () => {
  const content = '# Just a heading\n\nSome content here.';
  const { frontmatter, body } = parseFrontmatter(content);
  assert.deepStrictEqual(frontmatter, {});
  assert.strictEqual(body, content);
});

test('parseFrontmatter: strips quotes from string values', () => {
  const content = `---\nname: "quoted-name"\ndescription: 'single-quoted'\n---\nbody`;
  const { frontmatter } = parseFrontmatter(content);
  assert.strictEqual(frontmatter.name, 'quoted-name');
  assert.strictEqual(frontmatter.description, 'single-quoted');
});

test('parseFrontmatter: handles multiple frontmatter fields', () => {
  const content = `---\nname: sf-apex-reviewer\ndescription: Reviews Apex code quality\nmodel: sonnet\norigin: SCC\n---\n# Apex Reviewer`;
  const { frontmatter } = parseFrontmatter(content);
  assert.strictEqual(frontmatter.name, 'sf-apex-reviewer');
  assert.strictEqual(frontmatter.model, 'sonnet');
  assert.strictEqual(frontmatter.origin, 'SCC');
});

test('parseFrontmatter: body contains content after frontmatter separator', () => {
  const content = `---\nkey: value\n---\nFirst line\nSecond line`;
  const { body } = parseFrontmatter(content);
  assert.ok(body.startsWith('First line'));
  assert.ok(body.includes('Second line'));
});

test('parseFrontmatter: handles empty body after frontmatter', () => {
  const content = `---\nname: test\n---\n`;
  const { frontmatter, body } = parseFrontmatter(content);
  assert.strictEqual(frontmatter.name, 'test');
  assert.strictEqual(body, '');
});

test('parseFrontmatter: handles colon in value', () => {
  const content = `---\ndescription: Does this: and that\n---\nbody`;
  const { frontmatter } = parseFrontmatter(content);
  // Value should include everything after the first colon
  assert.ok(frontmatter.description.includes('Does this'));
});

// ── fileExists tests ──────────────────────────────────────────────────────────

test('fileExists: returns true for a file that exists', () => {
  const tmpFile = path.join(os.tmpdir(), `scc-test-${Date.now()}.txt`);
  fs.writeFileSync(tmpFile, 'hello');
  try {
    assert.strictEqual(fileExists(tmpFile), true);
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

test('fileExists: returns false for a file that does not exist', () => {
  const nonExistent = path.join(os.tmpdir(), `scc-nonexistent-${Date.now()}.txt`);
  assert.strictEqual(fileExists(nonExistent), false);
});

test('fileExists: returns true for a directory', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-test-'));
  try {
    assert.strictEqual(fileExists(tmpDir), true);
  } finally {
    fs.rmdirSync(tmpDir);
  }
});

// ── readJson tests ────────────────────────────────────────────────────────────

test('readJson: parses valid JSON file', () => {
  const tmpFile = path.join(os.tmpdir(), `scc-json-${Date.now()}.json`);
  const data = { name: 'test', version: '1.0.0', items: [1, 2, 3] };
  fs.writeFileSync(tmpFile, JSON.stringify(data));
  try {
    const result = readJson(tmpFile);
    assert.deepStrictEqual(result, data);
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

test('readJson: returns null for non-existent file', () => {
  const result = readJson(path.join(os.tmpdir(), `scc-missing-${Date.now()}.json`));
  assert.strictEqual(result, null);
});

test('readJson: returns null for invalid JSON', () => {
  const tmpFile = path.join(os.tmpdir(), `scc-bad-json-${Date.now()}.json`);
  fs.writeFileSync(tmpFile, '{ invalid json }');
  try {
    const result = readJson(tmpFile);
    assert.strictEqual(result, null);
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

test('readJson: handles nested objects and arrays', () => {
  const tmpFile = path.join(os.tmpdir(), `scc-nested-${Date.now()}.json`);
  const data = { profiles: { core: { modules: ['base'] }, full: { extends: ['core'], modules: [] } } };
  fs.writeFileSync(tmpFile, JSON.stringify(data));
  try {
    const result = readJson(tmpFile);
    assert.ok(Array.isArray(result.profiles.core.modules));
    assert.strictEqual(result.profiles.core.modules[0], 'base');
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

// ── ensureDir tests ───────────────────────────────────────────────────────────

test('ensureDir: creates directory and parents', () => {
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-dir-'));
  const deepDir = path.join(tmpBase, 'a', 'b', 'c');
  try {
    ensureDir(deepDir);
    assert.ok(fs.existsSync(deepDir));
  } finally {
    fs.rmSync(tmpBase, { recursive: true });
  }
});

test('ensureDir: is idempotent (does not error if dir exists)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-existing-'));
  try {
    assert.doesNotThrow(() => ensureDir(tmpDir));
    assert.doesNotThrow(() => ensureDir(tmpDir));
  } finally {
    fs.rmdirSync(tmpDir);
  }
});

// ── copyFile tests ────────────────────────────────────────────────────────────

test('copyFile: copies file and creates destination directory', () => {
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-copy-'));
  const srcFile = path.join(tmpBase, 'src.txt');
  const destFile = path.join(tmpBase, 'subdir', 'dest.txt');
  const content = 'test content for copy';
  fs.writeFileSync(srcFile, content);
  try {
    copyFile(srcFile, destFile);
    assert.ok(fs.existsSync(destFile));
    assert.strictEqual(fs.readFileSync(destFile, 'utf8'), content);
  } finally {
    fs.rmSync(tmpBase, { recursive: true });
  }
});

// ── simpleHash tests ──────────────────────────────────────────────────────────

test('simpleHash: returns a hex string for an existing file', () => {
  const tmpFile = path.join(os.tmpdir(), `scc-hash-${Date.now()}.txt`);
  fs.writeFileSync(tmpFile, 'hash me please');
  try {
    const hash = simpleHash(tmpFile);
    assert.ok(typeof hash === 'string');
    assert.ok(/^[0-9a-f]+$/.test(hash), `Hash "${hash}" should be hex string`);
    assert.strictEqual(hash.length, 8);
  } finally {
    fs.unlinkSync(tmpFile);
  }
});

test('simpleHash: same content produces same hash', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-hash2-'));
  const f1 = path.join(tmpDir, 'a.txt');
  const f2 = path.join(tmpDir, 'b.txt');
  fs.writeFileSync(f1, 'identical content');
  fs.writeFileSync(f2, 'identical content');
  try {
    assert.strictEqual(simpleHash(f1), simpleHash(f2));
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('simpleHash: different content produces different hash', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-hash3-'));
  const f1 = path.join(tmpDir, 'a.txt');
  const f2 = path.join(tmpDir, 'b.txt');
  fs.writeFileSync(f1, 'content A');
  fs.writeFileSync(f2, 'content B - very different');
  try {
    assert.notStrictEqual(simpleHash(f1), simpleHash(f2));
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('simpleHash: returns null for non-existent file', () => {
  const result = simpleHash(path.join(os.tmpdir(), `scc-no-file-${Date.now()}.txt`));
  assert.strictEqual(result, null);
});

// ── listFilesRecursive tests ──────────────────────────────────────────────────

test('listFilesRecursive: returns all files in nested directories', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-list-'));
  fs.writeFileSync(path.join(tmpDir, 'a.txt'), 'a');
  fs.mkdirSync(path.join(tmpDir, 'sub'));
  fs.writeFileSync(path.join(tmpDir, 'sub', 'b.txt'), 'b');
  fs.writeFileSync(path.join(tmpDir, 'sub', 'c.txt'), 'c');
  try {
    const files = listFilesRecursive(tmpDir);
    assert.strictEqual(files.length, 3);
    assert.ok(files.some(f => f.endsWith('a.txt')));
    assert.ok(files.some(f => f.endsWith('b.txt')));
    assert.ok(files.some(f => f.endsWith('c.txt')));
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('listFilesRecursive: returns empty array for non-existent directory', () => {
  const result = listFilesRecursive(path.join(os.tmpdir(), `scc-no-dir-${Date.now()}`));
  assert.deepStrictEqual(result, []);
});

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\nutils.test.js: ${passCount} passed, ${failCount} failed`);

if (failCount > 0) {
  process.exit(1);
}
