#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const childProcess = require('child_process');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const scriptPath = path.join(pluginRoot, 'scripts', 'hooks', 'post-edit-format.js');

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

function freshRequire(modulePath) {
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function makeTempFile(ext, content = '// test') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-format-test-'));
  const filePath = path.join(dir, `testfile${ext}`);
  fs.writeFileSync(filePath, content, 'utf8');
  return { dir, filePath };
}

function cleanupDir(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

// ── File existence ──

test('post-edit-format.js: script exists', () => {
  assert.ok(fs.existsSync(scriptPath), 'post-edit-format.js not found');
});

test('post-edit-format.js: exports run function', () => {
  const mod = freshRequire(scriptPath);
  assert.ok(typeof mod.run === 'function', 'Should export run()');
});

// ── Error handling (run returns input unchanged) ──

test('run: returns input unchanged on empty input', () => {
  const mod = freshRequire(scriptPath);
  const input = '{}';
  assert.strictEqual(mod.run(input), input);
});

test('run: returns input unchanged on invalid JSON', () => {
  const mod = freshRequire(scriptPath);
  const input = 'not json';
  assert.strictEqual(mod.run(input), input);
});

test('run: returns input unchanged for non-existent file', () => {
  const mod = freshRequire(scriptPath);
  const input = JSON.stringify({ tool_input: { file_path: '/tmp/nonexistent-scc-12345.js' } });
  assert.strictEqual(mod.run(input), input);
});

test('run: returns input unchanged when file_path is empty', () => {
  const mod = freshRequire(scriptPath);
  const input = JSON.stringify({ tool_input: { file_path: '' } });
  assert.strictEqual(mod.run(input), input);
});

test('run: returns input unchanged when tool_input is missing', () => {
  const mod = freshRequire(scriptPath);
  const input = JSON.stringify({ something: 'else' });
  assert.strictEqual(mod.run(input), input);
});

// ── Format invocation via spawnSync mock ──

test('run: calls prettier for .js file', () => {
  const { dir, filePath } = makeTempFile('.js');
  try {
    const original = childProcess.spawnSync;
    let capturedArgs = null;
    childProcess.spawnSync = (cmd, args, opts) => {
      capturedArgs = { cmd, args, opts };
      return { status: 0 };
    };
    try {
      const mod = freshRequire(scriptPath);
      const input = JSON.stringify({ tool_input: { file_path: filePath } });
      mod.run(input);
      assert.ok(capturedArgs, 'spawnSync should have been called');
      assert.strictEqual(capturedArgs.cmd, 'npx', 'Should use npx');
      assert.ok(capturedArgs.args.includes('prettier'), 'Should call prettier');
      assert.ok(capturedArgs.args.includes('--write'), 'Should use --write');
      assert.ok(capturedArgs.args.includes(path.resolve(filePath)), 'Should pass resolved file path');
    } finally {
      childProcess.spawnSync = original;
    }
  } finally {
    cleanupDir(dir);
  }
});

test('run: calls prettier for .ts file', () => {
  const { dir, filePath } = makeTempFile('.ts');
  try {
    const original = childProcess.spawnSync;
    let called = false;
    childProcess.spawnSync = (cmd, args) => {
      called = true;
      assert.ok(args.includes('prettier'), 'Should call prettier');
      return { status: 0 };
    };
    try {
      const mod = freshRequire(scriptPath);
      mod.run(JSON.stringify({ tool_input: { file_path: filePath } }));
      assert.ok(called, 'spawnSync should have been called for .ts');
    } finally {
      childProcess.spawnSync = original;
    }
  } finally {
    cleanupDir(dir);
  }
});

test('run: calls prettier for .json file', () => {
  const { dir, filePath } = makeTempFile('.json', '{}');
  try {
    const original = childProcess.spawnSync;
    let called = false;
    childProcess.spawnSync = () => { called = true; return { status: 0 }; };
    try {
      const mod = freshRequire(scriptPath);
      mod.run(JSON.stringify({ tool_input: { file_path: filePath } }));
      assert.ok(called, 'spawnSync should have been called for .json');
    } finally {
      childProcess.spawnSync = original;
    }
  } finally {
    cleanupDir(dir);
  }
});

test('run: calls prettier with apex plugin for .cls file', () => {
  const { dir, filePath } = makeTempFile('.cls');
  try {
    const original = childProcess.spawnSync;
    let capturedArgs = null;
    childProcess.spawnSync = (cmd, args) => {
      capturedArgs = { cmd, args };
      return { status: 0 };
    };
    try {
      const mod = freshRequire(scriptPath);
      mod.run(JSON.stringify({ tool_input: { file_path: filePath } }));
      assert.ok(capturedArgs, 'spawnSync should have been called for .cls');
      assert.ok(capturedArgs.args.includes('prettier-plugin-apex'), 'Should use apex plugin');
      assert.ok(capturedArgs.args.includes('--plugin'), 'Should have --plugin flag');
    } finally {
      childProcess.spawnSync = original;
    }
  } finally {
    cleanupDir(dir);
  }
});

test('run: calls prettier with apex plugin for .trigger file', () => {
  const { dir, filePath } = makeTempFile('.trigger');
  try {
    const original = childProcess.spawnSync;
    let capturedArgs = null;
    childProcess.spawnSync = (cmd, args) => {
      capturedArgs = { cmd, args };
      return { status: 0 };
    };
    try {
      const mod = freshRequire(scriptPath);
      mod.run(JSON.stringify({ tool_input: { file_path: filePath } }));
      assert.ok(capturedArgs, 'spawnSync should have been called for .trigger');
      assert.ok(capturedArgs.args.includes('prettier-plugin-apex'), 'Should use apex plugin');
    } finally {
      childProcess.spawnSync = original;
    }
  } finally {
    cleanupDir(dir);
  }
});

test('run: does not call spawnSync for unsupported extension (.md)', () => {
  const { dir, filePath } = makeTempFile('.md', '# test');
  try {
    const original = childProcess.spawnSync;
    let called = false;
    childProcess.spawnSync = () => { called = true; return { status: 0 }; };
    try {
      const mod = freshRequire(scriptPath);
      mod.run(JSON.stringify({ tool_input: { file_path: filePath } }));
      assert.ok(!called, 'spawnSync should NOT be called for .md files');
    } finally {
      childProcess.spawnSync = original;
    }
  } finally {
    cleanupDir(dir);
  }
});

test('run: does not call spawnSync for unsupported extension (.py)', () => {
  const { dir, filePath } = makeTempFile('.py', 'pass');
  try {
    const original = childProcess.spawnSync;
    let called = false;
    childProcess.spawnSync = () => { called = true; return { status: 0 }; };
    try {
      const mod = freshRequire(scriptPath);
      mod.run(JSON.stringify({ tool_input: { file_path: filePath } }));
      assert.ok(!called, 'spawnSync should NOT be called for .py files');
    } finally {
      childProcess.spawnSync = original;
    }
  } finally {
    cleanupDir(dir);
  }
});

// ── Logging ──

test('run: logs to stderr on successful format', () => {
  const { dir, filePath } = makeTempFile('.js');
  try {
    const original = childProcess.spawnSync;
    const originalWrite = process.stderr.write;
    let stderrOutput = '';
    childProcess.spawnSync = () => ({ status: 0 });
    process.stderr.write = (msg) => { stderrOutput += msg; };
    try {
      const mod = freshRequire(scriptPath);
      mod.run(JSON.stringify({ tool_input: { file_path: filePath } }));
      assert.ok(stderrOutput.includes('[SCC Format]'), 'Should log with [SCC Format] prefix');
      assert.ok(stderrOutput.includes('Prettier'), 'Should mention Prettier');
    } finally {
      childProcess.spawnSync = original;
      process.stderr.write = originalWrite;
    }
  } finally {
    cleanupDir(dir);
  }
});

test('run: does not log when spawnSync returns non-zero', () => {
  const { dir, filePath } = makeTempFile('.js');
  try {
    const original = childProcess.spawnSync;
    const originalWrite = process.stderr.write;
    let stderrOutput = '';
    childProcess.spawnSync = () => ({ status: 1 });
    process.stderr.write = (msg) => { stderrOutput += msg; };
    try {
      const mod = freshRequire(scriptPath);
      mod.run(JSON.stringify({ tool_input: { file_path: filePath } }));
      assert.ok(!stderrOutput.includes('[SCC Format]'), 'Should not log on failure');
    } finally {
      childProcess.spawnSync = original;
      process.stderr.write = originalWrite;
    }
  } finally {
    cleanupDir(dir);
  }
});

// ── Timeout config ──

test('run: passes 15-second timeout to spawnSync', () => {
  const { dir, filePath } = makeTempFile('.js');
  try {
    const original = childProcess.spawnSync;
    let capturedOpts = null;
    childProcess.spawnSync = (_cmd, _args, opts) => {
      capturedOpts = opts;
      return { status: 0 };
    };
    try {
      const mod = freshRequire(scriptPath);
      mod.run(JSON.stringify({ tool_input: { file_path: filePath } }));
      assert.ok(capturedOpts, 'spawnSync should have been called');
      assert.strictEqual(capturedOpts.timeout, 15000, 'Should use 15s timeout');
    } finally {
      childProcess.spawnSync = original;
    }
  } finally {
    cleanupDir(dir);
  }
});

console.log(`\npost-edit-format.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
