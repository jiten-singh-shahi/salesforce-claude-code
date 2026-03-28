#!/usr/bin/env node
/**
 * Post-Edit Type Check Hook
 *
 * Runs type checking after editing TypeScript or LWC files.
 * For LWC: validates component structure.
 * For TS: runs tsc --noEmit on the file.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const MAX_STDIN = 1024 * 1024;

function log(msg) {
  process.stderr.write(`${msg}\n`);
}

function checkFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return;

  filePath = path.resolve(filePath);
  const ext = path.extname(filePath).toLowerCase();

  // TypeScript files — run tsc
  if (ext === '.ts' || ext === '.tsx') {
    const result = spawnSync('npx', ['tsc', '--noEmit', '--pretty', filePath], {
      encoding: 'utf8',
      timeout: 30000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (result.status !== 0 && result.stderr) {
      log(`[SCC TypeCheck] Type errors in ${path.basename(filePath)}:`);
      const lines = result.stderr.split('\n').slice(0, 5);
      for (const line of lines) {
        if (line.trim()) log(`  ${line}`);
      }
    }
    return;
  }

  // LWC JavaScript — validate basic structure
  if (ext === '.js' && filePath.includes('/lwc/')) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const issues = [];

      // Check for default export
      if (!content.includes('export default class')) {
        issues.push('Missing default class export — LWC requires `export default class`');
      }

      // Check for LightningElement extension
      if (content.includes('export default class') && !content.includes('LightningElement')) {
        issues.push('LWC class should extend LightningElement');
      }

      if (issues.length > 0) {
        log(`[SCC TypeCheck] LWC issues in ${path.basename(filePath)}:`);
        for (const issue of issues) {
          log(`  - ${issue}`);
        }
      }
    } catch {
      // Ignore read errors
    }
  }
}

function run(rawInput) {
  try {
    const input = JSON.parse(rawInput);
    const filePath = String(input.tool_input?.file_path || '');
    checkFile(filePath);
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
