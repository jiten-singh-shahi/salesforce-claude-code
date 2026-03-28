'use strict';

/**
 * schema-validator.js — Shared AJV schema validation for SCC.
 *
 * Follows ECC's pattern:
 * - Graceful AJV import with fallback when not installed
 * - Cached schema, AJV instance, and compiled validators
 * - Consistent error formatting: `${instancePath || '/'} ${message}`
 * - Entity validation against $defs-based schemas
 */

const fs = require('fs');
const path = require('path');

// Graceful AJV import — fallback when not installed (bare environments)
let Ajv = null;
try {
  const ajvModule = require('ajv');
  Ajv = ajvModule.default || ajvModule;
} catch (_error) {
  Ajv = null;
}

// Caches
let cachedAjv = null;
const cachedSchemas = new Map();
const cachedValidators = new Map();

function getAjv() {
  if (cachedAjv) return cachedAjv;
  if (!Ajv) return null;
  cachedAjv = new Ajv({ allErrors: true, strict: false });
  return cachedAjv;
}

function readSchema(schemaPath) {
  const resolved = path.resolve(schemaPath);
  if (cachedSchemas.has(resolved)) return cachedSchemas.get(resolved);
  const schema = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  cachedSchemas.set(resolved, schema);
  return schema;
}

function getValidator(schemaPath) {
  const resolved = path.resolve(schemaPath);
  if (cachedValidators.has(resolved)) return cachedValidators.get(resolved);

  const ajv = getAjv();
  if (!ajv) return createFallbackValidator();

  const schema = readSchema(resolved);
  const validator = ajv.compile(schema);
  cachedValidators.set(resolved, validator);
  return validator;
}

function getEntityValidator(schemaPath, entityName) {
  const cacheKey = `${path.resolve(schemaPath)}#${entityName}`;
  if (cachedValidators.has(cacheKey)) return cachedValidators.get(cacheKey);

  const ajv = getAjv();
  if (!ajv) return createFallbackValidator();

  const schema = readSchema(schemaPath);
  if (!schema.$defs || !schema.$defs[entityName]) {
    throw new Error(`Unknown schema entity: ${entityName} in ${schemaPath}`);
  }

  const entitySchema = {
    $schema: schema.$schema,
    ...schema.$defs[entityName],
    $defs: schema.$defs,
  };
  const validator = ajv.compile(entitySchema);
  cachedValidators.set(cacheKey, validator);
  return validator;
}

/**
 * Fallback validator when AJV is not installed.
 * Returns a validator function with same interface: validate(data) → boolean, validate.errors → array.
 */
function createFallbackValidator() {
  const validate = (data) => {
    const errors = [];
    validate.errors = errors;

    if (data === null || data === undefined) {
      errors.push({ instancePath: '/', message: 'must not be null or undefined' });
      return false;
    }
    if (typeof data !== 'object' || Array.isArray(data)) {
      errors.push({ instancePath: '/', message: 'must be object' });
      return false;
    }
    return true;
  };
  validate.errors = [];
  return validate;
}

/**
 * Format AJV errors into a readable string.
 */
function formatErrors(errors) {
  if (!errors || errors.length === 0) return '';
  return errors
    .map(e => `${e.instancePath || '/'} ${e.message}`)
    .join('; ');
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Validate data against a JSON schema file.
 * @param {string} schemaPath - path to JSON schema file
 * @param {*} data - data to validate
 * @returns {{ valid: boolean, errors: Array }}
 */
function validateAgainstSchema(schemaPath, data) {
  const validator = getValidator(schemaPath);
  const valid = validator(data);
  return { valid, errors: validator.errors || [] };
}

/**
 * Validate data against a schema, throw on invalid.
 * @param {string} schemaPath - path to JSON schema file
 * @param {*} data - data to validate
 * @param {string} [label] - label for error message
 */
function assertAgainstSchema(schemaPath, data, label) {
  const result = validateAgainstSchema(schemaPath, data);
  if (!result.valid) {
    throw new Error(`Invalid${label ? ` ${label}` : ''}: ${formatErrors(result.errors)}`);
  }
}

/**
 * Validate data against a named entity definition ($defs) in a schema.
 * @param {string} schemaPath - path to JSON schema file
 * @param {string} entityName - name of the entity in $defs
 * @param {*} data - data to validate
 * @returns {{ valid: boolean, errors: Array }}
 */
function validateEntity(schemaPath, entityName, data) {
  const validator = getEntityValidator(schemaPath, entityName);
  const valid = validator(data);
  return { valid, errors: validator.errors || [] };
}

/**
 * Validate entity against a schema, throw on invalid.
 * @param {string} schemaPath - path to JSON schema file
 * @param {string} entityName - name of the entity in $defs
 * @param {*} data - data to validate
 * @param {string} [label] - label for error message
 */
function assertValidEntity(schemaPath, entityName, data, label) {
  const result = validateEntity(schemaPath, entityName, data);
  if (!result.valid) {
    throw new Error(`Invalid ${entityName}${label ? ` (${label})` : ''}: ${formatErrors(result.errors)}`);
  }
}

/**
 * Check if AJV is available.
 */
function hasAjv() {
  return Ajv !== null;
}

/**
 * Clear all caches (useful for testing).
 */
function clearCaches() {
  cachedAjv = null;
  cachedSchemas.clear();
  cachedValidators.clear();
}

module.exports = {
  validateAgainstSchema,
  assertAgainstSchema,
  validateEntity,
  assertValidEntity,
  formatErrors,
  hasAjv,
  clearCaches,
};
