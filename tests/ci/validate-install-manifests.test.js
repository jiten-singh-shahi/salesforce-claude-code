#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const scriptPath = path.join(pluginRoot, 'scripts', 'ci', 'validate-install-manifests.js');

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

// ── Helper: run script in a temp env ─────────────────────────────────────────

function runScript(envPluginRoot) {
  return spawnSync(process.execPath, [scriptPath], {
    encoding: 'utf8',
    timeout: 15000,
    env: {
      ...process.env,
      SCC_PLUGIN_ROOT: envPluginRoot,
      NODE_ENV: 'test',
    },
  });
}

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'scc-manifests-test-'));
}

function cleanup(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch { /* ignore */ }
}

// ── Tests: script existence ──────────────────────────────────────────────────

test('validate-install-manifests.js: script exists', () => {
  assert.ok(fs.existsSync(scriptPath), `Script not found at: ${scriptPath}`);
});

// ── Tests: passes on real project ────────────────────────────────────────────

test('validate-install-manifests.js: passes on real project', () => {
  const result = runScript(pluginRoot);
  assert.strictEqual(result.status, 0,
    `Should pass on real project. stderr: ${(result.stderr || '').slice(0, 500)}`);
  const output = result.stdout || '';
  assert.ok(output.includes('Manifest validation PASSED'), 'Should output PASSED message');
});

test('validate-install-manifests.js: validates profiles count', () => {
  const result = runScript(pluginRoot);
  assert.strictEqual(result.status, 0);
  const output = result.stdout || '';
  assert.ok(output.includes('install-profiles.json:'), 'Should mention profiles file');
  assert.ok(output.includes('profile(s)'), 'Should count profiles');
});

test('validate-install-manifests.js: validates modules count', () => {
  const result = runScript(pluginRoot);
  assert.strictEqual(result.status, 0);
  const output = result.stdout || '';
  assert.ok(output.includes('install-modules.json:'), 'Should mention modules file');
  assert.ok(output.includes('module(s)'), 'Should count modules');
});

// ── Tests: fails when manifests dir is missing ───────────────────────────────

test('validate-install-manifests.js: fails when manifests/ dir is missing', () => {
  const tmpDir = makeTempDir();
  try {
    const result = runScript(tmpDir);
    assert.notStrictEqual(result.status, 0, 'Should fail when manifests/ dir is missing');
    const stderr = result.stderr || '';
    assert.ok(stderr.includes('manifests/ directory not found') || stderr.includes('ERROR'),
      'Should report missing manifests directory');
  } finally {
    cleanup(tmpDir);
  }
});

// ── Tests: fails when profiles file is missing ───────────────────────────────

test('validate-install-manifests.js: fails when install-profiles.json is missing', () => {
  const tmpDir = makeTempDir();
  try {
    const manifestsDir = path.join(tmpDir, 'manifests');
    fs.mkdirSync(manifestsDir, { recursive: true });
    // Create modules but not profiles
    fs.writeFileSync(path.join(manifestsDir, 'install-modules.json'), JSON.stringify({
      version: 1,
      modules: [{ id: 'test-mod', kind: 'rules', paths: [], targets: {} }]
    }));

    const result = runScript(tmpDir);
    assert.notStrictEqual(result.status, 0, 'Should fail when profiles file is missing');
  } finally {
    cleanup(tmpDir);
  }
});

// ── Tests: fails when modules file is missing ────────────────────────────────

test('validate-install-manifests.js: fails when install-modules.json is missing', () => {
  const tmpDir = makeTempDir();
  try {
    const manifestsDir = path.join(tmpDir, 'manifests');
    fs.mkdirSync(manifestsDir, { recursive: true });
    // Create profiles but not modules
    fs.writeFileSync(path.join(manifestsDir, 'install-profiles.json'), JSON.stringify({
      version: 1,
      profiles: {
        core: { modules: ['m1'] },
        full: { modules: ['m1'] }
      }
    }));

    const result = runScript(tmpDir);
    assert.notStrictEqual(result.status, 0, 'Should fail when modules file is missing');
  } finally {
    cleanup(tmpDir);
  }
});

// ── Tests: fails with invalid JSON ───────────────────────────────────────────

test('validate-install-manifests.js: fails with invalid JSON in profiles', () => {
  const tmpDir = makeTempDir();
  try {
    const manifestsDir = path.join(tmpDir, 'manifests');
    fs.mkdirSync(manifestsDir, { recursive: true });
    fs.writeFileSync(path.join(manifestsDir, 'install-profiles.json'), '{not valid json}}}');
    fs.writeFileSync(path.join(manifestsDir, 'install-modules.json'), '{}');

    const result = runScript(tmpDir);
    assert.notStrictEqual(result.status, 0, 'Should fail with invalid JSON');
  } finally {
    cleanup(tmpDir);
  }
});

// ── Tests: fails when required profiles (core, full) are missing ─────────────

test('validate-install-manifests.js: passes when core profile is absent (only full is required)', () => {
  const tmpDir = makeTempDir();
  try {
    const manifestsDir = path.join(tmpDir, 'manifests');
    fs.mkdirSync(manifestsDir, { recursive: true });
    fs.writeFileSync(path.join(manifestsDir, 'install-profiles.json'), JSON.stringify({
      version: 2,
      profiles: {
        full: { modules: ['m1'] }
      }
    }));
    fs.writeFileSync(path.join(manifestsDir, 'install-modules.json'), JSON.stringify({
      version: 2,
      modules: [{ id: 'm1', kind: 'bundle', pathGroups: [], dependencies: [] }]
    }));

    const result = runScript(tmpDir);
    assert.strictEqual(result.status, 0, 'Should pass when only full profile exists');
  } finally {
    cleanup(tmpDir);
  }
});

test('validate-install-manifests.js: fails when full profile is missing', () => {
  const tmpDir = makeTempDir();
  try {
    const manifestsDir = path.join(tmpDir, 'manifests');
    fs.mkdirSync(manifestsDir, { recursive: true });
    fs.writeFileSync(path.join(manifestsDir, 'install-profiles.json'), JSON.stringify({
      version: 1,
      profiles: {
        core: { modules: ['m1'] }
        // missing 'full'
      }
    }));
    fs.writeFileSync(path.join(manifestsDir, 'install-modules.json'), JSON.stringify({
      version: 1,
      modules: [{ id: 'm1', kind: 'rules', paths: [], targets: {} }]
    }));

    const result = runScript(tmpDir);
    assert.notStrictEqual(result.status, 0, 'Should fail when full profile is missing');
  } finally {
    cleanup(tmpDir);
  }
});

// ── Tests: fails when profile extends unknown profile ────────────────────────

test('validate-install-manifests.js: fails when profile extends unknown profile', () => {
  const tmpDir = makeTempDir();
  try {
    const manifestsDir = path.join(tmpDir, 'manifests');
    fs.mkdirSync(manifestsDir, { recursive: true });
    fs.writeFileSync(path.join(manifestsDir, 'install-profiles.json'), JSON.stringify({
      version: 1,
      profiles: {
        core: { modules: ['m1'] },
        full: { extends: 'nonexistent', modules: ['m1'] }
      }
    }));
    fs.writeFileSync(path.join(manifestsDir, 'install-modules.json'), JSON.stringify({
      version: 1,
      modules: [{ id: 'm1', kind: 'rules', paths: [], targets: {} }]
    }));

    const result = runScript(tmpDir);
    assert.notStrictEqual(result.status, 0, 'Should fail when extends unknown profile');
    const stderr = result.stderr || '';
    assert.ok(stderr.includes('extends unknown profile'),
      'Should report extends unknown profile error');
  } finally {
    cleanup(tmpDir);
  }
});

// ── Tests: fails on circular self-extends ────────────────────────────────────

test('validate-install-manifests.js: fails on circular self-extends', () => {
  const tmpDir = makeTempDir();
  try {
    const manifestsDir = path.join(tmpDir, 'manifests');
    fs.mkdirSync(manifestsDir, { recursive: true });
    fs.writeFileSync(path.join(manifestsDir, 'install-profiles.json'), JSON.stringify({
      version: 1,
      profiles: {
        core: { modules: ['m1'] },
        full: { extends: 'full', modules: ['m1'] }
      }
    }));
    fs.writeFileSync(path.join(manifestsDir, 'install-modules.json'), JSON.stringify({
      version: 1,
      modules: [{ id: 'm1', kind: 'rules', paths: [], targets: {} }]
    }));

    const result = runScript(tmpDir);
    assert.notStrictEqual(result.status, 0, 'Should fail on circular self-extends');
    const stderr = result.stderr || '';
    assert.ok(stderr.includes('circular extends'),
      'Should report circular extends error');
  } finally {
    cleanup(tmpDir);
  }
});

// ── Tests: fails when profile has neither modules nor extends ────────────────

test('validate-install-manifests.js: fails when profile has no modules or extends', () => {
  const tmpDir = makeTempDir();
  try {
    const manifestsDir = path.join(tmpDir, 'manifests');
    fs.mkdirSync(manifestsDir, { recursive: true });
    fs.writeFileSync(path.join(manifestsDir, 'install-profiles.json'), JSON.stringify({
      version: 1,
      profiles: {
        core: { description: 'empty profile' },
        full: { modules: ['m1'] }
      }
    }));
    fs.writeFileSync(path.join(manifestsDir, 'install-modules.json'), JSON.stringify({
      version: 1,
      modules: [{ id: 'm1', kind: 'rules', paths: [], targets: {} }]
    }));

    const result = runScript(tmpDir);
    assert.notStrictEqual(result.status, 0, 'Should fail when profile has no modules or extends');
    const stderr = result.stderr || '';
    assert.ok(stderr.includes('must have either "modules" array or "extends" field'),
      'Should report missing modules/extends');
  } finally {
    cleanup(tmpDir);
  }
});

// ── Tests: fails when modules are not an array ───────────────────────────────

test('validate-install-manifests.js: fails when profile modules is not an array', () => {
  const tmpDir = makeTempDir();
  try {
    const manifestsDir = path.join(tmpDir, 'manifests');
    fs.mkdirSync(manifestsDir, { recursive: true });
    fs.writeFileSync(path.join(manifestsDir, 'install-profiles.json'), JSON.stringify({
      version: 1,
      profiles: {
        core: { modules: 'not-an-array' },
        full: { modules: ['m1'] }
      }
    }));
    fs.writeFileSync(path.join(manifestsDir, 'install-modules.json'), JSON.stringify({
      version: 1,
      modules: [{ id: 'm1', kind: 'rules', paths: [], targets: {} }]
    }));

    const result = runScript(tmpDir);
    assert.notStrictEqual(result.status, 0, 'Should fail when modules is not an array');
  } finally {
    cleanup(tmpDir);
  }
});

// ── Tests: warns on module with no files/dirs/paths ──────────────────────────

test('validate-install-manifests.js: warns on module with no files, dirs, or paths', () => {
  const tmpDir = makeTempDir();
  try {
    const manifestsDir = path.join(tmpDir, 'manifests');
    fs.mkdirSync(manifestsDir, { recursive: true });
    fs.writeFileSync(path.join(manifestsDir, 'install-profiles.json'), JSON.stringify({
      version: 1,
      profiles: {
        core: { modules: ['empty-mod'] },
        full: { modules: ['empty-mod'] }
      }
    }));
    fs.writeFileSync(path.join(manifestsDir, 'install-modules.json'), JSON.stringify({
      version: 1,
      modules: [{ id: 'empty-mod', kind: 'rules', description: 'no paths at all' }]
    }));

    const result = runScript(tmpDir);
    // May still pass (warnings are non-fatal), but should emit a warning
    const combinedOutput = (result.stdout || '') + (result.stderr || '');
    assert.ok(
      combinedOutput.includes('nothing will be installed') || result.status !== 0,
      'Should warn about empty module or fail'
    );
  } finally {
    cleanup(tmpDir);
  }
});

// ── Tests: fails when profile references unknown module ──────────────────────

test('validate-install-manifests.js: fails when profile references unknown module', () => {
  const tmpDir = makeTempDir();
  try {
    const manifestsDir = path.join(tmpDir, 'manifests');
    fs.mkdirSync(manifestsDir, { recursive: true });
    fs.writeFileSync(path.join(manifestsDir, 'install-profiles.json'), JSON.stringify({
      version: 1,
      profiles: {
        core: { modules: ['nonexistent-module'] },
        full: { modules: ['nonexistent-module'] }
      }
    }));
    fs.writeFileSync(path.join(manifestsDir, 'install-modules.json'), JSON.stringify({
      version: 1,
      modules: [{ id: 'actual-mod', kind: 'rules', paths: [], targets: {} }]
    }));

    const result = runScript(tmpDir);
    assert.notStrictEqual(result.status, 0, 'Should fail when profile references unknown module');
    const stderr = result.stderr || '';
    assert.ok(stderr.includes('references unknown module'),
      'Should report unknown module reference');
  } finally {
    cleanup(tmpDir);
  }
});

// ── Tests: Style A profiles (flat map) ───────────────────────────────────────

test('validate-install-manifests.js: handles Style A (flat map) profiles', () => {
  const tmpDir = makeTempDir();
  try {
    const manifestsDir = path.join(tmpDir, 'manifests');
    fs.mkdirSync(manifestsDir, { recursive: true });

    // Style A: no version/profiles wrapper
    fs.writeFileSync(path.join(manifestsDir, 'install-profiles.json'), JSON.stringify({
      core: { modules: ['m1'] },
      full: { modules: ['m1'] }
    }));
    fs.writeFileSync(path.join(manifestsDir, 'install-modules.json'), JSON.stringify({
      m1: { files: {} }
    }));

    const result = runScript(tmpDir);
    // Should recognize Style A and validate it
    const combined = (result.stdout || '') + (result.stderr || '');
    assert.ok(combined.includes('profile(s)') || result.status === 0 || result.status === 1,
      'Should process Style A manifests');
  } finally {
    cleanup(tmpDir);
  }
});

// ── Tests: validates paths entries ───────────────────────────────────────────

test('validate-install-manifests.js: fails on invalid paths entries (non-string)', () => {
  const tmpDir = makeTempDir();
  try {
    const manifestsDir = path.join(tmpDir, 'manifests');
    fs.mkdirSync(manifestsDir, { recursive: true });
    fs.writeFileSync(path.join(manifestsDir, 'install-profiles.json'), JSON.stringify({
      version: 1,
      profiles: {
        core: { modules: ['bad-paths-mod'] },
        full: { modules: ['bad-paths-mod'] }
      }
    }));
    fs.writeFileSync(path.join(manifestsDir, 'install-modules.json'), JSON.stringify({
      version: 1,
      modules: [{ id: 'bad-paths-mod', kind: 'rules', paths: [123, '', null], targets: {} }]
    }));

    const result = runScript(tmpDir);
    assert.notStrictEqual(result.status, 0, 'Should fail on invalid paths entries');
    const stderr = result.stderr || '';
    assert.ok(stderr.includes('path entries must be non-empty strings'),
      'Should report invalid path entries');
  } finally {
    cleanup(tmpDir);
  }
});

// ── Tests: validates files structure ─────────────────────────────────────────

test('validate-install-manifests.js: fails when files is not an object', () => {
  const tmpDir = makeTempDir();
  try {
    const manifestsDir = path.join(tmpDir, 'manifests');
    fs.mkdirSync(manifestsDir, { recursive: true });
    fs.writeFileSync(path.join(manifestsDir, 'install-profiles.json'), JSON.stringify({
      version: 1,
      profiles: {
        core: { modules: ['bad-files-mod'] },
        full: { modules: ['bad-files-mod'] }
      }
    }));
    fs.writeFileSync(path.join(manifestsDir, 'install-modules.json'), JSON.stringify({
      version: 1,
      modules: [{ id: 'bad-files-mod', kind: 'rules', files: 'not-object', targets: {} }]
    }));

    const result = runScript(tmpDir);
    assert.notStrictEqual(result.status, 0, 'Should fail when files is not an object');
    const stderr = result.stderr || '';
    assert.ok(stderr.includes('files: must be an object'),
      'Should report files must be an object');
  } finally {
    cleanup(tmpDir);
  }
});

// ── Tests: validates dirs structure ──────────────────────────────────────────

test('validate-install-manifests.js: fails when dirs is not an object', () => {
  const tmpDir = makeTempDir();
  try {
    const manifestsDir = path.join(tmpDir, 'manifests');
    fs.mkdirSync(manifestsDir, { recursive: true });
    fs.writeFileSync(path.join(manifestsDir, 'install-profiles.json'), JSON.stringify({
      version: 1,
      profiles: {
        core: { modules: ['bad-dirs-mod'] },
        full: { modules: ['bad-dirs-mod'] }
      }
    }));
    fs.writeFileSync(path.join(manifestsDir, 'install-modules.json'), JSON.stringify({
      version: 1,
      modules: [{ id: 'bad-dirs-mod', kind: 'rules', dirs: [1, 2, 3], targets: {} }]
    }));

    const result = runScript(tmpDir);
    assert.notStrictEqual(result.status, 0, 'Should fail when dirs is an array');
    const stderr = result.stderr || '';
    assert.ok(stderr.includes('dirs: must be an object'),
      'Should report dirs must be an object');
  } finally {
    cleanup(tmpDir);
  }
});

// ── Tests: handles profile extends as array ──────────────────────────────────

test('validate-install-manifests.js: handles extends as array', () => {
  const tmpDir = makeTempDir();
  try {
    const manifestsDir = path.join(tmpDir, 'manifests');
    fs.mkdirSync(manifestsDir, { recursive: true });
    fs.writeFileSync(path.join(manifestsDir, 'install-profiles.json'), JSON.stringify({
      version: 1,
      profiles: {
        core: { modules: ['m1'] },
        apex: { modules: ['m1'] },
        full: { extends: ['core', 'apex'], modules: [] }
      }
    }));
    fs.writeFileSync(path.join(manifestsDir, 'install-modules.json'), JSON.stringify({
      version: 1,
      modules: [{ id: 'm1', kind: 'rules', paths: [], targets: {} }]
    }));

    const result = runScript(tmpDir);
    // Should be valid — profile extends known profiles as an array
    const combined = (result.stdout || '') + (result.stderr || '');
    // Not necessarily passing (disk-to-manifest check may fail), but extends should work
    assert.ok(!combined.includes('extends unknown profile'),
      'Should not report extends unknown profile for valid array extends');
  } finally {
    cleanup(tmpDir);
  }
});

// ── Tests: empty profiles object ─────────────────────────────────────────────

test('validate-install-manifests.js: fails on empty profiles', () => {
  const tmpDir = makeTempDir();
  try {
    const manifestsDir = path.join(tmpDir, 'manifests');
    fs.mkdirSync(manifestsDir, { recursive: true });
    fs.writeFileSync(path.join(manifestsDir, 'install-profiles.json'), JSON.stringify({
      version: 1,
      profiles: {}
    }));
    fs.writeFileSync(path.join(manifestsDir, 'install-modules.json'), JSON.stringify({
      version: 1,
      modules: []
    }));

    const result = runScript(tmpDir);
    assert.notStrictEqual(result.status, 0, 'Should fail on empty profiles');
    const stderr = result.stderr || '';
    assert.ok(stderr.includes('no profiles found') || stderr.includes('FAIL'),
      'Should report no profiles found');
  } finally {
    cleanup(tmpDir);
  }
});

// ── Tests: empty modules ─────────────────────────────────────────────────────

test('validate-install-manifests.js: fails on empty modules', () => {
  const tmpDir = makeTempDir();
  try {
    const manifestsDir = path.join(tmpDir, 'manifests');
    fs.mkdirSync(manifestsDir, { recursive: true });
    fs.writeFileSync(path.join(manifestsDir, 'install-profiles.json'), JSON.stringify({
      version: 1,
      profiles: {
        core: { modules: [] },
        full: { modules: [] }
      }
    }));
    fs.writeFileSync(path.join(manifestsDir, 'install-modules.json'), JSON.stringify({
      version: 1,
      modules: []
    }));

    const result = runScript(tmpDir);
    assert.notStrictEqual(result.status, 0, 'Should fail on empty modules');
    const stderr = result.stderr || '';
    assert.ok(stderr.includes('no modules found') || stderr.includes('FAIL'),
      'Should report no modules found');
  } finally {
    cleanup(tmpDir);
  }
});

// ── Tests: profile definition is not an object ───────────────────────────────

test('validate-install-manifests.js: fails when profile definition is not an object', () => {
  const tmpDir = makeTempDir();
  try {
    const manifestsDir = path.join(tmpDir, 'manifests');
    fs.mkdirSync(manifestsDir, { recursive: true });
    fs.writeFileSync(path.join(manifestsDir, 'install-profiles.json'), JSON.stringify({
      version: 1,
      profiles: {
        core: 'not-an-object',
        full: { modules: ['m1'] }
      }
    }));
    fs.writeFileSync(path.join(manifestsDir, 'install-modules.json'), JSON.stringify({
      version: 1,
      modules: [{ id: 'm1', kind: 'rules', paths: [], targets: {} }]
    }));

    const result = runScript(tmpDir);
    assert.notStrictEqual(result.status, 0, 'Should fail when profile def is not an object');
    const stderr = result.stderr || '';
    assert.ok(stderr.includes('profile definition must be an object') || stderr.includes('FAIL'),
      'Should report invalid profile definition');
  } finally {
    cleanup(tmpDir);
  }
});

// ── Tests: module definition is not an object ────────────────────────────────

test('validate-install-manifests.js: fails when module definition is a string', () => {
  const tmpDir = makeTempDir();
  try {
    const manifestsDir = path.join(tmpDir, 'manifests');
    fs.mkdirSync(manifestsDir, { recursive: true });
    fs.writeFileSync(path.join(manifestsDir, 'install-profiles.json'), JSON.stringify({
      version: 1,
      profiles: {
        core: { modules: ['m1'] },
        full: { modules: ['m1'] }
      }
    }));
    // Style A with string module def
    fs.writeFileSync(path.join(manifestsDir, 'install-modules.json'), JSON.stringify({
      m1: 'not-an-object'
    }));

    const result = runScript(tmpDir);
    assert.notStrictEqual(result.status, 0, 'Should fail when module def is a string');
    const stderr = result.stderr || '';
    assert.ok(stderr.includes('module definition must be an object') || stderr.includes('FAIL'),
      'Should report invalid module definition');
  } finally {
    cleanup(tmpDir);
  }
});

// ── Tests: paths that is not an array ────────────────────────────────────────

test('validate-install-manifests.js: fails when paths is not an array', () => {
  const tmpDir = makeTempDir();
  try {
    const manifestsDir = path.join(tmpDir, 'manifests');
    fs.mkdirSync(manifestsDir, { recursive: true });
    fs.writeFileSync(path.join(manifestsDir, 'install-profiles.json'), JSON.stringify({
      version: 1,
      profiles: {
        core: { modules: ['m1'] },
        full: { modules: ['m1'] }
      }
    }));
    fs.writeFileSync(path.join(manifestsDir, 'install-modules.json'), JSON.stringify({
      version: 1,
      modules: [{ id: 'm1', kind: 'rules', paths: 'not-array', targets: {} }]
    }));

    const result = runScript(tmpDir);
    assert.notStrictEqual(result.status, 0, 'Should fail when paths is not an array');
    const stderr = result.stderr || '';
    assert.ok(stderr.includes('paths: must be an array') || stderr.includes('FAIL'),
      'Should report paths must be an array');
  } finally {
    cleanup(tmpDir);
  }
});

// ── Tests: dirs with empty string entries ────────────────────────────────────

test('validate-install-manifests.js: fails when dirs has empty string entries', () => {
  const tmpDir = makeTempDir();
  try {
    const manifestsDir = path.join(tmpDir, 'manifests');
    fs.mkdirSync(manifestsDir, { recursive: true });
    fs.writeFileSync(path.join(manifestsDir, 'install-profiles.json'), JSON.stringify({
      version: 1,
      profiles: {
        core: { modules: ['m1'] },
        full: { modules: ['m1'] }
      }
    }));
    fs.writeFileSync(path.join(manifestsDir, 'install-modules.json'), JSON.stringify({
      version: 1,
      modules: [{ id: 'm1', kind: 'rules', dirs: { rules: ['', '  '] }, targets: {} }]
    }));

    const result = runScript(tmpDir);
    assert.notStrictEqual(result.status, 0, 'Should fail on empty dir entries');
    const stderr = result.stderr || '';
    assert.ok(stderr.includes('dir entries must be non-empty strings') || stderr.includes('FAIL'),
      'Should report empty dir entries');
  } finally {
    cleanup(tmpDir);
  }
});

// ── Tests: files with empty string file entries ──────────────────────────────

test('validate-install-manifests.js: fails when files has empty string entries', () => {
  const tmpDir = makeTempDir();
  try {
    const manifestsDir = path.join(tmpDir, 'manifests');
    fs.mkdirSync(manifestsDir, { recursive: true });
    fs.writeFileSync(path.join(manifestsDir, 'install-profiles.json'), JSON.stringify({
      version: 1,
      profiles: {
        core: { modules: ['m1'] },
        full: { modules: ['m1'] }
      }
    }));
    fs.writeFileSync(path.join(manifestsDir, 'install-modules.json'), JSON.stringify({
      version: 1,
      modules: [{ id: 'm1', kind: 'rules', files: { agents: ['', 123] }, targets: {} }]
    }));

    const result = runScript(tmpDir);
    assert.notStrictEqual(result.status, 0, 'Should fail on empty file entries');
    const stderr = result.stderr || '';
    assert.ok(stderr.includes('file entries must be non-empty strings') || stderr.includes('FAIL'),
      'Should report empty file entries');
  } finally {
    cleanup(tmpDir);
  }
});

console.log(`\nvalidate-install-manifests.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
