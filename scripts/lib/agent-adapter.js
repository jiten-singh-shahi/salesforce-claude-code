'use strict';

/**
 * agent-adapter.js — Transforms SCC agents from Claude Code format to Cursor format.
 *
 * Claude Code agents use: name, description, tools, model (sonnet/opus/haiku), origin,
 *   disallowedTools, permissionMode, maxTurns, skills, mcpServers, hooks, memory, etc.
 * Cursor agents use: name, description, model (fast/inherit/specific ID), readonly, is_background.
 *
 * This adapter strips Claude-only fields, maps model aliases, and outputs
 * clean Cursor-compatible agent .md files.
 */

const fs = require('fs');
const path = require('path');
const { parseFrontmatter, serializeFrontmatter, ensureDir } = require('./utils');

// Fields that Cursor recognizes in agent frontmatter
const CURSOR_ALLOWED_FIELDS = new Set([
  'name',
  'description',
  'model',
  'readonly',
  'is_background',
]);

// Map Claude Code model aliases to Cursor equivalents
const MODEL_MAP = {
  sonnet: 'inherit',
  opus: 'inherit',
  haiku: 'fast',
  'claude-sonnet': 'inherit',
  'claude-opus': 'inherit',
  'claude-haiku': 'fast',
};

/**
 * Transform a single agent .md content string from Claude Code to Cursor format.
 * @param {string} content - raw agent .md content
 * @returns {string} - transformed agent .md content for Cursor
 */
function transformAgent(content) {
  const { frontmatter, body } = parseFrontmatter(content);

  const cursorFm = {};

  // Copy allowed fields
  for (const key of Object.keys(frontmatter)) {
    if (CURSOR_ALLOWED_FIELDS.has(key)) {
      cursorFm[key] = frontmatter[key];
    }
  }

  // Map model aliases to Cursor equivalents
  if (cursorFm.model) {
    const mapped = MODEL_MAP[String(cursorFm.model).toLowerCase()];
    if (mapped) {
      cursorFm.model = mapped;
    }
    // Full model IDs (e.g. claude-sonnet-4-6) pass through unchanged
  }

  return serializeFrontmatter(cursorFm, body);
}

/**
 * Transform and write a single agent file.
 * @param {string} srcPath - source agent .md file
 * @param {string} destPath - destination file path
 */
function transformAgentFile(srcPath, destPath) {
  if (!fs.existsSync(srcPath)) {
    throw new Error(`Source agent file not found: ${srcPath}`);
  }

  const content = fs.readFileSync(srcPath, 'utf8');
  const transformed = transformAgent(content);
  ensureDir(path.dirname(destPath));
  fs.writeFileSync(destPath, transformed, 'utf8');
}

module.exports = { transformAgent, transformAgentFile, CURSOR_ALLOWED_FIELDS, MODEL_MAP };
