#!/usr/bin/env node
'use strict';

/**
 * apex-analysis.test.js — Unit tests for scripts/lib/apex-analysis.js
 *
 * Uses Node.js built-in assert module (no external test frameworks).
 * Tests all 8 edge cases from the battle-tested plan plus preprocessing.
 */

const assert = require('assert');

const { preprocessApex, isTestClass, trackLoopDepth } = require('../../scripts/lib/apex-analysis');

// ── Test harness ──────────────────────────────────────────────────────────────

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  FAIL  ${name}`);
    console.error(`        ${err.message}`);
    failCount++;
  }
}

function depthsFor(code) {
  const processed = preprocessApex(code);
  return trackLoopDepth(processed.split('\n'));
}

// ── preprocessApex tests ──────────────────────────────────────────────────────

test('preprocessApex: strips single-line comments', () => {
  const code = 'Integer x = 1; // this is a comment\nInteger y = 2;';
  const result = preprocessApex(code);
  assert.ok(!result.includes('this is a comment'));
  assert.ok(result.includes('Integer x = 1;'));
  assert.ok(result.includes('Integer y = 2;'));
  // Line count preserved
  assert.strictEqual(result.split('\n').length, code.split('\n').length);
});

test('preprocessApex: strips block comments', () => {
  const code = 'Integer x = 1;\n/* multi\nline\ncomment */\nInteger y = 2;';
  const result = preprocessApex(code);
  assert.ok(!result.includes('multi'));
  assert.ok(!result.includes('comment'));
  assert.ok(result.includes('Integer y = 2;'));
  // Line count preserved
  assert.strictEqual(result.split('\n').length, code.split('\n').length);
});

test('preprocessApex: strips single-quoted string literals', () => {
  const code = "String s = 'SELECT Id FROM Account';";
  const result = preprocessApex(code);
  assert.ok(!result.includes('SELECT'));
  assert.ok(result.includes('String s ='));
});

test('preprocessApex: strips double-quoted string literals', () => {
  const code = 'String s = "SELECT Id FROM Account";';
  const result = preprocessApex(code);
  assert.ok(!result.includes('SELECT'));
});

test('preprocessApex: handles escaped quotes in strings', () => {
  const code = "String s = 'it\\'s a test';";
  const result = preprocessApex(code);
  assert.ok(!result.includes('test'));
});

test('preprocessApex: preserves line alignment (same length per line)', () => {
  const code = "Integer x = 1; // comment here\nString s = 'hello world';";
  const result = preprocessApex(code);
  const origLines = code.split('\n');
  const resultLines = result.split('\n');
  assert.strictEqual(origLines.length, resultLines.length);
  for (let i = 0; i < origLines.length; i++) {
    assert.strictEqual(origLines[i].length, resultLines[i].length,
      `Line ${i} length mismatch: "${origLines[i]}" vs "${resultLines[i]}"`);
  }
});

// ── isTestClass tests ─────────────────────────────────────────────────────────

test('isTestClass: detects @IsTest annotation', () => {
  const code = '@IsTest\npublic class MyTest {\n  // tests\n}';
  assert.strictEqual(isTestClass(code), true);
});

test('isTestClass: detects @isTest (lowercase)', () => {
  const code = '@isTest\nprivate class MyTest {\n}';
  assert.strictEqual(isTestClass(code), true);
});

test('isTestClass: returns false for non-test class', () => {
  const code = 'public with sharing class MyService {\n  public void doWork() {}\n}';
  assert.strictEqual(isTestClass(code), false);
});

test('isTestClass: returns false when @IsTest is inside method (not class-level)', () => {
  const code = 'public class MyService {\n  @IsTest\n  static void testSomething() {}\n}';
  // @IsTest appears after the first { so it's method-level, not class-level
  assert.strictEqual(isTestClass(code), false);
});

// ── trackLoopDepth: Edge Case 1 — K&R braced ─────────────────────────────────

test('trackLoopDepth: Case 1 — K&R braced for loop', () => {
  const depths = depthsFor([
    'for (Account a : accounts) {',
    '  insert a;',
    '}',
  ].join('\n'));
  assert.deepStrictEqual(depths, [1, 1, 1]);
});

test('trackLoopDepth: Case 1 — while loop', () => {
  const depths = depthsFor([
    'while (hasNext) {',
    '  process();',
    '}',
  ].join('\n'));
  assert.deepStrictEqual(depths, [1, 1, 1]);
});

// ── trackLoopDepth: Edge Case 2 — Allman braced ──────────────────────────────

test('trackLoopDepth: Case 2 — Allman brace style', () => {
  const depths = depthsFor([
    'for (Account a : accounts)',
    '{',
    '  insert a;',
    '}',
  ].join('\n'));
  assert.deepStrictEqual(depths, [0, 1, 1, 1]);
});

// ── trackLoopDepth: Edge Case 3 — Unbraced multi-line ────────────────────────

test('trackLoopDepth: Case 3 — unbraced multi-line loop', () => {
  const depths = depthsFor([
    'for (Account a : accounts)',
    '  a.Name = \'Fixed\';',
    'foo();',
  ].join('\n'));
  assert.deepStrictEqual(depths, [0, 1, 0]);
});

// ── trackLoopDepth: Edge Case 4 — Multi-line declaration ─────────────────────

test('trackLoopDepth: Case 4 — multi-line for declaration', () => {
  const depths = depthsFor([
    'for (',
    '  Account a : accounts',
    ') {',
    '  insert a;',
    '}',
  ].join('\n'));
  assert.deepStrictEqual(depths, [0, 0, 1, 1, 1]);
});

test('trackLoopDepth: Case 4b — multi-line for with SOQL', () => {
  const depths = depthsFor([
    'for (Account a : [SELECT Id FROM Account',
    '    WHERE Name LIKE \'%Test%\']) {',
    '  insert a;',
    '}',
  ].join('\n'));
  // Line 1: pendingLoop (paren not closed)
  // Line 2: paren closes, afterClose contains '{', braced loop starts
  assert.deepStrictEqual(depths, [0, 1, 1, 1]);
});

// ── trackLoopDepth: Edge Case 5 — Method call parens in body ─────────────────

test('trackLoopDepth: Case 5 — method call parens dont confuse paren tracking', () => {
  const depths = depthsFor([
    'for (Account a : accounts) { System.debug(a); }',
  ].join('\n'));
  // Single line: for's ) is found by paren scan. afterClose starts with {. Braced.
  // Braces balance (1 open, 1 close). Loop opens and closes on same line.
  assert.deepStrictEqual(depths, [1]);
});

test('trackLoopDepth: Case 5b — method call with braces after preprocessing', () => {
  // After preprocessApex, string contents are replaced with spaces
  // but method parens remain. Paren scan must find for's closing ) correctly.
  const code = 'for (Account a : accounts) { doStuff(a.Name); }';
  const depths = depthsFor(code);
  assert.deepStrictEqual(depths, [1]);
});

// ── trackLoopDepth: Edge Case 6 — if-block inside loop ───────────────────────

test('trackLoopDepth: Case 6 — if block closing brace does NOT exit loop', () => {
  const depths = depthsFor([
    'for (Account a : accs) {',
    '  if (a.Name == null) {',
    '    System.debug(a);',
    '  }',
    '  insert a;',       // MUST be at depth 1 (still inside for loop)
    '}',
  ].join('\n'));
  assert.deepStrictEqual(depths, [1, 1, 1, 1, 1, 1]);
});

test('trackLoopDepth: Case 6b — try-catch inside loop', () => {
  const depths = depthsFor([
    'for (Account a : accs) {',
    '  try {',
    '    insert a;',
    '  } catch (Exception e) {',
    '    System.debug(e);',
    '  }',
    '  doMore();',       // MUST be at depth 1
    '}',
  ].join('\n'));
  assert.deepStrictEqual(depths, [1, 1, 1, 1, 1, 1, 1, 1]);
});

test('trackLoopDepth: Case 6c — nested if-else inside loop', () => {
  const depths = depthsFor([
    'for (Account a : accs) {',
    '  if (a.Name == null) {',
    '    a.Name = \'Default\';',
    '  } else {',
    '    a.Name = a.Name.toUpperCase();',
    '  }',
    '  update a;',       // depth 1
    '}',
  ].join('\n'));
  assert.deepStrictEqual(depths, [1, 1, 1, 1, 1, 1, 1, 1]);
});

// ── trackLoopDepth: Edge Case 7 — Nested unbraced loops ──────────────────────

test('trackLoopDepth: Case 7 — nested unbraced loops', () => {
  const depths = depthsFor([
    'for (Account a : accs)',
    '  for (Contact c : a.Contacts)',
    '    c.Name = \'Test\';',
    'foo();',
  ].join('\n'));
  assert.deepStrictEqual(depths, [0, 1, 2, 0]);
});

// ── trackLoopDepth: Edge Case 8 — Brace in unbraced body ─────────────────────

test('trackLoopDepth: Case 8 — Map literal brace in unbraced loop body', () => {
  const depths = depthsFor([
    'for (Account a : accs)',
    '  doSomething(new Map<Id, Account>{',
    '    id1 => a',
    '  });',
  ].join('\n'));
  // Line 1: waitingForBody. depth 0.
  // Line 2: unbraced body (unbracedStack=1). depth 1. gBD goes to 1 (one {). No ; yet.
  // Line 3: depth 1. gBD stays 1.
  // Line 4: depth 1. }); has one }. gBD goes to 0. Then drain unbracedStack.
  assert.deepStrictEqual(depths, [0, 1, 1, 1]);
});

// ── trackLoopDepth: Mixed scenarios ──────────────────────────────────────────

test('trackLoopDepth: braced outer loop with unbraced inner loop', () => {
  const depths = depthsFor([
    'for (Account a : accs) {',
    '  for (Contact c : a.Contacts)',
    '    c.Name = \'Test\';',
    '  doMore();',       // depth 1 (inside outer, outside inner)
    '}',
  ].join('\n'));
  assert.deepStrictEqual(depths, [1, 1, 2, 1, 1]);
});

test('trackLoopDepth: nested braced loops', () => {
  const depths = depthsFor([
    'for (Account a : accs) {',
    '  for (Contact c : cs) {',
    '    insert c;',
    '  }',
    '  doMore();',       // depth 1 (inner loop closed)
    '}',
  ].join('\n'));
  assert.deepStrictEqual(depths, [1, 2, 2, 2, 1, 1]);
});

test('trackLoopDepth: single-line unbraced loop', () => {
  const depths = depthsFor([
    'for (Account a : accs) a.Name = \'x\';',
    'foo();',
  ].join('\n'));
  // Single-line: depth is +1 for that line only
  assert.deepStrictEqual(depths, [1, 0]);
});

test('trackLoopDepth: code after loop is at depth 0', () => {
  const depths = depthsFor([
    'for (Account a : accs) {',
    '  insert a;',
    '}',
    'Integer x = 1;',
    'System.debug(x);',
  ].join('\n'));
  assert.strictEqual(depths[3], 0);
  assert.strictEqual(depths[4], 0);
});

test('trackLoopDepth: empty lines inside loop maintain depth', () => {
  const depths = depthsFor([
    'for (Account a : accs) {',
    '',
    '  insert a;',
    '',
    '}',
  ].join('\n'));
  assert.deepStrictEqual(depths, [1, 1, 1, 1, 1]);
});

test('trackLoopDepth: deeply nested loops (depth 3+)', () => {
  const depths = depthsFor([
    'for (Account a : accs) {',
    '  for (Contact c : cs) {',
    '    for (Task t : ts) {',
    '      insert t;',
    '    }',
    '  }',
    '}',
  ].join('\n'));
  assert.strictEqual(depths[3], 3); // insert t; at depth 3
  assert.strictEqual(depths[4], 3); // inner } still shows 3 (pushed before reconcile)
  assert.strictEqual(depths[5], 2); // middle } shows 2
  assert.strictEqual(depths[6], 1); // outer } shows 1
});

// ── Integration: preprocessing + loop depth ──────────────────────────────────

test('integration: SOQL in comment inside loop is NOT at depth > 0 for pattern', () => {
  const code = [
    'for (Account a : accs) {',
    '  // [SELECT Id FROM Contact]',
    '  insert a;',
    '}',
  ].join('\n');
  const processed = preprocessApex(code);
  const processedLines = processed.split('\n');
  const depths = trackLoopDepth(processedLines);
  // The comment line is at depth 1, but after preprocessing the SOQL is gone
  assert.strictEqual(depths[1], 1); // depth is correct
  assert.ok(!/SELECT/.test(processedLines[1]), 'SOQL in comment should be stripped');
});

test('integration: SOQL in string literal inside loop is stripped', () => {
  const code = [
    'for (Account a : accs) {',
    "  String q = 'SELECT Id FROM Contact';",
    '  insert a;',
    '}',
  ].join('\n');
  const processed = preprocessApex(code);
  const processedLines = processed.split('\n');
  assert.ok(!/SELECT/.test(processedLines[1]), 'SOQL in string should be stripped');
});

test('integration: SOQL in actual code inside loop is preserved', () => {
  const code = [
    'for (Account a : accs) {',
    '  List<Contact> cs = [SELECT Id FROM Contact];',
    '}',
  ].join('\n');
  const processed = preprocessApex(code);
  const processedLines = processed.split('\n');
  const depths = trackLoopDepth(processedLines);
  assert.strictEqual(depths[1], 1);
  assert.ok(/SELECT/.test(processedLines[1]), 'Actual SOQL should be preserved');
});

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\napex-analysis: ${passCount} passed, ${failCount} failed\n`);
if (failCount > 0) process.exit(1);
