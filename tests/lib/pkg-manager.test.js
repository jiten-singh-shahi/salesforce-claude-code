#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const pkgManagerPath = path.join(pluginRoot, 'scripts', 'lib', 'package-manager.js');

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

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'scc-pkg-mgr-test-'));
}

function cleanup(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch { /* ignore */ }
}

// ── Tests: module exists and exports ─────────────────────────────────────────

test('package-manager.js: module exists', () => {
  assert.ok(fs.existsSync(pkgManagerPath), `package-manager.js not found at: ${pkgManagerPath}`);
});

const pkgManager = require(pkgManagerPath);

test('package-manager.js: exports detectPackageManager function', () => {
  assert.strictEqual(typeof pkgManager.detectPackageManager, 'function');
});

test('package-manager.js: exports getInstallCommand function', () => {
  assert.strictEqual(typeof pkgManager.getInstallCommand, 'function');
});

test('package-manager.js: exports getRunCommand function', () => {
  assert.strictEqual(typeof pkgManager.getRunCommand, 'function');
});

test('package-manager.js: exports getExecCommand function', () => {
  assert.strictEqual(typeof pkgManager.getExecCommand, 'function');
});

// ── Tests: detectPackageManager — lock file detection ────────────────────────

test('detectPackageManager: detects npm via package-lock.json', () => {
  const tmpDir = makeTempDir();
  try {
    // Save and clear env overrides
    const savedOverride = process.env.CLAUDE_PACKAGE_MANAGER;
    const savedSccOverride = process.env.SCC_PACKAGE_MANAGER;
    delete process.env.CLAUDE_PACKAGE_MANAGER;
    delete process.env.SCC_PACKAGE_MANAGER;

    fs.writeFileSync(path.join(tmpDir, 'package-lock.json'), '{}');
    const result = pkgManager.detectPackageManager(tmpDir);
    assert.strictEqual(result, 'npm');

    // Restore
    if (savedOverride !== undefined) process.env.CLAUDE_PACKAGE_MANAGER = savedOverride;
    if (savedSccOverride !== undefined) process.env.SCC_PACKAGE_MANAGER = savedSccOverride;
  } finally {
    cleanup(tmpDir);
  }
});

test('detectPackageManager: detects yarn via yarn.lock', () => {
  const tmpDir = makeTempDir();
  try {
    const savedOverride = process.env.CLAUDE_PACKAGE_MANAGER;
    const savedSccOverride = process.env.SCC_PACKAGE_MANAGER;
    delete process.env.CLAUDE_PACKAGE_MANAGER;
    delete process.env.SCC_PACKAGE_MANAGER;

    fs.writeFileSync(path.join(tmpDir, 'yarn.lock'), '');
    const result = pkgManager.detectPackageManager(tmpDir);
    assert.strictEqual(result, 'yarn');

    if (savedOverride !== undefined) process.env.CLAUDE_PACKAGE_MANAGER = savedOverride;
    if (savedSccOverride !== undefined) process.env.SCC_PACKAGE_MANAGER = savedSccOverride;
  } finally {
    cleanup(tmpDir);
  }
});

test('detectPackageManager: detects pnpm via pnpm-lock.yaml', () => {
  const tmpDir = makeTempDir();
  try {
    const savedOverride = process.env.CLAUDE_PACKAGE_MANAGER;
    const savedSccOverride = process.env.SCC_PACKAGE_MANAGER;
    delete process.env.CLAUDE_PACKAGE_MANAGER;
    delete process.env.SCC_PACKAGE_MANAGER;

    fs.writeFileSync(path.join(tmpDir, 'pnpm-lock.yaml'), '');
    const result = pkgManager.detectPackageManager(tmpDir);
    assert.strictEqual(result, 'pnpm');

    if (savedOverride !== undefined) process.env.CLAUDE_PACKAGE_MANAGER = savedOverride;
    if (savedSccOverride !== undefined) process.env.SCC_PACKAGE_MANAGER = savedSccOverride;
  } finally {
    cleanup(tmpDir);
  }
});

test('detectPackageManager: detects bun via bun.lockb', () => {
  const tmpDir = makeTempDir();
  try {
    const savedOverride = process.env.CLAUDE_PACKAGE_MANAGER;
    const savedSccOverride = process.env.SCC_PACKAGE_MANAGER;
    delete process.env.CLAUDE_PACKAGE_MANAGER;
    delete process.env.SCC_PACKAGE_MANAGER;

    fs.writeFileSync(path.join(tmpDir, 'bun.lockb'), '');
    const result = pkgManager.detectPackageManager(tmpDir);
    assert.strictEqual(result, 'bun');

    if (savedOverride !== undefined) process.env.CLAUDE_PACKAGE_MANAGER = savedOverride;
    if (savedSccOverride !== undefined) process.env.SCC_PACKAGE_MANAGER = savedSccOverride;
  } finally {
    cleanup(tmpDir);
  }
});

test('detectPackageManager: detects npm via npm-shrinkwrap.json', () => {
  const tmpDir = makeTempDir();
  try {
    const savedOverride = process.env.CLAUDE_PACKAGE_MANAGER;
    const savedSccOverride = process.env.SCC_PACKAGE_MANAGER;
    delete process.env.CLAUDE_PACKAGE_MANAGER;
    delete process.env.SCC_PACKAGE_MANAGER;

    fs.writeFileSync(path.join(tmpDir, 'npm-shrinkwrap.json'), '{}');
    const result = pkgManager.detectPackageManager(tmpDir);
    assert.strictEqual(result, 'npm');

    if (savedOverride !== undefined) process.env.CLAUDE_PACKAGE_MANAGER = savedOverride;
    if (savedSccOverride !== undefined) process.env.SCC_PACKAGE_MANAGER = savedSccOverride;
  } finally {
    cleanup(tmpDir);
  }
});

// ── Tests: detectPackageManager — lock file priority (bun > yarn > pnpm > npm)

test('detectPackageManager: bun.lockb takes priority over yarn.lock', () => {
  const tmpDir = makeTempDir();
  try {
    const savedOverride = process.env.CLAUDE_PACKAGE_MANAGER;
    const savedSccOverride = process.env.SCC_PACKAGE_MANAGER;
    delete process.env.CLAUDE_PACKAGE_MANAGER;
    delete process.env.SCC_PACKAGE_MANAGER;

    fs.writeFileSync(path.join(tmpDir, 'bun.lockb'), '');
    fs.writeFileSync(path.join(tmpDir, 'yarn.lock'), '');
    const result = pkgManager.detectPackageManager(tmpDir);
    assert.strictEqual(result, 'bun', 'bun should take priority');

    if (savedOverride !== undefined) process.env.CLAUDE_PACKAGE_MANAGER = savedOverride;
    if (savedSccOverride !== undefined) process.env.SCC_PACKAGE_MANAGER = savedSccOverride;
  } finally {
    cleanup(tmpDir);
  }
});

// ── Tests: detectPackageManager — environment override ───────────────────────

test('detectPackageManager: CLAUDE_PACKAGE_MANAGER env override', () => {
  const saved = process.env.CLAUDE_PACKAGE_MANAGER;
  const savedScc = process.env.SCC_PACKAGE_MANAGER;
  try {
    delete process.env.SCC_PACKAGE_MANAGER;
    process.env.CLAUDE_PACKAGE_MANAGER = 'pnpm';
    const result = pkgManager.detectPackageManager('/nonexistent');
    assert.strictEqual(result, 'pnpm');
  } finally {
    if (saved !== undefined) process.env.CLAUDE_PACKAGE_MANAGER = saved;
    else delete process.env.CLAUDE_PACKAGE_MANAGER;
    if (savedScc !== undefined) process.env.SCC_PACKAGE_MANAGER = savedScc;
  }
});

test('detectPackageManager: SCC_PACKAGE_MANAGER env override', () => {
  const saved = process.env.CLAUDE_PACKAGE_MANAGER;
  const savedScc = process.env.SCC_PACKAGE_MANAGER;
  try {
    delete process.env.CLAUDE_PACKAGE_MANAGER;
    process.env.SCC_PACKAGE_MANAGER = 'yarn';
    const result = pkgManager.detectPackageManager('/nonexistent');
    assert.strictEqual(result, 'yarn');
  } finally {
    if (saved !== undefined) process.env.CLAUDE_PACKAGE_MANAGER = saved;
    else delete process.env.CLAUDE_PACKAGE_MANAGER;
    if (savedScc !== undefined) process.env.SCC_PACKAGE_MANAGER = savedScc;
    else delete process.env.SCC_PACKAGE_MANAGER;
  }
});

test('detectPackageManager: ignores invalid env override', () => {
  const saved = process.env.CLAUDE_PACKAGE_MANAGER;
  const savedScc = process.env.SCC_PACKAGE_MANAGER;
  try {
    delete process.env.SCC_PACKAGE_MANAGER;
    process.env.CLAUDE_PACKAGE_MANAGER = 'invalid-manager';
    const tmpDir = makeTempDir();
    try {
      fs.writeFileSync(path.join(tmpDir, 'package-lock.json'), '{}');
      const result = pkgManager.detectPackageManager(tmpDir);
      assert.strictEqual(result, 'npm', 'Should fall through to lock file detection');
    } finally {
      cleanup(tmpDir);
    }
  } finally {
    if (saved !== undefined) process.env.CLAUDE_PACKAGE_MANAGER = saved;
    else delete process.env.CLAUDE_PACKAGE_MANAGER;
    if (savedScc !== undefined) process.env.SCC_PACKAGE_MANAGER = savedScc;
  }
});

test('detectPackageManager: env override is case-insensitive', () => {
  const saved = process.env.CLAUDE_PACKAGE_MANAGER;
  const savedScc = process.env.SCC_PACKAGE_MANAGER;
  try {
    delete process.env.SCC_PACKAGE_MANAGER;
    process.env.CLAUDE_PACKAGE_MANAGER = 'NPM';
    const result = pkgManager.detectPackageManager('/nonexistent');
    assert.strictEqual(result, 'npm');
  } finally {
    if (saved !== undefined) process.env.CLAUDE_PACKAGE_MANAGER = saved;
    else delete process.env.CLAUDE_PACKAGE_MANAGER;
    if (savedScc !== undefined) process.env.SCC_PACKAGE_MANAGER = savedScc;
  }
});

// ── Tests: detectPackageManager — fallback ───────────────────────────────────

test('detectPackageManager: falls back when no lock file found', () => {
  const tmpDir = makeTempDir();
  try {
    const saved = process.env.CLAUDE_PACKAGE_MANAGER;
    const savedScc = process.env.SCC_PACKAGE_MANAGER;
    const savedExec = process.env.npm_execpath;
    delete process.env.CLAUDE_PACKAGE_MANAGER;
    delete process.env.SCC_PACKAGE_MANAGER;
    delete process.env.npm_execpath;

    const result = pkgManager.detectPackageManager(tmpDir);
    assert.ok(['npm', 'pnpm', 'yarn', 'bun'].includes(result),
      `Should return a valid package manager, got: ${result}`);

    if (saved !== undefined) process.env.CLAUDE_PACKAGE_MANAGER = saved;
    if (savedScc !== undefined) process.env.SCC_PACKAGE_MANAGER = savedScc;
    if (savedExec !== undefined) process.env.npm_execpath = savedExec;
  } finally {
    cleanup(tmpDir);
  }
});

// ── Tests: getInstallCommand ─────────────────────────────────────────────────

test('getInstallCommand: npm install', () => {
  const cmd = pkgManager.getInstallCommand('sql.js', 'npm');
  assert.strictEqual(cmd, 'npm install sql.js');
});

test('getInstallCommand: yarn add', () => {
  const cmd = pkgManager.getInstallCommand('sql.js', 'yarn');
  assert.strictEqual(cmd, 'yarn add sql.js');
});

test('getInstallCommand: pnpm add', () => {
  const cmd = pkgManager.getInstallCommand('sql.js', 'pnpm');
  assert.strictEqual(cmd, 'pnpm add sql.js');
});

test('getInstallCommand: bun add', () => {
  const cmd = pkgManager.getInstallCommand('sql.js', 'bun');
  assert.strictEqual(cmd, 'bun add sql.js');
});

test('getInstallCommand: default is npm when unknown manager', () => {
  const cmd = pkgManager.getInstallCommand('sql.js', 'unknown');
  assert.strictEqual(cmd, 'npm install sql.js');
});

// ── Tests: getRunCommand ─────────────────────────────────────────────────────

test('getRunCommand: npm run', () => {
  const cmd = pkgManager.getRunCommand('test', 'npm');
  assert.strictEqual(cmd, 'npm run test');
});

test('getRunCommand: yarn (no run prefix)', () => {
  const cmd = pkgManager.getRunCommand('test', 'yarn');
  assert.strictEqual(cmd, 'yarn test');
});

test('getRunCommand: pnpm run', () => {
  const cmd = pkgManager.getRunCommand('test', 'pnpm');
  assert.strictEqual(cmd, 'pnpm run test');
});

test('getRunCommand: bun run', () => {
  const cmd = pkgManager.getRunCommand('test', 'bun');
  assert.strictEqual(cmd, 'bun run test');
});

test('getRunCommand: default is npm when unknown manager', () => {
  const cmd = pkgManager.getRunCommand('test', 'unknown');
  assert.strictEqual(cmd, 'npm run test');
});

// ── Tests: getExecCommand ────────────────────────────────────────────────────

test('getExecCommand: npx', () => {
  const cmd = pkgManager.getExecCommand('scc', 'npm');
  assert.strictEqual(cmd, 'npx scc');
});

test('getExecCommand: yarn dlx', () => {
  const cmd = pkgManager.getExecCommand('scc', 'yarn');
  assert.strictEqual(cmd, 'yarn dlx scc');
});

test('getExecCommand: pnpm dlx', () => {
  const cmd = pkgManager.getExecCommand('scc', 'pnpm');
  assert.strictEqual(cmd, 'pnpm dlx scc');
});

test('getExecCommand: bunx', () => {
  const cmd = pkgManager.getExecCommand('scc', 'bun');
  assert.strictEqual(cmd, 'bunx scc');
});

test('getExecCommand: default is npx when unknown manager', () => {
  const cmd = pkgManager.getExecCommand('scc', 'unknown');
  assert.strictEqual(cmd, 'npx scc');
});

console.log(`\npkg-manager.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
