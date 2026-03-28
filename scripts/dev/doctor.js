#!/usr/bin/env node
'use strict';

/**
 * doctor.js — Diagnose missing or drifted SCC-managed files.
 *
 * Reports:
 *   - Files that are installed (present and matching)
 *   - Files that are missing (tracked but not on disk)
 *   - Files that have drifted (present but content changed)
 */

const { loadState } = require('../lib/state-store');
const { fileExists, simpleHash } = require('../lib/utils');

function showHelp(exitCode = 0) {
  console.log(`
scc doctor — Diagnose SCC installation health

Usage:
  scc doctor [options]

Options:
  --json        Output as JSON
  --verbose     Show all files including healthy ones
  --help, -h    Show this help
`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = { json: false, verbose: false, help: false };
  for (const arg of args) {
    if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg === '--json') opts.json = true;
    else if (arg === '--verbose') opts.verbose = true;
  }
  return opts;
}

const opts = parseArgs(process.argv);
if (opts.help) showHelp(0);

const state = loadState();

if (!state.installedFiles || state.installedFiles.length === 0) {
  if (opts.json) {
    console.log(JSON.stringify({ status: 'not-installed', message: 'No SCC installation found.', files: [] }, null, 2));
  } else {
    console.log('[INFO] No SCC installation found. Run `scc install` first.');
  }
  process.exit(0);
}

// Categorise each file
const results = [];
let missingCount = 0;
let driftedCount = 0;
let healthyCount = 0;

for (const record of state.installedFiles) {
  const destPath = record.destPath;

  if (!fileExists(destPath)) {
    results.push({ status: 'missing', ...record });
    missingCount++;
    continue;
  }

  const currentHash = simpleHash(destPath);
  if (record.hash && currentHash !== record.hash) {
    results.push({ status: 'drifted', currentHash, ...record });
    driftedCount++;
  } else {
    results.push({ status: 'ok', ...record });
    healthyCount++;
  }
}

// Also check if source files are still available to repair from
const srcAvailable = results.filter(r => r.srcPath && fileExists(r.srcPath)).length;

const summary = {
  profile: state.profile,
  target: state.target,
  installedAt: state.installedAt,
  totalTracked: state.installedFiles.length,
  healthy: healthyCount,
  missing: missingCount,
  drifted: driftedCount,
  canRepair: srcAvailable,
  status: missingCount === 0 && driftedCount === 0 ? 'healthy' : missingCount > 0 ? 'degraded' : 'drifted',
};

if (opts.json) {
  console.log(JSON.stringify({ summary, files: opts.verbose ? results : results.filter(r => r.status !== 'ok') }, null, 2));
  process.exit(missingCount > 0 || driftedCount > 0 ? 1 : 0);
}

// Human-readable
console.log(`\nSCC Doctor Report`);
console.log(`${'─'.repeat(50)}`);
console.log(`Profile      : ${state.profile || 'unknown'}`);
console.log(`Target       : ${state.target || 'unknown'}`);
console.log(`Installed at : ${state.installedAt || 'unknown'}`);
console.log(`Tracked files: ${state.installedFiles.length}`);
console.log();

if (missingCount === 0 && driftedCount === 0) {
  console.log(`Status: HEALTHY — all ${healthyCount} file(s) are present and unmodified.`);
  if (opts.verbose) {
    console.log();
    for (const r of results) {
      console.log(`  [OK]   ${r.destPath}`);
    }
  }
  process.exit(0);
}

// Print issues
if (missingCount > 0) {
  console.log(`Missing files (${missingCount}):`);
  for (const r of results.filter(f => f.status === 'missing')) {
    console.log(`  [MISSING] ${r.destPath}`);
    if (r.srcPath) console.log(`            Source: ${r.srcPath}`);
  }
  console.log();
}

if (driftedCount > 0) {
  console.log(`Drifted files (${driftedCount}) — content has changed since install:`);
  for (const r of results.filter(f => f.status === 'drifted')) {
    console.log(`  [DRIFTED] ${r.destPath}`);
    console.log(`            Expected hash: ${r.hash}, Current: ${r.currentHash}`);
  }
  console.log();
}

if (opts.verbose && healthyCount > 0) {
  console.log(`Healthy files (${healthyCount}):`);
  for (const r of results.filter(f => f.status === 'ok')) {
    console.log(`  [OK]   ${r.destPath}`);
  }
  console.log();
}

console.log(`Summary: ${healthyCount} healthy, ${missingCount} missing, ${driftedCount} drifted`);
if (missingCount > 0 || driftedCount > 0) {
  console.log(`Run \`scc repair\` to restore missing/drifted files.`);
}

process.exit(missingCount > 0 || driftedCount > 0 ? 1 : 0);
