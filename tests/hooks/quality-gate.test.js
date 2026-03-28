#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const qualityGatePath = path.join(pluginRoot, 'scripts', 'hooks', 'quality-gate.js');

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
 * Helper: run quality-gate on a temp Apex file and capture stderr output.
 */
function runOnApex(apexCode) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-qg-'));
  const apexFile = path.join(tmpDir, 'TestClass.cls');
  fs.writeFileSync(apexFile, apexCode);
  const captured = [];
  const origWrite = process.stderr.write;
  process.stderr.write = (msg) => { captured.push(msg); };
  try {
    const qualityGate = require(qualityGatePath);
    // Clear require cache to ensure fresh state
    delete require.cache[require.resolve(qualityGatePath)];
    const input = JSON.stringify({ tool_input: { file_path: apexFile } });
    qualityGate.run(input);
  } finally {
    process.stderr.write = origWrite;
    fs.rmSync(tmpDir, { recursive: true });
  }
  return captured.join('');
}

test('quality-gate.js: module exists', () => {
  assert.ok(fs.existsSync(qualityGatePath), 'quality-gate.js not found');
});

if (fs.existsSync(qualityGatePath)) {
  const qualityGate = require(qualityGatePath);

  test('quality-gate.js: exports run function', () => {
    assert.ok(typeof qualityGate.run === 'function', 'Should export run()');
  });

  test('quality-gate.js: handles empty input gracefully', () => {
    const result = qualityGate.run('{}');
    assert.ok(typeof result === 'string', 'Should return string');
  });

  test('quality-gate.js: handles invalid JSON gracefully', () => {
    const result = qualityGate.run('not json');
    assert.ok(typeof result === 'string', 'Should return string even for invalid JSON');
  });

  test('quality-gate.js: detects SOQL inside braced loop', () => {
    const output = runOnApex(`
public class MyService {
    public void bad() {
        for (Account acc : accounts) {
            List<Contact> cs = [SELECT Id FROM Contact];
        }
    }
}`);
    assert.ok(output.includes('SOQL query inside loop'), 'Should detect SOQL in loop');
  });

  test('quality-gate.js: detects DML inside loop', () => {
    const output = runOnApex(`
public class MyService {
    public void bad() {
        for (Account acc : accounts) {
            insert acc;
        }
    }
}`);
    assert.ok(output.includes('DML operation inside loop'), 'Should detect DML in loop');
  });

  test('quality-gate.js: no false positive on SOQL in comment inside loop', () => {
    const output = runOnApex(`
public class MyService {
    public void ok() {
        for (Account acc : accounts) {
            // [SELECT Id FROM Contact]
            acc.Name = 'Test';
        }
    }
}`);
    assert.ok(!output.includes('SOQL query inside loop'), 'Should NOT flag SOQL in comment');
  });

  test('quality-gate.js: if-block closing brace does not exit loop (regression)', () => {
    const output = runOnApex(`
public class MyService {
    public void bad() {
        for (Account acc : accounts) {
            if (acc.Name == null) {
                acc.Name = 'Default';
            }
            List<Contact> cs = [SELECT Id FROM Contact];
        }
    }
}`);
    assert.ok(output.includes('SOQL query inside loop'),
      'Should detect SOQL after if-block inside loop');
  });

  test('quality-gate.js: detects hardcoded IDs', () => {
    const output = runOnApex(`
public class MyService {
    public void bad() {
        String id = '001000000000001';
    }
}`);
    assert.ok(output.includes('Hardcoded Salesforce record ID'), 'Should detect hardcoded ID');
  });

  test('quality-gate.js: detects excessive System.debug', () => {
    const output = runOnApex(`
public class MyService {
    public void debug() {
        System.debug('1');
        System.debug('2');
        System.debug('3');
        System.debug('4');
        System.debug('5');
        System.debug('6');
    }
}`);
    assert.ok(output.includes('System.debug statements found'), 'Should detect excessive debug');
  });

  test('quality-gate.js: detects missing sharing declaration', () => {
    const output = runOnApex(`
public class MyService {
    public void query() {
        List<Account> accs = [SELECT Id FROM Account];
    }
}`);
    assert.ok(output.includes('No sharing declaration'), 'Should detect missing sharing');
  });

  test('quality-gate.js: no sharing warning when sharing is declared', () => {
    const output = runOnApex(`
public with sharing class MyService {
    public void query() {
        List<Account> accs = [SELECT Id FROM Account];
    }
}`);
    assert.ok(!output.includes('No sharing declaration'), 'Should NOT warn when sharing declared');
  });

  test('quality-gate.js: detects without sharing + @AuraEnabled', () => {
    const output = runOnApex(`
public without sharing class MyController {
    @AuraEnabled
    public static List<Account> getAccounts() {
        return [SELECT Id FROM Account];
    }
}`);
    assert.ok(output.includes('privilege escalation'),
      'Should detect without sharing + @AuraEnabled');
  });

  test('quality-gate.js: detects SOQL without USER_MODE', () => {
    const output = runOnApex(`
public with sharing class MyService {
    public void query() {
        List<Account> accs = [SELECT Id FROM Account];
    }
}`);
    assert.ok(output.includes('WITHOUT WITH USER_MODE') || output.includes('without WITH USER_MODE') ||
      output.includes('SOQL query without WITH USER_MODE'),
      'Should warn about missing USER_MODE');
  });

  test('quality-gate.js: no USER_MODE warning when present', () => {
    const output = runOnApex(`
public with sharing class MyService {
    public void query() {
        List<Account> accs = [SELECT Id FROM Account WITH USER_MODE];
    }
}`);
    assert.ok(!output.includes('SOQL query without WITH USER_MODE'),
      'Should NOT warn when USER_MODE present');
  });

  test('quality-gate.js: detects dynamic SOQL', () => {
    const output = runOnApex(`
public with sharing class MyService {
    public void query(String s) {
        Database.query(s);
    }
}`);
    assert.ok(output.includes('Dynamic SOQL'), 'Should detect dynamic SOQL');
  });

  test('quality-gate.js: skips security checks for test classes', () => {
    const output = runOnApex(`
@IsTest
public class MyServiceTest {
    @IsTest
    static void testQuery() {
        List<Account> accs = [SELECT Id FROM Account];
        insert accs;
    }
}`);
    assert.ok(!output.includes('No sharing declaration'),
      'Should skip sharing check for test classes');
    assert.ok(!output.includes('Dynamic SOQL'),
      'Should skip dynamic SOQL check for test classes');
  });
}

console.log(`\nquality-gate.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
