#!/usr/bin/env node
'use strict';

/**
 * validate-commands.js — CI validator for commands/ directory.
 *
 * Each command must be a .md file with:
 *   - description frontmatter field (> 20 chars)
 *   - Content beyond the frontmatter block
 */

const fs = require('fs');
const path = require('path');
const { parseFrontmatter, getPluginRoot, listFilesRecursive } = require('../lib/utils');

const MIN_DESCRIPTION_LENGTH = 20;
const MIN_BODY_LENGTH = 30;

const pluginRoot = getPluginRoot();
const commandsDir = path.join(pluginRoot, 'commands');

const errors = [];
const warnings = [];
let validCount = 0;

if (!fs.existsSync(commandsDir)) {
  console.log('Command validation PASSED — no commands/ directory (all workflows are skills).');
  process.exit(0);
}

const files = listFilesRecursive(commandsDir).filter(f => f.endsWith('.md'));

if (files.length === 0) {
  console.warn('[WARN] No .md files found in commands/');
  process.exit(0);
}

for (const filePath of files) {
  const relPath = path.relative(pluginRoot, filePath);
  let content;

  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    errors.push(`${relPath}: Cannot read file — ${err.message}`);
    continue;
  }

  const { frontmatter, body } = parseFrontmatter(content);
  const fileErrors = [];

  // description is required
  if (!frontmatter.description || String(frontmatter.description).trim() === '') {
    fileErrors.push('missing required frontmatter field: description');
  } else if (String(frontmatter.description).trim().length < MIN_DESCRIPTION_LENGTH) {
    fileErrors.push(`description must be at least ${MIN_DESCRIPTION_LENGTH} characters (got ${frontmatter.description.length}): "${frontmatter.description}"`);
  }

  // Body content beyond frontmatter
  if (!body || body.trim().length < MIN_BODY_LENGTH) {
    fileErrors.push(`command body is too short (must be at least ${MIN_BODY_LENGTH} chars). Commands must include usage instructions.`);
  }

  // Warn if no examples section
  if (body && !body.toLowerCase().includes('example') && !body.toLowerCase().includes('usage')) {
    warnings.push(`${relPath}: no examples or usage section found in command body`);
  }

  if (fileErrors.length > 0) {
    for (const e of fileErrors) {
      errors.push(`${relPath}: ${e}`);
    }
  } else {
    validCount++;
  }
}

// ── Report ────────────────────────────────────────────────────────────────────

if (warnings.length > 0) {
  for (const w of warnings) {
    console.warn(`  [WARN] ${w}`);
  }
}

if (errors.length > 0) {
  console.error(`\nCommand validation FAILED (${errors.length} error(s), ${validCount} passed):\n`);
  for (const e of errors) {
    console.error(`  [FAIL] ${e}`);
  }
  process.exit(1);
}

console.log(`Command validation PASSED — ${validCount} command(s) validated.`);
process.exit(0);
