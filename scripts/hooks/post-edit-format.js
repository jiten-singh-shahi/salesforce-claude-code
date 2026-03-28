#!/usr/bin/env node
/**
 * Post-Edit Format Hook
 *
 * Auto-formats files after edits using Prettier or sfdx-scanner.
 * Runs on PostToolUse for Edit operations.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const MAX_STDIN = 1024 * 1024;

function log(msg) {
  process.stderr.write(`${msg}\n`);
}

function tryFormat(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return;

  filePath = path.resolve(filePath);
  const ext = path.extname(filePath).toLowerCase();

  // JavaScript/TypeScript/JSON/HTML/CSS — try Prettier
  if (['.js', '.ts', '.jsx', '.tsx', '.json', '.html', '.css'].includes(ext)) {
    const result = spawnSync('npx', ['prettier', '--write', filePath], {
      encoding: 'utf8',
      timeout: 15000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (result.status === 0) {
      log(`[SCC Format] Formatted ${path.basename(filePath)} with Prettier`);
    }
    return;
  }

  // Apex — try Prettier with apex plugin
  if (ext === '.cls' || ext === '.trigger') {
    const result = spawnSync('npx', ['prettier', '--write', '--plugin', 'prettier-plugin-apex', filePath], {
      encoding: 'utf8',
      timeout: 15000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (result.status === 0) {
      log(`[SCC Format] Formatted ${path.basename(filePath)} with Prettier (Apex)`);
    }
    return;
  }
}

function run(rawInput) {
  try {
    const input = JSON.parse(rawInput);
    const filePath = String(input.tool_input?.file_path || '');
    tryFormat(filePath);
  } catch {
    // Ignore errors
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
