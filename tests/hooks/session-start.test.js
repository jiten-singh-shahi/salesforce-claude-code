#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const vm = require('vm');
const { spawnSync } = require('child_process');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const scriptPath = path.join(pluginRoot, 'scripts', 'hooks', 'session-start.js');

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

// ── Helper: extract functions from the source without running the main block ──

function extractFunctions() {
  const src = fs.readFileSync(scriptPath, 'utf8');

  // Extract the function bodies we need to test
  const sandbox = {
    require,
    process: { ...process, exit: () => {}, cwd: process.cwd, env: process.env },
    console: { log: () => {}, error: () => {} },
    module: { exports: {} },
    __dirname: path.dirname(scriptPath),
    __filename: scriptPath,
  };

  // Extract only the function definitions (before the main block)
  const mainBlockIndex = src.indexOf('// ── Main');
  const funcSource = src.substring(0, mainBlockIndex);

  // Remove the shebang line
  const cleanSource = funcSource.replace(/^#!.*\n/, '');

  // Create a module-like wrapper to get the functions
  const wrapper = `
    ${cleanSource}
    module.exports = { readSfdxProject, findSfdxRoot, getSfCliVersion, listOrgs };
  `;

  const script = new vm.Script(wrapper, { filename: 'session-start-extract.js' });
  const context = vm.createContext(sandbox);
  script.runInContext(context);

  return sandbox.module.exports;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test('session-start.js: script exists', () => {
  assert.ok(fs.existsSync(scriptPath), 'session-start.js not found');
});

// Extract functions for unit testing
let fns;
try {
  fns = extractFunctions();
} catch {
  // If extraction fails, fall back to child process tests only
  fns = null;
}

if (fns) {
  // ── readSfdxProject tests ──

  test('readSfdxProject: returns parsed JSON for valid sfdx-project.json', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-ss-'));
    try {
      const projData = {
        name: 'TestProject',
        namespace: 'tns',
        packageDirectories: [{ path: 'force-app', default: true }],
        sourceApiVersion: '59.0',
      };
      fs.writeFileSync(path.join(tmpDir, 'sfdx-project.json'), JSON.stringify(projData));

      const result = fns.readSfdxProject(tmpDir);
      assert.ok(result !== null, 'Should return parsed object');
      assert.strictEqual(result.name, 'TestProject');
      assert.strictEqual(result.namespace, 'tns');
      assert.strictEqual(result.sourceApiVersion, '59.0');
      assert.ok(Array.isArray(result.packageDirectories));
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  test('readSfdxProject: returns null when file does not exist', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-ss2-'));
    try {
      const result = fns.readSfdxProject(tmpDir);
      assert.strictEqual(result, null);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  test('readSfdxProject: returns null for malformed JSON', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-ss3-'));
    try {
      fs.writeFileSync(path.join(tmpDir, 'sfdx-project.json'), '{invalid json!!!');
      const result = fns.readSfdxProject(tmpDir);
      assert.strictEqual(result, null);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  // ── findSfdxRoot tests ──

  test('findSfdxRoot: finds project root in current directory', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-ss4-'));
    try {
      fs.writeFileSync(path.join(tmpDir, 'sfdx-project.json'), '{}');
      const result = fns.findSfdxRoot(tmpDir);
      assert.strictEqual(result, tmpDir);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  test('findSfdxRoot: finds project root in parent directory', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-ss5-'));
    try {
      fs.writeFileSync(path.join(tmpDir, 'sfdx-project.json'), '{}');
      const subDir = path.join(tmpDir, 'src', 'main');
      fs.mkdirSync(subDir, { recursive: true });
      const result = fns.findSfdxRoot(subDir);
      assert.strictEqual(result, tmpDir);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  test('findSfdxRoot: returns null when no sfdx-project.json found', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-ss6-'));
    try {
      const result = fns.findSfdxRoot(tmpDir);
      assert.strictEqual(result, null);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  test('findSfdxRoot: limits search depth to 5 levels', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-ss7-'));
    try {
      // Create sfdx-project.json at root level
      fs.writeFileSync(path.join(tmpDir, 'sfdx-project.json'), '{}');
      // Create a deeply nested dir (more than 5 levels deep)
      const deepDir = path.join(tmpDir, 'a', 'b', 'c', 'd', 'e', 'f');
      fs.mkdirSync(deepDir, { recursive: true });
      const result = fns.findSfdxRoot(deepDir);
      // From deepDir, walking up 5 levels reaches 'a', not tmpDir
      // So it should NOT find it
      assert.strictEqual(result, null);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });
}

// ── Integration test: run script as a child process in a Salesforce project ──

test('session-start.js: outputs Salesforce context for a valid SF project', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-ss-int-'));
  try {
    const projData = {
      name: 'MyApp',
      namespace: 'myns',
      packageDirectories: [{ path: 'force-app', default: true }],
      sourceApiVersion: '60.0',
    };
    fs.writeFileSync(path.join(tmpDir, 'sfdx-project.json'), JSON.stringify(projData));

    const result = spawnSync(process.execPath, [scriptPath], {
      encoding: 'utf8',
      timeout: 15000,
      cwd: tmpDir,
      env: { ...process.env, PATH: process.env.PATH, HOME: os.tmpdir() },
    });

    // Script should produce output about the Salesforce project
    const output = result.stdout || '';
    assert.ok(output.includes('Salesforce Dev Context'), 'Should print SF context header');
    assert.ok(output.includes('MyApp') || output.includes('myns') || output.includes('60.0'),
      'Should include project details');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('session-start.js: exits silently for non-Salesforce project', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-ss-int2-'));
  try {
    const result = spawnSync(process.execPath, [scriptPath], {
      encoding: 'utf8',
      timeout: 15000,
      cwd: tmpDir,
      env: { ...process.env, PATH: '', HOME: os.tmpdir() },
    });

    assert.strictEqual(result.status, 0, 'Should exit with code 0');
    assert.strictEqual((result.stdout || '').trim(), '', 'Should produce no output');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('session-start.js: shows project name and package dirs', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-ss-int3-'));
  try {
    const projData = {
      name: 'DemoProject',
      packageDirectories: [
        { path: 'force-app' },
        { path: 'utils' },
      ],
      sourceApiVersion: '58.0',
    };
    fs.writeFileSync(path.join(tmpDir, 'sfdx-project.json'), JSON.stringify(projData));

    const result = spawnSync(process.execPath, [scriptPath], {
      encoding: 'utf8',
      timeout: 15000,
      cwd: tmpDir,
      env: { ...process.env, PATH: '', HOME: os.tmpdir() },
    });

    const output = result.stdout || '';
    assert.ok(output.includes('DemoProject'), 'Should show project name');
    assert.ok(output.includes('force-app'), 'Should list package directories');
    assert.ok(output.includes('58.0'), 'Should show API version');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('session-start.js: shows SF CLI not found message', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-ss-int4-'));
  try {
    fs.writeFileSync(path.join(tmpDir, 'sfdx-project.json'), '{}');

    // Run with empty PATH so sf/sfdx commands will fail
    const result = spawnSync(process.execPath, [scriptPath], {
      encoding: 'utf8',
      timeout: 15000,
      cwd: tmpDir,
      env: { ...process.env, PATH: '', HOME: os.tmpdir() },
    });

    const output = result.stdout || '';
    assert.ok(output.includes('not found'), 'Should indicate SF CLI not found');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('session-start.js: shows SF_ORG_ALIAS when env var is set', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-ss-int5-'));
  try {
    fs.writeFileSync(path.join(tmpDir, 'sfdx-project.json'), '{}');

    const result = spawnSync(process.execPath, [scriptPath], {
      encoding: 'utf8',
      timeout: 15000,
      cwd: tmpDir,
      env: { ...process.env, PATH: '', HOME: os.tmpdir(), SF_ORG_ALIAS: 'MyDevOrg' },
    });

    const output = result.stdout || '';
    assert.ok(output.includes('MyDevOrg'), 'Should show SF_ORG_ALIAS');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('session-start.js: shows "Project root" when run from subdirectory', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-ss-int6-'));
  try {
    fs.writeFileSync(path.join(tmpDir, 'sfdx-project.json'), JSON.stringify({ name: 'SubTest' }));
    const subDir = path.join(tmpDir, 'force-app', 'main');
    fs.mkdirSync(subDir, { recursive: true });

    const result = spawnSync(process.execPath, [scriptPath], {
      encoding: 'utf8',
      timeout: 15000,
      cwd: subDir,
      env: { ...process.env, PATH: '', HOME: os.tmpdir() },
    });

    const output = result.stdout || '';
    assert.ok(output.includes('Project root'), 'Should show "Project root" when in subdirectory');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

console.log(`\nsession-start.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
