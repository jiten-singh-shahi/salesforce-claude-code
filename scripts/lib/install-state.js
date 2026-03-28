'use strict';

/**
 * install-state.js — Schema-validated install state tracking for SCC.
 *
 * Validates against schemas/install-state.schema.json on every read/write.
 * Tracks rich installation provenance: target, request, resolution, source, operations.
 *
 * State is written to ~/.scc/install-state.json (separate from state.json).
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { validateAgainstSchema, assertAgainstSchema, formatErrors } = require('./schema-validator');

const STATE_DIR = path.join(os.homedir(), '.scc');
const INSTALL_STATE_PATH = path.join(STATE_DIR, 'install-state.json');
const SCHEMA_PATH = path.join(__dirname, '..', '..', 'schemas', 'install-state.schema.json');

function ensureStateDir() {
  fs.mkdirSync(STATE_DIR, { recursive: true });
}

/**
 * Create a new install state object with all required fields.
 *
 * @param {Object} params
 * @param {Object} params.target - { id, root, installStatePath, target?, kind? }
 * @param {Object} params.request - { profile, modules, includeComponents, excludeComponents, legacyLanguages, legacyMode }
 * @param {Object} params.resolution - { selectedModules, skippedModules }
 * @param {Object} params.source - { repoVersion, repoCommit, manifestVersion }
 * @param {Array}  params.operations - array of { kind, moduleId, sourceRelativePath, destinationPath, strategy, ownership, scaffoldOnly }
 * @returns {Object} validated install state
 */
function createInstallState({ target, request, resolution, source, operations }) {
  const state = {
    schemaVersion: 'scc.install.v1',
    installedAt: new Date().toISOString(),
    target: {
      id: target.id || 'default',
      root: target.root || process.cwd(),
      installStatePath: target.installStatePath || INSTALL_STATE_PATH,
      ...(target.target ? { target: target.target } : {}),
      ...(target.kind ? { kind: target.kind } : {}),
    },
    request: {
      profile: request.profile || null,
      modules: request.modules || [],
      includeComponents: request.includeComponents || [],
      excludeComponents: request.excludeComponents || [],
      legacyLanguages: request.legacyLanguages || [],
      legacyMode: request.legacyMode || false,
    },
    resolution: {
      selectedModules: resolution.selectedModules || [],
      skippedModules: resolution.skippedModules || [],
    },
    source: {
      repoVersion: source.repoVersion || null,
      repoCommit: source.repoCommit || null,
      manifestVersion: source.manifestVersion || 2,
    },
    operations: (operations || []).map(op => ({
      kind: op.kind || 'copy',
      moduleId: op.moduleId || '',
      sourceRelativePath: op.sourceRelativePath || '',
      destinationPath: op.destinationPath || '',
      strategy: op.strategy || 'overwrite',
      ownership: op.ownership || 'scc',
      scaffoldOnly: op.scaffoldOnly || false,
    })),
  };

  assertAgainstSchema(SCHEMA_PATH, state, 'install-state');
  return state;
}

/**
 * Read install state from disk. Returns validated state or null if not found.
 *
 * @param {string} [statePath] - path to install state file (defaults to ~/.scc/install-state.json)
 * @returns {Object|null} validated install state or null
 */
function readInstallState(statePath) {
  const filePath = statePath || INSTALL_STATE_PATH;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const state = JSON.parse(raw);

    const result = validateAgainstSchema(SCHEMA_PATH, state);
    if (!result.valid) {
      process.stderr.write(`[SCC] install-state validation warning: ${formatErrors(result.errors)}\n`);
      return null;
    }

    return state;
  } catch (err) {
    if (err.code !== 'ENOENT') {
      process.stderr.write(`[SCC] Failed to read install-state: ${err.message}\n`);
    }
    return null;
  }
}

/**
 * Write install state to disk after validation.
 *
 * @param {string} [statePath] - path to write (defaults to ~/.scc/install-state.json)
 * @param {Object} state - install state object (will be validated)
 */
function writeInstallState(state, statePath) {
  assertAgainstSchema(SCHEMA_PATH, state, 'install-state');

  const filePath = statePath || INSTALL_STATE_PATH;
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf8');
}

module.exports = { createInstallState, readInstallState, writeInstallState, INSTALL_STATE_PATH };
