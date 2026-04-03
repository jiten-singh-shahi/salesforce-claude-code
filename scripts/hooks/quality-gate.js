#!/usr/bin/env node
/**
 * Quality Gate Hook
 *
 * Runs lightweight quality checks after file edits.
 * For Apex files: checks for common anti-patterns using shared apex-analysis module.
 * For LWC files: checks for common issues.
 * Falls back to no-op when file type is unrecognized.
 *
 * Uses apex-analysis.js for:
 * - Comment/string stripping (eliminates false positives)
 * - Loop depth tracking (activeLoopDepths stack + globalBraceDepth)
 * - Test class detection
 */

'use strict';

const fs = require('fs');
const path = require('path');

const { preprocessApex, isTestClass, trackLoopDepth } = require('../lib/apex-analysis');

const MAX_STDIN = 1024 * 1024;

function log(msg) {
  process.stderr.write(`${msg}\n`);
}

/**
 * Check Apex file for common anti-patterns.
 */
function checkApex(filePath, content) {
  const issues = [];

  // Skip test classes for security/quality checks (they don't run in production)
  const testClass = isTestClass(content);

  // Preprocess: strip comments and string literals to avoid false positives
  const processed = preprocessApex(content);
  const processedLines = processed.split('\n');
  const depths = trackLoopDepth(processedLines);

  // Check for SOQL/DML inside loops
  for (let i = 0; i < processedLines.length; i++) {
    const line = processedLines[i];
    if (depths[i] > 0 && /\[\s*SELECT\s/i.test(line)) {
      issues.push(`Line ${i + 1}: SOQL query inside loop — potential governor limit violation`);
    }
    if (depths[i] > 0) {
      const dmlPattern = /\b(insert|update|delete|upsert)\s+/i;
      const dbPattern = /Database\.(insert|update|delete|upsert)/i;
      if (dmlPattern.test(line) || dbPattern.test(line)) {
        issues.push(`Line ${i + 1}: DML operation inside loop — potential governor limit violation`);
      }
    }
  }

  // Check for hardcoded IDs (use raw content — IDs could be in strings)
  if (/['"][a-zA-Z0-9]{15,18}['"]/.test(content) && /00[0-9a-zA-Z]{13,16}/.test(content)) {
    issues.push('Hardcoded Salesforce record ID detected — use Custom Settings, Custom Metadata, or labels instead');
  }

  // Check for System.debug (configurable threshold)
  const debugThreshold = parseInt(process.env.SCC_DEBUG_THRESHOLD, 10) || 5;
  const debugCount = (processed.match(/System\.debug/g) || []).length;
  if (debugCount > debugThreshold) {
    issues.push(`${debugCount} System.debug statements found — consider removing before deployment`);
  }

  // --- Security checks (skip for test classes) ---
  if (!testClass) {
    // Sharing model detection
    const beforeFirstBrace = content.split('{')[0] || '';
    const hasSharing = /\b(with\s+sharing|without\s+sharing|inherited\s+sharing)\b/i.test(beforeFirstBrace);
    const hasSoqlOrDml = /\[\s*SELECT\s/i.test(processed) ||
      /\b(insert|update|delete|upsert)\s+/i.test(processed) ||
      /Database\.(insert|update|delete|upsert|query)/i.test(processed);

    if (!hasSharing && hasSoqlOrDml) {
      issues.push('[HIGH] No sharing declaration (with sharing/without sharing/inherited sharing) on class that performs SOQL/DML');
    }

    // Privilege escalation: without sharing + @AuraEnabled/@RemoteAction
    if (/\bwithout\s+sharing\b/i.test(beforeFirstBrace)) {
      if (/@AuraEnabled/i.test(content) || /@RemoteAction/i.test(content)) {
        issues.push('[HIGH] "without sharing" class exposes @AuraEnabled/@RemoteAction methods — potential privilege escalation');
      }
    }

    // CRUD/FLS: SOQL without WITH USER_MODE or WITH SECURITY_ENFORCED
    for (let i = 0; i < processedLines.length; i++) {
      const line = processedLines[i];
      if (/\[\s*SELECT\s/i.test(line) && !/WITH\s+(USER_MODE|SECURITY_ENFORCED)/i.test(line)) {
        issues.push(`Line ${i + 1}: [LOW] SOQL query without WITH USER_MODE or WITH SECURITY_ENFORCED`);
        break; // Only warn once to avoid noise
      }
    }

    // DML without AccessLevel.USER_MODE
    for (let i = 0; i < processedLines.length; i++) {
      const line = processedLines[i];
      if (/Database\.(insert|update|delete|upsert)\s*\(/i.test(line) &&
          !/AccessLevel\.USER_MODE/i.test(line)) {
        issues.push(`Line ${i + 1}: [LOW] Database DML without AccessLevel.USER_MODE`);
        break; // Only warn once
      }
    }

    // Dynamic SOQL warning
    if (/Database\.(query|countQuery)\s*\(/i.test(processed)) {
      issues.push('[LOW] Dynamic SOQL detected — ensure user-supplied values use String.escapeSingleQuotes()');
    }
  }

  return issues;
}

/**
 * Check LWC JavaScript for common issues.
 */
function checkLwc(filePath, content) {
  const issues = [];

  // Check for console.log
  const consoleCount = (content.match(/console\.(log|warn|error|info)/g) || []).length;
  if (consoleCount > 0) {
    issues.push(`${consoleCount} console statement(s) found — remove before deployment`);
  }

  // Check for imperative Apex calls without error handling
  if (/import\s+\w+\s+from\s+['"]@salesforce\/apex\//.test(content)) {
    if (!/\.catch\(|try\s*\{|catch\s*\(/.test(content)) {
      issues.push('Imperative Apex call detected without error handling — add .catch() or try/catch');
    }
  }

  return issues;
}

/**
 * Run sf scanner on a single Apex file (standard+ profile).
 * Returns array of issue strings. Graceful no-op if scanner not installed.
 */
function runScannerOnFile(filePath) {
  const profile = (process.env.SCC_HOOK_PROFILE || 'standard').toLowerCase();
  if (profile === 'minimal') return [];

  const { execSync } = require('child_process');
  try {
    execSync('sf scanner --version', { timeout: 5000, stdio: 'pipe' });
  } catch {
    return []; // Scanner not installed — skip gracefully
  }

  try {
    const output = execSync(`sf scanner run --target "${filePath}" --format json --engine pmd`, {
      timeout: 30000,
      stdio: 'pipe',
      encoding: 'utf8',
    });
    const violations = JSON.parse(output);
    if (!Array.isArray(violations)) return [];
    return violations
      .filter(v => v.severity <= 2)
      .slice(0, 5)
      .map(v => {
        const sev = v.severity === 1 ? 'CRITICAL' : 'HIGH';
        return `[${sev}] PMD: ${v.message || v.ruleName} (line ${v.line})`;
      });
  } catch (err) {
    if (err.stdout) {
      try {
        const violations = JSON.parse(err.stdout);
        if (!Array.isArray(violations)) return [];
        return violations
          .filter(v => v.severity <= 2)
          .slice(0, 5)
          .map(v => {
            const sev = v.severity === 1 ? 'CRITICAL' : 'HIGH';
            return `[${sev}] PMD: ${v.message || v.ruleName} (line ${v.line})`;
          });
      } catch {
        return [];
      }
    }
    return [];
  }
}

function maybeRunQualityGate(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return;

  filePath = path.resolve(filePath);
  const ext = path.extname(filePath).toLowerCase();

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return;
  }

  let issues = [];

  if (ext === '.cls' || ext === '.trigger') {
    issues = checkApex(filePath, content);
    // Run sf scanner for deeper PMD analysis (standard+ profile, graceful no-op)
    const scannerIssues = runScannerOnFile(filePath);
    issues = issues.concat(scannerIssues);
  } else if (ext === '.js' && filePath.includes('/lwc/')) {
    issues = checkLwc(filePath, content);
  }

  if (issues.length > 0) {
    log(`\n[SCC QualityGate] ${path.basename(filePath)}:`);
    for (const issue of issues) {
      log(`  - ${issue}`);
    }
    if (issues.some(i => i.includes('PMD:'))) {
      log('  Install Salesforce Code Analyzer for enhanced checks: sf plugins install @salesforce/sfdx-scanner');
    }
    log('');
  }
}

function run(rawInput) {
  try {
    const input = JSON.parse(rawInput);
    const { normalizeInput } = require('../lib/hook-input');
    const ctx = normalizeInput(input);
    maybeRunQualityGate(ctx.filePath);
  } catch {
    // Ignore parse errors
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
