#!/usr/bin/env node
'use strict';

/**
 * PreToolUse Hook: Remind to review changes before git push
 *
 * Detects `git push` commands and logs a reminder to review
 * changes before pushing.
 */

const MAX_STDIN = 1024 * 1024;
let raw = '';

process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  if (raw.length < MAX_STDIN) {
    const remaining = MAX_STDIN - raw.length;
    raw += chunk.substring(0, remaining);
  }
});

process.stdin.on('end', () => {
  try {
    const input = JSON.parse(raw);
    const { normalizeInput } = require('../lib/hook-input');
    const ctx = normalizeInput(input);
    if (/\bgit\s+push\b/.test(ctx.command)) {
      console.error('[Hook] Review changes before push...');
      console.error('[Hook] Continuing with push (remove this hook to add interactive review)');
    }
  } catch {
    // ignore parse errors and pass through
  }

  process.stdout.write(raw);
});
