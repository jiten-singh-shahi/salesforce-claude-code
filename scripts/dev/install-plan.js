#!/usr/bin/env node
'use strict';

/**
 * install-plan.js — Show what would be installed for a given profile/target.
 *
 * Usage:
 *   node install-plan.js [--profile <name>] [--target <name>] [--json]
 */

const fs = require('fs');
const path = require('path');
const { readJson, fileExists, getPluginRoot } = require('../lib/utils');
const { resolveProfileModules, getTargetDirs, VALID_TARGETS, VALID_PROFILES } = require('../lib/install-executor');
const { loadInstallConfig } = require('../lib/install-config');

function showHelp(exitCode = 0) {
  console.log(`
scc plan — Show what would be installed

Usage:
  scc plan [options]

Options:
  --profile <name>  Profile to inspect: core|apex|lwc|devops|security|full (default: full)
  --target <name>   Target to inspect: ${VALID_TARGETS.join('|')} (default: claude)
  --config <path>   Load install config from scc-install.json (CLI args override config)
  --json            Output as JSON
  --help, -h        Show this help
`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = { profile: null, target: null, json: false, help: false, config: null };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg === '--json') opts.json = true;
    else if (arg === '--config' && args[i + 1]) opts.config = args[++i];
    else if (arg === '--profile' && args[i + 1]) opts.profile = args[++i];
    else if (arg === '--target' && args[i + 1]) opts.target = args[++i];
  }

  // Merge with config file if provided (CLI overrides config)
  if (opts.config) {
    try {
      const config = loadInstallConfig(opts.config);
      if (!opts.profile) opts.profile = config.profile;
      if (!opts.target) opts.target = config.target;
    } catch (err) {
      console.error(`[ERROR] Config: ${err.message}`);
      process.exit(1);
    }
  }

  // Apply defaults
  if (!opts.profile) opts.profile = 'full';
  if (!opts.target) opts.target = 'claude';

  return opts;
}

const opts = parseArgs(process.argv);
if (opts.help) showHelp(0);

const pluginRoot = getPluginRoot();
const profilesPath = path.join(pluginRoot, 'manifests', 'install-profiles.json');
const modulesPath = path.join(pluginRoot, 'manifests', 'install-modules.json');

const profilesData = readJson(profilesPath);
const modulesData = readJson(modulesPath);

if (!profilesData || !modulesData) {
  console.error('[ERROR] Cannot load manifests. Run from the plugin root or set CLAUDE_PLUGIN_ROOT.');
  process.exit(1);
}

// Extract nested objects (same pattern as install-executor.js loadManifests)
const profiles = profilesData.profiles || profilesData;
const modulesArray = modulesData.modules || modulesData;
const modules = {};
if (Array.isArray(modulesArray)) {
  for (const mod of modulesArray) {
    if (mod.id) modules[mod.id] = mod;
  }
} else {
  Object.assign(modules, modulesArray);
}

if (!VALID_PROFILES.includes(opts.profile)) {
  console.error(`[ERROR] Invalid profile: ${opts.profile}. Valid: ${VALID_PROFILES.join(', ')}`);
  process.exit(1);
}

if (!VALID_TARGETS.includes(opts.target)) {
  console.error(`[ERROR] Invalid target: ${opts.target}. Valid: ${VALID_TARGETS.join(', ')}`);
  process.exit(1);
}

let moduleNames;
try {
  moduleNames = resolveProfileModules(profiles, opts.profile);
} catch (err) {
  console.error(`[ERROR] ${err.message}`);
  process.exit(1);
}

const targetDirs = getTargetDirs(opts.target, process.cwd());
const plan = [];

for (const moduleName of moduleNames) {
  const moduleDef = modules[moduleName];
  if (!moduleDef) {
    plan.push({ module: moduleName, warning: 'Module definition not found', files: [] });
    continue;
  }

  const files = [];

  // Paths-based modules (standard install-modules.json format)
  const destRelative = (moduleDef.targets || {})[opts.target];
  for (const srcRelative of (moduleDef.paths || [])) {
    const srcPath = path.join(pluginRoot, srcRelative);

    if (srcRelative.endsWith('/')) {
      // Directory path — enumerate files
      if (fs.existsSync(srcPath)) {
        const dirName = path.basename(srcRelative.slice(0, -1));
        const entries = fs.readdirSync(srcPath);
        for (const entry of entries) {
          const fullSrc = path.join(srcPath, entry);
          const destPath = destRelative ? path.join(process.cwd(), destRelative, dirName, entry) : null;
          files.push({
            contentType: moduleDef.kind || 'unknown',
            file: path.join(srcRelative, entry),
            srcPath: fullSrc,
            destPath,
            srcExists: fileExists(fullSrc),
          });
        }
      } else {
        files.push({ contentType: moduleDef.kind || 'unknown', file: srcRelative, srcPath, destPath: null, srcExists: false, warning: 'Directory not found' });
      }
    } else {
      // Single file path
      const destPath = destRelative ? path.join(process.cwd(), destRelative, path.basename(srcRelative)) : null;
      files.push({
        contentType: moduleDef.kind || 'unknown',
        file: srcRelative,
        srcPath,
        destPath,
        srcExists: fileExists(srcPath),
      });
    }
  }

  // Legacy files/dirs format (fallback)
  for (const [contentType, fileList] of Object.entries(moduleDef.files || {})) {
    const destDir = targetDirs[contentType];
    const srcBaseDir = path.join(pluginRoot, contentType);

    for (const file of (Array.isArray(fileList) ? fileList : [fileList])) {
      const srcPath = path.join(srcBaseDir, file);
      const destPath = destDir ? path.join(destDir, path.basename(file)) : null;
      files.push({
        contentType,
        file,
        srcPath,
        destPath,
        srcExists: fileExists(srcPath),
      });
    }
  }

  for (const [contentType, dirList] of Object.entries(moduleDef.dirs || {})) {
    const destBaseDir = targetDirs[contentType];
    const srcBaseDir = path.join(pluginRoot, contentType);

    for (const dir of (Array.isArray(dirList) ? dirList : [dirList])) {
      const srcDir = path.join(srcBaseDir, dir);
      if (fs.existsSync(srcDir)) {
        const entries = fs.readdirSync(srcDir);
        for (const entry of entries) {
          const srcPath = path.join(srcDir, entry);
          const destPath = destBaseDir ? path.join(destBaseDir, dir, entry) : null;
          files.push({
            contentType,
            file: path.join(dir, entry),
            srcPath,
            destPath,
            srcExists: fileExists(srcPath),
          });
        }
      } else {
        files.push({ contentType, file: dir + '/', srcPath: srcDir, destPath: null, srcExists: false, warning: 'Directory not found' });
      }
    }
  }

  plan.push({ module: moduleName, description: moduleDef.description || '', files });
}

const totalFiles = plan.reduce((sum, m) => sum + m.files.length, 0);
const missingFiles = plan.reduce((sum, m) => sum + m.files.filter(f => !f.srcExists).length, 0);

if (opts.json) {
  console.log(JSON.stringify({ profile: opts.profile, target: opts.target, totalFiles, missingFiles, modules: plan }, null, 2));
  process.exit(0);
}

// Human-readable output
console.log(`\nSCC Install Plan`);
console.log(`${'─'.repeat(50)}`);
console.log(`Profile : ${opts.profile}`);
console.log(`Target  : ${opts.target}`);
console.log(`Modules : ${moduleNames.length}`);
console.log(`Files   : ${totalFiles}${missingFiles > 0 ? ` (${missingFiles} missing from source)` : ''}`);
console.log();

for (const mod of plan) {
  console.log(`Module: ${mod.module}${mod.description ? ` — ${mod.description}` : ''}${mod.warning ? ` [WARN: ${mod.warning}]` : ''}`);
  for (const f of mod.files) {
    const status = !f.srcExists ? ' [MISSING SRC]' : '';
    const dest = f.destPath || '(target does not support this content type)';
    console.log(`  ${f.contentType.padEnd(10)} ${f.file.padEnd(40)} → ${dest}${status}`);
  }
  if (mod.files.length === 0) {
    console.log('  (no files defined)');
  }
  console.log();
}

console.log(`Total: ${totalFiles} file(s) across ${moduleNames.length} module(s) would be installed.`);
