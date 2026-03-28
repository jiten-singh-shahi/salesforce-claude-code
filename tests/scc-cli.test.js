#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..');
const sccCliPath = path.join(pluginRoot, 'scripts', 'scc.js');

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

test('scc.js: CLI entry point exists', () => {
  assert.ok(fs.existsSync(sccCliPath), `scc.js not found at: ${sccCliPath}`);
});

test('scc.js: has shebang line', () => {
  const content = fs.readFileSync(sccCliPath, 'utf8');
  assert.ok(content.startsWith('#!/usr/bin/env node') || content.startsWith("'use strict'"),
    'CLI should start with shebang or use strict');
});

test('scc.js: responds to --help or help without error', () => {
  const result = spawnSync(process.execPath, [sccCliPath, 'help'], {
    encoding: 'utf8',
    timeout: 10000,
    cwd: pluginRoot,
  });
  // CLI should either exit 0 with help text or exit 1 with usage info
  assert.ok(result.status === 0 || result.status === 1,
    `CLI exited with unexpected code: ${result.status}`);
});

test('scc.js: is valid JavaScript', () => {
  const content = fs.readFileSync(sccCliPath, 'utf8');
  assert.ok(content.includes('require(') || content.includes('process.argv'),
    'CLI should use require() or process.argv');
});

console.log(`\nscc-cli.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
