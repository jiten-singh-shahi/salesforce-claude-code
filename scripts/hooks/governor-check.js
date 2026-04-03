#!/usr/bin/env node
/**
 * Governor Limit Check Hook
 *
 * Salesforce-specific PostToolUse hook that checks edited Apex files
 * for common governor limit violations using shared apex-analysis module.
 *
 * Uses apex-analysis.js for:
 * - Comment/string stripping (eliminates false positives)
 * - Loop depth tracking (activeLoopDepths stack + globalBraceDepth)
 * - Test class detection (skips test classes entirely)
 *
 * Detections:
 * - SOQL queries inside loops (CRITICAL)
 * - SOSL queries inside loops (CRITICAL)
 * - DML operations inside loops (CRITICAL)
 * - HTTP callouts inside loops (CRITICAL)
 * - Async operations inside loops (HIGH)
 * - Non-bulkified trigger patterns (HIGH)
 * - Schema describe in loops (MEDIUM)
 * - Deeply nested loops — 3+ levels (MEDIUM)
 * - Unbounded SOQL on large objects (LOW)
 */

'use strict';

const fs = require('fs');
const path = require('path');

const { preprocessApex, isTestClass, trackLoopDepth } = require('../lib/apex-analysis');

const MAX_STDIN = 1024 * 1024;

function log(msg) {
  process.stderr.write(`${msg}\n`);
}

/**
 * Analyze Apex code for governor limit violations.
 */
function checkGovernorLimits(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return;

  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.cls' && ext !== '.trigger') return;

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return;
  }

  // Skip test classes entirely — they don't run in production
  if (isTestClass(content)) return;

  // Preprocess: strip comments and string literals
  const processed = preprocessApex(content);
  const processedLines = processed.split('\n');
  const rawLines = content.split('\n');
  const depths = trackLoopDepth(processedLines);

  const violations = [];
  let deepNestWarned = false;

  for (let i = 0; i < processedLines.length; i++) {
    const line = processedLines[i];
    const depth = depths[i];

    // SOQL in loop
    if (depth > 0 && /\[\s*SELECT\s/i.test(line)) {
      violations.push({
        line: i + 1,
        severity: 'CRITICAL',
        message: 'SOQL query inside loop — will hit 100 SOQL query limit',
        fix: 'Move query before the loop and use a Map/Set for lookups',
      });
    }

    // SOSL in loop
    if (depth > 0 && /\[FIND\s/i.test(line)) {
      violations.push({
        line: i + 1,
        severity: 'CRITICAL',
        message: 'SOSL query inside loop — will hit 20 SOSL query limit',
        fix: 'Move SOSL search before the loop',
      });
    }

    // DML in loop
    if (depth > 0) {
      const dmlPattern = /\b(insert|update|delete|upsert|undelete|merge)\s+(?!into\b)/i;
      const dbPattern = /Database\.(insert|update|delete|upsert|undelete|merge)/i;
      if (dmlPattern.test(line) || dbPattern.test(line)) {
        violations.push({
          line: i + 1,
          severity: 'CRITICAL',
          message: 'DML operation inside loop — will hit 150 DML statement limit',
          fix: 'Collect records in a List and perform DML after the loop',
        });
      }
    }

    // Callout in loop
    if (depth > 0 && /Http[a-zA-Z]*\.(send|getContent)|HttpRequest/i.test(line)) {
      violations.push({
        line: i + 1,
        severity: 'CRITICAL',
        message: 'HTTP callout inside loop — will hit 100 callout limit',
        fix: 'Batch callouts or use Queueable/Future for async processing',
      });
    }

    // Async operations in loop
    if (depth > 0 && /System\.enqueueJob\s*\(/i.test(line)) {
      violations.push({
        line: i + 1,
        severity: 'HIGH',
        message: 'System.enqueueJob() inside loop — will hit 50 Queueable job limit',
        fix: 'Collect work items and enqueue a single Queueable after the loop',
      });
    }
    if (depth > 0 && /EventBus\.publish\s*\(/i.test(line)) {
      violations.push({
        line: i + 1,
        severity: 'HIGH',
        message: 'EventBus.publish() inside loop — publish events in bulk after the loop',
        fix: 'Collect events in a List and call EventBus.publish() once',
      });
    }
    if (depth > 0 && /Messaging\.sendEmail\s*\(/i.test(line)) {
      violations.push({
        line: i + 1,
        severity: 'HIGH',
        message: 'Messaging.sendEmail() inside loop — will hit 10 email invocation limit',
        fix: 'Collect emails in a List and call sendEmail() once after the loop',
      });
    }

    // Non-bulkified trigger (single record processing)
    if (ext === '.trigger' && /Trigger\.(new|old)\[0\]/.test(line)) {
      violations.push({
        line: i + 1,
        severity: 'HIGH',
        message: 'Non-bulkified trigger — accessing Trigger.new[0] directly',
        fix: 'Iterate over Trigger.new/old to handle bulk operations',
      });
    }

    // Schema describe in loop
    if (depth > 0 && /Schema\.\w+\.getDescribe\(\)/.test(line)) {
      violations.push({
        line: i + 1,
        severity: 'MEDIUM',
        message: 'Schema describe call inside loop — can hit describe limit',
        fix: 'Cache describe results in a variable outside the loop',
      });
    }

    // Deeply nested loops (3+ levels)
    if (depth >= 3 && !deepNestWarned) {
      deepNestWarned = true;
      violations.push({
        line: i + 1,
        severity: 'MEDIUM',
        message: `Loop nesting depth ${depth} — high CPU time risk`,
        fix: 'Refactor to reduce nesting or use Maps for lookups',
      });
    }

    // Unbounded SOQL on large standard objects
    if (/\[\s*SELECT\s/i.test(line) && !/LIMIT\s+\d/i.test(line) && !/COUNT\s*\(/i.test(line)) {
      if (/FROM\s+(Account|Contact|Lead|Opportunity|Task|Event|Case|CampaignMember)\b/i.test(line) &&
          !/WHERE\s/i.test(line)) {
        violations.push({
          line: i + 1,
          severity: 'LOW',
          message: 'SOQL query on large object without LIMIT or WHERE clause',
          fix: 'Add LIMIT clause or WHERE filter to bound result set',
        });
      }
    }
  }

  if (violations.length > 0) {
    log(`\n[SCC Governor] ${path.basename(filePath)} — ${violations.length} potential violation(s):`);
    for (const v of violations) {
      log(`  [${v.severity}] Line ${v.line}: ${v.message}`);
      log(`    Fix: ${v.fix}`);
    }
    log('');
  }
}

function run(rawInput) {
  try {
    const input = JSON.parse(rawInput);
    const { normalizeInput } = require('../lib/hook-input');
    const ctx = normalizeInput(input);
    checkGovernorLimits(ctx.filePath);
  } catch {
    // Ignore errors
  }
  return rawInput;
}

if (require.main === module) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => {
    if (raw.length < MAX_STDIN) {
      raw += chunk.substring(0, MAX_STDIN - raw.length);
    }
  });
  process.stdin.on('end', () => {
    const result = run(raw);
    process.stdout.write(result);
  });
}

module.exports = { run };
