#!/usr/bin/env node
'use strict';

/**
 * stop-hook.js — Stop hook for SCC.
 *
 * Runs when Claude Code is about to stop/complete a session.
 * Checks for uncommitted Apex/LWC changes and reminds about:
 *   - Running tests before committing
 *   - Deploying to a scratch org to verify
 *   - Checking test coverage
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const CWD = process.cwd();

/**
 * Run a command and return { status, stdout, stderr }.
 */
function run(cmd, args, cwd) {
  const result = spawnSync(cmd, args, {
    encoding: 'utf8',
    timeout: 10000,
    cwd: cwd || CWD,
    env: process.env,
  });
  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error,
  };
}

/**
 * Get uncommitted files via git status --porcelain.
 */
function getUncommittedFiles() {
  const result = run('git', ['status', '--porcelain']);
  if (result.status !== 0 || result.error) return null;

  return result.stdout
    .split('\n')
    .filter(line => line.trim().length > 0)
    .map(line => {
      const statusCode = line.slice(0, 2).trim();
      const filePath = line.slice(3).trim();
      return { statusCode, filePath };
    });
}

/**
 * Check if this is a Salesforce project.
 */
function isSalesforceProject(dir) {
  let d = dir;
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(d, 'sfdx-project.json'))) return true;
    const parent = path.dirname(d);
    if (parent === d) break;
    d = parent;
  }
  return false;
}

/**
 * Classify Salesforce file types.
 */
function classifyFiles(files) {
  const classified = { apex: [], lwc: [], aura: [], other: [] };
  for (const f of files) {
    const fp = f.filePath;
    const ext = path.extname(fp).toLowerCase();
    const parts = fp.split('/');

    if (ext === '.cls' || ext === '.trigger') {
      classified.apex.push(f);
    } else if (parts.includes('lwc')) {
      classified.lwc.push(f);
    } else if (parts.includes('aura')) {
      classified.aura.push(f);
    } else {
      classified.other.push(f);
    }
  }
  return classified;
}

// ── Main ─────────────────────────────────────────────────────────────────────

// Only run in Salesforce projects
if (!isSalesforceProject(CWD)) {
  process.exit(0);
}

const uncommittedFiles = getUncommittedFiles();

// Can't check git or no changes
if (uncommittedFiles === null || uncommittedFiles.length === 0) {
  process.exit(0);
}

const classified = classifyFiles(uncommittedFiles);
const hasSfChanges = classified.apex.length > 0 || classified.lwc.length > 0 || classified.aura.length > 0;

if (!hasSfChanges) {
  process.exit(0);
}

// Print a summary reminder
console.log('\n── SCC: Uncommitted Salesforce Changes ────────────────');

if (classified.apex.length > 0) {
  console.log(`\nApex changes (${classified.apex.length} file(s)):`);
  for (const f of classified.apex.slice(0, 5)) {
    console.log(`  ${f.statusCode}  ${f.filePath}`);
  }
  if (classified.apex.length > 5) console.log(`  ... and ${classified.apex.length - 5} more`);

  console.log('\nApex reminders:');
  console.log('  • Run Apex tests before committing:');
  console.log('      sf apex run test --result-format human --code-coverage');
  console.log('  • Ensure 75% code coverage across your org');
  console.log('  • Deploy to scratch org to verify: sf project deploy start');
}

if (classified.lwc.length > 0) {
  console.log(`\nLWC changes (${classified.lwc.length} file(s)):`);
  for (const f of classified.lwc.slice(0, 5)) {
    console.log(`  ${f.statusCode}  ${f.filePath}`);
  }
  if (classified.lwc.length > 5) console.log(`  ... and ${classified.lwc.length - 5} more`);

  console.log('\nLWC reminders:');
  console.log('  • Run Jest unit tests: npm run test:unit');
  console.log('  • Validate component: sf project deploy start --dry-run');
  console.log('  • Test in browser: sf org open');
}

if (classified.aura.length > 0) {
  console.log(`\nAura changes (${classified.aura.length} file(s)):`);
  for (const f of classified.aura.slice(0, 3)) {
    console.log(`  ${f.statusCode}  ${f.filePath}`);
  }
}

// Check if there's a package.json with test scripts (for LWC Jest)
const packageJsonPath = path.join(CWD, 'package.json');
let hasJestScript = false;
if (fs.existsSync(packageJsonPath)) {
  try {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    hasJestScript = !!(pkg.scripts && (pkg.scripts['test:unit'] || pkg.scripts['jest'] || pkg.scripts['test']));
  } catch { /* ignore */ }
}

console.log('\nNext steps:');
if (classified.apex.length > 0) {
  console.log('  1. sf apex run test --result-format human --code-coverage');
}
if (classified.lwc.length > 0 && hasJestScript) {
  console.log('  2. npm run test:unit');
}
console.log(`  ${classified.apex.length > 0 ? '3' : '1'}. git add . && git commit -m "feat: <your message>"`);
console.log('────────────────────────────────────────────────────────\n');

process.exit(0);
