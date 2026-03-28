'use strict';

/**
 * skill-adapter.js — Transforms SCC skills from Claude Code format to Cursor format.
 *
 * Claude Code skills use: name, description, origin, user-invocable, allowed-tools, context, etc.
 * Cursor skills use: name, description, disable-model-invocation, license, compatibility, metadata.
 *
 * This adapter strips Claude-only fields, maps user-invocable to disable-model-invocation,
 * and outputs clean Cursor-compatible SKILL.md files.
 */

const fs = require('fs');
const path = require('path');
const { parseFrontmatter, serializeFrontmatter, ensureDir, copyFile } = require('./utils');

// Fields that Cursor recognizes in SKILL.md frontmatter
const CURSOR_ALLOWED_FIELDS = new Set([
  'name',
  'description',
  'disable-model-invocation',
  'license',
  'compatibility',
  'metadata',
]);

/**
 * Transform a single SKILL.md content string from Claude Code to Cursor format.
 * @param {string} content - raw SKILL.md content
 * @returns {string} - transformed SKILL.md content for Cursor
 */
function transformSkill(content) {
  const { frontmatter, body } = parseFrontmatter(content);

  const cursorFm = {};

  // Copy allowed fields
  for (const key of Object.keys(frontmatter)) {
    if (CURSOR_ALLOWED_FIELDS.has(key)) {
      cursorFm[key] = frontmatter[key];
    }
  }

  // EXample for future Map user-invocable → disable-model-invocation
  /*if (frontmatter['user-invocable'] !== undefined) {
    const isUserInvocable = String(frontmatter['user-invocable']).toLowerCase() === 'true';
    if (isUserInvocable) {
      cursorFm['disable-model-invocation'] = false;
    }
    // When user-invocable is false (auto-only), omit disable-model-invocation
    // so Cursor defaults to model-can-invoke behavior
  }*/

  return serializeFrontmatter(cursorFm, body);
}

/**
 * Transform and copy an entire skill directory.
 * Transforms SKILL.md frontmatter; copies all other files as-is.
 * @param {string} srcDir - source skill directory (e.g., skills/sf-help/)
 * @param {string} destDir - destination directory (e.g., .cursor/skills/sf-help/)
 */
function transformSkillDir(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) {
    throw new Error(`Source skill directory not found: ${srcDir}`);
  }

  ensureDir(destDir);
  copyDirRecursive(srcDir, destDir);
}

/**
 * Recursively copy a directory, transforming SKILL.md files.
 * @param {string} src - source directory
 * @param {string} dest - destination directory
 */
function copyDirRecursive(src, dest) {
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else if (entry.name === 'SKILL.md') {
      // Transform SKILL.md frontmatter
      const content = fs.readFileSync(srcPath, 'utf8');
      const transformed = transformSkill(content);
      ensureDir(path.dirname(destPath));
      fs.writeFileSync(destPath, transformed, 'utf8');
    } else {
      // Copy other files as-is
      copyFile(srcPath, destPath);
    }
  }
}

module.exports = { transformSkill, transformSkillDir, CURSOR_ALLOWED_FIELDS };
