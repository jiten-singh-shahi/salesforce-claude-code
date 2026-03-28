#!/usr/bin/env node
'use strict';

/**
 * install-apply.js — Apply SCC content installation.
 *
 * Usage:
 *   node install-apply.js [target] [--profile <name>] [--target <name>] [--dry-run] [--help]
 *
 * Targets: apex, lwc, all (shorthand for 'full' profile)
 * Profiles: core, apex, lwc, devops, security, full
 */

const path = require('path');
const { executeInstall, VALID_TARGETS, VALID_PROFILES } = require('../lib/install-executor');
const { loadInstallConfig } = require('../lib/install-config');

function showHelp(exitCode = 0) {
  console.log(`
scc install — Install SCC content

Usage:
  scc install [target] [options]
  scc install --profile <name> --target <name>

Shorthand targets:
  apex              Install Apex profile content
  lwc               Install LWC profile content
  all               Install full profile content

Options:
  --profile <name>  Profile to install: core|apex|lwc|devops|security|full (default: full)
  --target <name>   Install target: ${VALID_TARGETS.join('|')} (default: claude)
  --config <path>   Load install config from scc-install.json (CLI args override config)
  --project <dir>   Project root directory (default: current directory)
  --dry-run         Show what would be installed without making changes
  --help, -h        Show this help

Examples:
  scc install apex
  scc install all
  scc install --config scc-install.json
  scc install --config scc-install.json --target cursor
  scc install --profile security --target claude
  scc install --profile lwc --target cursor --dry-run
`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = {
    profile: null,
    target: null,
    projectRoot: process.cwd(),
    dryRun: false,
    help: false,
    config: null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (arg === '--dry-run') {
      opts.dryRun = true;
    } else if (arg === '--config' && args[i + 1]) {
      opts.config = args[++i];
    } else if (arg === '--profile' && args[i + 1]) {
      opts.profile = args[++i];
    } else if (arg === '--target' && args[i + 1]) {
      opts.target = args[++i];
    } else if (arg === '--project' && args[i + 1]) {
      opts.projectRoot = path.resolve(args[++i]);
    } else if (!arg.startsWith('--')) {
      // Positional: treat as shorthand target/profile
      switch (arg) {
        case 'apex':
          opts.profile = opts.profile || 'apex';
          break;
        case 'lwc':
          opts.profile = opts.profile || 'lwc';
          break;
        case 'all':
          opts.profile = opts.profile || 'full';
          break;
        case 'core':
        case 'devops':
        case 'security':
        case 'full':
          opts.profile = opts.profile || arg;
          break;
        default:
          // Could be a target name
          if (VALID_TARGETS.includes(arg)) {
            opts.target = arg;
          } else {
            console.error(`[ERROR] Unknown argument: ${arg}`);
            process.exit(1);
          }
      }
    }
  }

  return opts;
}

/**
 * Merge CLI opts with config file. CLI args override config values.
 */
function mergeWithConfig(opts) {
  if (!opts.config) {
    // No config file — apply defaults
    if (!opts.profile) opts.profile = 'full';
    if (!opts.target) opts.target = 'claude';
    return opts;
  }

  try {
    const config = loadInstallConfig(opts.config);
    console.log(`[INFO] Loaded config from ${config.path}`);

    // CLI args override config values
    if (!opts.profile) opts.profile = config.profile || 'full';
    if (!opts.target) opts.target = config.target || 'claude';

    return opts;
  } catch (err) {
    console.error(`[ERROR] Config: ${err.message}`);
    process.exit(1);
  }
}

function validateArgs(opts) {
  if (!VALID_PROFILES.includes(opts.profile)) {
    console.error(`[ERROR] Invalid profile: ${opts.profile}`);
    console.error(`Valid profiles: ${VALID_PROFILES.join(', ')}`);
    process.exit(1);
  }
  if (!VALID_TARGETS.includes(opts.target)) {
    console.error(`[ERROR] Invalid target: ${opts.target}`);
    console.error(`Valid targets: ${VALID_TARGETS.join(', ')}`);
    process.exit(1);
  }
}

const opts = mergeWithConfig(parseArgs(process.argv));

if (opts.help) {
  showHelp(0);
}

validateArgs(opts);

try {
  const result = executeInstall(opts.profile, opts.target, {
    dryRun: opts.dryRun,
    projectRoot: opts.projectRoot,
  });

  if (result.fileCount === 0 && !opts.dryRun) {
    console.log('\n[INFO] No files were installed. Check your manifests or profile definition.');
  } else {
    console.log('\nDone.');
  }
} catch (err) {
  console.error(`\n[ERROR] Installation failed: ${err.message}`);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
}
