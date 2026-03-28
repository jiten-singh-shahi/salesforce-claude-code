#!/usr/bin/env node
'use strict';

/**
 * build-cursor-agents.js — Generate Cursor-compatible agents from SCC source agents.
 *
 * Reads all agent .md files from agents/, transforms each via agent-adapter,
 * and writes the output to .cursor/agents/.
 *
 * Usage:
 *   node scripts/dev/build-cursor-agents.js [--dry-run] [--help]
 */

const fs = require('fs');
const path = require('path');
const { getPluginRoot } = require('../lib/utils');
const { transformAgentFile } = require('../lib/agent-adapter');

function showHelp() {
  console.log(`
build-cursor-agents — Generate Cursor-compatible agents from SCC source.

Usage:
  node scripts/dev/build-cursor-agents.js [options]

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
  const srcAgentsDir = path.join(pluginRoot, 'agents');
  const destAgentsDir = path.join(pluginRoot, '.cursor', 'agents');

  if (!fs.existsSync(srcAgentsDir)) {
    console.error('[ERROR] agents/ directory not found');
    process.exit(1);
  }

  const agentFiles = fs.readdirSync(srcAgentsDir)
    .filter(f => f.endsWith('.md'));

  if (agentFiles.length === 0) {
    console.log('No agent .md files found in agents/');
    process.exit(0);
  }

  console.log(`\nBuilding Cursor agents${opts.dryRun ? ' [DRY RUN]' : ''}...`);
  console.log(`Source: ${srcAgentsDir}`);
  console.log(`Output: ${destAgentsDir}\n`);

  // Clean destination before building (fresh build)
  if (!opts.dryRun && fs.existsSync(destAgentsDir)) {
    fs.rmSync(destAgentsDir, { recursive: true, force: true });
  }

  let count = 0;

  for (const filename of agentFiles) {
    const srcPath = path.join(srcAgentsDir, filename);
    const destPath = path.join(destAgentsDir, filename);

    if (opts.dryRun) {
      console.log(`  [dry-run] Would build: ${filename}`);
    } else {
      transformAgentFile(srcPath, destPath);
      console.log(`  [OK] ${filename}`);
    }
    count++;
  }

  console.log(`\n${opts.dryRun ? '[DRY RUN] Would build' : 'Built'} ${count} Cursor agent(s) in .cursor/agents/`);
}

main();
