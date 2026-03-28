#!/usr/bin/env node
'use strict';

/**
 * validate-install-manifests.js — CI validator for manifests/*.json files.
 *
 * Validates manifest files:
 *   1. manifests/install-profiles.json
 *   2. manifests/install-modules.json
 *
 * Supports two manifest schema styles:
 *   Style A (flat map): { profileName: { modules: [...] } }
 *   Style B (versioned): { version: 1, profiles: { profileName: { modules: [...] } } }
 *
 *   Style A (flat map): { moduleName: { files: {...} } }
 *   Style B (versioned array): { version: 1, modules: [ { id: "...", paths: [...] } ] }
 */

const fs = require('fs');
const path = require('path');
const { getPluginRoot, fileExists } = require('../lib/utils');
const { validateAgainstSchema, formatErrors } = require('../lib/schema-validator');

const pluginRoot = getPluginRoot();
const manifestsDir = path.join(pluginRoot, 'manifests');

const errors = [];
const warnings = [];
let passCount = 0;

// ── Helper ────────────────────────────────────────────────────────────────────

function loadJson(filePath, required = true) {
  if (!fs.existsSync(filePath)) {
    if (required) errors.push(`File not found: ${path.relative(pluginRoot, filePath)}`);
    else warnings.push(`Optional file not found: ${path.relative(pluginRoot, filePath)}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    errors.push(`${path.relative(pluginRoot, filePath)}: invalid JSON — ${err.message}`);
    return null;
  }
}

/**
 * Normalize profiles manifest to flat-map style regardless of input schema.
 * Returns { [profileName]: { modules: [...], extends?: [...], description?: string } } or null on error.
 */
function normalizeProfiles(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  // Style B: { version, profiles: { ... } }
  if (raw.profiles && typeof raw.profiles === 'object' && !Array.isArray(raw.profiles)) {
    return raw.profiles;
  }

  // Style A: direct map (all keys except 'version' and '$schema' are profile names)
  const normalized = {};
  for (const [key, val] of Object.entries(raw)) {
    if (key === 'version' || key === '$schema') continue;
    normalized[key] = val;
  }
  return Object.keys(normalized).length > 0 ? normalized : null;
}

/**
 * Normalize modules manifest to flat-map style.
 * Returns { [moduleId]: { description?, files?, dirs?, paths? } } or null on error.
 */
function normalizeModules(raw) {
  if (!raw || typeof raw !== 'object') return null;

  // Style B: { version, modules: [ { id, ... }, ... ] }
  if (Array.isArray(raw.modules)) {
    const map = {};
    for (const mod of raw.modules) {
      if (mod && mod.id) {
        map[mod.id] = mod;
      }
    }
    return map;
  }

  // Style A: direct map
  const map = {};
  for (const [key, val] of Object.entries(raw)) {
    if (key === 'version' || key === '$schema') continue;
    map[key] = val;
  }
  return Object.keys(map).length > 0 ? map : null;
}

// ── 1. Validate manifests directory ──────────────────────────────────────────

if (!fs.existsSync(manifestsDir)) {
  console.error(`[ERROR] manifests/ directory not found at: ${manifestsDir}`);
  process.exit(1);
}

// ── 1b. Schema validation (AJV) ─────────────────────────────────────────────

const schemasDir = path.join(pluginRoot, 'schemas');

const profilesSchemaPath = path.join(schemasDir, 'install-profiles.schema.json');
const modulesSchemaPath = path.join(schemasDir, 'install-modules.schema.json');

function validateManifestSchema(filePath, schemaPath, label) {
  if (!fs.existsSync(schemaPath) || !fs.existsSync(filePath)) return;
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const result = validateAgainstSchema(schemaPath, data);
    if (!result.valid) {
      for (const err of result.errors) {
        warnings.push(`${label} schema: ${err.instancePath || '/'} ${err.message}`);
      }
    } else {
      passCount++;
    }
  } catch { /* JSON parse errors handled later */ }
}

validateManifestSchema(path.join(manifestsDir, 'install-profiles.json'), profilesSchemaPath, 'install-profiles.json');
validateManifestSchema(path.join(manifestsDir, 'install-modules.json'), modulesSchemaPath, 'install-modules.json');

// ── 2. Validate install-profiles.json ────────────────────────────────────────

const profilesPath = path.join(manifestsDir, 'install-profiles.json');
const profilesRaw = loadJson(profilesPath, true);
let profiles = null;

if (profilesRaw) {
  if (typeof profilesRaw !== 'object' || Array.isArray(profilesRaw)) {
    errors.push('install-profiles.json: root must be an object');
  } else {
    profiles = normalizeProfiles(profilesRaw);
    if (!profiles || Object.keys(profiles).length === 0) {
      errors.push('install-profiles.json: no profiles found (expected profile definitions)');
    } else {
      const requiredProfiles = ['full'];
      for (const req of requiredProfiles) {
        if (!profiles[req]) {
          errors.push(`install-profiles.json: missing required profile "${req}"`);
        }
      }

      for (const [profileName, profileDef] of Object.entries(profiles)) {
        const loc = `install-profiles.json[${profileName}]`;

        if (!profileDef || typeof profileDef !== 'object') {
          errors.push(`${loc}: profile definition must be an object`);
          continue;
        }

        // Must have modules array or extends
        if (!Array.isArray(profileDef.modules) && !profileDef.extends) {
          errors.push(`${loc}: must have either "modules" array or "extends" field`);
        }

        if (profileDef.modules && !Array.isArray(profileDef.modules)) {
          errors.push(`${loc}: "modules" must be an array`);
        }

        if (profileDef.extends) {
          const extendsArr = Array.isArray(profileDef.extends) ? profileDef.extends : [profileDef.extends];
          for (const parent of extendsArr) {
            if (!profiles[parent]) {
              errors.push(`${loc}: extends unknown profile "${parent}"`);
            }
          }
          const selfExtends = (Array.isArray(profileDef.extends) ? profileDef.extends : [profileDef.extends]).includes(profileName);
          if (selfExtends) {
            errors.push(`${loc}: circular extends — profile cannot extend itself`);
          }
        }
      }

      console.log(`  install-profiles.json: ${Object.keys(profiles).length} profile(s) — OK`);
      passCount++;
    }
  }
}

// ── 3. Validate install-modules.json ─────────────────────────────────────────

const modulesPath = path.join(manifestsDir, 'install-modules.json');
const modulesRaw = loadJson(modulesPath, true);
let modules;

if (modulesRaw) {
  if (typeof modulesRaw !== 'object') {
    errors.push('install-modules.json: root must be an object or have a "modules" array');
  } else {
    modules = normalizeModules(modulesRaw);
    if (!modules || Object.keys(modules).length === 0) {
      errors.push('install-modules.json: no modules found (expected module definitions)');
    } else {
      const VALID_CONTENT_TYPES = new Set(['agents', 'skills', 'commands', 'rules', 'hooks', 'contexts', 'examples', 'config', 'scripts']);

      for (const [moduleName, moduleDef] of Object.entries(modules)) {
        const loc = `install-modules.json[${moduleName}]`;

        if (!moduleDef || typeof moduleDef !== 'object') {
          errors.push(`${loc}: module definition must be an object`);
          continue;
        }

        // Must have files, dirs, paths, or pathGroups
        if (!moduleDef.files && !moduleDef.dirs && !moduleDef.paths && !moduleDef.pathGroups) {
          warnings.push(`${loc}: module has no "files", "dirs", "paths", or "pathGroups" — nothing will be installed`);
        }

        // Validate pathGroups (bundle format)
        if (moduleDef.pathGroups) {
          if (!Array.isArray(moduleDef.pathGroups)) {
            errors.push(`${loc}.pathGroups: must be an array of { paths, targets } objects`);
          } else {
            for (let gi = 0; gi < moduleDef.pathGroups.length; gi++) {
              const group = moduleDef.pathGroups[gi];
              const gloc = `${loc}.pathGroups[${gi}]`;
              if (!group || typeof group !== 'object') {
                errors.push(`${gloc}: must be an object with "paths" and "targets"`);
                continue;
              }
              if (!Array.isArray(group.paths)) {
                errors.push(`${gloc}.paths: must be an array`);
              } else {
                for (const p of group.paths) {
                  if (typeof p !== 'string' || p.trim() === '') {
                    errors.push(`${gloc}.paths: entries must be non-empty strings`);
                  } else {
                    const resolvedPath = path.join(pluginRoot, p);
                    if (!fileExists(resolvedPath) && !fs.existsSync(resolvedPath)) {
                      errors.push(`${gloc}.paths: referenced path does not exist: ${p}`);
                    }
                  }
                }
              }
              if (!group.targets || typeof group.targets !== 'object') {
                errors.push(`${gloc}.targets: must be an object`);
              }
            }
          }
        }

        // Validate files structure (Style A)
        if (moduleDef.files) {
          if (typeof moduleDef.files !== 'object' || Array.isArray(moduleDef.files)) {
            errors.push(`${loc}.files: must be an object mapping content-type → [file list]`);
          } else {
            for (const [contentType, fileList] of Object.entries(moduleDef.files)) {
              if (!VALID_CONTENT_TYPES.has(contentType)) {
                warnings.push(`${loc}.files.${contentType}: unknown content type (valid: ${[...VALID_CONTENT_TYPES].join(', ')})`);
              }
              const files = Array.isArray(fileList) ? fileList : [fileList];
              for (const f of files) {
                if (typeof f !== 'string' || f.trim() === '') {
                  errors.push(`${loc}.files.${contentType}: file entries must be non-empty strings`);
                } else {
                  const srcPath = path.join(pluginRoot, contentType, f);
                  if (!fileExists(srcPath)) {
                    warnings.push(`${loc}.files.${contentType}: referenced file does not exist: ${contentType}/${f}`);
                  }
                }
              }
            }
          }
        }

        // Validate dirs structure (Style A)
        if (moduleDef.dirs) {
          if (typeof moduleDef.dirs !== 'object' || Array.isArray(moduleDef.dirs)) {
            errors.push(`${loc}.dirs: must be an object mapping content-type → [dir list]`);
          } else {
            for (const [contentType, dirList] of Object.entries(moduleDef.dirs)) {
              if (!VALID_CONTENT_TYPES.has(contentType)) {
                warnings.push(`${loc}.dirs.${contentType}: unknown content type`);
              }
              const dirs = Array.isArray(dirList) ? dirList : [dirList];
              for (const d of dirs) {
                if (typeof d !== 'string' || d.trim() === '') {
                  errors.push(`${loc}.dirs.${contentType}: dir entries must be non-empty strings`);
                }
              }
            }
          }
        }

        // Validate paths array (Style B — versioned format)
        if (moduleDef.paths) {
          if (!Array.isArray(moduleDef.paths)) {
            errors.push(`${loc}.paths: must be an array of file/directory paths`);
          } else {
            for (const p of moduleDef.paths) {
              if (typeof p !== 'string' || p.trim() === '') {
                errors.push(`${loc}.paths: path entries must be non-empty strings`);
              } else {
                const resolvedPath = path.join(pluginRoot, p);
                if (!fileExists(resolvedPath) && !fs.existsSync(resolvedPath)) {
                  errors.push(`${loc}.paths: referenced path does not exist: ${p}`);
                }
              }
            }
          }
        }

        // Validate kind field (Style B)
        if (moduleDef.kind !== undefined) {
          const VALID_KINDS = new Set(['rules', 'agents', 'skills', 'commands', 'hooks', 'config', 'contexts', 'bundle']);
          if (!VALID_KINDS.has(moduleDef.kind)) {
            warnings.push(`${loc}.kind: unknown kind "${moduleDef.kind}" (valid: ${[...VALID_KINDS].join(', ')})`);
          }
        }
      }

      // Cross-check: all modules referenced in profiles must exist
      if (profiles) {
        for (const [profileName, profileDef] of Object.entries(profiles)) {
          for (const modName of (profileDef.modules || [])) {
            if (!modules[modName]) {
              errors.push(`install-profiles.json[${profileName}].modules: references unknown module "${modName}"`);
            }
          }
        }
      }

      // ── Disk→Manifest: all skill dirs, agent .md files, and command .md files must be in some module ──────

      const DIRS_TO_CHECK = ['skills', 'agents', 'commands'];
      const allManifestPaths = Object.values(modules).flatMap(m => {
        const direct = m.paths || [];
        const grouped = (m.pathGroups || []).flatMap(g => g.paths || []);
        return [...direct, ...grouped];
      });

      for (const contentDir of DIRS_TO_CHECK) {
        const dirPath = path.join(pluginRoot, contentDir);
        if (!fs.existsSync(dirPath)) continue;

        const diskItems = fs.readdirSync(dirPath)
          .filter(f => {
            const itemPath = path.join(dirPath, f);
            return fs.statSync(itemPath).isDirectory() || f.endsWith('.md');
          })
          .sort();

        for (const item of diskItems) {
          const covered = allManifestPaths.some(p => p.includes(`${contentDir}/${item}`));
          if (!covered) {
            errors.push(`${contentDir}/${item}: exists on disk but is not referenced in any install module`);
          }
        }
      }

      console.log(`  install-modules.json: ${Object.keys(modules).length} module(s) — OK`);
      passCount++;
    }
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
  console.error(`\nManifest validation FAILED (${errors.length} error(s)):\n`);
  for (const e of errors) {
    console.error(`  [FAIL] ${e}`);
  }
  process.exit(1);
}

console.log(`\nManifest validation PASSED — ${passCount} manifest file(s) validated.`);
process.exit(0);
