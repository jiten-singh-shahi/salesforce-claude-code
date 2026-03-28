#!/usr/bin/env node
/**
 * Strategic Compact Suggester
 *
 * Tracks tool call count and suggests manual /compact at logical intervals.
 * Runs on PreToolUse to count invocations.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

function getTempDir() {
  return os.tmpdir();
}

function log(msg) {
  process.stderr.write(`${msg}\n`);
}

async function main() {
  const sessionId = (process.env.CLAUDE_SESSION_ID || 'default').replace(/[^a-zA-Z0-9_-]/g, '') || 'default';
  const counterFile = path.join(getTempDir(), `scc-tool-count-${sessionId}`);
  const rawThreshold = parseInt(process.env.COMPACT_THRESHOLD || '50', 10);
  const threshold = Number.isFinite(rawThreshold) && rawThreshold > 0 && rawThreshold <= 10000
    ? rawThreshold
    : 50;

  let count = 1;

  try {
    const fd = fs.openSync(counterFile, 'a+');
    try {
      const buf = Buffer.alloc(64);
      const bytesRead = fs.readSync(fd, buf, 0, 64, 0);
      if (bytesRead > 0) {
        const parsed = parseInt(buf.toString('utf8', 0, bytesRead).trim(), 10);
        count = (Number.isFinite(parsed) && parsed > 0 && parsed <= 1000000)
          ? parsed + 1
          : 1;
      }
      fs.ftruncateSync(fd, 0);
      fs.writeSync(fd, String(count), 0);
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    try { fs.writeFileSync(counterFile, String(count)); } catch { /* ignore */ }
  }

  if (count === threshold) {
    log(`[SCC Compact] ${threshold} tool calls reached — consider /compact if transitioning phases`);
  }

  if (count > threshold && (count - threshold) % 25 === 0) {
    log(`[SCC Compact] ${count} tool calls — good checkpoint for /compact if context is stale`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('[SCC Compact] Error:', err.message);
  process.exit(0);
});
