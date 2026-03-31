#!/usr/bin/env node
'use strict';

/**
 * SessionStart hook: checks if platform reference docs are outdated.
 * Warns the user to run /update-platform-docs if files haven't been
 * verified in more than SCC_PLATFORM_DOCS_AGE_MONTHS months (default: 4).
 *
 * Uses CLAUDE_PLUGIN_ROOT / SCC_PLUGIN_ROOT env vars — no hardcoded paths.
 */

const fs = require('fs');
const path = require('path');

const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT
  || process.env.SCC_PLUGIN_ROOT
  || path.resolve(__dirname, '../..');

const MONTHS_THRESHOLD = parseInt(
  process.env.SCC_PLATFORM_DOCS_AGE_MONTHS || '4',
  10
);

const FILES_TO_CHECK = [
  path.join(PLUGIN_ROOT, 'skills', '_reference', 'DEPRECATIONS.md'),
  path.join(PLUGIN_ROOT, 'skills', '_reference', 'API_VERSIONS.md')
];

for (const filePath of FILES_TO_CHECK) {
  if (!fs.existsSync(filePath)) continue;

  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(/Last verified:\s*(\d{4}-\d{2}-\d{2})/);
  if (!match) continue;

  const verifiedDate = new Date(match[1]);
  const threshold = new Date();
  threshold.setMonth(threshold.getMonth() - MONTHS_THRESHOLD);

  if (verifiedDate < threshold) {
    const name = path.basename(filePath);
    const age = Math.round((Date.now() - verifiedDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
    console.log(
      `Platform docs outdated: ${name} was last verified ${match[1]} (${age} months ago). ` +
      `Run /update-platform-docs to refresh with latest Salesforce release info.`
    );
  }
}
