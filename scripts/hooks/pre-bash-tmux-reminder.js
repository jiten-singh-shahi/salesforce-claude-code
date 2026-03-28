#!/usr/bin/env node
'use strict';

/**
 * pre-bash-tmux-reminder.js — PreToolUse (Bash) hook.
 *
 * Reminds the user to run long-running Salesforce CLI commands inside tmux
 * so that session disconnection doesn't kill deploys or test runs.
 *
 * Fires on: sf project deploy, sfdx force:source:deploy, sf apex run test,
 *           sfdx force:apex:test:run, sf org create scratch, npm test, jest
 *
 * Profile: strict (only fires when SCC_HOOK_PROFILE=strict)
 * Wired via run-with-flags.js — gating is handled externally.
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
    const cmd = String(input.tool_input?.command || '');

    if (
      process.platform !== 'win32' &&
      !process.env.TMUX &&
      /\b(sf project deploy|sfdx force:source:deploy|sfdx force:mdapi:deploy|sf apex run test|sfdx force:apex:test:run|sf org create scratch|sfdx force:org:create|npm test\b|jest\b)/.test(cmd)
    ) {
      console.error('[SCC] Long-running Salesforce command detected. Consider running in tmux:');
      console.error('[SCC]   tmux new -s sf-dev  |  tmux attach -t sf-dev');
      console.error('[SCC] This prevents session disconnection from killing deploys or test runs.');
    }
  } catch {
    // ignore parse errors and pass through
  }

  process.stdout.write(raw);
});
