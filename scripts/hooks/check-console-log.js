#!/usr/bin/env node

/**
 * Stop Hook: Check for console.log statements in modified LWC/JS files
 *
 * Cross-platform (Windows, macOS, Linux)
 *
 * Runs after each response and checks if any modified JavaScript/TypeScript
 * files contain console.log statements. Particularly useful for LWC development
 * where console.log should be removed before deployment.
 *
 * Exclusions: test files, config files, and scripts/ directory.
 */

const fs = require('fs');

// Files where console.log is expected and should not trigger warnings
const EXCLUDED_PATTERNS = [
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
  /\.config\.[jt]s$/,
  /scripts\//,
  /__tests__\//,
  /__mocks__\//,
];

function isGitRepo() {
  try {
    const { execSync } = require('child_process');
    execSync('git rev-parse --is-inside-work-tree', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function getGitModifiedFiles(patterns) {
  try {
    const { execSync } = require('child_process');
    const output = execSync('git diff --name-only HEAD 2>/dev/null || git diff --name-only', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
    if (!output) return [];
    const files = output.split('\n').filter(Boolean);
    if (patterns && patterns.length > 0) {
      return files.filter(f => patterns.some(p => new RegExp(p).test(f)));
    }
    return files;
  } catch {
    return [];
  }
}

const MAX_STDIN = 1024 * 1024; // 1MB limit
let data = '';
process.stdin.setEncoding('utf8');

process.stdin.on('data', chunk => {
  if (data.length < MAX_STDIN) {
    const remaining = MAX_STDIN - data.length;
    data += chunk.substring(0, remaining);
  }
});

process.stdin.on('end', () => {
  try {
    if (!isGitRepo()) {
      process.stdout.write(data);
      process.exit(0);
    }

    const files = getGitModifiedFiles(['\\.tsx?$', '\\.jsx?$'])
      .filter(f => fs.existsSync(f))
      .filter(f => !EXCLUDED_PATTERNS.some(pattern => pattern.test(f)));

    let hasConsole = false;

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        if (content && content.includes('console.log')) {
          console.error(`[Hook] WARNING: console.log found in ${file}`);
          hasConsole = true;
        }
      } catch {
        // Skip unreadable files
      }
    }

    if (hasConsole) {
      console.error('[Hook] Remove console.log statements before committing (especially in LWC)');
    }
  } catch (err) {
    console.error(`[Hook] check-console-log error: ${err.message}`);
  }

  // Always output the original data
  process.stdout.write(data);
  process.exit(0);
});
