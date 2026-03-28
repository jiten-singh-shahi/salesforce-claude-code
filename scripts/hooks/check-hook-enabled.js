#!/usr/bin/env node
'use strict';

/**
 * Helper: Check if a hook is enabled based on profile and disabled list.
 * Returns "yes" or "no" based on SCC_HOOK_PROFILE and SCC_DISABLED_HOOKS.
 */

const { isHookEnabled } = require('../lib/hook-flags');

const [, , hookId, profilesCsv] = process.argv;
if (!hookId) {
  process.stdout.write('yes');
  process.exit(0);
}

process.stdout.write(isHookEnabled(hookId, { profiles: profilesCsv }) ? 'yes' : 'no');
