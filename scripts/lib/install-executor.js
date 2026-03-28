'use strict';

/**
 * install-executor.js — Executes SCC content installation.
 *
 * Handles file copying for different targets:
 *   - claude   → .claude/ subdirs (agents, skills, commands)
 *   - cursor   → .cursor/ subdirs (agents, skills)
 */

const fs = require('fs');
const path = require('path');
const { copyFile, readJson, fileExists, simpleHash } = require('./utils');
const { saveState } = require('./state-store');
const { transformSkillDir } = require('./skill-adapter');
const { transformAgentFile } = require('./agent-adapter');

const VALID_TARGETS = ['claude', 'cursor'];
const VALID_PROFILES = ['apex', 'lwc', 'full'];

/**
 * Resolve target directory mappings.
 * @param {string} target
 * @param {string} projectRoot - directory where content is being installed
 */
function getTargetDirs(target, projectRoot) {
  switch (target) {
    case 'claude':
      return {
        agents: path.join(projectRoot, '.claude', 'agents'),
        skills: path.join(projectRoot, '.claude', 'skills'),
        commands: path.join(projectRoot, '.claude', 'commands'),
        hooks: path.join(projectRoot, '.claude', 'hooks'),
      };
    case 'cursor':
      return {
        agents: path.join(projectRoot, '.cursor', 'agents'),
        skills: path.join(projectRoot, '.cursor', 'skills'),
        commands: path.join(projectRoot, '.cursor', 'commands'),
        hooks: null,
      };
    default:
      throw new Error(`Unknown target: ${target}`);
  }
}

/**
 * Load install manifests from the plugin root.
 */
function loadManifests(pluginRoot) {
  const profilesPath = path.join(pluginRoot, 'manifests', 'install-profiles.json');
  const modulesPath = path.join(pluginRoot, 'manifests', 'install-modules.json');

  const profilesData = readJson(profilesPath);
  const modulesData = readJson(modulesPath);

  if (!profilesData) throw new Error(`Cannot read install-profiles.json at ${profilesPath}`);
  if (!modulesData) throw new Error(`Cannot read install-modules.json at ${modulesPath}`);

  // Extract nested profiles object from { version, profiles } wrapper
  const profiles = profilesData.profiles || profilesData;

  // Convert modules array to object keyed by id for lookup
  const modulesArray = modulesData.modules || modulesData;
  const modules = {};
  if (Array.isArray(modulesArray)) {
    for (const mod of modulesArray) {
      if (mod.id) modules[mod.id] = mod;
    }
  } else {
    Object.assign(modules, modulesArray);
  }

  return { profiles, modules, targets: {} };
}

/**
 * Resolve which modules belong to a profile.
 * @param {Object} profiles
 * @param {string} profileName
 * @returns {string[]} list of module names
 */
function resolveProfileModules(profiles, profileName, visited = new Set()) {
  if (visited.has(profileName)) {
    throw new Error(`Circular profile dependency detected: ${[...visited, profileName].join(' → ')}`);
  }
  const profile = profiles[profileName];
  if (!profile) throw new Error(`Unknown profile: ${profileName}. Valid profiles: ${Object.keys(profiles).join(', ')}`);

  visited.add(profileName);

  // Profile may extend others
  const moduleList = [];
  if (profile.extends) {
    for (const parent of (Array.isArray(profile.extends) ? profile.extends : [profile.extends])) {
      moduleList.push(...resolveProfileModules(profiles, parent, new Set(visited)));
    }
  }
  moduleList.push(...(profile.modules || []));

  // Deduplicate while preserving order
  return [...new Set(moduleList)];
}

/**
 * Copy a single content file to the target directory.
 * @returns {{ destPath: string, srcPath: string, module: string, hash: string } | null}
 */
function installFile(srcPath, destDir, relativeName, moduleName, dryRun) {
  if (!fileExists(srcPath)) {
    console.warn(`  [WARN] Source file not found: ${srcPath}`);
    return null;
  }

  const destPath = path.join(destDir, relativeName);

  if (dryRun) {
    console.log(`  [dry-run] Would copy: ${srcPath} → ${destPath}`);
    return { destPath, srcPath, module: moduleName, hash: simpleHash(srcPath) };
  }

  copyFile(srcPath, destPath);
  return { destPath, srcPath, module: moduleName, hash: simpleHash(srcPath) };
}

/**
 * Check if a source path is a skill directory (contains SKILL.md).
 */
function isSkillDir(srcPath) {
  return fs.existsSync(path.join(srcPath, 'SKILL.md'));
}

/**
 * Check if a source path is an agent file (agents/*.md).
 */
function isAgentFile(srcRelative) {
  return srcRelative.startsWith('agents/') && srcRelative.endsWith('.md');
}

/**
 * Install paths for a given source list to a target directory.
 * @param {string} targetName - install target ('claude' or 'cursor')
 * @returns {Array} installed file records
 */
function installPaths(pathsList, destDir, pluginRoot, moduleName, dryRun, targetName) {
  const installed = [];

  for (const srcRelative of pathsList) {
    const srcPath = path.join(pluginRoot, srcRelative);

    if (srcRelative.endsWith('/')) {
      // Directory path — copy all files, preserving subdirectory name
      if (!fs.existsSync(srcPath)) {
        console.warn(`  [WARN] Source dir not found: ${srcPath}`);
        continue;
      }

      const dirName = path.basename(srcRelative.slice(0, -1));
      const destSubDir = path.join(destDir, dirName);

      // Use skill adapter for Cursor target when source is a skill directory
      if (targetName === 'cursor' && isSkillDir(srcPath)) {
        if (dryRun) {
          console.log(`  [dry-run] Would transform skill: ${srcRelative} → ${path.relative(pluginRoot, destSubDir)}/`);
        } else {
          transformSkillDir(srcPath, destSubDir);
        }
        installed.push({ destPath: destSubDir, srcPath, module: moduleName, hash: null });
        continue;
      }

      const entries = fs.readdirSync(srcPath);
      for (const entry of entries) {
        const fullSrc = path.join(srcPath, entry);
        if (fs.statSync(fullSrc).isFile()) {
          const record = installFile(fullSrc, destSubDir, entry, moduleName, dryRun);
          if (record) installed.push(record);
        }
      }
    } else {
      // Specific file path — use agent adapter for Cursor target
      if (targetName === 'cursor' && isAgentFile(srcRelative)) {
        const destPath = path.join(destDir, path.basename(srcRelative));
        if (dryRun) {
          console.log(`  [dry-run] Would transform agent: ${srcRelative} → ${path.relative(pluginRoot, destPath)}`);
        } else {
          transformAgentFile(srcPath, destPath);
        }
        installed.push({ destPath, srcPath, module: moduleName, hash: null });
      } else {
        const record = installFile(srcPath, destDir, path.basename(srcRelative), moduleName, dryRun);
        if (record) installed.push(record);
      }
    }
  }

  return installed;
}

/**
 * Install files for a single module definition.
 * Supports two formats:
 *   - Legacy: `paths` + `targets` (single target directory for all paths)
 *   - Bundle: `pathGroups` array of { paths, targets } (different targets per content type)
 *
 * @param {Object} moduleDef - from install-modules.json
 * @param {string} moduleName
 * @param {string} pluginRoot
 * @param {string} targetName - e.g. 'claude', 'cursor'
 * @param {string} projectRoot
 * @param {boolean} dryRun
 * @returns {Array} installed file records
 */
function installModule(moduleDef, moduleName, pluginRoot, targetName, projectRoot, dryRun) {
  // Bundle format: pathGroups array with per-group targets
  if (Array.isArray(moduleDef.pathGroups)) {
    const installed = [];
    let hasAnyTarget = false;

    for (const group of moduleDef.pathGroups) {
      const destRelative = (group.targets || {})[targetName];
      if (!destRelative) continue;
      hasAnyTarget = true;
      const destDir = path.join(projectRoot, destRelative);
      installed.push(...installPaths(group.paths || [], destDir, pluginRoot, moduleName, dryRun, targetName));
    }

    if (!hasAnyTarget) {
      console.log(`  [SKIP] Module ${moduleName} doesn't support target: ${targetName}`);
    }
    return installed;
  }

  // Legacy format: single paths + targets
  const installed = [];
  const destRelative = (moduleDef.targets || {})[targetName];
  if (!destRelative) {
    console.log(`  [SKIP] Module ${moduleName} doesn't support target: ${targetName}`);
    return installed;
  }

  const destDir = path.join(projectRoot, destRelative);
  return installPaths(moduleDef.paths || [], destDir, pluginRoot, moduleName, dryRun, targetName);
}

/**
 * Execute a full installation.
 *
 * @param {string} profileName - e.g. 'full', 'apex', 'core'
 * @param {string} targetName  - e.g. 'claude', 'cursor'
 * @param {Object} options
 * @param {boolean} [options.dryRun=false]
 * @param {string}  [options.projectRoot=process.cwd()]
 * @param {string}  [options.pluginRoot]
 * @returns {{ installedFiles: Array, moduleCount: number, fileCount: number }}
 */
function executeInstall(profileName, targetName, options = {}) {
  const dryRun = options.dryRun || false;
  const projectRoot = options.projectRoot || process.cwd();
  const pluginRoot = options.pluginRoot || process.env.CLAUDE_PLUGIN_ROOT || process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');

  if (!VALID_TARGETS.includes(targetName)) {
    throw new Error(`Invalid target: ${targetName}. Valid targets: ${VALID_TARGETS.join(', ')}`);
  }
  if (!VALID_PROFILES.includes(profileName)) {
    throw new Error(`Invalid profile: ${profileName}. Valid profiles: ${VALID_PROFILES.join(', ')}`);
  }

  const { profiles, modules } = loadManifests(pluginRoot);
  const moduleNames = resolveProfileModules(profiles, profileName);

  console.log(`\nInstalling SCC — profile: ${profileName}, target: ${targetName}${dryRun ? ' [DRY RUN]' : ''}`);
  console.log(`Project root: ${projectRoot}`);
  console.log(`Modules to install: ${moduleNames.join(', ')}\n`);

  const allInstalled = [];

  for (const moduleName of moduleNames) {
    const moduleDef = modules[moduleName];
    if (!moduleDef) {
      console.warn(`[WARN] Module definition not found: ${moduleName}`);
      continue;
    }
    console.log(`Installing module: ${moduleName}`);
    const records = installModule(moduleDef, moduleName, pluginRoot, targetName, projectRoot, dryRun);
    allInstalled.push(...records);
    console.log(`  ${records.length} file(s) installed`);
  }

  // Install MCP config (renamed file — claude: .mcp.json at root, cursor: .cursor/mcp.json)
  const mcpSrc = path.join(pluginRoot, 'mcp-configs', 'mcp-servers.json');
  const mcpDestMap = { claude: '.mcp.json', cursor: path.join('.cursor', 'mcp.json') };
  const mcpDest = mcpDestMap[targetName];
  if (mcpDest && fileExists(mcpSrc)) {
    const destPath = path.join(projectRoot, mcpDest);
    if (dryRun) {
      console.log(`\nMCP config:`);
      console.log(`  [dry-run] Would copy: mcp-configs/mcp-servers.json → ${mcpDest}`);
    } else {
      copyFile(mcpSrc, destPath);
      console.log(`\nMCP config:`);
      console.log(`  [OK] mcp-configs/mcp-servers.json → ${mcpDest}`);
    }
    allInstalled.push({ destPath, srcPath: mcpSrc, module: 'core', hash: simpleHash(mcpSrc) });
  }

  if (!dryRun) {
    saveState({
      profile: profileName,
      target: targetName,
      installedFiles: allInstalled,
    });
  }

  console.log(`\n${dryRun ? '[DRY RUN] Would install' : 'Installed'} ${allInstalled.length} file(s) across ${moduleNames.length} module(s).`);

  return {
    installedFiles: allInstalled,
    moduleCount: moduleNames.length,
    fileCount: allInstalled.length,
  };
}

/**
 * List available install targets.
 * @returns {string[]}
 */
function listAvailableTargets() {
  return [...VALID_TARGETS];
}

/**
 * List available install profiles.
 * @param {string} [pluginRoot]
 * @returns {Object} profile definitions
 */
function listAvailableProfiles(pluginRoot) {
  const root = pluginRoot || process.env.CLAUDE_PLUGIN_ROOT || process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
  try {
    const { profiles } = loadManifests(root);
    return profiles;
  } catch {
    // Return defaults if manifests not yet created
    return {
      core: { description: 'Minimal baseline', modules: [] },
      apex: { description: 'Apex development suite', modules: [] },
      lwc: { description: 'LWC development suite', modules: [] },
      devops: { description: 'DevOps and deployment', modules: [] },
      security: { description: 'Security-focused', modules: [] },
      full: { description: 'Complete suite', extends: ['apex', 'lwc', 'devops', 'security'], modules: [] },
    };
  }
}

module.exports = {
  executeInstall,
  listAvailableTargets,
  listAvailableProfiles,
  getTargetDirs,
  resolveProfileModules,
  VALID_TARGETS,
  VALID_PROFILES,
};
