#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const executorPath = path.join(pluginRoot, 'scripts', 'lib', 'install-executor.js');

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
  return fs.mkdtempSync(path.join(os.tmpdir(), 'scc-executor-test-'));
}

function cleanup(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch { /* ignore */ }
}

// ── Load module ──────────────────────────────────────────────────────────────

const executor = require(executorPath);

// ── Tests: module exports ────────────────────────────────────────────────────

test('install-executor: exports executeInstall function', () => {
  assert.strictEqual(typeof executor.executeInstall, 'function');
});

test('install-executor: exports listAvailableTargets function', () => {
  assert.strictEqual(typeof executor.listAvailableTargets, 'function');
});

test('install-executor: exports listAvailableProfiles function', () => {
  assert.strictEqual(typeof executor.listAvailableProfiles, 'function');
});

test('install-executor: exports getTargetDirs function', () => {
  assert.strictEqual(typeof executor.getTargetDirs, 'function');
});

test('install-executor: exports resolveProfileModules function', () => {
  assert.strictEqual(typeof executor.resolveProfileModules, 'function');
});

test('install-executor: exports VALID_TARGETS array', () => {
  assert.ok(Array.isArray(executor.VALID_TARGETS));
  assert.ok(executor.VALID_TARGETS.includes('claude'));
  assert.ok(executor.VALID_TARGETS.includes('cursor'));
});

test('install-executor: exports VALID_PROFILES array', () => {
  assert.ok(Array.isArray(executor.VALID_PROFILES));
  assert.ok(executor.VALID_PROFILES.includes('full'));
  assert.ok(executor.VALID_PROFILES.includes('apex'));
  assert.ok(executor.VALID_PROFILES.includes('lwc'));
  assert.strictEqual(executor.VALID_PROFILES.length, 3, 'Should have 3 profiles');
});

// ── Tests: listAvailableTargets ──────────────────────────────────────────────

test('listAvailableTargets: returns array of 2 targets', () => {
  const targets = executor.listAvailableTargets();
  assert.ok(Array.isArray(targets));
  assert.strictEqual(targets.length, 2);
  assert.deepStrictEqual(targets.sort(), ['claude', 'cursor']);
});

test('listAvailableTargets: returns a copy, not the original', () => {
  const t1 = executor.listAvailableTargets();
  const t2 = executor.listAvailableTargets();
  assert.notStrictEqual(t1, t2, 'Should return new array each time');
  t1.push('fake');
  const t3 = executor.listAvailableTargets();
  assert.strictEqual(t3.length, 2, 'Modifying returned array should not affect original');
});

// ── Tests: getTargetDirs ─────────────────────────────────────────────────────

test('getTargetDirs: returns correct dirs for claude target', () => {
  const dirs = executor.getTargetDirs('claude', '/project');
  assert.strictEqual(dirs.agents, '/project/.claude/agents');
  assert.strictEqual(dirs.skills, '/project/.claude/skills');
  assert.strictEqual(dirs.commands, '/project/.claude/commands');
  assert.strictEqual(dirs.hooks, '/project/.claude/hooks');
});

test('getTargetDirs: returns correct dirs for cursor target', () => {
  const dirs = executor.getTargetDirs('cursor', '/project');
  assert.strictEqual(dirs.agents, '/project/.cursor/agents');
  assert.strictEqual(dirs.skills, '/project/.cursor/skills');
  assert.strictEqual(dirs.commands, '/project/.cursor/commands');
  assert.strictEqual(dirs.hooks, '/project/.cursor/hooks.json', 'cursor hooks points to generated hooks.json');
});

test('getTargetDirs: throws on unknown target', () => {
  assert.throws(
    () => executor.getTargetDirs('invalid', '/project'),
    /Unknown target/,
    'Should throw on unknown target'
  );
});

// ── Tests: listAvailableProfiles ─────────────────────────────────────────────

test('listAvailableProfiles: returns profiles object', () => {
  const profiles = executor.listAvailableProfiles(pluginRoot);
  assert.ok(typeof profiles === 'object' && profiles !== null);
});

test('listAvailableProfiles: contains apex, lwc, and full profiles', () => {
  const profiles = executor.listAvailableProfiles(pluginRoot);
  assert.ok(profiles.apex, 'Should have apex profile');
  assert.ok(profiles.lwc, 'Should have lwc profile');
  assert.ok(profiles.full, 'Should have full profile');
});

test('listAvailableProfiles: returns defaults when manifests missing', () => {
  const tmpDir = makeTempDir();
  try {
    const profiles = executor.listAvailableProfiles(tmpDir);
    assert.ok(typeof profiles === 'object');
    assert.ok(profiles.core, 'Should have default core profile');
    assert.ok(profiles.full, 'Should have default full profile');
    assert.ok(profiles.apex, 'Should have default apex profile');
    assert.ok(profiles.lwc, 'Should have default lwc profile');
  } finally {
    cleanup(tmpDir);
  }
});

// ── Tests: resolveProfileModules ─────────────────────────────────────────────

test('resolveProfileModules: resolves simple profile', () => {
  const profiles = {
    core: { modules: ['mod-a', 'mod-b'] },
    full: { modules: ['mod-a', 'mod-b', 'mod-c'] }
  };
  const mods = executor.resolveProfileModules(profiles, 'core');
  assert.deepStrictEqual(mods, ['mod-a', 'mod-b']);
});

test('resolveProfileModules: resolves profile with extends (string)', () => {
  const profiles = {
    core: { modules: ['mod-a'] },
    full: { extends: 'core', modules: ['mod-b'] }
  };
  const mods = executor.resolveProfileModules(profiles, 'full');
  assert.deepStrictEqual(mods, ['mod-a', 'mod-b']);
});

test('resolveProfileModules: resolves profile with extends (array)', () => {
  const profiles = {
    core: { modules: ['mod-a'] },
    apex: { modules: ['mod-b'] },
    full: { extends: ['core', 'apex'], modules: ['mod-c'] }
  };
  const mods = executor.resolveProfileModules(profiles, 'full');
  assert.deepStrictEqual(mods, ['mod-a', 'mod-b', 'mod-c']);
});

test('resolveProfileModules: deduplicates modules', () => {
  const profiles = {
    core: { modules: ['mod-a', 'mod-b'] },
    apex: { modules: ['mod-b', 'mod-c'] },
    full: { extends: ['core', 'apex'], modules: ['mod-a', 'mod-d'] }
  };
  const mods = executor.resolveProfileModules(profiles, 'full');
  // Should be deduplicated, preserving order of first occurrence
  assert.deepStrictEqual(mods, ['mod-a', 'mod-b', 'mod-c', 'mod-d']);
});

test('resolveProfileModules: throws on unknown profile', () => {
  const profiles = {
    core: { modules: ['mod-a'] }
  };
  assert.throws(
    () => executor.resolveProfileModules(profiles, 'nonexistent'),
    /Unknown profile/,
    'Should throw on unknown profile'
  );
});

test('resolveProfileModules: handles profile with no modules array', () => {
  const profiles = {
    core: { description: 'no modules key' },
    full: { extends: 'core', modules: ['mod-a'] }
  };
  const mods = executor.resolveProfileModules(profiles, 'full');
  assert.deepStrictEqual(mods, ['mod-a']);
});

test('resolveProfileModules: handles nested extends', () => {
  const profiles = {
    base: { modules: ['mod-base'] },
    core: { extends: 'base', modules: ['mod-core'] },
    full: { extends: 'core', modules: ['mod-full'] }
  };
  const mods = executor.resolveProfileModules(profiles, 'full');
  assert.deepStrictEqual(mods, ['mod-base', 'mod-core', 'mod-full']);
});

// ── Tests: executeInstall with dry-run ───────────────────────────────────────

test('executeInstall: dry-run for apex profile with claude target', () => {
  const tmpDir = makeTempDir();
  try {
    const result = executor.executeInstall('apex', 'claude', {
      dryRun: true,
      projectRoot: tmpDir,
      pluginRoot: pluginRoot,
    });
    assert.ok(result, 'Should return a result object');
    assert.ok(typeof result.fileCount === 'number', 'Should have fileCount');
    assert.ok(typeof result.moduleCount === 'number', 'Should have moduleCount');
    assert.ok(Array.isArray(result.installedFiles), 'Should have installedFiles array');
    assert.ok(result.moduleCount > 0, 'Should have at least 1 module');
  } finally {
    cleanup(tmpDir);
  }
});

test('executeInstall: dry-run does not create files', () => {
  const tmpDir = makeTempDir();
  try {
    executor.executeInstall('apex', 'claude', {
      dryRun: true,
      projectRoot: tmpDir,
      pluginRoot: pluginRoot,
    });
    // Check no .claude dir was created
    assert.ok(!fs.existsSync(path.join(tmpDir, '.claude')),
      'Dry run should not create .claude directory');
  } finally {
    cleanup(tmpDir);
  }
});

test('executeInstall: throws on invalid target', () => {
  assert.throws(
    () => executor.executeInstall('apex', 'invalid-target', { dryRun: true }),
    /Invalid target/,
    'Should throw on invalid target'
  );
});

test('executeInstall: throws on invalid profile', () => {
  assert.throws(
    () => executor.executeInstall('invalid-profile', 'claude', { dryRun: true }),
    /Invalid profile/,
    'Should throw on invalid profile'
  );
});

test('executeInstall: dry-run for full profile', () => {
  const tmpDir = makeTempDir();
  try {
    const result = executor.executeInstall('full', 'claude', {
      dryRun: true,
      projectRoot: tmpDir,
      pluginRoot: pluginRoot,
    });
    assert.ok(result.moduleCount > 0, 'Full profile should have modules');
    assert.ok(result.fileCount > 0, 'Full profile should have files');
  } finally {
    cleanup(tmpDir);
  }
});

test('executeInstall: dry-run for apex profile', () => {
  const tmpDir = makeTempDir();
  try {
    const result = executor.executeInstall('apex', 'claude', {
      dryRun: true,
      projectRoot: tmpDir,
      pluginRoot: pluginRoot,
    });
    assert.ok(result.moduleCount > 0, 'Apex profile should have modules');
  } finally {
    cleanup(tmpDir);
  }
});

test('executeInstall: dry-run for cursor target', () => {
  const tmpDir = makeTempDir();
  try {
    const result = executor.executeInstall('apex', 'cursor', {
      dryRun: true,
      projectRoot: tmpDir,
      pluginRoot: pluginRoot,
    });
    assert.ok(result, 'Should return result for cursor target');
    assert.ok(typeof result.fileCount === 'number');
  } finally {
    cleanup(tmpDir);
  }
});

// ── Tests: executeInstall with all valid profiles ────────────────────────────

for (const profile of executor.VALID_PROFILES) {
  test(`executeInstall: dry-run works for ${profile} profile`, () => {
    const tmpDir = makeTempDir();
    try {
      const result = executor.executeInstall(profile, 'claude', {
        dryRun: true,
        projectRoot: tmpDir,
        pluginRoot: pluginRoot,
      });
      assert.ok(result, `Should complete dry-run for ${profile}`);
      assert.ok(typeof result.fileCount === 'number');
      assert.ok(typeof result.moduleCount === 'number');
    } finally {
      cleanup(tmpDir);
    }
  });
}

// ── Tests: real installation (non-dry-run) ───────────────────────────────────

test('executeInstall: real install copies files to project root', () => {
  const tmpDir = makeTempDir();
  try {
    const result = executor.executeInstall('apex', 'claude', {
      dryRun: false,
      projectRoot: tmpDir,
      pluginRoot: pluginRoot,
    });

    // Should have created files
    if (result.fileCount > 0) {
      const claudeDir = path.join(tmpDir, '.claude');
      assert.ok(fs.existsSync(claudeDir),
        '.claude directory should be created after install');
    }
  } finally {
    cleanup(tmpDir);
  }
});

// ── Tests: installedFiles records ────────────────────────────────────────────

test('executeInstall: installedFiles records have required fields', () => {
  const tmpDir = makeTempDir();
  try {
    const result = executor.executeInstall('apex', 'claude', {
      dryRun: true,
      projectRoot: tmpDir,
      pluginRoot: pluginRoot,
    });

    for (const record of result.installedFiles) {
      assert.ok(record.destPath, 'Record should have destPath');
      assert.ok(record.srcPath, 'Record should have srcPath');
      assert.ok(record.module, 'Record should have module name');
    }
  } finally {
    cleanup(tmpDir);
  }
});

// ── Tests: pathGroups bundle format ──────────────────────────────────────────

test('executeInstall: pathGroups routes files to correct per-group targets', () => {
  const tmpDir = makeTempDir();
  try {
    const result = executor.executeInstall('apex', 'claude', {
      dryRun: true,
      projectRoot: tmpDir,
      pluginRoot: pluginRoot,
    });

    // Apex profile installs core + apex + platform + devops + security bundles
    // Each bundle uses pathGroups with different target dirs per content type
    assert.ok(result.fileCount > 0, 'Should install files');

    // Verify that agent files go to .claude/agents/, skills to skills/
    const agentFiles = result.installedFiles.filter(f => f.destPath.includes('/agents/'));
    const skillFiles = result.installedFiles.filter(f => f.destPath.includes('/skills/'));

    assert.ok(agentFiles.length > 0, 'Should have agent files in agents/ target');
    assert.ok(skillFiles.length > 0, 'Should have skill files in skills/ target');
  } finally {
    cleanup(tmpDir);
  }
});

test('executeInstall: pathGroups bundle produces more files than legacy would', () => {
  const tmpDir = makeTempDir();
  try {
    const result = executor.executeInstall('full', 'claude', {
      dryRun: true,
      projectRoot: tmpDir,
      pluginRoot: pluginRoot,
    });

    // Full profile should install all 7 bundles with many files
    assert.ok(result.fileCount > 100, `Full profile should install 100+ files, got ${result.fileCount}`);
    assert.ok(result.moduleCount === 7, `Full profile should have 7 bundles, got ${result.moduleCount}`);
  } finally {
    cleanup(tmpDir);
  }
});

// ── MCP config installation tests ───────────────────────────────────────────

test('executeInstall: installs MCP config as .mcp.json for claude target', () => {
  const tmpDir = makeTempDir();
  try {
    const result = executor.executeInstall('apex', 'claude', {
      dryRun: false,
      projectRoot: tmpDir,
      pluginRoot: pluginRoot,
    });

    const mcpPath = path.join(tmpDir, '.mcp.json');
    assert.ok(fs.existsSync(mcpPath), '.mcp.json should be created at project root');

    const content = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));
    assert.ok(content.mcpServers, 'MCP config should have mcpServers key');
    assert.ok(content.mcpServers['salesforce-dx'], 'Should include salesforce-dx server');

    const mcpRecord = result.installedFiles.find(f => f.destPath === mcpPath);
    assert.ok(mcpRecord, 'MCP config should be tracked in installedFiles');
  } finally {
    cleanup(tmpDir);
  }
});

test('executeInstall: installs MCP config as .cursor/mcp.json for cursor target', () => {
  const tmpDir = makeTempDir();
  try {
    const result = executor.executeInstall('apex', 'cursor', {
      dryRun: false,
      projectRoot: tmpDir,
      pluginRoot: pluginRoot,
    });

    const mcpPath = path.join(tmpDir, '.cursor', 'mcp.json');
    assert.ok(fs.existsSync(mcpPath), '.cursor/mcp.json should be created');

    const content = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));
    assert.ok(content.mcpServers, 'MCP config should have mcpServers key');
  } finally {
    cleanup(tmpDir);
  }
});

test('executeInstall: MCP config shows in dry-run output', () => {
  const tmpDir = makeTempDir();
  try {
    const result = executor.executeInstall('apex', 'claude', {
      dryRun: true,
      projectRoot: tmpDir,
      pluginRoot: pluginRoot,
    });

    const mcpRecord = result.installedFiles.find(f =>
      f.srcPath && f.srcPath.includes('mcp-servers.json')
    );
    assert.ok(mcpRecord, 'MCP config should be in dry-run installedFiles');
  } finally {
    cleanup(tmpDir);
  }
});

console.log(`\ninstall-executor.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
