#!/usr/bin/env node
'use strict';

/**
 * post-write.js — PostToolUse hook for Write operations.
 *
 * Detects Salesforce-specific file writes and provides guidance:
 *   - .cls / .trigger files → remind about 75% Apex test coverage
 *   - LWC .js files → remind about Jest unit tests
 *   - .page, .component (Visualforce) → note about test considerations
 */

const path = require('path');
const readline = require('readline');

/**
 * Classify a written file path into Salesforce content type.
 */
function classifyFile(filePath) {
  if (!filePath) return null;
  const ext = path.extname(filePath).toLowerCase();
  const base = path.basename(filePath).toLowerCase();
  const parts = filePath.split(path.sep);

  // Apex class
  if (ext === '.cls') return 'apex-class';
  // Apex trigger
  if (ext === '.trigger') return 'apex-trigger';
  // Apex test class (may already have test annotations but remind anyway)
  if (ext === '.cls' && base.includes('test')) return 'apex-test';

  // LWC: check if the file is inside an lwc directory
  const lwcIdx = parts.findIndex(p => p === 'lwc');
  if (lwcIdx !== -1) {
    if (ext === '.js' && !base.endsWith('.test.js') && !base.endsWith('.spec.js')) return 'lwc-js';
    if (ext === '.html') return 'lwc-html';
    if (ext === '.css') return 'lwc-css';
    if (ext === '.js' && (base.endsWith('.test.js') || base.endsWith('.spec.js'))) return 'lwc-test';
  }

  // Aura component
  const auraIdx = parts.findIndex(p => p === 'aura');
  if (auraIdx !== -1 && ext === '.js') return 'aura-js';

  // Visualforce
  if (ext === '.page') return 'visualforce-page';
  if (ext === '.component') return 'visualforce-component';

  // Flow
  if (ext === '.flow' || ext === '.flow-meta.xml') return 'flow';

  // Permission set / profile
  if (filePath.includes('permissionsets') || ext === '.permissionset-meta.xml') return 'permission-set';

  return null;
}

const REMINDERS = {
  'apex-class': {
    emoji: '',
    title: 'Apex Class Written',
    messages: [
      'Apex classes require 75% code coverage across your org to deploy to production.',
      'Create or update a corresponding test class (e.g., MyClass_Test.cls or MyClassTest.cls).',
      'Use @isTest annotation and System.assert/assertEquals for assertions.',
      'Run tests: sf apex run test --class-names MyClassTest --result-format human',
    ],
  },
  'apex-trigger': {
    emoji: '',
    title: 'Apex Trigger Written',
    messages: [
      'Triggers require 75% code coverage to deploy to production.',
      'Best practice: keep trigger logic minimal — delegate to a handler class.',
      'Create a test class that fires the trigger with both insert and update scenarios.',
      'Consider using a TriggerHandler framework for maintainability.',
      'Run tests: sf apex run test --class-names MyTriggerTest --result-format human',
    ],
  },
  'lwc-js': {
    emoji: '',
    title: 'LWC JavaScript Written',
    messages: [
      'LWC components should have Jest unit tests.',
      'Test file convention: __tests__/myComponent.test.js',
      'Run Jest tests: npm run test:unit (or sf lightning generate component for scaffolding)',
      'Use @salesforce/lwc-jest or @lwc/jest-transformer for testing.',
      'Mock Salesforce imports with jest.mock() or @salesforce/jest-mocks.',
    ],
  },
  'lwc-html': {
    emoji: '',
    title: 'LWC Template Written',
    messages: [
      'Update Jest tests if you added new elements, slots, or event handlers.',
      'Validate template with: sf project deploy start --dry-run',
    ],
  },
  'aura-js': {
    emoji: '',
    title: 'Aura Component Written',
    messages: [
      'Consider migrating Aura components to LWC for better performance and maintainability.',
      'Aura components can coexist with LWC but LWC is the recommended approach for new development.',
    ],
  },
  'visualforce-page': {
    emoji: '',
    title: 'Visualforce Page Written',
    messages: [
      'Visualforce pages used with Apex controllers require controller test coverage.',
      'Consider whether this functionality could be implemented with LWC instead.',
    ],
  },
  'flow': {
    emoji: '',
    title: 'Flow Metadata Written',
    messages: [
      'Test Flows using Flow Interview tests in Apex or through the UI.',
      'Ensure Flow is activated before deploying to production.',
    ],
  },
};

function generateReminder(fileType, filePath) {
  const reminder = REMINDERS[fileType];
  if (!reminder) return null;

  const lines = [];
  lines.push(`[SCC] ${reminder.title}: ${path.basename(filePath)}`);
  for (const msg of reminder.messages) {
    lines.push(`  • ${msg}`);
  }
  return lines.join('\n');
}

// ── Main ─────────────────────────────────────────────────────────────────────

let rawInput = '';
const rl = readline.createInterface({ input: process.stdin });
rl.on('line', line => { rawInput += line + '\n'; });

rl.on('close', () => {
  let input = {};
  try {
    input = JSON.parse(rawInput.trim() || '{}');
  } catch {
    process.exit(0);
  }

  // Only process Write tool
  if (input.tool_name !== 'Write' && input.tool_name !== 'write') {
    process.exit(0);
  }

  const filePath = (input.tool_input && input.tool_input.file_path) || '';
  if (!filePath) process.exit(0);

  const fileType = classifyFile(filePath);
  if (!fileType) process.exit(0);

  const reminder = generateReminder(fileType, filePath);
  if (reminder) {
    console.log('\n' + reminder + '\n');
  }

  process.exit(0);
});
