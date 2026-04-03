#!/usr/bin/env node
'use strict';

/**
 * build-cursor-hooks.js — Generate Cursor-compatible hooks.json from Claude Code hooks.
 *
 * Reads hooks/hooks.json (Claude Code format), transforms via hooks-adapter,
 * and writes the output to .cursor/hooks.json.
 *
 * Usage:
 *   node scripts/dev/build-cursor-hooks.js [--dry-run] [--help]
 */

const fs = require('fs');
const path = require('path');
const { getPluginRoot } = require('../lib/utils');
const { transformHooks } = require('../lib/hooks-adapter');

function showHelp() {
  console.log(`
build-cursor-hooks — Generate Cursor-compatible hooks from SCC source.

Usage:
  node scripts/dev/build-cursor-hooks.js [options]

Options:
  --dry-run   Show what would be generated without writing files
  --help, -h  Show this help
`);
  process.exit(0);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = { dryRun: false };
  for (const arg of args) {
    if (arg === '--help' || arg === '-h') showHelp();
    if (arg === '--dry-run') opts.dryRun = true;
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv);
  const pluginRoot = getPluginRoot();
  const srcPath = path.join(pluginRoot, 'hooks', 'hooks.json');
  const destPath = path.join(pluginRoot, '.cursor', 'hooks.json');

  if (!fs.existsSync(srcPath)) {
    console.error('[ERROR] hooks/hooks.json not found');
    process.exit(1);
  }

  console.log(`\nBuilding Cursor hooks${opts.dryRun ? ' [DRY RUN]' : ''}...`);
  console.log(`Source: ${srcPath}`);
  console.log(`Output: ${destPath}`);

  const claudeHooks = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
  const cursorHooks = transformHooks(claudeHooks);

  // Count hooks per event
  let totalHooks = 0;
  for (const [event, hooks] of Object.entries(cursorHooks.hooks)) {
    totalHooks += hooks.length;
    if (opts.dryRun) {
      console.log(`  [dry-run] ${event}: ${hooks.length} hook(s)`);
    }
  }

  if (!opts.dryRun) {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, JSON.stringify(cursorHooks, null, 2) + '\n', 'utf8');
    const eventCount = Object.keys(cursorHooks.hooks).length;
    console.log(`  [OK] ${totalHooks} hooks across ${eventCount} events`);
  }

  console.log(`\n${opts.dryRun ? '[DRY RUN] Would build' : 'Built'} Cursor hooks in .cursor/hooks.json`);
}

main();
