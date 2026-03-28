'use strict';

/**
 * state-store.js — Schema-validated JSON state store for SCC.
 *
 * Persists to ~/.scc/state.json with 6 entity types (validated against state-store.schema.json):
 *   - sessions:         AI session tracking
 *   - skillRuns:        Skill execution history
 *   - skillVersions:    Skill version tracking
 *   - decisions:        Decision records
 *   - installState:     Installation tracking (replaces legacy installedFiles)
 *   - governanceEvents: Governor limit/security events
 *
 * Backward-compatible: saveState/loadState/clearState/removeFiles still work for existing callers.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { assertValidEntity } = require('./schema-validator');

const STATE_DIR = path.join(os.homedir(), '.scc');
const STATE_PATH = path.join(STATE_DIR, 'state.json');
const SCHEMA_PATH = path.join(__dirname, '..', '..', 'schemas', 'state-store.schema.json');

// Entity collection names (must match schema properties)
const ENTITY_COLLECTIONS = ['sessions', 'skillRuns', 'skillVersions', 'decisions', 'installState', 'governanceEvents'];

function ensureStateDir() {
  fs.mkdirSync(STATE_DIR, { recursive: true });
}

/**
 * Create an empty state object with all entity collections.
 */
function emptyState() {
  const state = {};
  for (const col of ENTITY_COLLECTIONS) {
    state[col] = [];
  }
  return state;
}

/**
 * Load raw JSON state from disk.
 */
function loadJsonState() {
  try {
    const raw = fs.readFileSync(STATE_PATH, 'utf8');
    const parsed = JSON.parse(raw);

    // Detect and migrate legacy format
    if (parsed.installedFiles || parsed.lastProfile) {
      return migrateLegacyState(parsed);
    }

    // Ensure all collections exist
    const state = emptyState();
    for (const col of ENTITY_COLLECTIONS) {
      if (Array.isArray(parsed[col])) {
        state[col] = parsed[col];
      }
    }
    return state;
  } catch {
    return emptyState();
  }
}

/**
 * Migrate legacy state format (installedFiles/lastProfile) to entity model.
 */
function migrateLegacyState(legacy) {
  const state = emptyState();

  // Legacy state migration: v1.0.0 used fine-grained module IDs (rules-apex, agents-lwc, etc.)
  // v2.0.0 uses 7 bundle IDs (core, apex, lwc, platform, devops, security, extended).
  const LEGACY_PREFIXES = ['rules-', 'agents-', 'commands-', 'skills-', 'hooks-', 'platform-'];
  const hasLegacyModules = (legacy.installedFiles || []).some(f =>
    f.module && LEGACY_PREFIXES.some(prefix => f.module.startsWith(prefix))
  );

  // If legacy module IDs detected, wipe and return empty
  if (hasLegacyModules) {
    saveJsonState(state);
    return state;
  }

  // Migrate installedFiles to installState entities (group by target)
  if (Array.isArray(legacy.installedFiles) && legacy.installedFiles.length > 0) {
    const byTarget = new Map();
    for (const f of legacy.installedFiles) {
      const target = f.target || legacy.lastTarget || 'claude';
      if (!byTarget.has(target)) byTarget.set(target, []);
      byTarget.get(target).push(f);
    }
    for (const [target, files] of byTarget) {
      state.installState.push({
        targetId: target,
        targetRoot: process.cwd(),
        profile: legacy.lastProfile || null,
        modules: [],
        operations: files.map(f => ({
          kind: 'copy',
          moduleId: f.module || '',
          sourceRelativePath: f.srcPath || '',
          destinationPath: f.destPath || '',
          strategy: 'overwrite',
          ownership: 'scc',
          scaffoldOnly: false,
          hash: f.hash || null,
        })),
        installedAt: legacy.lastInstalledAt || new Date().toISOString(),
        sourceVersion: null,
      });
    }
  }

  // Migrate legacy sessions
  if (Array.isArray(legacy.sessions)) {
    for (const s of legacy.sessions) {
      state.sessions.push({
        id: `legacy-${s.installedAt || Date.now()}`,
        adapterId: 'scc-install',
        harness: s.target || 'claude',
        state: 'completed',
        repoRoot: null,
        startedAt: s.installedAt || null,
        endedAt: s.installedAt || null,
        snapshot: { profile: s.profile, fileCount: s.fileCount },
      });
    }
  }

  // Write migrated state
  saveJsonState(state);
  return state;
}

function saveJsonState(state) {
  ensureStateDir();
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
}

// ── Entity Operations (schema-validated) ────────────────────────────────────

/**
 * Upsert an entity into a collection. Validates against schema before saving.
 * If entity with same `id` exists, it's replaced.
 */
function upsertEntity(collectionName, entityName, entity) {
  assertValidEntity(SCHEMA_PATH, entityName, entity);

  const state = loadJsonState();
  if (!Array.isArray(state[collectionName])) {
    state[collectionName] = [];
  }

  // Replace by id if exists, otherwise append
  const idField = entity.id ? 'id' : (entity.skillId ? 'skillId' : null);
  if (idField && entity[idField]) {
    const idx = state[collectionName].findIndex(e => e[idField] === entity[idField]);
    if (idx >= 0) {
      state[collectionName][idx] = entity;
    } else {
      state[collectionName].push(entity);
    }
  } else {
    state[collectionName].push(entity);
  }

  saveJsonState(state);
}

function upsertSession(entity) {
  upsertEntity('sessions', 'session', entity);
}

function upsertSkillRun(entity) {
  upsertEntity('skillRuns', 'skillRun', entity);
}

function upsertSkillVersion(entity) {
  upsertEntity('skillVersions', 'skillVersion', entity);
}

function upsertDecision(entity) {
  upsertEntity('decisions', 'decision', entity);
}

function upsertGovernanceEvent(entity) {
  upsertEntity('governanceEvents', 'governanceEvent', entity);
}

// ── Query Helpers ───────────────────────────────────────────────────────────

function listSessions() {
  return loadJsonState().sessions;
}

function listSkillRuns(sessionId) {
  const runs = loadJsonState().skillRuns;
  return sessionId ? runs.filter(r => r.sessionId === sessionId) : runs;
}

function listDecisions(sessionId) {
  const decisions = loadJsonState().decisions;
  return sessionId ? decisions.filter(d => d.sessionId === sessionId) : decisions;
}

function listGovernanceEvents(sessionId) {
  const events = loadJsonState().governanceEvents;
  return sessionId ? events.filter(e => e.sessionId === sessionId) : events;
}

/**
 * Collect all operations across all installState entities into flat installedFiles format.
 */
function allOperations(state) {
  const files = [];
  for (const install of state.installState) {
    for (const op of install.operations) {
      files.push({
        destPath: op.destinationPath,
        srcPath: op.sourceRelativePath,
        module: op.moduleId,
        hash: op.hash || null,
        installedAt: install.installedAt,
        profile: install.profile,
        target: install.targetId,
      });
    }
  }
  return files;
}

// ── Backward-Compatible API ─────────────────────────────────────────────────

/**
 * Save installation state (backward-compatible).
 * Translates old format to installState entity.
 */
function saveState(state) {
  ensureStateDir();
  const now = state.installedAt || new Date().toISOString();
  const current = loadJsonState();

  // Create installState entity from legacy format
  const installEntity = {
    targetId: state.target || 'claude',
    targetRoot: process.cwd(),
    profile: state.profile || null,
    modules: [],
    operations: (state.installedFiles || []).map(f => ({
      kind: 'copy',
      moduleId: f.module || '',
      sourceRelativePath: f.srcPath || '',
      destinationPath: f.destPath || '',
      strategy: 'overwrite',
      ownership: 'scc',
      scaffoldOnly: false,
      hash: f.hash || null,
    })),
    installedAt: now,
    sourceVersion: null,
  };

  // Merge operations: replace entries with same destinationPath
  const existingInstall = current.installState[current.installState.length - 1];
  if (existingInstall) {
    const existingOps = new Map(existingInstall.operations.map(op => [op.destinationPath, op]));
    for (const op of installEntity.operations) {
      existingOps.set(op.destinationPath, op);
    }
    installEntity.operations = Array.from(existingOps.values());
  }

  // Replace or append installState
  if (current.installState.length > 0) {
    current.installState[current.installState.length - 1] = installEntity;
  } else {
    current.installState.push(installEntity);
  }

  // Record session
  current.sessions.push({
    id: `install-${now}`,
    adapterId: 'scc-install',
    harness: state.target || 'claude',
    state: 'completed',
    repoRoot: null,
    startedAt: now,
    endedAt: now,
    snapshot: { profile: state.profile, fileCount: (state.installedFiles || []).length },
  });

  saveJsonState(current);
}

/**
 * Load current installation state (backward-compatible).
 * Returns format expected by existing callers.
 */
function loadState() {
  const state = loadJsonState();
  const latest = state.installState[state.installState.length - 1];

  // Legacy module ID detection in entity format
  const LEGACY_PREFIXES = ['rules-', 'agents-', 'commands-', 'skills-', 'hooks-', 'platform-'];
  if (latest) {
    const hasLegacy = latest.operations.some(op =>
      op.moduleId && LEGACY_PREFIXES.some(prefix => op.moduleId.startsWith(prefix))
    );
    if (hasLegacy) {
      clearState();
      return { profile: null, target: null, installedAt: null, installedFiles: [], sessions: [] };
    }
  }

  return {
    profile: latest ? latest.profile : null,
    target: latest ? latest.targetId : null,
    installedAt: latest ? latest.installedAt : null,
    installedFiles: allOperations(state),
    sessions: state.sessions.map(s => ({
      profile: s.snapshot?.profile || null,
      target: s.harness,
      fileCount: s.snapshot?.fileCount || 0,
      installedAt: s.startedAt,
    })),
  };
}

/**
 * Clear all SCC state.
 */
function clearState() {
  try { fs.unlinkSync(STATE_PATH); } catch { /* ignore */ }
  // Also clean up legacy DB file if it exists
  const legacyDbPath = path.join(STATE_DIR, 'state.db');
  try { fs.unlinkSync(legacyDbPath); } catch { /* ignore */ }
}

/**
 * Remove specific files from the state store.
 * @param {string[]} destPaths
 */
function removeFiles(destPaths) {
  const state = loadJsonState();
  const removeSet = new Set(destPaths);

  for (const install of state.installState) {
    install.operations = install.operations.filter(op => !removeSet.has(op.destinationPath));
  }

  saveJsonState(state);
}

module.exports = {
  // Backward-compatible API
  saveState,
  loadState,
  clearState,
  removeFiles,
  // Entity operations (schema-validated)
  upsertSession,
  upsertSkillRun,
  upsertSkillVersion,
  upsertDecision,
  upsertGovernanceEvent,
  // Query helpers
  listSessions,
  listSkillRuns,
  listDecisions,
  listGovernanceEvents,
};
