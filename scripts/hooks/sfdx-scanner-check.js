#!/usr/bin/env node
/**
 * sfdx-scanner PreBash Hook
 *
 * Runs sfdx-scanner (PMD) on modified Apex files before git push or sf deploy.
 * The AI is still active when this fires, so it can read the violations and
 * self-heal before proceeding.
 *
 * - Lifecycle: PreToolUse (Bash matcher)
 * - Only fires on: git push, sf project deploy
 * - Graceful no-op if sfdx-scanner not installed
 * - Gated behind SCC_HOOK_PROFILE=strict
 */

'use strict';

const { execSync } = require('child_process');
const path = require('path');

const MAX_STDIN = 1024 * 1024;

function log(msg) {
  process.stderr.write(`${msg}\n`);
}

/**
 * Check if sf scanner is available.
 */
function isScannerAvailable() {
  try {
    execSync('sf scanner --version', { timeout: 5000, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get modified Apex files from git diff.
 */
function getModifiedApexFiles() {
  try {
    const output = execSync('git diff --name-only HEAD', {
      timeout: 5000,
      stdio: 'pipe',
      encoding: 'utf8',
    });
    return output
      .split('\n')
      .filter(f => f.endsWith('.cls') || f.endsWith('.trigger'))
      .filter(f => f.trim().length > 0);
  } catch {
    return [];
  }
}

/**
 * Run sfdx-scanner on the given files.
 */
function runScanner(files) {
  if (files.length === 0) return [];

  const target = files.join(',');
  try {
    const output = execSync(`sf scanner run --target "${target}" --format json --engine pmd`, {
      timeout: 40000,
      stdio: 'pipe',
      encoding: 'utf8',
    });
    return JSON.parse(output);
  } catch (err) {
    // Scanner returns non-zero when violations found, output is still valid JSON
    if (err.stdout) {
      try {
        return JSON.parse(err.stdout);
      } catch {
        return [];
      }
    }
    return [];
  }
}

function run(rawInput) {
  try {
    const input = JSON.parse(rawInput);
    const { normalizeInput } = require('../lib/hook-input');
    const ctx = normalizeInput(input);
    const command = ctx.command;

    // Only intercept git push and sf deploy commands
    const isGitPush = /\bgit\s+push\b/.test(command);
    const isDeploy = /\bsf\s+project\s+deploy\s+start\b/.test(command);
    if (!isGitPush && !isDeploy) return rawInput;

    // Check if scanner is available
    if (!isScannerAvailable()) return rawInput;

    // Get modified Apex files
    const files = getModifiedApexFiles();
    if (files.length === 0) return rawInput;

    // Run scanner
    const violations = runScanner(files);
    if (!Array.isArray(violations) || violations.length === 0) return rawInput;

    // Count by severity
    const critical = violations.filter(v => v.severity <= 1).length;
    const high = violations.filter(v => v.severity === 2).length;
    const medium = violations.filter(v => v.severity === 3).length;

    if (critical + high === 0) return rawInput; // Only warn on critical/high

    log(`\n[SCC Scanner] Found ${violations.length} PMD violation(s) in ${files.length} file(s):`);
    for (const v of violations.filter(v2 => v2.severity <= 2).slice(0, 10)) {
      const sev = v.severity === 1 ? 'CRITICAL' : 'HIGH';
      const file = path.basename(v.fileName || '');
      log(`  [${sev}] ${file}:${v.line} — ${v.message || v.ruleName}`);
    }
    if (violations.filter(v2 => v2.severity <= 2).length > 10) {
      log(`  ... and ${violations.filter(v2 => v2.severity <= 2).length - 10} more`);
    }
    log('  Recommend fixing before push. Run /sf-quality-gate for details.\n');
  } catch {
    // Ignore errors — never block the user
  }
  return rawInput;
}

if (require.main === module) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => {
    if (raw.length < MAX_STDIN) {
      raw += chunk.substring(0, MAX_STDIN - raw.length);
    }
  });
  process.stdin.on('end', () => {
    const result = run(raw);
    process.stdout.write(result);
  });
}

module.exports = { run };
