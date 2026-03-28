#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const vm = require('vm');
const { spawnSync } = require('child_process');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const scriptPath = path.join(pluginRoot, 'scripts', 'hooks', 'stop-hook.js');

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

// ── Helper: extract pure functions from source ────────────────────────────────

function extractFunctions() {
  const src = fs.readFileSync(scriptPath, 'utf8');

  const sandbox = {
    require,
    process: {
      cwd: process.cwd,
      env: { ...process.env },
      exit: () => {},
    },
    console: { log: () => {}, error: () => {} },
    module: { exports: {} },
    __dirname: path.dirname(scriptPath),
    __filename: scriptPath,
  };

  // Extract function definitions before the main block
  const mainBlockIndex = src.indexOf('// ── Main');
  if (mainBlockIndex === -1) throw new Error('Could not find main block');

  let funcSource = src.substring(0, mainBlockIndex);
  funcSource = funcSource.replace(/^#!.*\n/, '');
  funcSource = funcSource.replace(/'use strict';\s*\n?/, '');

  const fullSource = `
    ${funcSource}
    module.exports = { run, getUncommittedFiles, isSalesforceProject, classifyFiles };
  `;

  const script = new vm.Script(fullSource, { filename: 'stop-hook-extract.js' });
  const context = vm.createContext(sandbox);
  script.runInContext(context);

  return sandbox.module.exports;
}

test('stop-hook.js: script exists', () => {
  assert.ok(fs.existsSync(scriptPath), 'stop-hook.js not found');
});

let fns;
try {
  fns = extractFunctions();
} catch {
  fns = null;
}

if (fns) {
  // ── isSalesforceProject ──

  test('isSalesforceProject: returns true when sfdx-project.json exists', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-sh-'));
    try {
      fs.writeFileSync(path.join(tmpDir, 'sfdx-project.json'), '{}');
      assert.strictEqual(fns.isSalesforceProject(tmpDir), true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  test('isSalesforceProject: returns true when sfdx-project.json is in parent', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-sh2-'));
    try {
      fs.writeFileSync(path.join(tmpDir, 'sfdx-project.json'), '{}');
      const subDir = path.join(tmpDir, 'src');
      fs.mkdirSync(subDir);
      assert.strictEqual(fns.isSalesforceProject(subDir), true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  test('isSalesforceProject: returns false when no sfdx-project.json found', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-sh3-'));
    try {
      assert.strictEqual(fns.isSalesforceProject(tmpDir), false);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  test('isSalesforceProject: limits search to 5 parent levels', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-sh4-'));
    try {
      fs.writeFileSync(path.join(tmpDir, 'sfdx-project.json'), '{}');
      const deepDir = path.join(tmpDir, 'a', 'b', 'c', 'd', 'e', 'f');
      fs.mkdirSync(deepDir, { recursive: true });
      // 6 levels deep — should not find it
      assert.strictEqual(fns.isSalesforceProject(deepDir), false);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  // ── classifyFiles ──

  test('classifyFiles: classifies .cls files as apex', () => {
    const files = [
      { statusCode: 'M', filePath: 'force-app/main/classes/MyClass.cls' },
    ];
    const result = fns.classifyFiles(files);
    assert.strictEqual(result.apex.length, 1);
    assert.strictEqual(result.lwc.length, 0);
    assert.strictEqual(result.aura.length, 0);
    assert.strictEqual(result.other.length, 0);
  });

  test('classifyFiles: classifies .trigger files as apex', () => {
    const files = [
      { statusCode: 'M', filePath: 'force-app/triggers/MyTrigger.trigger' },
    ];
    const result = fns.classifyFiles(files);
    assert.strictEqual(result.apex.length, 1);
  });

  test('classifyFiles: classifies LWC files', () => {
    const files = [
      { statusCode: 'M', filePath: 'force-app/main/lwc/myComponent/myComponent.js' },
      { statusCode: 'A', filePath: 'force-app/main/lwc/myComponent/myComponent.html' },
    ];
    const result = fns.classifyFiles(files);
    assert.strictEqual(result.lwc.length, 2);
  });

  test('classifyFiles: classifies Aura files', () => {
    const files = [
      { statusCode: 'M', filePath: 'force-app/main/aura/myComp/myComp.cmp' },
    ];
    const result = fns.classifyFiles(files);
    assert.strictEqual(result.aura.length, 1);
  });

  test('classifyFiles: classifies non-SF files as other', () => {
    const files = [
      { statusCode: 'M', filePath: 'package.json' },
      { statusCode: 'A', filePath: 'README.md' },
    ];
    const result = fns.classifyFiles(files);
    assert.strictEqual(result.other.length, 2);
  });

  test('classifyFiles: handles mixed file types', () => {
    const files = [
      { statusCode: 'M', filePath: 'classes/MyClass.cls' },
      { statusCode: 'M', filePath: 'lwc/myComp/myComp.js' },
      { statusCode: 'M', filePath: 'aura/myCmp/myCmp.cmp' },
      { statusCode: 'M', filePath: 'config/settings.json' },
    ];
    const result = fns.classifyFiles(files);
    assert.strictEqual(result.apex.length, 1);
    assert.strictEqual(result.lwc.length, 1);
    assert.strictEqual(result.aura.length, 1);
    assert.strictEqual(result.other.length, 1);
  });

  test('classifyFiles: handles empty array', () => {
    const result = fns.classifyFiles([]);
    assert.strictEqual(result.apex.length, 0);
    assert.strictEqual(result.lwc.length, 0);
    assert.strictEqual(result.aura.length, 0);
    assert.strictEqual(result.other.length, 0);
  });
}

// ── Integration tests via child process ──

test('stop-hook.js: exits 0 for non-Salesforce project', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-sh-int-'));
  try {
    const result = spawnSync(process.execPath, [scriptPath], {
      encoding: 'utf8',
      timeout: 15000,
      cwd: tmpDir,
      env: { ...process.env, HOME: os.tmpdir() },
    });

    assert.strictEqual(result.status, 0);
    assert.strictEqual((result.stdout || '').trim(), '');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('stop-hook.js: exits 0 for SF project with no git changes', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-sh-int2-'));
  try {
    fs.writeFileSync(path.join(tmpDir, 'sfdx-project.json'), '{}');

    // Initialize git repo with no changes
    spawnSync('git', ['init'], { cwd: tmpDir, encoding: 'utf8' });
    spawnSync('git', ['add', '.'], { cwd: tmpDir, encoding: 'utf8' });
    spawnSync('git', ['commit', '-m', 'init', '--allow-empty'], {
      cwd: tmpDir,
      encoding: 'utf8',
      env: { ...process.env, GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@test.com', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@test.com' },
    });

    const result = spawnSync(process.execPath, [scriptPath], {
      encoding: 'utf8',
      timeout: 15000,
      cwd: tmpDir,
      env: { ...process.env, HOME: os.tmpdir() },
    });

    assert.strictEqual(result.status, 0);
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('stop-hook.js: shows Apex reminders for uncommitted .cls files', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-sh-int3-'));
  try {
    fs.writeFileSync(path.join(tmpDir, 'sfdx-project.json'), '{}');

    // Initialize git repo
    const gitEnv = {
      ...process.env,
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@test.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@test.com',
      HOME: os.tmpdir(),
    };
    spawnSync('git', ['init'], { cwd: tmpDir, encoding: 'utf8', env: gitEnv });
    spawnSync('git', ['commit', '-m', 'init', '--allow-empty'], { cwd: tmpDir, encoding: 'utf8', env: gitEnv });

    // Create uncommitted Apex file
    fs.writeFileSync(path.join(tmpDir, 'MyClass.cls'), 'public class MyClass {}');

    const result = spawnSync(process.execPath, [scriptPath], {
      encoding: 'utf8',
      timeout: 15000,
      cwd: tmpDir,
      env: gitEnv,
    });

    assert.strictEqual(result.status, 0);
    const output = result.stdout || '';
    assert.ok(output.includes('Uncommitted Salesforce Changes'), 'Should show uncommitted changes header');
    assert.ok(output.includes('Apex changes'), 'Should mention Apex changes');
    assert.ok(output.includes('MyClass.cls'), 'Should list the .cls file');
    assert.ok(output.includes('sf apex run test'), 'Should suggest running tests');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('stop-hook.js: shows LWC reminders for uncommitted LWC files', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-sh-int4-'));
  try {
    fs.writeFileSync(path.join(tmpDir, 'sfdx-project.json'), '{}');

    const gitEnv = {
      ...process.env,
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@test.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@test.com',
      HOME: os.tmpdir(),
    };
    spawnSync('git', ['init'], { cwd: tmpDir, encoding: 'utf8', env: gitEnv });
    spawnSync('git', ['commit', '-m', 'init', '--allow-empty'], { cwd: tmpDir, encoding: 'utf8', env: gitEnv });

    // Create uncommitted LWC files
    const lwcDir = path.join(tmpDir, 'lwc', 'myComp');
    fs.mkdirSync(lwcDir, { recursive: true });
    fs.writeFileSync(path.join(lwcDir, 'myComp.js'), 'export default class MyComp {}');

    const result = spawnSync(process.execPath, [scriptPath], {
      encoding: 'utf8',
      timeout: 15000,
      cwd: tmpDir,
      env: gitEnv,
    });

    assert.strictEqual(result.status, 0);
    const output = result.stdout || '';
    assert.ok(output.includes('LWC changes'), 'Should mention LWC changes');
    assert.ok(output.includes('npm run test:unit'), 'Should suggest running Jest tests');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('stop-hook.js: shows Aura reminders for uncommitted Aura files', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-sh-int5-'));
  try {
    fs.writeFileSync(path.join(tmpDir, 'sfdx-project.json'), '{}');

    const gitEnv = {
      ...process.env,
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@test.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@test.com',
      HOME: os.tmpdir(),
    };
    spawnSync('git', ['init'], { cwd: tmpDir, encoding: 'utf8', env: gitEnv });
    spawnSync('git', ['commit', '-m', 'init', '--allow-empty'], { cwd: tmpDir, encoding: 'utf8', env: gitEnv });

    // Create uncommitted Aura files
    const auraDir = path.join(tmpDir, 'aura', 'myCmp');
    fs.mkdirSync(auraDir, { recursive: true });
    fs.writeFileSync(path.join(auraDir, 'myCmp.cmp'), '<aura:component></aura:component>');

    const result = spawnSync(process.execPath, [scriptPath], {
      encoding: 'utf8',
      timeout: 15000,
      cwd: tmpDir,
      env: gitEnv,
    });

    assert.strictEqual(result.status, 0);
    const output = result.stdout || '';
    assert.ok(output.includes('Aura changes'), 'Should mention Aura changes');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('stop-hook.js: exits silently when only non-SF files are uncommitted', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-sh-int6-'));
  try {
    fs.writeFileSync(path.join(tmpDir, 'sfdx-project.json'), '{}');

    const gitEnv = {
      ...process.env,
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@test.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@test.com',
      HOME: os.tmpdir(),
    };
    spawnSync('git', ['init'], { cwd: tmpDir, encoding: 'utf8', env: gitEnv });
    spawnSync('git', ['commit', '-m', 'init', '--allow-empty'], { cwd: tmpDir, encoding: 'utf8', env: gitEnv });

    // Only non-SF files uncommitted
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# README');

    const result = spawnSync(process.execPath, [scriptPath], {
      encoding: 'utf8',
      timeout: 15000,
      cwd: tmpDir,
      env: gitEnv,
    });

    assert.strictEqual(result.status, 0);
    const output = (result.stdout || '').trim();
    assert.strictEqual(output, '', 'Should produce no output for non-SF changes');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('stop-hook.js: shows test:unit step when package.json has test script', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-sh-int7-'));
  try {
    fs.writeFileSync(path.join(tmpDir, 'sfdx-project.json'), '{}');
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      scripts: { 'test:unit': 'jest' },
    }));

    const gitEnv = {
      ...process.env,
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@test.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@test.com',
      HOME: os.tmpdir(),
    };
    spawnSync('git', ['init'], { cwd: tmpDir, encoding: 'utf8', env: gitEnv });
    spawnSync('git', ['commit', '-m', 'init', '--allow-empty'], { cwd: tmpDir, encoding: 'utf8', env: gitEnv });

    // LWC files
    const lwcDir = path.join(tmpDir, 'lwc', 'comp');
    fs.mkdirSync(lwcDir, { recursive: true });
    fs.writeFileSync(path.join(lwcDir, 'comp.js'), 'export default class Comp {}');

    const result = spawnSync(process.execPath, [scriptPath], {
      encoding: 'utf8',
      timeout: 15000,
      cwd: tmpDir,
      env: gitEnv,
    });

    const output = result.stdout || '';
    assert.ok(output.includes('npm run test:unit'), 'Should suggest test:unit from package.json');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('stop-hook.js: truncates Apex file list when more than 5 files', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-sh-int8-'));
  try {
    fs.writeFileSync(path.join(tmpDir, 'sfdx-project.json'), '{}');

    const gitEnv = {
      ...process.env,
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@test.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@test.com',
      HOME: os.tmpdir(),
    };
    spawnSync('git', ['init'], { cwd: tmpDir, encoding: 'utf8', env: gitEnv });
    spawnSync('git', ['commit', '-m', 'init', '--allow-empty'], { cwd: tmpDir, encoding: 'utf8', env: gitEnv });

    // Create more than 5 uncommitted Apex files
    for (let i = 0; i < 7; i++) {
      fs.writeFileSync(path.join(tmpDir, `Class${i}.cls`), `public class Class${i} {}`);
    }

    const result = spawnSync(process.execPath, [scriptPath], {
      encoding: 'utf8',
      timeout: 15000,
      cwd: tmpDir,
      env: gitEnv,
    });

    const output = result.stdout || '';
    assert.ok(output.includes('... and 2 more'), 'Should truncate list and show "and N more"');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

console.log(`\nstop-hook.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
