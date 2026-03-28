#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const scriptPath = path.join(pluginRoot, 'scripts', 'ci', 'validate-no-personal-paths.js');

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

function runScript(envPluginRoot) {
  return spawnSync(process.execPath, [scriptPath], {
    encoding: 'utf8',
    timeout: 15000,
    env: {
      ...process.env,
      SCC_PLUGIN_ROOT: envPluginRoot,
      NODE_ENV: 'test',
    },
  });
}

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'scc-personal-paths-test-'));
}

function cleanup(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch { /* ignore */ }
}

// ── Tests: script existence ──────────────────────────────────────────────────

test('validate-no-personal-paths.js: script exists', () => {
  assert.ok(fs.existsSync(scriptPath), `Script not found at: ${scriptPath}`);
});

// ── Tests: passes on real project ────────────────────────────────────────────

test('validate-no-personal-paths.js: passes on real project', () => {
  const result = runScript(pluginRoot);
  assert.strictEqual(result.status, 0,
    `Should pass on real project. stderr: ${(result.stderr || '').slice(0, 500)}`);
  const output = result.stdout || '';
  assert.ok(output.includes('Personal path scan PASSED'), 'Should output PASSED message');
});

test('validate-no-personal-paths.js: reports file count on success', () => {
  const result = runScript(pluginRoot);
  assert.strictEqual(result.status, 0);
  const output = result.stdout || '';
  assert.ok(output.includes('file(s) scanned'), 'Should report number of scanned files');
});

// ── Tests: passes on empty directory ─────────────────────────────────────────

test('validate-no-personal-paths.js: passes on empty directory (no scan dirs)', () => {
  const tmpDir = makeTempDir();
  try {
    const result = runScript(tmpDir);
    assert.strictEqual(result.status, 0,
      'Should pass when no scan dirs exist (nothing to scan)');
  } finally {
    cleanup(tmpDir);
  }
});

// ── Tests: detects macOS personal paths ──────────────────────────────────────

test('validate-no-personal-paths.js: detects /Users/specificname/ paths', () => {
  const tmpDir = makeTempDir();
  try {
    const agentsDir = path.join(tmpDir, 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });
    fs.writeFileSync(path.join(agentsDir, 'test-agent.md'), [
      '---',
      'name: test',
      '---',
      'Look at /Users/johndoe/Desktop/project for reference.',
    ].join('\n'));

    const result = runScript(tmpDir);
    assert.notStrictEqual(result.status, 0, 'Should fail when personal paths are found');
    const stderr = result.stderr || '';
    assert.ok(stderr.includes('Personal path scan FAILED'), 'Should report FAILED');
    assert.ok(stderr.includes('/Users/johndoe'), 'Should show the offending path');
  } finally {
    cleanup(tmpDir);
  }
});

// ── Tests: detects Linux personal paths ──────────────────────────────────────

test('validate-no-personal-paths.js: detects /home/specificname/ paths', () => {
  const tmpDir = makeTempDir();
  try {
    const skillsDir = path.join(tmpDir, 'skills');
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.writeFileSync(path.join(skillsDir, 'test-skill.md'),
      'Config is at /home/janedoe/configs/app.yml\n');

    const result = runScript(tmpDir);
    assert.notStrictEqual(result.status, 0, 'Should fail on Linux personal paths');
    const stderr = result.stderr || '';
    assert.ok(stderr.includes('/home/janedoe'), 'Should show the Linux path');
  } finally {
    cleanup(tmpDir);
  }
});

// ── Tests: detects Windows personal paths ────────────────────────────────────

test('validate-no-personal-paths.js: detects C:\\Users\\name\\ paths', () => {
  const tmpDir = makeTempDir();
  try {
    const commandsDir = path.join(tmpDir, 'commands');
    fs.mkdirSync(commandsDir, { recursive: true });
    fs.writeFileSync(path.join(commandsDir, 'test-cmd.md'),
      'Open C:\\Users\\Developer\\Documents\\project\\\n');

    const result = runScript(tmpDir);
    assert.notStrictEqual(result.status, 0, 'Should fail on Windows personal paths');
    const stderr = result.stderr || '';
    assert.ok(stderr.includes('Windows user directory path') || stderr.includes('Personal project path'),
      'Should describe the Windows path violation');
  } finally {
    cleanup(tmpDir);
  }
});

// ── Tests: allows generic placeholder paths ──────────────────────────────────

test('validate-no-personal-paths.js: allows /Users/username/ placeholder', () => {
  const tmpDir = makeTempDir();
  try {
    const agentsDir = path.join(tmpDir, 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });
    fs.writeFileSync(path.join(agentsDir, 'test-agent.md'), [
      '---',
      'name: test',
      '---',
      'See /Users/username/project for an example.',
    ].join('\n'));

    const result = runScript(tmpDir);
    assert.strictEqual(result.status, 0,
      'Should allow /Users/username/ as a generic placeholder');
  } finally {
    cleanup(tmpDir);
  }
});

test('validate-no-personal-paths.js: allows /Users/your-name/ placeholder', () => {
  const tmpDir = makeTempDir();
  try {
    const agentsDir = path.join(tmpDir, 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });
    fs.writeFileSync(path.join(agentsDir, 'test-agent.md'), [
      '---',
      'name: test',
      '---',
      'See /Users/your-name/project for an example.',
    ].join('\n'));

    const result = runScript(tmpDir);
    assert.strictEqual(result.status, 0,
      'Should allow /Users/your-name/ as a generic placeholder');
  } finally {
    cleanup(tmpDir);
  }
});

// ── Tests: skips JS comment lines in scripts ─────────────────────────────────

test('validate-no-personal-paths.js: skips JS comment-only lines in script dirs', () => {
  const tmpDir = makeTempDir();
  try {
    const scriptsDir = path.join(tmpDir, 'scripts');
    fs.mkdirSync(scriptsDir, { recursive: true });
    fs.writeFileSync(path.join(scriptsDir, 'test-script.js'), [
      '// This references /Users/johndoe/project but is a comment',
      'const x = 1;',
    ].join('\n'));

    const result = runScript(tmpDir);
    assert.strictEqual(result.status, 0,
      'Should skip comment-only lines in script files');
  } finally {
    cleanup(tmpDir);
  }
});

// ── Tests: skips indented code blocks ────────────────────────────────────────

test('validate-no-personal-paths.js: skips indented code blocks', () => {
  const tmpDir = makeTempDir();
  try {
    const agentsDir = path.join(tmpDir, 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });
    fs.writeFileSync(path.join(agentsDir, 'test-agent.md'), [
      '---',
      'name: test',
      '---',
      '    /Users/johndoe/project is in an indented code block',
    ].join('\n'));

    const result = runScript(tmpDir);
    assert.strictEqual(result.status, 0,
      'Should skip indented code blocks');
  } finally {
    cleanup(tmpDir);
  }
});

// ── Tests: skips tab-indented code blocks ────────────────────────────────────

test('validate-no-personal-paths.js: skips tab-indented code blocks', () => {
  const tmpDir = makeTempDir();
  try {
    const agentsDir = path.join(tmpDir, 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });
    fs.writeFileSync(path.join(agentsDir, 'test-agent.md'), [
      '---',
      'name: test',
      '---',
      '\t/Users/johndoe/project is in a tab-indented line',
    ].join('\n'));

    const result = runScript(tmpDir);
    assert.strictEqual(result.status, 0,
      'Should skip tab-indented lines');
  } finally {
    cleanup(tmpDir);
  }
});

// ── Tests: detects personal project paths ────────────────────────────────────

test('validate-no-personal-paths.js: detects Desktop/Documents/Projects patterns', () => {
  const tmpDir = makeTempDir();
  try {
    const rulesDir = path.join(tmpDir, 'rules');
    fs.mkdirSync(rulesDir, { recursive: true });
    fs.writeFileSync(path.join(rulesDir, 'test-rule.md'),
      'Source at /Users/developer/Desktop/my-project/src/main.js\n');

    const result = runScript(tmpDir);
    assert.notStrictEqual(result.status, 0, 'Should detect personal project paths');
  } finally {
    cleanup(tmpDir);
  }
});

// ── Tests: skips non-scanned extensions ──────────────────────────────────────

test('validate-no-personal-paths.js: ignores non-scanned file extensions', () => {
  const tmpDir = makeTempDir();
  try {
    const agentsDir = path.join(tmpDir, 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });
    // .png file should not be scanned
    fs.writeFileSync(path.join(agentsDir, 'test.png'), '/Users/johndoe/secret/path\n');

    const result = runScript(tmpDir);
    assert.strictEqual(result.status, 0,
      'Should ignore non-scanned file extensions');
  } finally {
    cleanup(tmpDir);
  }
});

// ── Tests: scans multiple directories ────────────────────────────────────────

test('validate-no-personal-paths.js: scans agents, skills, commands, rules dirs', () => {
  const tmpDir = makeTempDir();
  try {
    // Create clean dirs with no violations
    for (const dir of ['agents', 'skills', 'commands', 'rules', 'contexts']) {
      const d = path.join(tmpDir, dir);
      fs.mkdirSync(d, { recursive: true });
      fs.writeFileSync(path.join(d, 'clean-file.md'), 'This is clean content.\n');
    }

    const result = runScript(tmpDir);
    assert.strictEqual(result.status, 0, 'Should pass when all dirs are clean');
    const output = result.stdout || '';
    assert.ok(output.includes('file(s) scanned'), 'Should report scanned file count');
  } finally {
    cleanup(tmpDir);
  }
});

// ── Tests: skips URLs ────────────────────────────────────────────────────────

test('validate-no-personal-paths.js: skips URLs with short domains', () => {
  const tmpDir = makeTempDir();
  try {
    const agentsDir = path.join(tmpDir, 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });
    // The URL skip looks 8 chars before the match for ://
    // With a short domain like 'x.co', the :// is within 8 chars
    fs.writeFileSync(path.join(agentsDir, 'test.md'),
      'Visit http://x.co/Users/johndoe/profile for info.\n');

    const result = runScript(tmpDir);
    assert.strictEqual(result.status, 0,
      'Should skip path-like patterns in URLs with short domains');
  } finally {
    cleanup(tmpDir);
  }
});

// ── Tests: reports fix suggestion ────────────────────────────────────────────

test('validate-no-personal-paths.js: reports fix suggestion on failure', () => {
  const tmpDir = makeTempDir();
  try {
    const agentsDir = path.join(tmpDir, 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });
    fs.writeFileSync(path.join(agentsDir, 'bad-agent.md'),
      'File at /Users/myuser/code/app.js\n');

    const result = runScript(tmpDir);
    assert.notStrictEqual(result.status, 0);
    const stderr = result.stderr || '';
    assert.ok(stderr.includes('Fix: Replace personal paths'),
      'Should suggest how to fix personal paths');
  } finally {
    cleanup(tmpDir);
  }
});

// ── Tests: skips node_modules ────────────────────────────────────────────────

test('validate-no-personal-paths.js: skips files in node_modules', () => {
  const tmpDir = makeTempDir();
  try {
    const nmDir = path.join(tmpDir, 'scripts', 'node_modules', 'some-pkg');
    fs.mkdirSync(nmDir, { recursive: true });
    fs.writeFileSync(path.join(nmDir, 'index.js'),
      'const path = "/Users/pkgauthor/dev/something";\n');

    const result = runScript(tmpDir);
    assert.strictEqual(result.status, 0,
      'Should skip files inside node_modules');
  } finally {
    cleanup(tmpDir);
  }
});

// ── Tests: handles unreadable files gracefully ───────────────────────────────

test('validate-no-personal-paths.js: handles missing scan dirs gracefully', () => {
  const tmpDir = makeTempDir();
  try {
    // Only create one dir, leave others missing
    const agentsDir = path.join(tmpDir, 'agents');
    fs.mkdirSync(agentsDir, { recursive: true });
    fs.writeFileSync(path.join(agentsDir, 'clean.md'), 'Clean content\n');

    const result = runScript(tmpDir);
    assert.strictEqual(result.status, 0,
      'Should handle missing scan dirs gracefully');
  } finally {
    cleanup(tmpDir);
  }
});

console.log(`\nvalidate-no-personal-paths.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
