#!/usr/bin/env node
/**
 * Stop Hook (Session End) - Persist learnings during active sessions
 *
 * Cross-platform (Windows, macOS, Linux)
 *
 * Runs on Stop events (after each response). Extracts a meaningful summary
 * from the session transcript (via stdin JSON transcript_path) and updates a
 * session file for cross-session continuity.
 */

const path = require('path');
const fs = require('fs');

const SUMMARY_START_MARKER = '<!-- SCC:SUMMARY:START -->';
const SUMMARY_END_MARKER = '<!-- SCC:SUMMARY:END -->';
const SESSION_SEPARATOR = '\n---\n';

function getSessionsDir() {
  return path.join(process.env.HOME || process.env.USERPROFILE || '', '.claude', 'sessions');
}

function getDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getTimeString() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function getSessionIdShort() {
  return Math.random().toString(36).slice(2, 10);
}

function getProjectName() {
  try {
    return path.basename(process.cwd());
  } catch {
    return 'unknown';
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function writeFile(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
}

function runCommand(cmd) {
  try {
    const { execSync } = require('child_process');
    const output = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    return { success: true, output };
  } catch {
    return { success: false, output: '' };
  }
}

function log(msg) {
  console.error(msg);
}

/**
 * Extract a meaningful summary from the session transcript.
 */
function extractSessionSummary(transcriptPath) {
  const content = readFile(transcriptPath);
  if (!content) return null;

  const lines = content.split('\n').filter(Boolean);
  const userMessages = [];
  const toolsUsed = new Set();
  const filesModified = new Set();
  let parseErrors = 0;

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);

      if (entry.type === 'user' || entry.role === 'user' || entry.message?.role === 'user') {
        const rawContent = entry.message?.content ?? entry.content;
        const text = typeof rawContent === 'string'
          ? rawContent
          : Array.isArray(rawContent)
            ? rawContent.map(c => (c && c.text) || '').join(' ')
            : '';
        if (text.trim()) {
          userMessages.push(text.trim().slice(0, 200));
        }
      }

      if (entry.type === 'tool_use' || entry.tool_name) {
        const toolName = entry.tool_name || entry.name || '';
        if (toolName) toolsUsed.add(toolName);
        const filePath = entry.tool_input?.file_path || entry.input?.file_path || '';
        if (filePath && (toolName === 'Edit' || toolName === 'Write')) {
          filesModified.add(filePath);
        }
      }

      if (entry.type === 'assistant' && Array.isArray(entry.message?.content)) {
        for (const block of entry.message.content) {
          if (block.type === 'tool_use') {
            const toolName = block.name || '';
            if (toolName) toolsUsed.add(toolName);
            const filePath = block.input?.file_path || '';
            if (filePath && (toolName === 'Edit' || toolName === 'Write')) {
              filesModified.add(filePath);
            }
          }
        }
      }
    } catch {
      parseErrors++;
    }
  }

  if (parseErrors > 0) {
    log(`[SessionEnd] Skipped ${parseErrors}/${lines.length} unparseable transcript lines`);
  }

  if (userMessages.length === 0) return null;

  return {
    userMessages: userMessages.slice(-10),
    toolsUsed: Array.from(toolsUsed).slice(0, 20),
    filesModified: Array.from(filesModified).slice(0, 30),
    totalMessages: userMessages.length
  };
}

// Read hook input from stdin
const MAX_STDIN = 1024 * 1024;
let stdinData = '';
process.stdin.setEncoding('utf8');

process.stdin.on('data', chunk => {
  if (stdinData.length < MAX_STDIN) {
    const remaining = MAX_STDIN - stdinData.length;
    stdinData += chunk.substring(0, remaining);
  }
});

process.stdin.on('end', () => {
  runMain();
});

function runMain() {
  main().catch(err => {
    console.error('[SessionEnd] Error:', err.message);
    process.exit(0);
  });
}

function getSessionMetadata() {
  const branchResult = runCommand('git rev-parse --abbrev-ref HEAD');
  return {
    project: getProjectName() || 'unknown',
    branch: branchResult.success ? branchResult.output : 'unknown',
    worktree: process.cwd()
  };
}

function extractHeaderField(header, label) {
  const match = header.match(new RegExp(`\\*\\*${escapeRegExp(label)}:\\*\\*\\s*(.+)$`, 'm'));
  return match ? match[1].trim() : null;
}

function buildSessionHeader(today, currentTime, metadata, existingContent = '') {
  const headingMatch = existingContent.match(/^#\s+.+$/m);
  const heading = headingMatch ? headingMatch[0] : `# Session: ${today}`;
  const date = extractHeaderField(existingContent, 'Date') || today;
  const started = extractHeaderField(existingContent, 'Started') || currentTime;

  return [
    heading,
    `**Date:** ${date}`,
    `**Started:** ${started}`,
    `**Last Updated:** ${currentTime}`,
    `**Project:** ${metadata.project}`,
    `**Branch:** ${metadata.branch}`,
    `**Worktree:** ${metadata.worktree}`,
    ''
  ].join('\n');
}

function mergeSessionHeader(content, today, currentTime, metadata) {
  const separatorIndex = content.indexOf(SESSION_SEPARATOR);
  if (separatorIndex === -1) return null;
  const existingHeader = content.slice(0, separatorIndex);
  const body = content.slice(separatorIndex + SESSION_SEPARATOR.length);
  const nextHeader = buildSessionHeader(today, currentTime, metadata, existingHeader);
  return `${nextHeader}${SESSION_SEPARATOR}${body}`;
}

async function main() {
  let transcriptPath;
  try {
    const input = JSON.parse(stdinData);
    transcriptPath = input.transcript_path;
  } catch {
    transcriptPath = process.env.CLAUDE_TRANSCRIPT_PATH;
  }

  const sessionsDir = getSessionsDir();
  const today = getDateString();
  const shortId = getSessionIdShort();
  const sessionFile = path.join(sessionsDir, `${today}-${shortId}-session.tmp`);
  const sessionMetadata = getSessionMetadata();

  ensureDir(sessionsDir);

  const currentTime = getTimeString();

  let summary = null;
  if (transcriptPath) {
    if (fs.existsSync(transcriptPath)) {
      summary = extractSessionSummary(transcriptPath);
    } else {
      log(`[SessionEnd] Transcript not found: ${transcriptPath}`);
    }
  }

  if (fs.existsSync(sessionFile)) {
    const existing = readFile(sessionFile);
    let updatedContent = existing;

    if (existing) {
      const merged = mergeSessionHeader(existing, today, currentTime, sessionMetadata);
      if (merged) {
        updatedContent = merged;
      }
    }

    if (summary && updatedContent) {
      const summaryBlock = buildSummaryBlock(summary);
      if (updatedContent.includes(SUMMARY_START_MARKER) && updatedContent.includes(SUMMARY_END_MARKER)) {
        updatedContent = updatedContent.replace(
          new RegExp(`${escapeRegExp(SUMMARY_START_MARKER)}[\\s\\S]*?${escapeRegExp(SUMMARY_END_MARKER)}`),
          summaryBlock
        );
      } else {
        updatedContent = updatedContent.replace(
          /## (?:Session Summary|Current State)[\s\S]*?$/,
          `${summaryBlock}\n\n### Notes for Next Session\n-\n\n### Context to Load\n\`\`\`\n[relevant files]\n\`\`\`\n`
        );
      }
    }

    if (updatedContent) {
      writeFile(sessionFile, updatedContent);
    }

    log(`[SessionEnd] Updated session file: ${sessionFile}`);
  } else {
    const summarySection = summary
      ? `${buildSummaryBlock(summary)}\n\n### Notes for Next Session\n-\n\n### Context to Load\n\`\`\`\n[relevant files]\n\`\`\``
      : `## Current State\n\n[Session context goes here]\n\n### Completed\n- [ ]\n\n### In Progress\n- [ ]\n\n### Notes for Next Session\n-\n\n### Context to Load\n\`\`\`\n[relevant files]\n\`\`\``;

    const template = `${buildSessionHeader(today, currentTime, sessionMetadata)}${SESSION_SEPARATOR}${summarySection}\n`;
    writeFile(sessionFile, template);
    log(`[SessionEnd] Created session file: ${sessionFile}`);
  }

  process.exit(0);
}

function buildSummarySection(summary) {
  let section = '## Session Summary\n\n';

  section += '### Tasks\n';
  for (const msg of summary.userMessages) {
    section += `- ${msg.replace(/\n/g, ' ').replace(/`/g, '\\`')}\n`;
  }
  section += '\n';

  if (summary.filesModified.length > 0) {
    section += '### Files Modified\n';
    for (const f of summary.filesModified) {
      section += `- ${f}\n`;
    }
    section += '\n';
  }

  if (summary.toolsUsed.length > 0) {
    section += `### Tools Used\n${summary.toolsUsed.join(', ')}\n\n`;
  }

  section += `### Stats\n- Total user messages: ${summary.totalMessages}\n`;
  return section;
}

function buildSummaryBlock(summary) {
  return `${SUMMARY_START_MARKER}\n${buildSummarySection(summary).trim()}\n${SUMMARY_END_MARKER}`;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
