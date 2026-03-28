#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const projectDetectPath = path.join(pluginRoot, 'scripts', 'lib', 'project-detect.js');

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

function createTmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function cleanTmpDir(dir) {
  fs.rmSync(dir, { recursive: true });
}

test('project-detect.js: module exists', () => {
  assert.ok(fs.existsSync(projectDetectPath), 'project-detect.js not found');
});

const projectDetect = require(projectDetectPath);

test('project-detect.js: exports expected functions', () => {
  assert.ok(typeof projectDetect.detectProjectType === 'function', 'Should export detectProjectType');
});

test('project-detect.js: exports detection rules', () => {
  assert.ok(Array.isArray(projectDetect.SF_PROJECT_RULES), 'Should export SF_PROJECT_RULES');
  assert.ok(Array.isArray(projectDetect.LANGUAGE_RULES), 'Should export LANGUAGE_RULES');
  assert.ok(Array.isArray(projectDetect.FRAMEWORK_RULES), 'Should export FRAMEWORK_RULES');
});

test('project-detect.js: SF_PROJECT_RULES covers key SF types', () => {
  const types = projectDetect.SF_PROJECT_RULES.map(r => r.type);
  assert.ok(types.includes('sfdx'), 'Should detect sfdx projects');
  assert.ok(types.includes('lwc'), 'Should detect LWC projects');
  assert.ok(types.includes('apex'), 'Should detect Apex projects');
});

test('project-detect.js: detects empty directory as unknown', () => {
  const tmpDir = createTmpDir('scc-pd-empty-');
  try {
    const result = projectDetect.detectProjectType(tmpDir);
    assert.strictEqual(result.primary, 'unknown', 'Empty dir should be unknown');
    assert.strictEqual(result.sfTypes.length, 0, 'No SF types');
    assert.strictEqual(result.languages.length, 0, 'No languages');
    assert.strictEqual(result.frameworks.length, 0, 'No frameworks');
    assert.strictEqual(result.projectDir, tmpDir, 'Should return projectDir');
    assert.strictEqual(result.sfdxConfig, null, 'No sfdx config');
  } finally {
    cleanTmpDir(tmpDir);
  }
});

test('project-detect.js: detects SFDX project', () => {
  const tmpDir = createTmpDir('scc-pd-sfdx-');
  fs.writeFileSync(path.join(tmpDir, 'sfdx-project.json'), JSON.stringify({
    packageDirectories: [{ path: 'force-app', default: true }],
    namespace: '',
    sfdcLoginUrl: 'https://login.salesforce.com',
    sourceApiVersion: '59.0',
  }));

  try {
    const result = projectDetect.detectProjectType(tmpDir);
    assert.ok(result.sfTypes.includes('sfdx'), 'Should detect sfdx type');
    assert.strictEqual(result.primary, 'salesforce', 'Primary should be salesforce');
    assert.ok(result.sfdxConfig !== null, 'Should parse sfdx config');
    assert.strictEqual(result.sfdxConfig.sourceApiVersion, '59.0', 'Should read API version');
  } finally {
    cleanTmpDir(tmpDir);
  }
});

test('project-detect.js: detects LWC project structure', () => {
  const tmpDir = createTmpDir('scc-pd-lwc-');
  const lwcDir = path.join(tmpDir, 'force-app', 'main', 'default', 'lwc');
  fs.mkdirSync(lwcDir, { recursive: true });

  try {
    const result = projectDetect.detectProjectType(tmpDir);
    assert.ok(result.sfTypes.includes('lwc'), 'Should detect lwc type');
  } finally {
    cleanTmpDir(tmpDir);
  }
});

test('project-detect.js: detects Apex project structure', () => {
  const tmpDir = createTmpDir('scc-pd-apex-');
  const classesDir = path.join(tmpDir, 'force-app', 'main', 'default', 'classes');
  fs.mkdirSync(classesDir, { recursive: true });

  try {
    const result = projectDetect.detectProjectType(tmpDir);
    assert.ok(result.sfTypes.includes('apex'), 'Should detect apex type');
  } finally {
    cleanTmpDir(tmpDir);
  }
});

test('project-detect.js: detects TypeScript language', () => {
  const tmpDir = createTmpDir('scc-pd-ts-');
  fs.writeFileSync(path.join(tmpDir, 'tsconfig.json'), '{}');

  try {
    const result = projectDetect.detectProjectType(tmpDir);
    assert.ok(result.languages.includes('typescript'), 'Should detect TypeScript');
  } finally {
    cleanTmpDir(tmpDir);
  }
});

test('project-detect.js: deduplicates TypeScript and JavaScript', () => {
  const tmpDir = createTmpDir('scc-pd-dedup-');
  fs.writeFileSync(path.join(tmpDir, 'tsconfig.json'), '{}');
  fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"name":"test"}');

  try {
    const result = projectDetect.detectProjectType(tmpDir);
    assert.ok(result.languages.includes('typescript'), 'Should include TypeScript');
    assert.ok(!result.languages.includes('javascript'), 'Should not duplicate JavaScript');
  } finally {
    cleanTmpDir(tmpDir);
  }
});

test('project-detect.js: detects React framework from package.json', () => {
  const tmpDir = createTmpDir('scc-pd-react-');
  fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
    name: 'test',
    dependencies: { react: '^18.0.0' },
  }));

  try {
    const result = projectDetect.detectProjectType(tmpDir);
    assert.ok(result.frameworks.includes('react'), 'Should detect React');
  } finally {
    cleanTmpDir(tmpDir);
  }
});

test('project-detect.js: getPackageJsonDeps handles missing package.json', () => {
  const tmpDir = createTmpDir('scc-pd-nopkg-');
  try {
    const deps = projectDetect.getPackageJsonDeps(tmpDir);
    assert.deepStrictEqual(deps, [], 'Should return empty array');
  } finally {
    cleanTmpDir(tmpDir);
  }
});

test('project-detect.js: getSfdxProjectConfig handles missing config', () => {
  const tmpDir = createTmpDir('scc-pd-nosfdx-');
  try {
    const config = projectDetect.getSfdxProjectConfig(tmpDir);
    assert.strictEqual(config, null, 'Should return null');
  } finally {
    cleanTmpDir(tmpDir);
  }
});

test('project-detect.js: detects multiple SF types together', () => {
  const tmpDir = createTmpDir('scc-pd-multi-');
  fs.writeFileSync(path.join(tmpDir, 'sfdx-project.json'), '{"packageDirectories":[]}');
  const classesDir = path.join(tmpDir, 'force-app', 'main', 'default', 'classes');
  const lwcDir = path.join(tmpDir, 'force-app', 'main', 'default', 'lwc');
  const triggersDir = path.join(tmpDir, 'force-app', 'main', 'default', 'triggers');
  fs.mkdirSync(classesDir, { recursive: true });
  fs.mkdirSync(lwcDir, { recursive: true });
  fs.mkdirSync(triggersDir, { recursive: true });

  try {
    const result = projectDetect.detectProjectType(tmpDir);
    assert.ok(result.sfTypes.includes('sfdx'), 'Should detect sfdx');
    assert.ok(result.sfTypes.includes('apex'), 'Should detect apex');
    assert.ok(result.sfTypes.includes('lwc'), 'Should detect lwc');
    assert.ok(result.sfTypes.includes('trigger'), 'Should detect trigger');
    assert.strictEqual(result.primary, 'salesforce', 'Primary should be salesforce');
  } finally {
    cleanTmpDir(tmpDir);
  }
});

console.log(`\nproject-detect.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
