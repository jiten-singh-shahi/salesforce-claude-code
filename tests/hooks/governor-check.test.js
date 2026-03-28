#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const governorCheckPath = path.join(pluginRoot, 'scripts', 'hooks', 'governor-check.js');

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

/**
 * Helper: run governor-check on a temp Apex file and capture stderr output.
 */
function runOnApex(apexCode, ext = '.cls') {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-gov-'));
  const apexFile = path.join(tmpDir, `TestClass${ext}`);
  fs.writeFileSync(apexFile, apexCode);
  const captured = [];
  const origWrite = process.stderr.write;
  process.stderr.write = (msg) => { captured.push(msg); };
  try {
    // Clear require cache
    delete require.cache[require.resolve(governorCheckPath)];
    const governorCheck = require(governorCheckPath);
    const input = JSON.stringify({ tool_input: { file_path: apexFile } });
    governorCheck.run(input);
  } finally {
    process.stderr.write = origWrite;
    fs.rmSync(tmpDir, { recursive: true });
  }
  return captured.join('');
}

test('governor-check.js: module exists', () => {
  assert.ok(fs.existsSync(governorCheckPath), 'governor-check.js not found');
});

if (fs.existsSync(governorCheckPath)) {
  const governorCheck = require(governorCheckPath);

  test('governor-check.js: exports run function', () => {
    assert.ok(typeof governorCheck.run === 'function', 'Should export run()');
  });

  test('governor-check.js: handles empty input gracefully', () => {
    const result = governorCheck.run('{}');
    assert.ok(typeof result === 'string');
  });

  test('governor-check.js: handles non-Apex file gracefully', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-gov-'));
    const jsFile = path.join(tmpDir, 'test.js');
    fs.writeFileSync(jsFile, 'console.log("hello");');
    try {
      const input = JSON.stringify({ tool_input: { file_path: jsFile } });
      const result = governorCheck.run(input);
      assert.ok(typeof result === 'string');
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  // --- SOQL in loop ---

  test('governor-check.js: detects SOQL in braced loop', () => {
    const output = runOnApex(`
public with sharing class BadClass {
    public void bad() {
        for (Account a : accs) {
            List<Contact> cs = [SELECT Id FROM Contact];
        }
    }
}`);
    assert.ok(output.includes('CRITICAL'), 'Should be CRITICAL');
    assert.ok(output.includes('SOQL query inside loop'), 'Should detect SOQL in loop');
  });

  test('governor-check.js: no false positive on SOQL in comment inside loop', () => {
    const output = runOnApex(`
public with sharing class OkClass {
    public void ok() {
        for (Account a : accs) {
            // [SELECT Id FROM Contact]
            a.Name = 'Test';
        }
    }
}`);
    assert.ok(!output.includes('SOQL query inside loop'), 'Should NOT flag SOQL in comment');
  });

  test('governor-check.js: no false positive on SOQL in string inside loop', () => {
    const output = runOnApex(`
public with sharing class OkClass {
    public void ok() {
        for (Account a : accs) {
            String q = 'SELECT Id FROM Contact';
        }
    }
}`);
    assert.ok(!output.includes('SOQL query inside loop'), 'Should NOT flag SOQL in string');
  });

  test('governor-check.js: detects SOQL after if-block inside loop (regression)', () => {
    const output = runOnApex(`
public with sharing class BadClass {
    public void bad() {
        for (Account a : accs) {
            if (a.Name == null) {
                a.Name = 'Default';
            }
            List<Contact> cs = [SELECT Id FROM Contact];
        }
    }
}`);
    assert.ok(output.includes('SOQL query inside loop'),
      'Should detect SOQL after if-block inside loop');
  });

  // --- SOSL in loop ---

  test('governor-check.js: detects SOSL in loop', () => {
    const output = runOnApex(`
public with sharing class BadClass {
    public void bad() {
        for (Account a : accs) {
            List<List<SObject>> results = [FIND 'test' IN ALL FIELDS];
        }
    }
}`);
    assert.ok(output.includes('SOSL query inside loop'), 'Should detect SOSL in loop');
  });

  // --- DML in loop ---

  test('governor-check.js: detects DML in loop', () => {
    const output = runOnApex(`
public with sharing class BadClass {
    public void bad() {
        for (Account a : accs) {
            insert a;
        }
    }
}`);
    assert.ok(output.includes('DML operation inside loop'), 'Should detect DML in loop');
  });

  // --- Async in loop ---

  test('governor-check.js: detects System.enqueueJob in loop', () => {
    const output = runOnApex(`
public with sharing class BadClass {
    public void bad() {
        for (Account a : accs) {
            System.enqueueJob(new MyQueueable(a));
        }
    }
}`);
    assert.ok(output.includes('enqueueJob'), 'Should detect enqueueJob in loop');
  });

  test('governor-check.js: detects EventBus.publish in loop', () => {
    const output = runOnApex(`
public with sharing class BadClass {
    public void bad() {
        for (Account a : accs) {
            EventBus.publish(new MyEvent__e());
        }
    }
}`);
    assert.ok(output.includes('EventBus.publish'), 'Should detect EventBus.publish in loop');
  });

  test('governor-check.js: detects Messaging.sendEmail in loop', () => {
    const output = runOnApex(`
public with sharing class BadClass {
    public void bad() {
        for (Account a : accs) {
            Messaging.sendEmail(new List<Messaging.SingleEmailMessage>{msg});
        }
    }
}`);
    assert.ok(output.includes('sendEmail'), 'Should detect sendEmail in loop');
  });

  // --- Non-bulkified trigger ---

  test('governor-check.js: detects non-bulkified trigger', () => {
    const output = runOnApex(`
trigger AccountTrigger on Account (before insert) {
    Account acc = Trigger.new[0];
    acc.Name = 'Test';
}`, '.trigger');
    assert.ok(output.includes('Non-bulkified trigger'), 'Should detect Trigger.new[0]');
  });

  // --- Deeply nested loops ---

  test('governor-check.js: warns on deeply nested loops', () => {
    const output = runOnApex(`
public with sharing class DeepClass {
    public void deep() {
        for (Account a : accs) {
            for (Contact c : cs) {
                for (Task t : ts) {
                    System.debug(t);
                }
            }
        }
    }
}`);
    assert.ok(output.includes('nesting depth') || output.includes('CPU time'),
      'Should warn about deep nesting');
  });

  // --- Test class skipping ---

  test('governor-check.js: skips test classes entirely', () => {
    const output = runOnApex(`
@IsTest
public class BadTestClass {
    @IsTest
    static void testBad() {
        for (Account a : accs) {
            List<Contact> cs = [SELECT Id FROM Contact];
            insert a;
        }
    }
}`);
    assert.strictEqual(output, '', 'Should produce no output for test classes');
  });

  // --- Unbounded SOQL ---

  test('governor-check.js: warns on unbounded SOQL on large object', () => {
    const output = runOnApex(`
public with sharing class BigQuery {
    public void query() {
        List<Account> all = [SELECT Id FROM Account];
    }
}`);
    assert.ok(output.includes('without LIMIT') || output.includes('bound result set'),
      'Should warn about unbounded SOQL on large object');
  });

  test('governor-check.js: no unbounded warning when LIMIT present', () => {
    const output = runOnApex(`
public with sharing class OkQuery {
    public void query() {
        List<Account> some = [SELECT Id FROM Account LIMIT 100];
    }
}`);
    assert.ok(!output.includes('without LIMIT') && !output.includes('bound result set'),
      'Should NOT warn when LIMIT is present');
  });
}

console.log(`\ngovernor-check.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
