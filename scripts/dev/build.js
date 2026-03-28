#!/usr/bin/env node
'use strict';

/**
 * build.js — Unified build for SCC.
 *
 * Generates all derived content from source of truth:
 *   1. Cursor skills   — adapter-transforms skills/ → .cursor/skills/
 *   2. Cursor agents   — adapter-transforms agents/ → .cursor/agents/
 *   3. Cursor MCP      — copies mcp-configs/mcp-servers.json → .cursor/mcp.json
 *   4. Claude MCP      — copies mcp-configs/mcp-servers.json → .mcp.json
 *
 * Run automatically:
 *   - Before every `npm test`
 *   - In CI via `npm run build`
 *   - As pre-commit hook
 *
 * Usage:
 *   node scripts/dev/build.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { getPluginRoot } = require('../lib/utils');

const pluginRoot = getPluginRoot();
const dryRun = process.argv.includes('--dry-run');

let errors = 0;

function run(label, command, args) {
  console.log(`\n[build] ${label}...`);
  if (dryRun) {
    console.log(`  [dry-run] Would run: ${command} ${args.join(' ')}`);
    return;
  }
  const result = spawnSync(command, args, {
    cwd: pluginRoot,
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: pluginRoot, SCC_PLUGIN_ROOT: pluginRoot },
    timeout: 60000,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    console.error(`  [FAIL] ${label} exited with code ${result.status}`);
    errors++;
  }
}

function copyFile(src, dest, label) {
  console.log(`\n[build] ${label}...`);
  const srcPath = path.join(pluginRoot, src);
  const destPath = path.join(pluginRoot, dest);
  if (!fs.existsSync(srcPath)) {
    console.error(`  [FAIL] Source not found: ${src}`);
    errors++;
    return;
  }
  if (dryRun) {
    console.log(`  [dry-run] Would copy: ${src} → ${dest}`);
    return;
  }
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.copyFileSync(srcPath, destPath);
  console.log(`  [OK] ${src} → ${dest}`);
}

// ── Build steps ──────────────────────────────────────────────────────────────

console.log(`SCC Build${dryRun ? ' [DRY RUN]' : ''}`);
console.log('═'.repeat(50));

// 1. Cursor skills
run('Cursor skills', process.execPath, [path.join(pluginRoot, 'scripts', 'dev', 'build-cursor-skills.js')]);

// 2. Cursor agents
run('Cursor agents', process.execPath, [path.join(pluginRoot, 'scripts', 'dev', 'build-cursor-agents.js')]);

// MCP: No copy needed — both plugin.json files reference mcp-configs/mcp-servers.json directly

// ── Summary ──────────────────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(50));
if (errors > 0) {
  console.error(`Build FAILED with ${errors} error(s)`);
  process.exit(1);
} else {
  console.log('Build completed successfully');
}
