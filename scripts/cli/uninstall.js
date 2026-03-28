#!/usr/bin/env node
'use strict';

/**
 * uninstall.js — Remove SCC-managed files.
 *
 * Reads the state store to find all files installed by SCC and removes them.
 * Optionally prunes empty directories.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { loadState, clearState, removeFiles } = require('../lib/state-store');
const { fileExists } = require('../lib/utils');

function showHelp(exitCode = 0) {
  console.log(`
scc uninstall — Remove SCC-managed files

Usage:
  scc uninstall [options]

Options:
  --target <name>  Only uninstall files for a specific target
  --dry-run        Show what would be removed without making changes
  --yes, -y        Skip confirmation prompt
  --keep-state     Remove files but keep the state store
  --json           Output result as JSON
  --help, -h       Show this help

Notes:
  Only files tracked in the SCC state store will be removed.
  Files you manually added to .claude/ etc. will not be touched.
`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = { target: null, dryRun: false, yes: false, keepState: false, json: false, help: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--yes' || arg === '-y') opts.yes = true;
    else if (arg === '--keep-state') opts.keepState = true;
    else if (arg === '--json') opts.json = true;
    else if (arg === '--target' && args[i + 1]) opts.target = args[++i];
  }
  return opts;
}

async function confirm(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) showHelp(0);

  const state = loadState();

  if (!state.installedFiles || state.installedFiles.length === 0) {
    const msg = 'No SCC installation found. Nothing to uninstall.';
    if (opts.json) console.log(JSON.stringify({ status: 'not-installed', message: msg }));
    else console.log(`[INFO] ${msg}`);
    process.exit(0);
  }

  // Filter by target if specified
  let filesToRemove = state.installedFiles;
  if (opts.target) {
    filesToRemove = filesToRemove.filter(f => f.target === opts.target);
    if (filesToRemove.length === 0) {
      console.log(`[INFO] No files found for target: ${opts.target}`);
      process.exit(0);
    }
  }

  // Only consider files that actually exist
  const existingFiles = filesToRemove.filter(f => fileExists(f.destPath));
  const missingFiles = filesToRemove.filter(f => !fileExists(f.destPath));

  if (!opts.json) {
    console.log(`\nSCC Uninstall${opts.dryRun ? ' (DRY RUN)' : ''}`);
    console.log(`${'─'.repeat(50)}`);
    console.log(`Files to remove : ${existingFiles.length}`);
    if (missingFiles.length > 0) {
      console.log(`Already missing : ${missingFiles.length} (will clear from state)`);
    }
    console.log();

    if (opts.dryRun || opts.json) {
      // just list
    } else if (existingFiles.length > 0) {
      console.log('Files that will be deleted:');
      for (const f of existingFiles) {
        console.log(`  ${f.destPath}`);
      }
      console.log();
    }
  }

  if (opts.dryRun) {
    if (opts.json) {
      console.log(JSON.stringify({ status: 'dry-run', wouldRemove: existingFiles.map(f => f.destPath), alreadyMissing: missingFiles.map(f => f.destPath) }, null, 2));
    } else {
      console.log(`[dry-run] Would remove ${existingFiles.length} file(s).`);
    }
    process.exit(0);
  }

  // Prompt for confirmation unless --yes
  if (!opts.yes && !opts.json && existingFiles.length > 0) {
    const answer = await confirm(`Remove ${existingFiles.length} file(s)? [y/N] `);
    if (answer !== 'y' && answer !== 'yes') {
      console.log('Aborted.');
      process.exit(0);
    }
  }

  // Remove files
  const removed = [];
  const errors = [];

  for (const f of existingFiles) {
    try {
      fs.unlinkSync(f.destPath);
      removed.push(f.destPath);
      if (!opts.json) console.log(`  [REMOVED] ${f.destPath}`);
    } catch (err) {
      errors.push({ path: f.destPath, error: err.message });
      if (!opts.json) console.error(`  [ERROR] Failed to remove ${f.destPath}: ${err.message}`);
    }
  }

  // Try to prune empty directories
  const dirsToCheck = new Set(existingFiles.map(f => path.dirname(f.destPath)));
  const pruned = [];
  for (const dir of dirsToCheck) {
    try {
      const entries = fs.readdirSync(dir);
      if (entries.length === 0) {
        fs.rmdirSync(dir);
        pruned.push(dir);
        if (!opts.json) console.log(`  [PRUNED] empty dir: ${dir}`);
      }
    } catch { /* ignore */ }
  }

  // Update state
  if (!opts.keepState) {
    if (opts.target) {
      // Only remove files for this target from state
      removeFiles(filesToRemove.map(f => f.destPath));
    } else {
      clearState();
    }
  }

  const result = {
    status: errors.length > 0 ? 'partial' : 'ok',
    removed: removed.length,
    failed: errors.length,
    prunedDirs: pruned.length,
    removedFiles: removed,
    failedFiles: errors,
  };

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log();
    console.log(`Removed: ${removed.length} file(s).`);
    if (pruned.length > 0) console.log(`Pruned : ${pruned.length} empty director(ies).`);
    if (errors.length > 0) console.log(`Errors : ${errors.length} file(s) could not be removed.`);
    if (!opts.keepState) console.log('State  : cleared.');
  }

  process.exit(errors.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error(`[FATAL] ${err.message}`);
  process.exit(1);
});
