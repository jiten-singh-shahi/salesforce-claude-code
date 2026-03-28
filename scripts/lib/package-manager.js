'use strict';

/**
 * package-manager.js — Detect the active package manager (npm/pnpm/yarn/bun).
 *
 * Detection order:
 *   1. CLAUDE_PACKAGE_MANAGER env var override
 *   2. Presence of lock files in cwd
 *   3. npm_execpath env var set by npm/yarn
 *   4. Fallback: npm
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const LOCK_FILES = [
  { file: 'bun.lockb', manager: 'bun' },
  { file: 'yarn.lock', manager: 'yarn' },
  { file: 'pnpm-lock.yaml', manager: 'pnpm' },
  { file: 'package-lock.json', manager: 'npm' },
  { file: 'npm-shrinkwrap.json', manager: 'npm' },
];

/**
 * Detect which package manager is in use.
 * @param {string} [cwd] - Directory to check for lock files (defaults to process.cwd())
 * @returns {'npm' | 'pnpm' | 'yarn' | 'bun'}
 */
function detectPackageManager(cwd) {
  // 1. Environment override
  const override = process.env.CLAUDE_PACKAGE_MANAGER || process.env.SCC_PACKAGE_MANAGER;
  if (override && ['npm', 'pnpm', 'yarn', 'bun'].includes(override.toLowerCase())) {
    return override.toLowerCase();
  }

  const dir = cwd || process.cwd();

  // 2. Lock file detection
  for (const { file, manager } of LOCK_FILES) {
    if (fs.existsSync(path.join(dir, file))) {
      return manager;
    }
  }

  // 3. npm_execpath (set by npm/yarn when running scripts)
  const execPath = process.env.npm_execpath || '';
  if (execPath.includes('yarn')) return 'yarn';
  if (execPath.includes('pnpm')) return 'pnpm';
  if (execPath.includes('bun')) return 'bun';

  // 4. Try to detect installed package managers by running them
  for (const pm of ['bun', 'pnpm', 'yarn']) {
    const result = spawnSync(pm, ['--version'], { encoding: 'utf8', timeout: 2000 });
    if (result.status === 0) return pm;
  }

  return 'npm';
}

/**
 * Get the install command for a given package.
 * @param {string} pkg - Package name (e.g., 'sql.js')
 * @param {string} [manager] - Override package manager
 * @returns {string} Full install command string
 */
function getInstallCommand(pkg, manager) {
  const pm = manager || detectPackageManager();
  switch (pm) {
    case 'yarn':
      return `yarn add ${pkg}`;
    case 'pnpm':
      return `pnpm add ${pkg}`;
    case 'bun':
      return `bun add ${pkg}`;
    case 'npm':
    default:
      return `npm install ${pkg}`;
  }
}

/**
 * Get the run command for a script.
 * @param {string} script - Script name
 * @param {string} [manager] - Override package manager
 * @returns {string}
 */
function getRunCommand(script, manager) {
  const pm = manager || detectPackageManager();
  switch (pm) {
    case 'yarn':
      return `yarn ${script}`;
    case 'pnpm':
      return `pnpm run ${script}`;
    case 'bun':
      return `bun run ${script}`;
    case 'npm':
    default:
      return `npm run ${script}`;
  }
}

/**
 * Get the exec/dlx command (equivalent of npx).
 * @param {string} bin - Binary to exec
 * @param {string} [manager] - Override package manager
 * @returns {string}
 */
function getExecCommand(bin, manager) {
  const pm = manager || detectPackageManager();
  switch (pm) {
    case 'yarn':
      return `yarn dlx ${bin}`;
    case 'pnpm':
      return `pnpm dlx ${bin}`;
    case 'bun':
      return `bunx ${bin}`;
    case 'npm':
    default:
      return `npx ${bin}`;
  }
}

module.exports = { detectPackageManager, getInstallCommand, getRunCommand, getExecCommand };
