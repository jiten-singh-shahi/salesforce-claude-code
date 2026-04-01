'use strict';

/**
 * install-config.js — Loads and validates SCC install config files.
 *
 * Config files (scc-install.json) let teams commit install preferences to their repo.
 * Read-only — SCC never writes config files. CLI args override config values.
 *
 * Validates against schemas/scc-install-config.schema.json via AJV.
 */

const fs = require('fs');
const path = require('path');
const { assertAgainstSchema, formatErrors } = require('./schema-validator');

const SCHEMA_PATH = path.join(__dirname, '..', '..', 'schemas', 'scc-install-config.schema.json');

/**
 * Deduplicate an array of strings while preserving order.
 */
function dedupeStrings(arr) {
  return [...new Set(arr)];
}

/**
 * Resolve a config file path. Relative paths resolve against cwd.
 *
 * @param {string} configPath - path to config file
 * @returns {string} resolved absolute path
 */
function resolveConfigPath(configPath) {
  if (!configPath) throw new Error('Config path is required');
  return path.resolve(configPath);
}

/**
 * Load and validate an SCC install config file.
 *
 * @param {string} configPath - path to scc-install.json
 * @returns {Object} normalized config: { path, version, target, profile, modules, include, exclude, options }
 * @throws {Error} if file not found, invalid JSON, or schema validation fails
 */
function loadInstallConfig(configPath) {
  const resolved = resolveConfigPath(configPath);

  if (!fs.existsSync(resolved)) {
    throw new Error(`Install config not found: ${resolved}`);
  }

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  } catch (err) {
    throw new Error(`Invalid JSON in config ${resolved}: ${err.message}`, { cause: err });
  }

  // Validate against schema
  assertAgainstSchema(SCHEMA_PATH, raw, `install config ${path.basename(resolved)}`);

  // Normalize and deduplicate
  return {
    path: resolved,
    version: raw.version,
    target: raw.target || null,
    profile: raw.profile || null,
    modules: dedupeStrings(raw.modules || []),
    include: dedupeStrings(raw.include || []),
    exclude: dedupeStrings(raw.exclude || []),
    options: raw.options || {},
  };
}

module.exports = { loadInstallConfig, resolveConfigPath };
