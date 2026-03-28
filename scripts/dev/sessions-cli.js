#!/usr/bin/env node
'use strict';

/**
 * sessions-cli.js — List and inspect Claude Code sessions.
 *
 * Reads session data from:
 *   1. ~/.claude/sessions/ (Claude Code session store)
 *   2. SCC state store (install session history)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { loadState } = require('../lib/state-store');

function showHelp(exitCode = 0) {
  console.log(`
scc sessions — List or inspect Claude Code sessions

Usage:
  scc sessions [options]

Options:
  --json         Output as JSON
  --limit <n>    Show only the N most recent sessions (default: 20)
  --scc-only     Show only SCC install sessions (skip Claude Code sessions)
  --claude-only  Show only Claude Code sessions (skip SCC sessions)
  --help, -h     Show this help
`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = { json: false, limit: 20, sccOnly: false, claudeOnly: false, help: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg === '--json') opts.json = true;
    else if (arg === '--scc-only') opts.sccOnly = true;
    else if (arg === '--claude-only') opts.claudeOnly = true;
    else if (arg === '--limit' && args[i + 1]) opts.limit = parseInt(args[++i], 10) || 20;
  }
  return opts;
}

/**
 * Read Claude Code sessions from ~/.claude/sessions/
 */
function readClaudeCodeSessions(limit) {
  const sessionsDir = path.join(os.homedir(), '.claude', 'sessions');
  const sessions = [];

  if (!fs.existsSync(sessionsDir)) {
    return { sessions: [], available: false, path: sessionsDir };
  }

  let entries;
  try {
    entries = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.json'));
  } catch {
    return { sessions: [], available: false, path: sessionsDir };
  }

  // Sort by mtime descending
  const withMtime = entries.map(name => {
    try {
      const fpath = path.join(sessionsDir, name);
      const stat = fs.statSync(fpath);
      return { name, mtime: stat.mtimeMs, path: fpath };
    } catch {
      return null;
    }
  }).filter(Boolean);

  withMtime.sort((a, b) => b.mtime - a.mtime);

  for (const entry of withMtime.slice(0, limit)) {
    try {
      const raw = fs.readFileSync(entry.path, 'utf8');
      const data = JSON.parse(raw);
      sessions.push({
        id: path.basename(entry.name, '.json'),
        path: entry.path,
        modifiedAt: new Date(entry.mtime).toISOString(),
        messageCount: Array.isArray(data.messages) ? data.messages.length : null,
        model: data.model || null,
        project: data.project || null,
        summary: data.summary || (Array.isArray(data.messages) && data.messages.length > 0
          ? String(data.messages[0].content || '').slice(0, 100)
          : null),
      });
    } catch {
      sessions.push({
        id: path.basename(entry.name, '.json'),
        path: entry.path,
        modifiedAt: new Date(entry.mtime).toISOString(),
        parseError: true,
      });
    }
  }

  return { sessions, available: true, path: sessionsDir, total: withMtime.length };
}

/**
 * Read SCC install sessions from state store.
 */
function readSccSessions() {
  try {
    const state = loadState();
    return {
      sessions: (state.sessions || []).map(s => ({
        profile: s.profile,
        target: s.target,
        fileCount: s.fileCount,
        installedAt: s.installedAt,
      })),
      available: true,
    };
  } catch {
    return { sessions: [], available: false };
  }
}

const opts = parseArgs(process.argv);
if (opts.help) showHelp(0);

const claudeCodeData = opts.sccOnly ? { sessions: [], available: false } : readClaudeCodeSessions(opts.limit);
const sccData = opts.claudeOnly ? { sessions: [], available: false } : readSccSessions();

if (opts.json) {
  const output = {
    claudeCode: {
      available: claudeCodeData.available,
      path: claudeCodeData.path,
      total: claudeCodeData.total || 0,
      sessions: claudeCodeData.sessions,
    },
    sccInstalls: {
      available: sccData.available,
      sessions: sccData.sessions,
    },
  };
  console.log(JSON.stringify(output, null, 2));
  process.exit(0);
}

// Human-readable output
console.log(`\nSCC Sessions`);
console.log(`${'─'.repeat(50)}`);

if (!opts.sccOnly) {
  console.log(`\nClaude Code Sessions`);
  if (!claudeCodeData.available) {
    console.log(`  (not available — ${claudeCodeData.path} not found)`);
  } else if (claudeCodeData.sessions.length === 0) {
    console.log('  No sessions found.');
  } else {
    console.log(`  Path: ${claudeCodeData.path}`);
    if (claudeCodeData.total > opts.limit) {
      console.log(`  Showing ${opts.limit} of ${claudeCodeData.total} sessions (use --limit to see more)`);
    }
    console.log();
    for (const s of claudeCodeData.sessions) {
      const date = s.modifiedAt ? s.modifiedAt.slice(0, 19).replace('T', ' ') : 'unknown';
      const msgs = s.messageCount != null ? `${s.messageCount} msg(s)` : '';
      const model = s.model ? ` [${s.model}]` : '';
      console.log(`  ${date}  ${s.id}${model}  ${msgs}`);
      if (s.summary) console.log(`              ${s.summary.slice(0, 80)}${s.summary.length > 80 ? '…' : ''}`);
    }
  }
}

if (!opts.claudeOnly) {
  console.log(`\nSCC Install Sessions`);
  if (!sccData.available || sccData.sessions.length === 0) {
    console.log('  No SCC install sessions found.');
  } else {
    for (const s of sccData.sessions.slice(0, opts.limit)) {
      const date = s.installedAt ? s.installedAt.slice(0, 19).replace('T', ' ') : 'unknown';
      console.log(`  ${date}  profile=${s.profile || 'unknown'}  target=${s.target || 'unknown'}  files=${s.fileCount || 0}`);
    }
  }
}

console.log();
