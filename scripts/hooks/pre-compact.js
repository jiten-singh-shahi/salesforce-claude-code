#!/usr/bin/env node
/**
 * PreCompact Hook — Save state before context compaction.
 *
 * Logs compaction events and annotates active session files
 * so post-compaction context has a record of what happened.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { ensureDir } = require('../lib/utils');

function getClaudeDir() {
  return path.join(process.env.HOME || process.env.USERPROFILE || '/tmp', '.claude');
}

function getDateTimeString() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

async function main() {
  const sessionsDir = path.join(getClaudeDir(), 'sessions');
  const compactionLog = path.join(sessionsDir, 'compaction-log.txt');

  ensureDir(sessionsDir);

  const timestamp = getDateTimeString();
  fs.appendFileSync(compactionLog, `[${timestamp}] Context compaction triggered\n`);

  // Annotate active session files
  try {
    const entries = fs.readdirSync(sessionsDir);
    const sessionFiles = entries.filter(f => f.endsWith('-session.tmp'));
    if (sessionFiles.length > 0) {
      const activeSession = path.join(sessionsDir, sessionFiles[0]);
      fs.appendFileSync(activeSession, `\n---\n**[Compaction at ${timestamp}]** — Context was summarized\n`);
    }
  } catch {
    // Ignore errors
  }

  process.stderr.write('[SCC PreCompact] State saved before compaction\n');
  process.exit(0);
}

main().catch(err => {
  console.error('[SCC PreCompact] Error:', err.message);
  process.exit(0);
});
