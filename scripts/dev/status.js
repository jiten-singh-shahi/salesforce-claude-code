#!/usr/bin/env node
'use strict';

/**
 * status.js — Query and display SCC installation status.
 *
 * Shows: installed profile, modules, file counts, last install date,
 * session history.
 */

const path = require('path');
const { loadState } = require('../lib/state-store');
const { fileExists } = require('../lib/utils');

function showHelp(exitCode = 0) {
  console.log(`
scc status — Show SCC installation status

Usage:
  scc status [options]

Options:
  --json        Output as JSON
  --sessions    Show session history
  --files       Show all tracked file paths
  --help, -h    Show this help
`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = { json: false, showSessions: false, showFiles: false, help: false };
  for (const arg of args) {
    if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg === '--json') opts.json = true;
    else if (arg === '--sessions') opts.showSessions = true;
    else if (arg === '--files') opts.showFiles = true;
  }
  return opts;
}

const opts = parseArgs(process.argv);
if (opts.help) showHelp(0);

const state = loadState();

if (!state.installedFiles || state.installedFiles.length === 0) {
  if (opts.json) {
    console.log(JSON.stringify({ installed: false, message: 'SCC is not installed.' }, null, 2));
  } else {
    console.log('[INFO] SCC is not installed. Run `scc install` to get started.');
  }
  process.exit(0);
}

// Build per-module counts
const moduleMap = {};
for (const f of state.installedFiles) {
  const mod = f.module || 'unknown';
  if (!moduleMap[mod]) moduleMap[mod] = { module: mod, fileCount: 0, files: [] };
  moduleMap[mod].fileCount++;
  moduleMap[mod].files.push(f.destPath);
}

// Count healthy vs missing
let presentCount = 0;
let missingCount = 0;
for (const f of state.installedFiles) {
  if (fileExists(f.destPath)) presentCount++;
  else missingCount++;
}

// Derive unique content types
const contentTypes = [...new Set(state.installedFiles.map(f => {
  const parts = f.destPath ? f.destPath.split(path.sep) : [];
  // Look for .claude/agents, .claude/skills, etc.
  const markerIdx = parts.findIndex(p => p === '.claude' || p === '.cursor');
  if (markerIdx !== -1 && parts[markerIdx + 1]) return parts[markerIdx + 1];
  return 'unknown';
}))];

const statusData = {
  installed: true,
  profile: state.profile || 'unknown',
  target: state.target || 'unknown',
  installedAt: state.installedAt || 'unknown',
  totalFiles: state.installedFiles.length,
  presentFiles: presentCount,
  missingFiles: missingCount,
  modules: Object.values(moduleMap).map(m => ({ module: m.module, fileCount: m.fileCount })),
  contentTypes,
  health: missingCount === 0 ? 'healthy' : 'degraded',
};

if (opts.json) {
  const output = { ...statusData };
  if (opts.showSessions) output.sessions = state.sessions || [];
  if (opts.showFiles) output.files = state.installedFiles.map(f => f.destPath);
  console.log(JSON.stringify(output, null, 2));
  process.exit(0);
}

// Human-readable
console.log(`\nSCC Status`);
console.log(`${'─'.repeat(50)}`);
console.log(`Profile      : ${statusData.profile}`);
console.log(`Target       : ${statusData.target}`);
console.log(`Installed at : ${statusData.installedAt}`);
console.log(`Health       : ${statusData.health === 'healthy' ? 'HEALTHY' : `DEGRADED (${missingCount} file(s) missing)`}`);
console.log();
console.log(`Files        : ${statusData.totalFiles} tracked (${presentCount} present, ${missingCount} missing)`);
console.log(`Content types: ${contentTypes.join(', ')}`);
console.log();

if (Object.keys(moduleMap).length > 0) {
  console.log(`Installed modules (${Object.keys(moduleMap).length}):`);
  for (const mod of Object.values(moduleMap).sort((a, b) => a.module.localeCompare(b.module))) {
    console.log(`  ${mod.module.padEnd(30)} ${mod.fileCount} file(s)`);
  }
  console.log();
}

if (opts.showFiles) {
  console.log(`Tracked files (${state.installedFiles.length}):`);
  for (const f of state.installedFiles) {
    const marker = fileExists(f.destPath) ? ' ' : ' [MISSING]';
    console.log(`  ${f.destPath}${marker}`);
  }
  console.log();
}

if (opts.showSessions && state.sessions && state.sessions.length > 0) {
  console.log(`Session history (${Math.min(state.sessions.length, 10)} most recent):`);
  for (const s of state.sessions.slice(0, 10)) {
    console.log(`  ${s.installedAt}  profile=${s.profile}  target=${s.target}  files=${s.fileCount}`);
  }
  console.log();
}

if (missingCount > 0) {
  console.log(`[WARN] ${missingCount} file(s) are missing. Run \`scc repair\` to restore them.`);
}
