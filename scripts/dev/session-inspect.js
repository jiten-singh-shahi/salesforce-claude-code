#!/usr/bin/env node
'use strict';

/**
 * Session Inspector — Inspect session files and Claude sessions.
 *
 * Simplified version for SCC. Inspects session files from ~/.claude/sessions/
 * and provides session history analysis.
 *
 * Usage:
 *   node scripts/dev/session-inspect.js <target> [--write <output.json>]
 *   node scripts/dev/session-inspect.js claude:latest
 *   node scripts/dev/session-inspect.js <session.tmp>
 */

const fs = require('fs');
const path = require('path');

function usage() {
  console.log([
    'Usage:',
    '  node scripts/dev/session-inspect.js <target> [--write <output.json>]',
    '',
    'Targets:',
    '  claude:latest        Most recent Claude session history entry',
    '  claude:<id>          Specific Claude session by ID prefix',
    '  <session.tmp>        Direct path to a session file',
    '  list                 List all available session files',
    '',
    'Examples:',
    '  node scripts/dev/session-inspect.js claude:latest',
    '  node scripts/dev/session-inspect.js list',
    '  node scripts/dev/session-inspect.js ~/.claude/sessions/2026-03-18-abc12345-session.tmp',
    '  node scripts/dev/session-inspect.js claude:latest --write /tmp/session.json',
  ].join('\n'));
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const target = args.find(a => !a.startsWith('--'));

  const writeIndex = args.indexOf('--write');
  const writePath = writeIndex >= 0 ? args[writeIndex + 1] : null;

  return { target, writePath };
}

function getSessionsDir() {
  return path.join(process.env.HOME || process.env.USERPROFILE || '/tmp', '.claude', 'sessions');
}

function listSessionFiles() {
  const dir = getSessionsDir();
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter(f => f.endsWith('-session.tmp'))
    .sort()
    .reverse();
}

function parseSessionFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const result = {
    file: filePath,
    filename: path.basename(filePath),
  };

  // Extract header fields
  const dateMatch = content.match(/\*\*Date:\*\*\s*(.+)$/m);
  const startedMatch = content.match(/\*\*Started:\*\*\s*(.+)$/m);
  const lastUpdatedMatch = content.match(/\*\*Last Updated:\*\*\s*(.+)$/m);
  const projectMatch = content.match(/\*\*Project:\*\*\s*(.+)$/m);
  const branchMatch = content.match(/\*\*Branch:\*\*\s*(.+)$/m);

  result.date = dateMatch ? dateMatch[1].trim() : null;
  result.started = startedMatch ? startedMatch[1].trim() : null;
  result.lastUpdated = lastUpdatedMatch ? lastUpdatedMatch[1].trim() : null;
  result.project = projectMatch ? projectMatch[1].trim() : null;
  result.branch = branchMatch ? branchMatch[1].trim() : null;

  // Extract tasks from summary section
  const tasksMatch = content.match(/### Tasks\n([\s\S]*?)(?=\n###|\n---|\n$)/);
  if (tasksMatch) {
    result.tasks = tasksMatch[1]
      .split('\n')
      .filter(l => l.startsWith('- '))
      .map(l => l.slice(2).trim());
  }

  // Extract files modified
  const filesMatch = content.match(/### Files Modified\n([\s\S]*?)(?=\n###|\n---|\n$)/);
  if (filesMatch) {
    result.filesModified = filesMatch[1]
      .split('\n')
      .filter(l => l.startsWith('- '))
      .map(l => l.slice(2).trim());
  }

  // Extract tools used
  const toolsMatch = content.match(/### Tools Used\n(.+)/);
  if (toolsMatch) {
    result.toolsUsed = toolsMatch[1].split(',').map(t => t.trim()).filter(Boolean);
  }

  // Extract compaction events
  const compactions = content.match(/\*\*\[Compaction at .+?\]\*\*/g);
  result.compactionCount = compactions ? compactions.length : 0;

  return result;
}

function inspectClaudeSession(target) {
  const sessions = listSessionFiles();
  if (sessions.length === 0) {
    throw new Error('No session files found in ' + getSessionsDir());
  }

  if (target === 'claude:latest') {
    const latestFile = path.join(getSessionsDir(), sessions[0]);
    return parseSessionFile(latestFile);
  }

  // Match by ID prefix
  const idPrefix = target.replace('claude:', '');
  const match = sessions.find(s => s.includes(idPrefix));
  if (!match) {
    throw new Error(`No session matching "${idPrefix}" found`);
  }
  return parseSessionFile(path.join(getSessionsDir(), match));
}

function inspectFileTarget(target) {
  const resolved = path.resolve(target);
  if (!fs.existsSync(resolved)) {
    throw new Error('File not found: ' + resolved);
  }
  return parseSessionFile(resolved);
}

function listSessions() {
  const sessions = listSessionFiles();
  if (sessions.length === 0) {
    return { sessions: [], message: 'No session files found' };
  }

  const summaries = sessions.map(filename => {
    try {
      const parsed = parseSessionFile(path.join(getSessionsDir(), filename));
      return {
        filename,
        date: parsed.date,
        project: parsed.project,
        branch: parsed.branch,
        taskCount: parsed.tasks ? parsed.tasks.length : 0,
        compactionCount: parsed.compactionCount,
      };
    } catch {
      return { filename, error: 'unparseable' };
    }
  });

  return { sessions: summaries, total: sessions.length };
}

function main() {
  const { target, writePath } = parseArgs(process.argv);

  if (!target) {
    usage();
    process.exit(1);
  }

  let payloadObject;

  if (target === 'list') {
    payloadObject = listSessions();
  } else if (target.startsWith('claude:')) {
    payloadObject = inspectClaudeSession(target);
  } else {
    payloadObject = inspectFileTarget(target);
  }

  const payload = JSON.stringify(payloadObject, null, 2);

  if (writePath) {
    const absoluteWritePath = path.resolve(writePath);
    fs.mkdirSync(path.dirname(absoluteWritePath), { recursive: true });
    fs.writeFileSync(absoluteWritePath, payload + '\n', 'utf8');
  }

  console.log(payload);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`[session-inspect] ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  main,
  parseArgs,
  parseSessionFile,
  listSessionFiles,
};
