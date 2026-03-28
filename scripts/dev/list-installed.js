#!/usr/bin/env node
'use strict';

/**
 * list-installed.js — List currently installed SCC content.
 *
 * Shows all files tracked by SCC, grouped by module or content type.
 */

const path = require('path');
const { loadState } = require('../lib/state-store');
const { fileExists } = require('../lib/utils');

function showHelp(exitCode = 0) {
  console.log(`
scc list-installed — List installed SCC content

Usage:
  scc list-installed [options]

Options:
  --group-by <field>  Group by: module|content-type|target (default: module)
  --json              Output as JSON
  --missing           Show only missing files
  --help, -h          Show this help
`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = { groupBy: 'module', json: false, missingOnly: false, help: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg === '--json') opts.json = true;
    else if (arg === '--missing') opts.missingOnly = true;
    else if (arg === '--group-by' && args[i + 1]) opts.groupBy = args[++i];
  }
  return opts;
}

const opts = parseArgs(process.argv);
if (opts.help) showHelp(0);

const state = loadState();

if (!state.installedFiles || state.installedFiles.length === 0) {
  if (opts.json) {
    console.log(JSON.stringify({ installed: false, files: [] }, null, 2));
  } else {
    console.log('[INFO] No SCC content installed. Run `scc install` to get started.');
  }
  process.exit(0);
}

// Add presence check to each file
let files = state.installedFiles.map(f => ({
  ...f,
  present: fileExists(f.destPath),
}));

if (opts.missingOnly) {
  files = files.filter(f => !f.present);
  if (files.length === 0) {
    if (!opts.json) console.log('[OK] All installed files are present on disk.');
    else console.log(JSON.stringify({ missing: 0, files: [] }, null, 2));
    process.exit(0);
  }
}

if (opts.json) {
  console.log(JSON.stringify({
    profile: state.profile,
    target: state.target,
    installedAt: state.installedAt,
    totalFiles: state.installedFiles.length,
    presentFiles: files.filter(f => f.present).length,
    files: files.map(f => ({
      path: f.destPath,
      module: f.module,
      present: f.present,
      installedAt: f.installedAt,
    })),
  }, null, 2));
  process.exit(0);
}

// Human-readable grouped output
console.log(`\nInstalled SCC Content`);
console.log(`${'─'.repeat(50)}`);
console.log(`Profile: ${state.profile || 'unknown'}  Target: ${state.target || 'unknown'}`);
console.log(`Installed: ${state.installedAt || 'unknown'}`);
console.log();

if (opts.groupBy === 'module') {
  const groups = {};
  for (const f of files) {
    const key = f.module || 'unknown';
    if (!groups[key]) groups[key] = [];
    groups[key].push(f);
  }
  for (const [module, moduleFiles] of Object.entries(groups).sort()) {
    console.log(`${module} (${moduleFiles.length} file(s)):`);
    for (const f of moduleFiles) {
      const status = f.present ? '' : ' [MISSING]';
      console.log(`  ${f.destPath}${status}`);
    }
    console.log();
  }
} else if (opts.groupBy === 'content-type') {
  const groups = {};
  for (const f of files) {
    const parts = (f.destPath || '').split(path.sep);
    // Find content type directory (.claude/agents → agents)
    const markers = ['.claude', '.cursor'];
    const markerIdx = parts.findIndex(p => markers.includes(p));
    const key = (markerIdx !== -1 && parts[markerIdx + 1]) ? parts[markerIdx + 1] : 'other';
    if (!groups[key]) groups[key] = [];
    groups[key].push(f);
  }
  for (const [type, typeFiles] of Object.entries(groups).sort()) {
    console.log(`${type} (${typeFiles.length} file(s)):`);
    for (const f of typeFiles) {
      const status = f.present ? '' : ' [MISSING]';
      console.log(`  ${f.destPath}${status}`);
    }
    console.log();
  }
} else {
  // Flat list
  for (const f of files) {
    const status = f.present ? '' : ' [MISSING]';
    console.log(`  ${f.destPath}${status}`);
  }
  console.log();
}

const missingCount = files.filter(f => !f.present).length;
console.log(`Total: ${files.length} file(s)${missingCount > 0 ? `, ${missingCount} missing` : ', all present'}.`);
if (missingCount > 0) console.log(`Run \`scc repair\` to restore missing files.`);
