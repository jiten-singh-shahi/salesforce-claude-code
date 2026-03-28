#!/usr/bin/env node
/**
 * SFDX Validate Hook
 *
 * PreToolUse hook that validates Salesforce CLI commands before execution.
 * Checks for:
 * - Commands that should use --dry-run first
 * - Destructive operations that need confirmation
 * - Common parameter mistakes
 */

'use strict';

const readline = require('readline');

const MAX_STDIN = 1024 * 1024;

/**
 * Validation rules for SF CLI commands.
 */
const VALIDATION_RULES = [
  {
    pattern: /sf project deploy start(?!.*--dry-run)(?!.*--validate)/,
    check: (cmd) => !cmd.includes('--test-level') && !cmd.includes('--dry-run'),
    message: 'Deployment without --test-level specified. Consider adding --test-level RunLocalTests',
    severity: 'warning',
  },
  {
    pattern: /sf data delete bulk/,
    message: 'Bulk delete operation — this permanently removes records. Use --dry-run first.',
    severity: 'warning',
  },
  {
    pattern: /sf org delete scratch/,
    check: (cmd) => !cmd.includes('--no-prompt'),
    message: 'Scratch org deletion — ensure you have pushed all source changes before deleting.',
    severity: 'info',
  },
  {
    pattern: /sf project deploy start.*--ignore-conflicts/,
    message: 'Deploying with --ignore-conflicts may overwrite changes made directly in the org.',
    severity: 'warning',
  },
  {
    pattern: /sf data import tree/,
    check: (cmd) => !cmd.includes('--plan'),
    message: 'Data import without --plan. Consider using a plan file for repeatable imports.',
    severity: 'info',
  },
  {
    pattern: /sf package version create(?!.*--skip-validation)/,
    check: (cmd) => !cmd.includes('--code-coverage'),
    message: 'Package version creation — remember that managed packages require 75% code coverage.',
    severity: 'info',
  },
  {
    pattern: /sf project deploy start.*--source-dir.*destructiveChanges/i,
    message: 'Destructive changes deployment detected. Ensure you have verified the manifest.',
    severity: 'warning',
  },
];

function validateCommand(command) {
  if (!command) return [];

  // Only check SF CLI commands
  if (!command.includes('sf ') && !command.includes('sfdx ')) return [];

  const warnings = [];
  for (const rule of VALIDATION_RULES) {
    if (rule.pattern.test(command)) {
      if (rule.check && !rule.check(command)) continue;
      warnings.push({
        severity: rule.severity,
        message: rule.message,
      });
    }
  }
  return warnings;
}

// Read JSON from stdin
let rawInput = '';
const rl = readline.createInterface({ input: process.stdin });
rl.on('line', line => {
  if (rawInput.length < MAX_STDIN) {
    rawInput += line + '\n';
  }
});

rl.on('close', () => {
  let input = {};
  try {
    input = JSON.parse(rawInput.trim() || '{}');
  } catch {
    process.exit(0);
  }

  if (input.tool_name !== 'Bash' && input.tool_name !== 'bash') {
    process.exit(0);
  }

  const command = (input.tool_input && input.tool_input.command) || '';
  const warnings = validateCommand(command);

  if (warnings.length === 0) {
    process.exit(0);
  }

  console.error('\n[SCC Validate] SF CLI Command Check:');
  for (const w of warnings) {
    const prefix = w.severity === 'warning' ? 'WARNING' : 'INFO';
    console.error(`  ${prefix}: ${w.message}`);
  }
  console.error();

  // Exit 0 — we warn but don't block
  process.exit(0);
});
