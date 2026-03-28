#!/usr/bin/env node
'use strict';

/**
 * validate-no-personal-paths.js — Scan content files for hardcoded personal paths.
 *
 * Detects patterns like:
 *   - /Users/username/...  (macOS home dirs)
 *   - /home/username/...   (Linux home dirs)
 *   - C:\Users\username\...  (Windows home dirs)
 *   - ~/.something with specific usernames embedded
 *
 * Scans: agents/, skills/, examples/
 * Also scans: scripts/ (hook scripts, CI scripts)
 */

const fs = require('fs');
const path = require('path');
const { getPluginRoot, listFilesRecursive } = require('../lib/utils');

const pluginRoot = getPluginRoot();

// Patterns that indicate hardcoded personal paths
const PERSONAL_PATH_PATTERNS = [
  // macOS: /Users/<specific-name>/ — but not /Users/ alone or /Users/$USER
  {
    pattern: /\/Users\/(?![${])[a-zA-Z][a-zA-Z0-9_.-]{1,}(?:\/|$)/g,
    description: 'macOS user home directory path',
    // Whitelist common placeholder-style names
    allowlist: [/\/Users\/username\//i, /\/Users\/your[-_]?(?:name|username|user)\//i, /\/Users\/\$USER\//],
  },
  // Linux: /home/<specific-name>/
  {
    pattern: /\/home\/(?![${])[a-zA-Z][a-zA-Z0-9_.-]{1,}(?:\/|$)/g,
    description: 'Linux user home directory path',
    allowlist: [/\/home\/username\//i, /\/home\/your[-_]?(?:name|user)\//i, /\/home\/\$USER\//],
  },
  // Windows: C:\Users\<name>\
  {
    pattern: /[A-Z]:\\Users\\(?![${])[a-zA-Z][a-zA-Z0-9_.-]{1,}(?:\\|$)/g,
    description: 'Windows user directory path',
    allowlist: [/\\Users\\Username\\/i, /\\Users\\your[-_]?(?:name|user)\\/i],
  },
  // Absolute paths that look like they point to a specific person's project
  {
    pattern: /\/(?:Users|home)\/[a-zA-Z][a-zA-Z0-9_.-]+\/(?:Desktop|Documents|Projects|dev|code|repos|workspace)\/[^\s"'`]+/g,
    description: 'Personal project path (Desktop/Documents/Projects/dev/repos)',
    allowlist: [],
  },
];

// Directories to scan
const SCAN_DIRS = ['agents', 'skills', 'commands', 'rules', 'examples',
  'hooks', 'manifests', 'schemas', '.cursor'];
// Also scan scripts but with some allowances for test/example paths
const ALSO_SCAN_DIRS = ['scripts'];

// File extensions to scan
const SCAN_EXTENSIONS = new Set(['.md', '.json', '.js', '.yaml', '.yml', '.txt']);

// Lines/patterns to skip (false positive prevention) — reserved for future use

function isAllowlisted(match, allowlist) {
  return allowlist.some(pattern => pattern.test(match));
}

function scanFile(filePath, isScriptFile = false) {
  const violations = [];
  let content;

  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return violations;
  }

  const lines = content.split('\n');

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];

    // Skip comment-only lines in JS
    if (isScriptFile && line.trim().startsWith('//')) continue;
    // Skip markdown code fences content (best effort)
    if (line.startsWith('    ') || line.startsWith('\t')) continue; // indented code blocks

    for (const { pattern, description, allowlist } of PERSONAL_PATH_PATTERNS) {
      // Reset regex lastIndex
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(line)) !== null) {
        const matchStr = match[0];

        // Skip if allowlisted
        if (isAllowlisted(matchStr, allowlist)) continue;

        // Skip if it looks like a URL
        if (line.slice(Math.max(0, match.index - 8), match.index).includes('://')) continue;

        // Skip if in a code block example with generic placeholder
        const lowerLine = line.toLowerCase();
        if (lowerLine.includes('example') && lowerLine.includes('username')) continue;

        violations.push({
          line: lineNum + 1,
          col: match.index + 1,
          match: matchStr.trim(),
          description,
          lineContent: line.trim().slice(0, 120),
        });
      }
    }
  }

  return violations;
}

// ── Main scan ─────────────────────────────────────────────────────────────────

const allViolations = [];

for (const dir of [...SCAN_DIRS, ...ALSO_SCAN_DIRS]) {
  const dirPath = path.join(pluginRoot, dir);
  if (!fs.existsSync(dirPath)) continue;

  const isScript = ALSO_SCAN_DIRS.includes(dir);
  const files = listFilesRecursive(dirPath).filter(f => {
    if (f.includes('/node_modules/')) return false;
    const ext = path.extname(f).toLowerCase();
    return SCAN_EXTENSIONS.has(ext);
  });

  for (const filePath of files) {
    const violations = scanFile(filePath, isScript);
    if (violations.length > 0) {
      allViolations.push({
        file: path.relative(pluginRoot, filePath),
        violations,
      });
    }
  }
}

// ── Report ────────────────────────────────────────────────────────────────────

if (allViolations.length === 0) {
  const totalFiles = [...SCAN_DIRS, ...ALSO_SCAN_DIRS].reduce((sum, dir) => {
    const dirPath = path.join(pluginRoot, dir);
    if (!fs.existsSync(dirPath)) return sum;
    return sum + listFilesRecursive(dirPath).filter(f => !f.includes('/node_modules/') && SCAN_EXTENSIONS.has(path.extname(f).toLowerCase())).length;
  }, 0);
  console.log(`Personal path scan PASSED — ${totalFiles} file(s) scanned, no personal paths found.`);
  process.exit(0);
}

console.error(`\nPersonal path scan FAILED — found hardcoded personal paths in ${allViolations.length} file(s):\n`);

for (const { file, violations } of allViolations) {
  console.error(`  ${file}:`);
  for (const v of violations) {
    console.error(`    Line ${v.line}: ${v.description}`);
    console.error(`      Match: "${v.match}"`);
    console.error(`      Context: ${v.lineContent}`);
  }
  console.error();
}

console.error('Fix: Replace personal paths with generic placeholders like /Users/username/ or $HOME/');
process.exit(1);
