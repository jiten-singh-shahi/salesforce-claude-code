#!/usr/bin/env node
'use strict';

/**
 * apex-analysis.js — Shared Apex static analysis utilities
 *
 * Provides preprocessing (comment/string stripping), loop depth tracking,
 * and test class detection for use by governor-check.js and quality-gate.js.
 *
 * Architecture:
 * - trackLoopDepth uses an activeLoopDepths stack + globalBraceDepth counter
 *   to correctly handle if/try/catch blocks inside loops (their closing braces
 *   don't prematurely end the enclosing loop).
 * - Linear 6-step pipeline per line — no continue statements that could skip
 *   brace tracking and desync globalBraceDepth.
 *
 * Known limitations:
 * - do { } while(cond) — the 'do' keyword isn't followed by '(', so the loop
 *   regex doesn't match it. Brace tracking still manages depth correctly, but
 *   'do' itself isn't recognized as a loop start.
 * - Class-level static initializer blocks may affect globalBraceDepth.
 * - Anonymous inner classes with { } may affect brace counting.
 */

/**
 * Strip comments and string literals from Apex code.
 * Replaces removed content with whitespace to preserve line alignment.
 *
 * @param {string} code - Raw Apex source code
 * @returns {string} Code with comments and strings replaced by spaces
 */
function preprocessApex(code) {
  let result = code;
  // Remove block comments (preserve newlines for line alignment)
  result = result.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
  // Remove single-line comments
  result = result.replace(/\/\/.*$/gm, m => ' '.repeat(m.length));
  // Remove string literals (handle escaped quotes)
  result = result.replace(/'(?:[^'\\]|\\.)*'/g, m => ' '.repeat(m.length));
  result = result.replace(/"(?:[^"\\]|\\.)*"/g, m => ' '.repeat(m.length));
  return result;
}

/**
 * Detect whether an Apex source file is a test class.
 * Test classes don't run in production, so governor limit scanning
 * on them creates noise.
 *
 * @param {string} code - Raw or preprocessed Apex source code
 * @returns {boolean} True if the class has @IsTest annotation at class level
 */
function isTestClass(code) {
  // Match @IsTest before the class keyword (class-level annotation)
  const beforeFirstBrace = code.split('{')[0] || '';
  return /@[Ii]s[Tt]est\b/.test(beforeFirstBrace);
}

/**
 * Track loop depth for each line of preprocessed Apex code.
 *
 * Returns an array of integers where depths[i] is the loop nesting depth
 * at line i. depths[i] > 0 means line i is inside a loop.
 *
 * Uses an activeLoopDepths stack bound to globalBraceDepth to correctly
 * handle if/try/catch blocks inside loops. Uses unbracedStack counter
 * for nested unbraced loops. Uses waitingForBody state for Allman brace style.
 *
 * CRITICAL: Linear 6-step pipeline — every non-empty line flows through all
 * steps. No continue statements that could skip brace tracking.
 *
 * @param {string[]} processedLines - Lines from preprocessApex(code).split('\n')
 * @returns {number[]} Array of loop depth per line
 */
function trackLoopDepth(processedLines) {
  const depths = [];
  let globalBraceDepth = 0;   // total brace depth in file
  const activeLoopDepths = [];   // stack: globalBraceDepth where each braced loop started
  let unbracedStack = 0;       // counter for nested unbraced loops
  let parenDepth = 0;          // for multi-line for/while declarations
  let pendingLoop = false;     // SCANNING_DECLARATION state
  let waitingForBody = false;  // WAITING_FOR_BODY state

  for (let i = 0; i < processedLines.length; i++) {
    const line = processedLines[i];
    const trimmed = line.trim();
    let singleLineLoopBonus = 0;
    let skipLoopDetection = false;

    // Empty lines: no braces, safe to skip
    if (!trimmed) {
      depths.push(activeLoopDepths.length + unbracedStack);
      continue;
    }

    // ═══════════ STEP 1: Resolve pending multi-line declarations ═══════════
    if (pendingLoop) {
      let closingIdx = -1;
      for (let j = 0; j < trimmed.length; j++) {
        if (trimmed[j] === '(') parenDepth++;
        if (trimmed[j] === ')') {
          parenDepth--;
          if (parenDepth === 0) { closingIdx = j; break; }
        }
      }
      if (closingIdx === -1) {
        // Still reading declaration — inside parens, no block braces matter
        depths.push(activeLoopDepths.length + unbracedStack);
        continue; // safe: inside parens
      }
      pendingLoop = false;
      const afterClose = trimmed.substring(closingIdx + 1).trim();
      if (afterClose.startsWith('{') || afterClose.includes('{')) {
        activeLoopDepths.push(globalBraceDepth);
      } else if (/\S/.test(afterClose) && /;\s*$/.test(afterClose)) {
        singleLineLoopBonus = 1;
      } else if (/\S/.test(afterClose)) {
        unbracedStack++;
      } else {
        waitingForBody = true;
      }
      skipLoopDetection = true;
    }

    // ═══════════ STEP 2: Resolve WAITING_FOR_BODY ═══════════
    if (waitingForBody) {
      waitingForBody = false;
      if (trimmed.startsWith('{')) {
        // Allman braced loop
        activeLoopDepths.push(globalBraceDepth);
      } else {
        // Unbraced loop — this line IS the body (or start of it)
        unbracedStack++;
      }
    }

    // ═══════════ STEP 3: Detect new loop starts ═══════════
    const loopMatch = !skipLoopDetection && trimmed.match(/\b(for|while|do)\s*\(/);
    if (loopMatch) {
      // Token-aware paren scan from match point (NOT lastIndexOf)
      let localParenDepth = 0;
      let closingIdx = -1;
      for (let j = loopMatch.index; j < trimmed.length; j++) {
        if (trimmed[j] === '(') localParenDepth++;
        if (trimmed[j] === ')') {
          localParenDepth--;
          if (localParenDepth === 0) { closingIdx = j; break; }
        }
      }

      if (closingIdx === -1) {
        // Multi-line declaration — parens still open
        parenDepth = localParenDepth;
        pendingLoop = true;
      } else {
        // CRITICAL: use closingIdx from paren scan, NOT lastIndexOf(')')
        const afterClose = trimmed.substring(closingIdx + 1).trim();
        if (afterClose.startsWith('{') || afterClose.includes('{')) {
          activeLoopDepths.push(globalBraceDepth);
        } else if (/\S/.test(afterClose) && /;\s*$/.test(afterClose)) {
          singleLineLoopBonus = 1;
        } else if (/\S/.test(afterClose)) {
          unbracedStack++;
        } else {
          waitingForBody = true;
        }
      }
    }

    // ═══════════ STEP 4: Record current line depth ═══════════
    // Single-line loop bonus adds +1 for the current line only
    depths.push(activeLoopDepths.length + unbracedStack + singleLineLoopBonus);

    // ═══════════ STEP 5: Update globalBraceDepth + reconcile ═══════════
    const opens = (trimmed.match(/\{/g) || []).length;
    const closes = (trimmed.match(/\}/g) || []).length;
    globalBraceDepth += (opens - closes);

    // If brace depth dropped to/below where a loop started, that loop closed
    while (
      activeLoopDepths.length > 0 &&
      globalBraceDepth <= activeLoopDepths[activeLoopDepths.length - 1]
    ) {
      activeLoopDepths.pop();
    }

    // ═══════════ STEP 6: Drain unbraced stack (LAST — after braces counted) ═══════════
    if (unbracedStack > 0 && /;\s*$/.test(trimmed) && singleLineLoopBonus === 0) {
      unbracedStack = 0;
    }
  }
  return depths;
}

module.exports = { preprocessApex, isTestClass, trackLoopDepth };
