#!/usr/bin/env node
'use strict';

/**
 * build-cursor-skills.js — Generate Cursor-compatible skills from SCC source skills.
 *
 * Reads all skills from skills/, transforms each via skill-adapter,
 * and writes the output to .cursor/skills/.
 *
 * Usage:
 *   node scripts/dev/build-cursor-skills.js [--dry-run] [--help]
 */

const fs = require('fs');
const path = require('path');
const { getPluginRoot } = require('../lib/utils');
const { transformSkillDir } = require('../lib/skill-adapter');

function showHelp() {
  console.log(`
build-cursor-skills — Generate Cursor-compatible skills from SCC source.

Usage:
  node scripts/dev/build-cursor-skills.js [options]

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
  const srcSkillsDir = path.join(pluginRoot, 'skills');
  const destSkillsDir = path.join(pluginRoot, '.cursor', 'skills');

  if (!fs.existsSync(srcSkillsDir)) {
    console.error('[ERROR] skills/ directory not found');
    process.exit(1);
  }

  const entries = fs.readdirSync(srcSkillsDir, { withFileTypes: true });
  const skillDirs = entries.filter(e => e.isDirectory());

  if (skillDirs.length === 0) {
    console.log('No skill directories found in skills/');
    process.exit(0);
  }

  console.log(`\nBuilding Cursor skills${opts.dryRun ? ' [DRY RUN]' : ''}...`);
  console.log(`Source: ${srcSkillsDir}`);
  console.log(`Output: ${destSkillsDir}\n`);

  // Clean destination before building (fresh build)
  if (!opts.dryRun && fs.existsSync(destSkillsDir)) {
    fs.rmSync(destSkillsDir, { recursive: true, force: true });
  }

  let count = 0;

  for (const entry of skillDirs) {
    const srcDir = path.join(srcSkillsDir, entry.name);
    const destDir = path.join(destSkillsDir, entry.name);

    // Verify skill has a SKILL.md
    const skillMd = path.join(srcDir, 'SKILL.md');
    if (!fs.existsSync(skillMd)) {
      console.warn(`  [SKIP] ${entry.name}/ — no SKILL.md found`);
      continue;
    }

    if (opts.dryRun) {
      console.log(`  [dry-run] Would build: ${entry.name}/`);
    } else {
      transformSkillDir(srcDir, destDir);
      console.log(`  [OK] ${entry.name}/`);
    }
    count++;
  }

  console.log(`\n${opts.dryRun ? '[DRY RUN] Would build' : 'Built'} ${count} Cursor skill(s) in .cursor/skills/`);
}

main();
