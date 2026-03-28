#!/usr/bin/env node
'use strict';

/**
 * run-with-flags.js — Profile-based hook gating for SCC.
 *
 * Reads stdin, checks SCC_HOOK_PROFILE and SCC_DISABLED_HOOKS before running
 * a hook script. Passes stdin through to stdout when the hook is skipped.
 *
 * Usage: node run-with-flags.js <hook-name> <min-profile> <script-path>
 * Profiles: minimal < standard < strict
 *
 * Hook execution:
 *   - If module exports run(input): calls run(stdin) directly (no child process)
 *   - Otherwise: spawns 'node <script-path>' with stdin piped (legacy hooks)
 */

const fs = require('fs');
const { spawnSync } = require('child_process');

const PROFILE_LEVELS = { minimal: 1, standard: 2, strict: 3 };
const MAX_STDIN = 1024 * 1024;

function readStdinRaw() {
  return new Promise(resolve => {
    let raw = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => {
      if (raw.length < MAX_STDIN) {
        const remaining = MAX_STDIN - raw.length;
        raw += chunk.substring(0, remaining);
      }
    });
    process.stdin.on('end', () => resolve(raw));
    process.stdin.on('error', () => resolve(raw));
  });
}

async function main() {
  const hookName = process.argv[2];
  const minProfile = process.argv[3] || 'standard';
  const scriptPath = process.argv[4];
  const timeoutMs = parseInt(process.argv[5], 10) || 30000;

  const raw = await readStdinRaw();

  // Guard: missing args — pass through transparently
  if (!hookName || !scriptPath) {
    process.stdout.write(raw);
    process.exit(0);
  }

  const currentProfile = process.env.SCC_HOOK_PROFILE || 'standard';
  const disabledHooks = (process.env.SCC_DISABLED_HOOKS || '').split(',').map(h => h.trim().toLowerCase()).filter(Boolean);

  // Skip if hook is explicitly disabled
  if (disabledHooks.includes(hookName.toLowerCase())) {
    process.stdout.write(raw);
    process.exit(0);
  }

  // Skip if current profile is below minimum required level
  const currentLevel = PROFILE_LEVELS[currentProfile] || 2;
  const minLevel = PROFILE_LEVELS[minProfile] || 2;
  if (currentLevel < minLevel) {
    process.stdout.write(raw);
    process.exit(0);
  }

  // Guard: script must exist and be a .js file
  if (!scriptPath.endsWith('.js') || !fs.existsSync(scriptPath)) {
    process.stderr.write(`[Hook] Script not found or invalid: ${scriptPath}\n`);
    process.stdout.write(raw);
    process.exit(0);
  }

  // Source pre-check: only require() hooks that export run().
  // Prevents executing legacy hooks' module-scope side effects (stdin listeners,
  // process.exit calls, main() invocations) when called via require().
  const src = fs.readFileSync(scriptPath, 'utf8');
  const hasRunExport = /\bmodule\.exports\b/.test(src) && /\brun\b/.test(src);

  let hookModule;
  if (hasRunExport) {
    try {
      hookModule = require(scriptPath);
    } catch (requireErr) {
      process.stderr.write(`[Hook] require() failed for ${hookName}: ${requireErr.message}\n`);
      // Fall through to spawnSync
    }
  }

  if (hookModule && typeof hookModule.run === 'function') {
    try {
      const output = hookModule.run(raw);
      if (output !== null && output !== undefined) process.stdout.write(output);
    } catch (runErr) {
      process.stderr.write(`[Hook] run() error for ${hookName}: ${runErr.message}\n`);
      process.stdout.write(raw);
    }
    process.exit(0);
  }

  // Legacy path: spawn a child Node process for hooks without run() export
  const result = spawnSync('node', [scriptPath], {
    input: raw,
    encoding: 'utf8',
    env: process.env,
    cwd: process.cwd(),
    timeout: timeoutMs
  });

  if (result.error) {
    process.stderr.write(`[Hook] Spawn error for ${hookName}: ${result.error.message}\n`);
    process.stdout.write(raw);
    process.exit(0);
  }

  if (result.signal) {
    process.stderr.write(`[Hook] ${hookName} killed by ${result.signal} (timeout: ${timeoutMs}ms)\n`);
    process.stdout.write(raw);
    process.exit(0);
  }

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  const code = Number.isInteger(result.status) ? result.status : 0;
  process.exit(code);
}

main().catch(err => {
  process.stderr.write(`[Hook] run-with-flags error: ${err.message}\n`);
  process.exit(0);
});
