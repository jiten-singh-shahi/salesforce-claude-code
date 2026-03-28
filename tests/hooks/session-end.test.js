#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const vm = require('vm');
const { spawnSync } = require('child_process');

const pluginRoot = process.env.SCC_PLUGIN_ROOT || path.join(__dirname, '..', '..');
const scriptPath = path.join(pluginRoot, 'scripts', 'hooks', 'session-end.js');

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

  // We need to extract just the function definitions.
  // The file has stdin listeners and process.exit calls at module scope.
  // Extract everything up to the stdin handling.

  const sandbox = {
    require,
    process: {
      cwd: process.cwd,
      env: { ...process.env },
      exit: () => {},
      stdin: { setEncoding: () => {}, on: () => {} },
    },
    console: { log: () => {}, error: () => {} },
    module: { exports: {} },
    __dirname: path.dirname(scriptPath),
    __filename: scriptPath,
  };

  // Extract function definitions before the stdin block
  const stdinBlockIndex = src.indexOf('// Read hook input from stdin');
  if (stdinBlockIndex === -1) throw new Error('Could not find stdin block marker');

  let funcSource = src.substring(0, stdinBlockIndex);
  funcSource = funcSource.replace(/^#!.*\n/, '');
  funcSource = funcSource.replace(/'use strict';\s*\n?/, '');

  // Also extract the functions AFTER the stdin block (runMain, main, buildSummary*, etc.)
  // We need: getSessionMetadata, extractHeaderField, buildSessionHeader, mergeSessionHeader,
  //          buildSummarySection, buildSummaryBlock, escapeRegExp

  const postFunctions = [
    'getSessionMetadata', 'extractHeaderField', 'buildSessionHeader',
    'mergeSessionHeader', 'buildSummarySection', 'buildSummaryBlock', 'escapeRegExp'
  ];

  // Extract each function from the full source
  let extraFuncs = '';
  for (const fnName of postFunctions) {
    const regex = new RegExp(`(function ${fnName}\\s*\\([^)]*\\)\\s*\\{)`, 'g');
    const match = regex.exec(src);
    if (match) {
      // Find the function body by counting braces
      let braceCount = 0;
      const start = match.index;
      let end = start;
      let foundStart = false;
      for (let i = start; i < src.length; i++) {
        if (src[i] === '{') { braceCount++; foundStart = true; }
        if (src[i] === '}') { braceCount--; }
        if (foundStart && braceCount === 0) { end = i + 1; break; }
      }
      extraFuncs += src.substring(start, end) + '\n\n';
    }
  }

  const fullSource = `
    ${funcSource}
    ${extraFuncs}
    module.exports = {
      getSessionsDir, getDateString, getTimeString, getSessionIdShort,
      getProjectName, ensureDir, readFile, writeFile, log,
      extractSessionSummary,
      extractHeaderField, buildSessionHeader, mergeSessionHeader,
      buildSummarySection, buildSummaryBlock, escapeRegExp
    };
  `;

  const script = new vm.Script(fullSource, { filename: 'session-end-extract.js' });
  const context = vm.createContext(sandbox);
  script.runInContext(context);

  return sandbox.module.exports;
}

test('session-end.js: script exists', () => {
  assert.ok(fs.existsSync(scriptPath), 'session-end.js not found');
});

let fns;
try {
  fns = extractFunctions();
} catch {
  fns = null;
}

if (fns) {
  // ── getDateString / getTimeString ──

  test('getDateString: returns YYYY-MM-DD format', () => {
    const result = fns.getDateString();
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(result), `Expected YYYY-MM-DD, got: ${result}`);
  });

  test('getTimeString: returns HH:MM format', () => {
    const result = fns.getTimeString();
    assert.ok(/^\d{2}:\d{2}$/.test(result), `Expected HH:MM, got: ${result}`);
  });

  // ── getSessionIdShort ──

  test('getSessionIdShort: returns 8-char alphanumeric string', () => {
    const id = fns.getSessionIdShort();
    assert.strictEqual(id.length, 8, `Expected length 8, got: ${id.length}`);
    assert.ok(/^[a-z0-9]+$/.test(id), `Expected alphanumeric, got: ${id}`);
  });

  // ── getProjectName ──

  test('getProjectName: returns basename of cwd', () => {
    const result = fns.getProjectName();
    assert.ok(typeof result === 'string');
    assert.ok(result.length > 0);
  });

  // ── getSessionsDir ──

  test('getSessionsDir: returns path ending with .claude/sessions', () => {
    const result = fns.getSessionsDir();
    assert.ok(result.endsWith(path.join('.claude', 'sessions')),
      `Expected path ending with .claude/sessions, got: ${result}`);
  });

  // ── escapeRegExp ──

  test('escapeRegExp: escapes special regex characters', () => {
    assert.strictEqual(fns.escapeRegExp('hello'), 'hello');
    assert.strictEqual(fns.escapeRegExp('a.b'), 'a\\.b');
    assert.strictEqual(fns.escapeRegExp('a*b+c?'), 'a\\*b\\+c\\?');
    assert.strictEqual(fns.escapeRegExp('a[b]c'), 'a\\[b\\]c');
    assert.strictEqual(fns.escapeRegExp('a(b)c'), 'a\\(b\\)c');
    assert.strictEqual(fns.escapeRegExp('$100'), '\\$100');
  });

  // ── readFile / writeFile / ensureDir ──

  test('readFile: returns file content', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-se-'));
    try {
      const f = path.join(tmpDir, 'test.txt');
      fs.writeFileSync(f, 'hello world');
      assert.strictEqual(fns.readFile(f), 'hello world');
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  test('readFile: returns null for non-existent file', () => {
    assert.strictEqual(fns.readFile('/nonexistent/file.txt'), null);
  });

  test('writeFile: writes content to file', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-se2-'));
    try {
      const f = path.join(tmpDir, 'out.txt');
      fns.writeFile(f, 'test content');
      assert.strictEqual(fs.readFileSync(f, 'utf8'), 'test content');
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  test('ensureDir: creates nested directories', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-se3-'));
    try {
      const nested = path.join(tmpDir, 'a', 'b', 'c');
      fns.ensureDir(nested);
      assert.ok(fs.existsSync(nested));
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  // ── extractSessionSummary ──

  test('extractSessionSummary: returns null for non-existent file', () => {
    const result = fns.extractSessionSummary('/nonexistent/transcript.jsonl');
    assert.strictEqual(result, null);
  });

  test('extractSessionSummary: returns null for empty transcript', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-se4-'));
    try {
      const f = path.join(tmpDir, 'transcript.jsonl');
      fs.writeFileSync(f, '');
      const result = fns.extractSessionSummary(f);
      assert.strictEqual(result, null);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  test('extractSessionSummary: extracts user messages', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-se5-'));
    try {
      const f = path.join(tmpDir, 'transcript.jsonl');
      const lines = [
        JSON.stringify({ type: 'user', content: 'Fix the bug' }),
        JSON.stringify({ type: 'user', content: 'Add tests' }),
      ];
      fs.writeFileSync(f, lines.join('\n'));
      const result = fns.extractSessionSummary(f);
      assert.ok(result !== null);
      assert.strictEqual(result.userMessages.length, 2);
      assert.ok(result.userMessages.includes('Fix the bug'));
      assert.ok(result.userMessages.includes('Add tests'));
      assert.strictEqual(result.totalMessages, 2);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  test('extractSessionSummary: extracts user messages from message.content (object form)', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-se5b-'));
    try {
      const f = path.join(tmpDir, 'transcript.jsonl');
      const lines = [
        JSON.stringify({ type: 'user', message: { role: 'user', content: 'Hello from nested' } }),
      ];
      fs.writeFileSync(f, lines.join('\n'));
      const result = fns.extractSessionSummary(f);
      assert.ok(result !== null);
      assert.strictEqual(result.userMessages.length, 1);
      assert.ok(result.userMessages[0].includes('Hello from nested'));
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  test('extractSessionSummary: extracts user messages from array content blocks', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-se5c-'));
    try {
      const f = path.join(tmpDir, 'transcript.jsonl');
      const lines = [
        JSON.stringify({
          role: 'user',
          content: [{ type: 'text', text: 'Block A' }, { type: 'text', text: 'Block B' }],
        }),
      ];
      fs.writeFileSync(f, lines.join('\n'));
      const result = fns.extractSessionSummary(f);
      assert.ok(result !== null);
      assert.strictEqual(result.userMessages.length, 1);
      assert.ok(result.userMessages[0].includes('Block A'));
      assert.ok(result.userMessages[0].includes('Block B'));
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  test('extractSessionSummary: extracts tools used from tool_use entries', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-se6-'));
    try {
      const f = path.join(tmpDir, 'transcript.jsonl');
      const lines = [
        JSON.stringify({ type: 'user', content: 'do something' }),
        JSON.stringify({ type: 'tool_use', tool_name: 'Read', tool_input: {} }),
        JSON.stringify({ type: 'tool_use', tool_name: 'Edit', tool_input: { file_path: '/a/b.js' } }),
      ];
      fs.writeFileSync(f, lines.join('\n'));
      const result = fns.extractSessionSummary(f);
      assert.ok(result !== null);
      assert.ok(result.toolsUsed.includes('Read'));
      assert.ok(result.toolsUsed.includes('Edit'));
      assert.ok(result.filesModified.includes('/a/b.js'));
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  test('extractSessionSummary: extracts tools from assistant message content blocks', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-se6b-'));
    try {
      const f = path.join(tmpDir, 'transcript.jsonl');
      const lines = [
        JSON.stringify({ type: 'user', content: 'fix it' }),
        JSON.stringify({
          type: 'assistant',
          message: {
            content: [
              { type: 'tool_use', name: 'Write', input: { file_path: '/x/y.py' } },
              { type: 'tool_use', name: 'Grep', input: {} },
            ],
          },
        }),
      ];
      fs.writeFileSync(f, lines.join('\n'));
      const result = fns.extractSessionSummary(f);
      assert.ok(result !== null);
      assert.ok(result.toolsUsed.includes('Write'));
      assert.ok(result.toolsUsed.includes('Grep'));
      assert.ok(result.filesModified.includes('/x/y.py'));
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  test('extractSessionSummary: handles unparseable lines gracefully', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-se7-'));
    try {
      const f = path.join(tmpDir, 'transcript.jsonl');
      const lines = [
        'not valid json at all',
        JSON.stringify({ type: 'user', content: 'valid message' }),
        '{broken',
      ];
      fs.writeFileSync(f, lines.join('\n'));
      const result = fns.extractSessionSummary(f);
      assert.ok(result !== null);
      assert.strictEqual(result.userMessages.length, 1);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  test('extractSessionSummary: limits user messages to last 10', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-se8-'));
    try {
      const f = path.join(tmpDir, 'transcript.jsonl');
      const lines = [];
      for (let i = 0; i < 15; i++) {
        lines.push(JSON.stringify({ type: 'user', content: `Message ${i}` }));
      }
      fs.writeFileSync(f, lines.join('\n'));
      const result = fns.extractSessionSummary(f);
      assert.ok(result !== null);
      assert.strictEqual(result.userMessages.length, 10);
      assert.strictEqual(result.totalMessages, 15);
      // Should keep the last 10 (indices 5-14)
      assert.ok(result.userMessages[0].includes('Message 5'));
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  test('extractSessionSummary: truncates long user messages to 200 chars', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-se8b-'));
    try {
      const f = path.join(tmpDir, 'transcript.jsonl');
      const longMsg = 'A'.repeat(300);
      fs.writeFileSync(f, JSON.stringify({ type: 'user', content: longMsg }));
      const result = fns.extractSessionSummary(f);
      assert.ok(result !== null);
      assert.strictEqual(result.userMessages[0].length, 200);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  // ── extractHeaderField ──

  test('extractHeaderField: extracts field from markdown header', () => {
    const header = '# Session: 2026-03-22\n**Date:** 2026-03-22\n**Started:** 10:30\n**Project:** MyApp';
    assert.strictEqual(fns.extractHeaderField(header, 'Date'), '2026-03-22');
    assert.strictEqual(fns.extractHeaderField(header, 'Started'), '10:30');
    assert.strictEqual(fns.extractHeaderField(header, 'Project'), 'MyApp');
  });

  test('extractHeaderField: returns null for missing field', () => {
    const header = '# Session\n**Date:** 2026-03-22';
    assert.strictEqual(fns.extractHeaderField(header, 'Branch'), null);
  });

  // ── buildSessionHeader ──

  test('buildSessionHeader: builds header with all metadata', () => {
    const metadata = { project: 'TestProj', branch: 'main', worktree: '/tmp/test' };
    const header = fns.buildSessionHeader('2026-03-22', '14:30', metadata);
    assert.ok(header.includes('2026-03-22'));
    assert.ok(header.includes('14:30'));
    assert.ok(header.includes('TestProj'));
    assert.ok(header.includes('main'));
    assert.ok(header.includes('/tmp/test'));
  });

  test('buildSessionHeader: preserves existing heading and start time', () => {
    const metadata = { project: 'TestProj', branch: 'main', worktree: '/tmp/test' };
    const existing = '# Custom Heading\n**Date:** 2026-03-20\n**Started:** 09:00';
    const header = fns.buildSessionHeader('2026-03-22', '14:30', metadata, existing);
    assert.ok(header.includes('# Custom Heading'), 'Should preserve existing heading');
    assert.ok(header.includes('**Started:** 09:00'), 'Should preserve start time');
    assert.ok(header.includes('**Last Updated:** 14:30'), 'Should update last updated');
  });

  // ── mergeSessionHeader ──

  test('mergeSessionHeader: merges header with existing content', () => {
    const existing = '# Session: 2026-03-22\n**Date:** 2026-03-22\n**Started:** 10:00\n\n---\n\n## Content Here';
    const metadata = { project: 'Proj', branch: 'dev', worktree: '/tmp' };
    const result = fns.mergeSessionHeader(existing, '2026-03-22', '15:00', metadata);
    assert.ok(result !== null);
    assert.ok(result.includes('**Last Updated:** 15:00'));
    assert.ok(result.includes('## Content Here'));
  });

  test('mergeSessionHeader: returns null when no separator found', () => {
    const result = fns.mergeSessionHeader('no separator here', '2026-03-22', '15:00', {});
    assert.strictEqual(result, null);
  });

  // ── buildSummarySection ──

  test('buildSummarySection: builds markdown summary with tasks', () => {
    const summary = {
      userMessages: ['Fix the login bug', 'Add password validation'],
      toolsUsed: ['Read', 'Edit', 'Grep'],
      filesModified: ['/src/login.js', '/src/validate.js'],
      totalMessages: 2,
    };
    const section = fns.buildSummarySection(summary);
    assert.ok(section.includes('## Session Summary'));
    assert.ok(section.includes('### Tasks'));
    assert.ok(section.includes('Fix the login bug'));
    assert.ok(section.includes('Add password validation'));
    assert.ok(section.includes('### Files Modified'));
    assert.ok(section.includes('/src/login.js'));
    assert.ok(section.includes('### Tools Used'));
    assert.ok(section.includes('Read, Edit, Grep'));
    assert.ok(section.includes('Total user messages: 2'));
  });

  test('buildSummarySection: omits files section when none modified', () => {
    const summary = {
      userMessages: ['Hello'],
      toolsUsed: ['Read'],
      filesModified: [],
      totalMessages: 1,
    };
    const section = fns.buildSummarySection(summary);
    assert.ok(!section.includes('### Files Modified'));
  });

  test('buildSummarySection: omits tools section when none used', () => {
    const summary = {
      userMessages: ['Hello'],
      toolsUsed: [],
      filesModified: [],
      totalMessages: 1,
    };
    const section = fns.buildSummarySection(summary);
    assert.ok(!section.includes('### Tools Used'));
  });

  test('buildSummarySection: escapes backticks in user messages', () => {
    const summary = {
      userMessages: ['Fix the `config` file'],
      toolsUsed: [],
      filesModified: [],
      totalMessages: 1,
    };
    const section = fns.buildSummarySection(summary);
    assert.ok(section.includes('\\`config\\`'), 'Should escape backticks');
  });

  // ── buildSummaryBlock ──

  test('buildSummaryBlock: wraps summary with markers', () => {
    const summary = {
      userMessages: ['Test'],
      toolsUsed: [],
      filesModified: [],
      totalMessages: 1,
    };
    const block = fns.buildSummaryBlock(summary);
    assert.ok(block.startsWith('<!-- SCC:SUMMARY:START -->'));
    assert.ok(block.endsWith('<!-- SCC:SUMMARY:END -->'));
  });
}

// ── Integration tests via child process ──

test('session-end.js: creates session file when given transcript', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-se-int-'));
  const sessionsDir = path.join(tmpDir, '.claude', 'sessions');
  try {
    // Create a transcript file
    const transcriptFile = path.join(tmpDir, 'transcript.jsonl');
    const lines = [
      JSON.stringify({ type: 'user', content: 'Hello world' }),
      JSON.stringify({ type: 'tool_use', tool_name: 'Read', tool_input: {} }),
    ];
    fs.writeFileSync(transcriptFile, lines.join('\n'));

    const input = JSON.stringify({ transcript_path: transcriptFile });
    const result = spawnSync(process.execPath, [scriptPath], {
      input,
      encoding: 'utf8',
      timeout: 15000,
      cwd: tmpDir,
      env: { ...process.env, HOME: tmpDir, PATH: process.env.PATH },
    });

    assert.strictEqual(result.status, 0, `Expected exit 0, got: ${result.status}`);
    assert.ok(fs.existsSync(sessionsDir), 'Should create sessions directory');

    // Check that a session file was created
    const sessionFiles = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.tmp'));
    assert.ok(sessionFiles.length > 0, 'Should create at least one session file');

    // Check file content
    const content = fs.readFileSync(path.join(sessionsDir, sessionFiles[0]), 'utf8');
    assert.ok(content.includes('Hello world') || content.includes('Session'), 'Should contain session data');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('session-end.js: handles invalid JSON stdin gracefully', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-se-int2-'));
  try {
    const result = spawnSync(process.execPath, [scriptPath], {
      input: 'not valid json',
      encoding: 'utf8',
      timeout: 15000,
      cwd: tmpDir,
      env: { ...process.env, HOME: tmpDir, PATH: process.env.PATH },
    });

    assert.strictEqual(result.status, 0, 'Should exit 0 even with invalid input');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('session-end.js: handles empty stdin gracefully', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-se-int3-'));
  try {
    const result = spawnSync(process.execPath, [scriptPath], {
      input: '',
      encoding: 'utf8',
      timeout: 15000,
      cwd: tmpDir,
      env: { ...process.env, HOME: tmpDir, PATH: process.env.PATH },
    });

    assert.strictEqual(result.status, 0, 'Should exit 0 with empty input');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test('session-end.js: handles missing transcript file', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-se-int4-'));
  try {
    const input = JSON.stringify({ transcript_path: '/nonexistent/transcript.jsonl' });
    const result = spawnSync(process.execPath, [scriptPath], {
      input,
      encoding: 'utf8',
      timeout: 15000,
      cwd: tmpDir,
      env: { ...process.env, HOME: tmpDir, PATH: process.env.PATH },
    });

    assert.strictEqual(result.status, 0, 'Should exit 0 with missing transcript');
    const stderr = result.stderr || '';
    assert.ok(stderr.includes('Transcript not found') || stderr.includes('SessionEnd'),
      'Should log warning about missing transcript');
  } finally {
    fs.rmSync(tmpDir, { recursive: true });
  }
});

console.log(`\nsession-end.test.js: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
