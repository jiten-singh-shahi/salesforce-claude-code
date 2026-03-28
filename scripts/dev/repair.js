#!/usr/bin/env node
'use strict';

/**
 * repair.js — Restore drifted or missing SCC-managed files.
 *
 * Uses the state store to find tracked files and re-copies them
 * from their original source paths.
 */

const { loadState, saveState } = require('../lib/state-store');
const { fileExists, copyFile, simpleHash } = require('../lib/utils');

function showHelp(exitCode = 0) {
  console.log(`
scc repair — Restore missing or drifted SCC files

Usage:
  scc repair [options]

Options:
  --dry-run      Show what would be repaired without making changes
  --missing      Repair only missing files (skip drifted)
  --drifted      Repair only drifted files (skip missing)
  --json         Output result as JSON
  --help, -h     Show this help

Notes:
  Repair works by re-copying files from their original source paths.
  If the plugin source has been moved or deleted, repair will report
  which files cannot be restored.
`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = { dryRun: false, missingOnly: false, driftedOnly: false, json: false, help: false };
  for (const arg of args) {
    if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--missing') opts.missingOnly = true;
    else if (arg === '--drifted') opts.driftedOnly = true;
    else if (arg === '--json') opts.json = true;
  }
  return opts;
}

const opts = parseArgs(process.argv);
if (opts.help) showHelp(0);

const state = loadState();

if (!state.installedFiles || state.installedFiles.length === 0) {
  const msg = 'No SCC installation found. Run `scc install` first.';
  if (opts.json) console.log(JSON.stringify({ status: 'not-installed', message: msg }));
  else console.log(`[INFO] ${msg}`);
  process.exit(0);
}

// Find files that need repair
const toRepair = [];
const cannotRepair = [];

for (const record of state.installedFiles) {
  const { destPath, srcPath, hash } = record;

  const isMissing = !fileExists(destPath);
  const currentHash = isMissing ? null : simpleHash(destPath);
  const isDrifted = !isMissing && hash && currentHash !== hash;

  if (!isMissing && !isDrifted) continue; // healthy

  if (opts.missingOnly && !isMissing) continue;
  if (opts.driftedOnly && !isDrifted) continue;

  const status = isMissing ? 'missing' : 'drifted';
  const canFix = srcPath && fileExists(srcPath);

  if (!canFix) {
    cannotRepair.push({ status, destPath, srcPath, reason: srcPath ? 'Source file not found' : 'No source path recorded' });
  } else {
    toRepair.push({ status, destPath, srcPath, currentHash, expectedHash: hash });
  }
}

const totalIssues = toRepair.length + cannotRepair.length;

if (totalIssues === 0) {
  const msg = 'All tracked files are present and unmodified. Nothing to repair.';
  if (opts.json) console.log(JSON.stringify({ status: 'healthy', message: msg, repaired: [], failed: [] }));
  else console.log(`[OK] ${msg}`);
  process.exit(0);
}

if (!opts.json) {
  console.log(`\nSCC Repair${opts.dryRun ? ' (DRY RUN)' : ''}`);
  console.log(`${'─'.repeat(50)}`);
  console.log(`Issues found : ${totalIssues} (${toRepair.length} repairable, ${cannotRepair.length} cannot repair)`);
  console.log();
}

// Report unrepairable files
if (cannotRepair.length > 0 && !opts.json) {
  console.log(`Cannot repair (${cannotRepair.length}):`);
  for (const f of cannotRepair) {
    console.log(`  [${f.status.toUpperCase()}] ${f.destPath}`);
    console.log(`         Reason: ${f.reason}`);
    if (f.srcPath) console.log(`         Expected source: ${f.srcPath}`);
  }
  console.log();
}

// Repair what we can
const repaired = [];
const errors = [];

for (const f of toRepair) {
  if (opts.dryRun) {
    if (!opts.json) console.log(`  [dry-run] Would restore ${f.status}: ${f.destPath}`);
    repaired.push({ ...f, action: 'would-restore' });
    continue;
  }

  try {
    copyFile(f.srcPath, f.destPath);
    const newHash = simpleHash(f.destPath);
    if (!opts.json) console.log(`  [REPAIRED] ${f.destPath}`);
    repaired.push({ ...f, action: 'restored', newHash });
  } catch (err) {
    if (!opts.json) console.error(`  [ERROR] Failed to restore ${f.destPath}: ${err.message}`);
    errors.push({ ...f, error: err.message });
  }
}

// Update state with new hashes for repaired files
if (!opts.dryRun && repaired.length > 0) {
  const updatedFiles = state.installedFiles.map(record => {
    const fix = repaired.find(r => r.destPath === record.destPath);
    if (fix && fix.newHash) return { ...record, hash: fix.newHash };
    return record;
  });
  saveState({
    profile: state.profile,
    target: state.target,
    installedAt: state.installedAt,
    installedFiles: updatedFiles,
  });
}

const result = {
  status: errors.length > 0 ? 'partial' : opts.dryRun ? 'dry-run' : 'ok',
  dryRun: opts.dryRun,
  repaired: repaired.length,
  failed: errors.length,
  cannotRepair: cannotRepair.length,
  repairedFiles: repaired,
  failedFiles: errors,
  unrepairableFiles: cannotRepair,
};

if (opts.json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log();
  if (opts.dryRun) {
    console.log(`[dry-run] Would repair ${repaired.length} file(s).`);
  } else {
    console.log(`Repaired: ${repaired.length} file(s).`);
    if (errors.length > 0) console.log(`Errors  : ${errors.length} file(s) failed.`);
    if (cannotRepair.length > 0) console.log(`Skipped : ${cannotRepair.length} file(s) (source unavailable).`);
  }
}

process.exit(errors.length > 0 ? 1 : 0);
