#!/usr/bin/env node
'use strict';

/**
 * bump-version.js — Bump version in all SCC manifest files.
 *
 * Updates version consistently across:
 *   1. package.json
 *   2. .claude-plugin/plugin.json
 *   3. .claude-plugin/marketplace.json
 *   4. .cursor-plugin/plugin.json
 *   5. .cursor-plugin/marketplace.json
 *
 * Usage:
 *   node scripts/dev/bump-version.js <patch|minor|major>
 *   node scripts/dev/bump-version.js --set 2.0.0
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.env.CLAUDE_PLUGIN_ROOT || process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');

const VERSION_FILES = [
  'package.json',
  '.claude-plugin/plugin.json',
  '.claude-plugin/marketplace.json',
  '.cursor-plugin/plugin.json',
  '.cursor-plugin/marketplace.json',
];

function readVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  return pkg.version;
}

function bumpVersion(current, type) {
  const parts = current.split('.').map(Number);
  switch (type) {
    case 'major':
      return `${parts[0] + 1}.0.0`;
    case 'minor':
      return `${parts[0]}.${parts[1] + 1}.0`;
    case 'patch':
      return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
    default:
      throw new Error(`Unknown bump type: ${type}. Use patch, minor, or major.`);
  }
}

function updateFile(filePath, oldVersion, newVersion) {
  const fullPath = path.join(ROOT, filePath);
  if (!fs.existsSync(fullPath)) return false;

  const content = fs.readFileSync(fullPath, 'utf8');
  const updated = content.replace(
    new RegExp(`"version":\\s*"${oldVersion.replace(/\./g, '\\.')}"`, 'g'),
    `"version": "${newVersion}"`
  );

  if (updated !== content) {
    fs.writeFileSync(fullPath, updated, 'utf8');
    return true;
  }
  return false;
}

// ── Main ─────────────────────────────────────────────────────────────────────

const arg = process.argv[2];

if (!arg || arg === '--help' || arg === '-h') {
  console.log('Usage: bump-version.js <patch|minor|major> or --set <version>');
  process.exit(0);
}

const currentVersion = readVersion();
let newVersion;

if (arg === '--set') {
  newVersion = process.argv[3];
  if (!newVersion || !/^\d+\.\d+\.\d+$/.test(newVersion)) {
    console.error('Error: --set requires a valid semver version (e.g., 2.0.0)');
    process.exit(1);
  }
} else {
  newVersion = bumpVersion(currentVersion, arg);
}

let updated = 0;
for (const file of VERSION_FILES) {
  if (updateFile(file, currentVersion, newVersion)) {
    updated++;
  }
}

console.log(`${currentVersion} → ${newVersion} (${updated} file(s) updated)`);
// Output just the version for scripts to capture
process.stdout.write(newVersion);
