#!/usr/bin/env node
'use strict';

/**
 * validate-agents.js — CI validator for agents/ directory.
 *
 * Each agent must be a .md file with YAML frontmatter containing:
 *   - name        (string, non-empty)
 *   - description (string, > 20 chars)
 *   - tools       (array)
 *   - model       (one of: opus, sonnet, haiku)
 */

const fs = require('fs');
const path = require('path');
const { parseFrontmatter, getPluginRoot, listFilesRecursive } = require('../lib/utils');

const VALID_MODELS = new Set(['opus', 'sonnet', 'haiku', 'claude-opus', 'claude-sonnet', 'claude-haiku']);
const MIN_DESCRIPTION_LENGTH = 20;

const pluginRoot = getPluginRoot();
const agentsDir = path.join(pluginRoot, 'agents');

const errors = [];
const warnings = [];
let validCount = 0;

if (!fs.existsSync(agentsDir)) {
  console.error(`[ERROR] agents/ directory not found at: ${agentsDir}`);
  process.exit(1);
}

const files = listFilesRecursive(agentsDir).filter(f => f.endsWith('.md'));

if (files.length === 0) {
  console.warn('[WARN] No .md files found in agents/');
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

  // Check frontmatter exists
  if (!frontmatter || Object.keys(frontmatter).length === 0) {
    fileErrors.push('missing YAML frontmatter');
  } else {
    // name
    if (!frontmatter.name || String(frontmatter.name).trim() === '') {
      fileErrors.push('frontmatter.name is required and must be non-empty');
    }

    // description
    if (!frontmatter.description || String(frontmatter.description).trim() === '') {
      fileErrors.push('frontmatter.description is required');
    } else if (String(frontmatter.description).trim().length < MIN_DESCRIPTION_LENGTH) {
      fileErrors.push(`frontmatter.description must be at least ${MIN_DESCRIPTION_LENGTH} characters (got: "${frontmatter.description}")`);
    }

    // tools
    if (frontmatter.tools === undefined || frontmatter.tools === null || frontmatter.tools === '') {
      fileErrors.push('frontmatter.tools is required (must be an array)');
    } else if (!Array.isArray(frontmatter.tools)) {
      // Parsed as string — means it wasn't a proper array
      fileErrors.push(`frontmatter.tools must be an array (got: ${JSON.stringify(frontmatter.tools)})`);
    } else if (frontmatter.tools.length === 0) {
      warnings.push(`${relPath}: frontmatter.tools is an empty array`);
    }

    // model
    if (!frontmatter.model || String(frontmatter.model).trim() === '') {
      fileErrors.push('frontmatter.model is required');
    } else {
      const model = String(frontmatter.model).trim().toLowerCase();
      // Accept both short (opus, sonnet, haiku) and full (claude-opus-4, etc.)
      const isValid = VALID_MODELS.has(model) ||
        model.startsWith('claude-opus') ||
        model.startsWith('claude-sonnet') ||
        model.startsWith('claude-haiku') ||
        model === 'opus' || model === 'sonnet' || model === 'haiku';
      if (!isValid) {
        fileErrors.push(`frontmatter.model must be one of: opus, sonnet, haiku (got: "${frontmatter.model}")`);
      }
    }

    // origin (warning only)
    const origin = frontmatter.origin ? String(frontmatter.origin).trim().toUpperCase() : '';
    if (!origin) {
      warnings.push(`${relPath}: frontmatter.origin is missing — expected "SCC"`);
    } else if (origin !== 'SCC') {
      warnings.push(`${relPath}: frontmatter.origin is "${frontmatter.origin}" — expected "SCC"`);
    }
  }

  // Body content check
  if (!body || body.trim().length < 10) {
    warnings.push(`${relPath}: agent body content is very short or empty`);
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
  console.warn('\nWarnings:');
  for (const w of warnings) {
    console.warn(`  [WARN] ${w}`);
  }
}

if (errors.length > 0) {
  console.error(`\nAgent validation FAILED (${errors.length} error(s), ${validCount} passed):\n`);
  for (const e of errors) {
    console.error(`  [FAIL] ${e}`);
  }
  process.exit(1);
}

console.log(`Agent validation PASSED — ${validCount} agent(s) validated.`);
process.exit(0);
