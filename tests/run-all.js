#!/usr/bin/env node
'use strict';

/**
 * run-all.js — Test runner for SCC.
 *
 * Recursively finds and runs all *.test.js files under tests/.
 * Reports pass/fail counts and exits with code 1 if any tests fail.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const TESTS_DIR = path.join(__dirname);

// ── Discover test files ───────────────────────────────────────────────────────

function findTestFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      results.push(...findTestFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.test.js')) {
      results.push(fullPath);
    }
  }
  return results;
}

const testFiles = findTestFiles(TESTS_DIR).filter(f => f !== __filename);

if (testFiles.length === 0) {
  console.log('[INFO] No test files found.');
  process.exit(0);
}

console.log(`\nSCC Test Runner`);
console.log(`${'─'.repeat(60)}`);
console.log(`Found ${testFiles.length} test file(s).\n`);

// ── Run each test file ────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failedFiles = [];
const startTime = Date.now();

for (const testFile of testFiles) {
  const relPath = path.relative(path.join(__dirname, '..'), testFile);
  process.stdout.write(`  ${relPath} ... `);

  const result = spawnSync(process.execPath, [testFile], {
    encoding: 'utf8',
    timeout: 30000,
    env: {
      ...process.env,
      SCC_PLUGIN_ROOT: path.join(__dirname, '..'),
      NODE_ENV: 'test',
    },
  });

  if (result.status === 0) {
    console.log('PASS');
    passed++;

    // Print stdout if it has content (test details)
    if (result.stdout && result.stdout.trim()) {
      const lines = result.stdout.trim().split('\n');
      for (const line of lines) {
        console.log(`    ${line}`);
      }
    }
  } else {
    console.log('FAIL');
    failed++;
    failedFiles.push({ file: relPath, result });

    // Always print output on failure
    if (result.stdout && result.stdout.trim()) {
      console.error(`  stdout:\n${result.stdout.trim().split('\n').map(l => '    ' + l).join('\n')}`);
    }
    if (result.stderr && result.stderr.trim()) {
      console.error(`  stderr:\n${result.stderr.trim().split('\n').map(l => '    ' + l).join('\n')}`);
    }
    if (result.error) {
      console.error(`  error: ${result.error.message}`);
    }
  }
}

const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed (${testFiles.length} total) in ${elapsed}s`);

if (failed > 0) {
  console.error(`\nFailed test files:`);
  for (const { file } of failedFiles) {
    console.error(`  FAIL  ${file}`);
  }
  console.error();
  process.exit(1);
}

console.log('\nAll tests passed.');
process.exit(0);
