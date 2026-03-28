#!/usr/bin/env node
'use strict';

/**
 * pre-tool-use.js — PreToolUse hook for SCC.
 *
 * Reads the tool use event from stdin (JSON) and:
 *   1. Warns if deprecated `sfdx` commands are used (suggest `sf` equivalent)
 *   2. Warns about dangerous org operations (delete, reset, deploy to prod)
 *
 * Claude Code sends hook input as JSON on stdin:
 * { tool_name: "Bash", tool_input: { command: "..." } }
 */

const readline = require('readline');

// Map of deprecated sfdx commands to their sf equivalents
const SFDX_MIGRATION_MAP = {
  'sfdx force:apex:execute': 'sf apex run',
  'sfdx force:apex:test:run': 'sf apex run test',
  'sfdx force:apex:class:create': 'sf apex generate class',
  'sfdx force:lightning:component:create': 'sf lightning generate component',
  'sfdx force:source:deploy': 'sf project deploy start',
  'sfdx force:source:retrieve': 'sf project retrieve start',
  'sfdx force:source:push': 'sf project deploy start',
  'sfdx force:source:pull': 'sf project retrieve start',
  'sfdx force:org:create': 'sf org create scratch',
  'sfdx force:org:delete': 'sf org delete scratch',
  'sfdx force:org:list': 'sf org list',
  'sfdx force:org:open': 'sf org open',
  'sfdx force:data:query': 'sf data query',
  'sfdx force:data:record:create': 'sf data create record',
  'sfdx force:data:record:update': 'sf data update record',
  'sfdx force:data:record:delete': 'sf data delete record',
  'sfdx force:data:bulk:upsert': 'sf data upsert bulk',
  'sfdx force:package:create': 'sf package create',
  'sfdx force:package:version:create': 'sf package version create',
  'sfdx force:user:create': 'sf org create user',
  'sfdx force:user:password:generate': 'sf org generate password',
};

// Patterns for dangerous operations
const DANGEROUS_PATTERNS = [
  {
    pattern: /sfdx force:org:delete|sf org delete/,
    warning: 'This will permanently delete a Salesforce org. Ensure you have selected the correct org.',
  },
  {
    pattern: /--target-org\s+\S*(prod|production|prd)\S*/i,
    warning: 'This command targets a PRODUCTION org. Double-check before proceeding.',
  },
  {
    pattern: /-u\s+\S*(prod|production|prd)\S*/i,
    warning: 'This command targets what appears to be a PRODUCTION org alias.',
  },
  {
    pattern: /sf project deploy start.*--target-org\s+\S*(prod|production|prd)\S*/i,
    warning: 'Deploying to PRODUCTION. Ensure all tests pass and you have approval.',
  },
  {
    pattern: /sfdx force:data:bulk:delete|sf data delete bulk/,
    warning: 'Bulk delete operation detected. This will permanently delete records.',
  },
  {
    pattern: /sf org reset|sfdx force:org:reset/,
    warning: 'Org reset will remove all source tracking history.',
  },
  {
    pattern: /--no-track-source/,
    warning: 'Deploying without source tracking. Changes may not be reflected in local source.',
  },
];

function checkSfdxDeprecation(command) {
  const warnings = [];
  for (const [deprecated, replacement] of Object.entries(SFDX_MIGRATION_MAP)) {
    if (command.includes(deprecated)) {
      warnings.push({
        type: 'deprecation',
        message: `Deprecated command detected: \`${deprecated}\``,
        suggestion: `Use the new SF CLI equivalent: \`${replacement}\``,
        docs: 'https://developer.salesforce.com/tools/salesforcecli/migration',
      });
    }
  }
  return warnings;
}

function checkDangerousOps(command) {
  const warnings = [];
  for (const { pattern, warning } of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      warnings.push({
        type: 'danger',
        message: warning,
      });
    }
  }
  return warnings;
}

function processInput(input) {
  // Only process Bash tool
  if (input.tool_name !== 'Bash' && input.tool_name !== 'bash') {
    return null;
  }

  const command = (input.tool_input && input.tool_input.command) || '';
  if (!command) return null;

  // Skip if command doesn't involve SF/SFDX
  if (!command.includes('sfdx') && !command.includes('sf ') && !command.includes('sf\n')) {
    return null;
  }

  const deprecationWarnings = checkSfdxDeprecation(command);
  const dangerWarnings = checkDangerousOps(command);
  const allWarnings = [...deprecationWarnings, ...dangerWarnings];

  if (allWarnings.length === 0) return null;

  return allWarnings;
}

// ── Main ─────────────────────────────────────────────────────────────────────

// Read JSON from stdin
let rawInput = '';

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', line => { rawInput += line + '\n'; });

rl.on('close', () => {
  let input = {};
  try {
    input = JSON.parse(rawInput.trim() || '{}');
  } catch {
    // Not valid JSON — exit gracefully
    process.exit(0);
  }

  const warnings = processInput(input);

  if (!warnings || warnings.length === 0) {
    process.exit(0);
  }

  // Print warnings to stderr (visible in Claude Code output)
  console.error('\n[SCC Hook] Salesforce CLI Warnings:');
  for (const w of warnings) {
    if (w.type === 'deprecation') {
      console.error(`  DEPRECATED : ${w.message}`);
      console.error(`  MIGRATE TO : ${w.suggestion}`);
      if (w.docs) console.error(`  DOCS       : ${w.docs}`);
    } else if (w.type === 'danger') {
      console.error(`  WARNING    : ${w.message}`);
    }
    console.error();
  }

  // Exit 0 to allow the tool use to proceed (we're just warning, not blocking)
  process.exit(0);
});
