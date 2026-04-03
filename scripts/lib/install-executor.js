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
const { transformHooks } = require('./hooks-adapter');

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
        settings: path.join(projectRoot, '.claude', 'settings.json'),
      };
    case 'cursor':
      return {
        agents: path.join(projectRoot, '.cursor', 'agents'),
        skills: path.join(projectRoot, '.cursor', 'skills'),
        commands: path.join(projectRoot, '.cursor', 'commands'),
        hooks: path.join(projectRoot, '.cursor', 'hooks.json'),
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
 * Remap hook commands from plugin paths to project-local paths.
 * ${CLAUDE_PLUGIN_ROOT}/scripts/hooks/foo.js → "$CLAUDE_PROJECT_DIR"/.claude/hooks/foo.js
 */
function remapHookCommandForProject(command) {
  // Strip run-with-flags wrapper and extract the actual script
  const runWithFlagsMatch = command.match(
    /node\s+"?\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/hooks\/run-with-flags\.js"?\s+\S+\s+\S+\s+"?\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/hooks\/([^"]+)"?/
  );
  if (runWithFlagsMatch) {
    return `node "$CLAUDE_PROJECT_DIR"/.claude/hooks/${runWithFlagsMatch[1]}`;
  }

  // Shell flags wrapper
  const shellFlagsMatch = command.match(
    /bash\s+"?\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/hooks\/run-with-flags-shell\.sh"?\s+\S+\s+"?scripts\/hooks\/([^"]+)"?\s+\S+/
  );
  if (shellFlagsMatch) {
    return `bash "$CLAUDE_PROJECT_DIR"/.claude/hooks/${shellFlagsMatch[1]}`;
  }

  // Direct script reference
  const directMatch = command.match(
    /node\s+"?\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/hooks\/([^"]+)"?/
  );
  if (directMatch) {
    return `node "$CLAUDE_PROJECT_DIR"/.claude/hooks/${directMatch[1]}`;
  }

  // npx commands pass through
  if (command.startsWith('npx ')) {
    return command;
  }

  return command.replace(/\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/hooks\//g, '"$CLAUDE_PROJECT_DIR"/.claude/hooks/');
}

/**
 * Install hooks by merging into .claude/settings.json (Claude Code target)
 * or generating .cursor/hooks.json (Cursor target).
 *
 * Claude Code reads hooks from settings.json, NOT from a separate hooks.json.
 * The hooks/hooks.json format is only for plugins.
 */
function installHooks(group, pluginRoot, targetName, projectRoot, moduleName, dryRun) {
  const installed = [];
  const hooksSourcePath = path.join(pluginRoot, group.hooksSource || 'hooks/hooks.json');

  if (!fileExists(hooksSourcePath)) {
    console.warn(`  [WARN] Hooks source not found: ${hooksSourcePath}`);
    return installed;
  }

  // Step 1: Copy hook scripts to target directory
  const destRelative = (group.targets || {})[targetName];
  if (destRelative) {
    const destDir = path.join(projectRoot, destRelative);
    installed.push(...installPaths(group.paths || [], destDir, pluginRoot, moduleName, dryRun, targetName));
  }

  // Step 2: For Claude Code target, merge hooks into .claude/settings.json
  if (targetName === 'claude') {
    const settingsPath = path.join(projectRoot, '.claude', 'settings.json');
    const hooksJson = readJson(hooksSourcePath);

    if (!hooksJson || !hooksJson.hooks) {
      console.warn('  [WARN] No hooks found in hooks source');
      return installed;
    }

    // Remap all hook commands from plugin paths to project-local paths
    const remappedHooks = {};
    for (const [event, groups] of Object.entries(hooksJson.hooks)) {
      remappedHooks[event] = groups.map(g => ({
        ...g,
        hooks: (g.hooks || []).map(h => ({
          ...h,
          command: h.command ? remapHookCommandForProject(h.command) : h.command,
        })),
      }));
    }

    if (dryRun) {
      const hookCount = Object.values(remappedHooks).reduce((sum, arr) => sum + arr.length, 0);
      console.log(`  [dry-run] Would merge ${hookCount} hook groups into .claude/settings.json`);
    } else {
      // Read existing settings or create new
      let settings = {};
      if (fileExists(settingsPath)) {
        settings = readJson(settingsPath) || {};
      }

      // Merge hooks (SCC hooks replace any existing SCC hooks)
      settings.hooks = remappedHooks;

      // Write settings.json
      const settingsDir = path.dirname(settingsPath);
      if (!fs.existsSync(settingsDir)) {
        fs.mkdirSync(settingsDir, { recursive: true });
      }
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
      console.log(`  [OK] Merged hooks into .claude/settings.json`);
    }

    installed.push({
      destPath: settingsPath,
      srcPath: hooksSourcePath,
      module: moduleName,
      hash: simpleHash(hooksSourcePath),
    });
  }

  // Step 3: For Cursor target, generate .cursor/hooks.json via adapter
  if (targetName === 'cursor') {
    const hooksJson = readJson(hooksSourcePath);
    if (hooksJson) {
      const cursorHooksPath = path.join(projectRoot, '.cursor', 'hooks.json');
      const cursorHooks = transformHooks(hooksJson);

      // Remap adapter paths from scripts/hooks/ to .cursor/hooks/
      // (adapter outputs plugin-relative paths, but install copies to .cursor/hooks/)
      for (const hooks of Object.values(cursorHooks.hooks)) {
        for (const hook of hooks) {
          if (hook.command) {
            hook.command = hook.command.replace(/\bnode scripts\/hooks\//g, 'node "$CURSOR_PROJECT_DIR"/.cursor/hooks/');
            hook.command = hook.command.replace(/\bbash scripts\/hooks\//g, 'bash "$CURSOR_PROJECT_DIR"/.cursor/hooks/');
          }
        }
      }

      if (dryRun) {
        const hookCount = Object.values(cursorHooks.hooks).reduce((sum, arr) => sum + arr.length, 0);
        console.log(`  [dry-run] Would generate .cursor/hooks.json (${hookCount} hooks)`);
      } else {
        const destDir = path.dirname(cursorHooksPath);
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }
        fs.writeFileSync(cursorHooksPath, JSON.stringify(cursorHooks, null, 2) + '\n', 'utf8');
        console.log(`  [OK] Generated .cursor/hooks.json`);
      }

      installed.push({
        destPath: cursorHooksPath,
        srcPath: hooksSourcePath,
        module: moduleName,
        hash: simpleHash(hooksSourcePath),
      });
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
      // Special handling for hooks install type
      if (group.installType === 'hooks') {
        hasAnyTarget = true;
        installed.push(...installHooks(group, pluginRoot, targetName, projectRoot, moduleName, dryRun));
        continue;
      }

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
