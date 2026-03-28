#!/usr/bin/env node
'use strict';

/**
 * agent-adapter.test.js — Unit tests for scripts/lib/agent-adapter.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { transformAgent, transformAgentFile, CURSOR_ALLOWED_FIELDS, MODEL_MAP } = require('../../scripts/lib/agent-adapter');
const { parseFrontmatter } = require('../../scripts/lib/utils');

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

// ── transformAgent tests ──────────────────────────────────────────────────────

test('transformAgent: keeps name and description', () => {
  const input = `---\nname: sf-planner\ndescription: Expert planner for Salesforce\ntools: ["Read", "Grep"]\nmodel: sonnet\norigin: SCC\n---\nYou are an expert planner.`;
  const output = transformAgent(input);
  const { frontmatter } = parseFrontmatter(output);
  assert.strictEqual(frontmatter.name, 'sf-planner');
  assert.strictEqual(frontmatter.description, 'Expert planner for Salesforce');
});

test('transformAgent: maps model sonnet to inherit', () => {
  const input = `---\nname: test\ndescription: Test agent\nmodel: sonnet\n---\nPrompt`;
  const output = transformAgent(input);
  const { frontmatter } = parseFrontmatter(output);
  assert.strictEqual(frontmatter.model, 'inherit');
});

test('transformAgent: maps model opus to inherit', () => {
  const input = `---\nname: test\ndescription: Test agent\nmodel: opus\n---\nPrompt`;
  const output = transformAgent(input);
  const { frontmatter } = parseFrontmatter(output);
  assert.strictEqual(frontmatter.model, 'inherit');
});

test('transformAgent: maps model haiku to fast', () => {
  const input = `---\nname: test\ndescription: Test agent\nmodel: haiku\n---\nPrompt`;
  const output = transformAgent(input);
  const { frontmatter } = parseFrontmatter(output);
  assert.strictEqual(frontmatter.model, 'fast');
});

test('transformAgent: passes through full model IDs unchanged', () => {
  const input = `---\nname: test\ndescription: Test agent\nmodel: claude-sonnet-4-6\n---\nPrompt`;
  const output = transformAgent(input);
  const { frontmatter } = parseFrontmatter(output);
  assert.strictEqual(frontmatter.model, 'claude-sonnet-4-6');
});

test('transformAgent: passes through inherit unchanged', () => {
  const input = `---\nname: test\ndescription: Test agent\nmodel: inherit\n---\nPrompt`;
  const output = transformAgent(input);
  const { frontmatter } = parseFrontmatter(output);
  assert.strictEqual(frontmatter.model, 'inherit');
});

test('transformAgent: strips tools field', () => {
  const input = `---\nname: test\ndescription: Test agent\ntools: ["Read", "Write", "Bash"]\nmodel: sonnet\n---\nPrompt`;
  const output = transformAgent(input);
  const { frontmatter } = parseFrontmatter(output);
  assert.strictEqual(frontmatter.tools, undefined);
});

test('transformAgent: strips origin field', () => {
  const input = `---\nname: test\ndescription: Test agent\norigin: SCC\nmodel: sonnet\n---\nPrompt`;
  const output = transformAgent(input);
  const { frontmatter } = parseFrontmatter(output);
  assert.strictEqual(frontmatter.origin, undefined);
});

test('transformAgent: strips Claude-only advanced fields', () => {
  const input = `---\nname: test\ndescription: Test agent\ndisallowedTools: Write\npermissionMode: plan\nmaxTurns: 10\nskills: api-conventions\nmcpServers: github\nhooks: something\nmemory: user\neffort: high\nisolation: worktree\ninitialPrompt: hello\n---\nPrompt`;
  const output = transformAgent(input);
  const { frontmatter } = parseFrontmatter(output);
  assert.strictEqual(frontmatter.disallowedTools, undefined);
  assert.strictEqual(frontmatter.permissionMode, undefined);
  assert.strictEqual(frontmatter.maxTurns, undefined);
  assert.strictEqual(frontmatter.skills, undefined);
  assert.strictEqual(frontmatter.mcpServers, undefined);
  assert.strictEqual(frontmatter.hooks, undefined);
  assert.strictEqual(frontmatter.memory, undefined);
  assert.strictEqual(frontmatter.effort, undefined);
  assert.strictEqual(frontmatter.isolation, undefined);
  assert.strictEqual(frontmatter.initialPrompt, undefined);
});

test('transformAgent: preserves Cursor-native fields', () => {
  const input = `---\nname: test\ndescription: Test agent\nreadonly: true\nis_background: false\nmodel: sonnet\n---\nPrompt`;
  const output = transformAgent(input);
  const { frontmatter } = parseFrontmatter(output);
  assert.strictEqual(frontmatter.readonly, 'true');
  assert.strictEqual(frontmatter.is_background, 'false');
});

test('transformAgent: body/system prompt passes through unchanged', () => {
  const body = 'You are an expert Salesforce Apex code reviewer.\n\n## Severity Matrix\n\n| Level | Description |\n|-------|-------------|\n| CRITICAL | Must fix |';
  const input = `---\nname: test\ndescription: Test\nmodel: sonnet\n---\n${body}`;
  const output = transformAgent(input);
  const { body: outputBody } = parseFrontmatter(output);
  assert.strictEqual(outputBody, body);
});

test('transformAgent: handles content with no frontmatter', () => {
  const input = '# Just an agent without frontmatter\n\nSome instructions.';
  const output = transformAgent(input);
  assert.strictEqual(output, input);
});

// ── transformAgentFile tests ──────────────────────────────────────────────────

test('transformAgentFile: transforms and writes file', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scc-agent-adapter-'));
  const srcPath = path.join(tmpDir, 'test-agent.md');
  const destPath = path.join(tmpDir, 'output', 'test-agent.md');

  fs.writeFileSync(srcPath, '---\nname: test-agent\ndescription: A test agent for validation\ntools: ["Read", "Grep"]\nmodel: sonnet\norigin: SCC\n---\nYou are a test agent.');

  transformAgentFile(srcPath, destPath);

  assert.ok(fs.existsSync(destPath));
  const content = fs.readFileSync(destPath, 'utf8');
  const { frontmatter } = parseFrontmatter(content);
  assert.strictEqual(frontmatter.name, 'test-agent');
  assert.strictEqual(frontmatter.model, 'inherit');
  assert.strictEqual(frontmatter.tools, undefined);
  assert.strictEqual(frontmatter.origin, undefined);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('transformAgentFile: throws for missing source file', () => {
  assert.throws(() => {
    transformAgentFile('/nonexistent/agent.md', '/tmp/dest.md');
  }, /Source agent file not found/);
});

// ── Constants tests ────────────────────────────────────────────────────────────

test('CURSOR_ALLOWED_FIELDS: includes expected fields', () => {
  assert.ok(CURSOR_ALLOWED_FIELDS.has('name'));
  assert.ok(CURSOR_ALLOWED_FIELDS.has('description'));
  assert.ok(CURSOR_ALLOWED_FIELDS.has('model'));
  assert.ok(CURSOR_ALLOWED_FIELDS.has('readonly'));
  assert.ok(CURSOR_ALLOWED_FIELDS.has('is_background'));
});

test('MODEL_MAP: maps Claude aliases correctly', () => {
  assert.strictEqual(MODEL_MAP.sonnet, 'inherit');
  assert.strictEqual(MODEL_MAP.opus, 'inherit');
  assert.strictEqual(MODEL_MAP.haiku, 'fast');
});

// ── Report ─────────────────────────────────────────────────────────────────────

console.log(`\nAgent adapter tests: ${passCount} passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
