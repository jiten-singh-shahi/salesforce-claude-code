#!/usr/bin/env node
'use strict';

/**
 * install-config.test.js — Unit tests for scripts/lib/install-config.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { loadInstallConfig, resolveConfigPath } = require('../../scripts/lib/install-config');

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

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'scc-config-test-'));
}

function writeConfig(dir, data) {
  const filePath = path.join(dir, 'scc-install.json');
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  return filePath;
}

// ── loadInstallConfig tests ─────────────────────────────────────────────────

test('loadInstallConfig: loads valid minimal config', () => {
  const tmp = makeTmpDir();
  const configPath = writeConfig(tmp, { version: 1 });
  const config = loadInstallConfig(configPath);

  assert.strictEqual(config.version, 1);
  assert.strictEqual(config.target, null);
  assert.strictEqual(config.profile, null);
  assert.deepStrictEqual(config.modules, []);
  assert.deepStrictEqual(config.include, []);
  assert.deepStrictEqual(config.exclude, []);
  assert.deepStrictEqual(config.options, {});
  assert.ok(config.path.endsWith('scc-install.json'));

  fs.rmSync(tmp, { recursive: true, force: true });
});

test('loadInstallConfig: loads full config with all fields', () => {
  const tmp = makeTmpDir();
  const configPath = writeConfig(tmp, {
    version: 1,
    target: 'claude',
    profile: 'apex',
    modules: ['core', 'apex', 'security'],
    include: ['domain:soql'],
    exclude: ['feature:orchestration'],
    options: { verbose: true },
  });
  const config = loadInstallConfig(configPath);

  assert.strictEqual(config.target, 'claude');
  assert.strictEqual(config.profile, 'apex');
  assert.deepStrictEqual(config.modules, ['core', 'apex', 'security']);
  assert.deepStrictEqual(config.include, ['domain:soql']);
  assert.deepStrictEqual(config.exclude, ['feature:orchestration']);
  assert.deepStrictEqual(config.options, { verbose: true });

  fs.rmSync(tmp, { recursive: true, force: true });
});

test('loadInstallConfig: deduplicates arrays', () => {
  const tmp = makeTmpDir();
  const configPath = writeConfig(tmp, {
    version: 1,
    modules: ['core', 'apex', 'core', 'apex'],
    include: ['domain:soql', 'domain:soql'],
  });
  const config = loadInstallConfig(configPath);

  assert.deepStrictEqual(config.modules, ['core', 'apex']);
  assert.deepStrictEqual(config.include, ['domain:soql']);

  fs.rmSync(tmp, { recursive: true, force: true });
});

test('loadInstallConfig: throws for missing file', () => {
  assert.throws(() => {
    loadInstallConfig('/nonexistent/scc-install.json');
  }, /Install config not found/);
});

test('loadInstallConfig: throws for invalid JSON', () => {
  const tmp = makeTmpDir();
  const filePath = path.join(tmp, 'bad.json');
  fs.writeFileSync(filePath, 'not valid json');

  assert.throws(() => {
    loadInstallConfig(filePath);
  }, /Invalid JSON/);

  fs.rmSync(tmp, { recursive: true, force: true });
});

test('loadInstallConfig: rejects wrong version', () => {
  const tmp = makeTmpDir();
  const configPath = writeConfig(tmp, { version: 2 });

  assert.throws(() => {
    loadInstallConfig(configPath);
  }, /Invalid.*install config/);

  fs.rmSync(tmp, { recursive: true, force: true });
});

test('loadInstallConfig: rejects invalid target', () => {
  const tmp = makeTmpDir();
  const configPath = writeConfig(tmp, { version: 1, target: 'invalid-harness' });

  assert.throws(() => {
    loadInstallConfig(configPath);
  }, /Invalid.*install config/);

  fs.rmSync(tmp, { recursive: true, force: true });
});

test('loadInstallConfig: rejects additional properties', () => {
  const tmp = makeTmpDir();
  const configPath = writeConfig(tmp, { version: 1, unknownField: true });

  assert.throws(() => {
    loadInstallConfig(configPath);
  }, /Invalid.*install config/);

  fs.rmSync(tmp, { recursive: true, force: true });
});

test('loadInstallConfig: rejects invalid module pattern', () => {
  const tmp = makeTmpDir();
  const configPath = writeConfig(tmp, { version: 1, modules: ['INVALID_CAPS'] });

  assert.throws(() => {
    loadInstallConfig(configPath);
  }, /Invalid.*install config/);

  fs.rmSync(tmp, { recursive: true, force: true });
});

// ── resolveConfigPath tests ─────────────────────────────────────────────────

test('resolveConfigPath: resolves relative path', () => {
  const resolved = resolveConfigPath('scc-install.json');
  assert.ok(path.isAbsolute(resolved));
  assert.ok(resolved.endsWith('scc-install.json'));
});

test('resolveConfigPath: passes through absolute path', () => {
  const resolved = resolveConfigPath('/tmp/scc-install.json');
  assert.strictEqual(resolved, '/tmp/scc-install.json');
});

test('resolveConfigPath: throws for empty path', () => {
  assert.throws(() => {
    resolveConfigPath('');
  }, /Config path is required/);
});

// ── Report ─────────────────────────────────────────────────────────────────────

console.log(`\ninstall-config.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
