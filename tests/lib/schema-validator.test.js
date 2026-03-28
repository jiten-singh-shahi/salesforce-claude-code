#!/usr/bin/env node
'use strict';

/**
 * schema-validator.test.js — Unit tests for scripts/lib/schema-validator.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  validateAgainstSchema,
  assertAgainstSchema,
  validateEntity,
  assertValidEntity,
  formatErrors,
  hasAjv,
  clearCaches,
} = require('../../scripts/lib/schema-validator');
const { getPluginRoot } = require('../../scripts/lib/utils');

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

const pluginRoot = getPluginRoot();
const schemasDir = path.join(pluginRoot, 'schemas');

// Create a temp schema for testing
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-schema-test-'));
const testSchemaPath = path.join(tmpDir, 'test.schema.json');
fs.writeFileSync(testSchemaPath, JSON.stringify({
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["name", "version"],
  "additionalProperties": false,
  "properties": {
    "name": { "type": "string", "minLength": 1 },
    "version": { "type": "integer", "minimum": 1 }
  },
  "$defs": {
    "item": {
      "type": "object",
      "required": ["id", "value"],
      "properties": {
        "id": { "type": "string", "minLength": 1 },
        "value": { "type": ["string", "null"] }
      }
    }
  }
}, null, 2));

// Clear caches before tests
clearCaches();

// ── validateAgainstSchema tests ───────────────────────────────────────────────

test('validateAgainstSchema: valid data passes', () => {
  const result = validateAgainstSchema(testSchemaPath, { name: 'test', version: 1 });
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.errors.length, 0);
});

test('validateAgainstSchema: missing required field fails', () => {
  const result = validateAgainstSchema(testSchemaPath, { name: 'test' });
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.length > 0);
});

test('validateAgainstSchema: wrong type fails', () => {
  const result = validateAgainstSchema(testSchemaPath, { name: 'test', version: 'not-a-number' });
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.length > 0);
});

test('validateAgainstSchema: extra properties fail (additionalProperties: false)', () => {
  const result = validateAgainstSchema(testSchemaPath, { name: 'test', version: 1, extra: true });
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.length > 0);
});

test('validateAgainstSchema: empty string name fails (minLength: 1)', () => {
  const result = validateAgainstSchema(testSchemaPath, { name: '', version: 1 });
  assert.strictEqual(result.valid, false);
});

// ── assertAgainstSchema tests ─────────────────────────────────────────────────

test('assertAgainstSchema: does not throw for valid data', () => {
  assertAgainstSchema(testSchemaPath, { name: 'test', version: 1 });
});

test('assertAgainstSchema: throws for invalid data', () => {
  assert.throws(() => {
    assertAgainstSchema(testSchemaPath, {}, 'test-data');
  }, /Invalid test-data/);
});

// ── validateEntity tests ──────────────────────────────────────────────────────

test('validateEntity: valid entity passes', () => {
  const result = validateEntity(testSchemaPath, 'item', { id: 'abc', value: 'hello' });
  assert.strictEqual(result.valid, true);
});

test('validateEntity: nullable field accepts null', () => {
  const result = validateEntity(testSchemaPath, 'item', { id: 'abc', value: null });
  assert.strictEqual(result.valid, true);
});

test('validateEntity: missing required field fails', () => {
  const result = validateEntity(testSchemaPath, 'item', { value: 'hello' });
  assert.strictEqual(result.valid, false);
});

test('validateEntity: throws for unknown entity name', () => {
  assert.throws(() => {
    validateEntity(testSchemaPath, 'nonexistent', {});
  }, /Unknown schema entity/);
});

// ── assertValidEntity tests ───────────────────────────────────────────────────

test('assertValidEntity: does not throw for valid entity', () => {
  assertValidEntity(testSchemaPath, 'item', { id: 'abc', value: 'test' });
});

test('assertValidEntity: throws for invalid entity', () => {
  assert.throws(() => {
    assertValidEntity(testSchemaPath, 'item', {}, 'my-item');
  }, /Invalid item \(my-item\)/);
});

// ── formatErrors tests ────────────────────────────────────────────────────────

test('formatErrors: formats single error', () => {
  const result = formatErrors([{ instancePath: '/name', message: 'must be string' }]);
  assert.strictEqual(result, '/name must be string');
});

test('formatErrors: formats multiple errors with semicolon', () => {
  const result = formatErrors([
    { instancePath: '/name', message: 'must be string' },
    { instancePath: '', message: 'must have required property' },
  ]);
  assert.ok(result.includes('/name must be string'));
  assert.ok(result.includes('/ must have required property'));
});

test('formatErrors: returns empty string for no errors', () => {
  assert.strictEqual(formatErrors([]), '');
  assert.strictEqual(formatErrors(null), '');
});

// ── hasAjv test ───────────────────────────────────────────────────────────────

test('hasAjv: returns boolean', () => {
  const result = hasAjv();
  assert.strictEqual(typeof result, 'boolean');
});

// ── Real schema tests ─────────────────────────────────────────────────────────

test('validates hooks.schema.json with real hooks data', () => {
  const hooksSchemaPath = path.join(schemasDir, 'hooks.schema.json');
  const hooksData = JSON.parse(fs.readFileSync(path.join(pluginRoot, 'hooks', 'hooks.json'), 'utf8'));
  const result = validateAgainstSchema(hooksSchemaPath, hooksData);
  // This tests that the real hooks.json validates against its schema
  assert.strictEqual(result.valid, true, `hooks.json validation failed: ${formatErrors(result.errors)}`);
});

test('validates state-store.schema.json entity: session', () => {
  const stateSchemaPath = path.join(schemasDir, 'state-store.schema.json');
  const validSession = {
    id: 'session-1',
    adapterId: 'claude',
    harness: 'claude',
    state: 'active',
    repoRoot: '/tmp/project',
    startedAt: '2026-03-26T00:00:00.000Z',
    endedAt: null,
    snapshot: {},
  };
  const result = validateEntity(stateSchemaPath, 'session', validSession);
  assert.strictEqual(result.valid, true, `session validation failed: ${formatErrors(result.errors)}`);
});

// ── Cleanup ───────────────────────────────────────────────────────────────────

fs.rmSync(tmpDir, { recursive: true, force: true });

console.log(`\nSchema validator tests: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
