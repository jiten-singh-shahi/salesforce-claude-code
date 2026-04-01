#!/usr/bin/env node
'use strict';

/**
 * validate-agents.js — CI validator for agents/ directory.
 *
 * Validates every .md agent file for:
 *   - name        (string, must match filename stem)
 *   - description (100–250 chars, ≥3 SF keywords, "Use when" clause)
 *   - tools       (array, readonly consistency)
 *   - model       (one of: opus, sonnet, haiku, inherit)
 *   - origin      (required, must be "SCC")
 *   - body        (## When to Use, ## Workflow, ≥2 steps, escalation for write agents)
 *   - plugin restrictions (no hooks, permissionMode, mcpServers, initialPrompt)
 *   - folder-level checks (context budget, redundancy, orphaned skills)
 */

const fs = require('fs');
const path = require('path');
const { parseFrontmatter, parseBool, getPluginRoot, listFilesRecursive } = require('../lib/utils');

// ── Config ────────────────────────────────────────────────────────────────────

const MIN_DESCRIPTION_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 250;
const MIN_SF_KEYWORDS = 3;
const MIN_BODY_LENGTH = 50;
const BUDGET_WARN_CHARS = 12000;
const BUDGET_ERROR_CHARS = 15000;

const VALID_MODELS = new Set(['opus', 'sonnet', 'haiku', 'inherit']);
const VALID_EFFORTS = new Set(['low', 'medium', 'high', 'max']);
const VALID_MEMORY = new Set(['user', 'project', 'local']);
const DESTRUCTIVE_TOOLS = new Set(['write', 'edit', 'bash', 'multiedit']);
const PLUGIN_RESTRICTED = ['hooks', 'permissionMode', 'mcpServers', 'initialPrompt'];

const SF_KEYWORDS = [
  'apex', 'trigger', 'batch', 'queueable', 'schedulable', 'future method',
  'lwc', 'aura', 'visualforce', 'flow', 'process builder',
  'soql', 'sosl', 'dml', 'upsert', 'sobject',
  'governor limit', 'crud', 'fls', 'sharing', 'permission',
  'custom metadata', 'custom settings', 'platform event',
  'deploy', 'sandbox', 'scratch org', 'changeset', 'package',
  'sf cli', 'metadata api', 'salesforce', 'org', 'namespace',
  'apex class', 'test class', 'test coverage',
  'agentforce', 'einstein', 'data cloud', 'data 360', 'agent action',
  'prompt template', 'trust layer', 'mcp', 'rag', 'vector',
  'mulesoft', 'heroku',
];

// ── Setup ─────────────────────────────────────────────────────────────────────

const pluginRoot = getPluginRoot();
const agentsDir = path.join(pluginRoot, 'agents');
const skillsDir = path.join(pluginRoot, 'skills');

const errors = [];
const warnings = [];
let validCount = 0;
let totalCount = 0;

function err(label, msg) { errors.push(`  [FAIL] ${label}: ${msg}`); }
function warn(label, msg) { warnings.push(`  [WARN] ${label}: ${msg}`); }

function countSFKeywords(text) {
  const lower = text.toLowerCase();
  return SF_KEYWORDS.filter(kw => lower.includes(kw)).length;
}

// ── Load available skills ────────────────────────────────────────────────────

function loadAvailableSkills() {
  const skills = new Set();
  if (!fs.existsSync(skillsDir)) return skills;
  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name !== '_reference') {
      const skillMd = path.join(skillsDir, entry.name, 'SKILL.md');
      if (fs.existsSync(skillMd)) skills.add(entry.name);
    }
  }
  return skills;
}

// ── Agent validator ──────────────────────────────────────────────────────────

function validateAgent(filePath, availableSkills) {
  const relPath = path.relative(pluginRoot, filePath);
  let content;
  totalCount++;

  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    err(relPath, `Cannot read file — ${e.message}`);
    return;
  }

  const { frontmatter, body } = parseFrontmatter(content);
  const fileErrors = [];

  if (!frontmatter || Object.keys(frontmatter).length === 0) {
    fileErrors.push('missing YAML frontmatter');
    for (const e of fileErrors) err(relPath, e);
    return;
  }

  // ── name ──────────────────────────────────────────────────────────────────
  const name = frontmatter.name ? String(frontmatter.name).trim() : '';
  const stem = path.basename(filePath, '.md');
  if (!name) {
    fileErrors.push('frontmatter.name is required and must be non-empty');
  } else if (name !== stem) {
    fileErrors.push(`frontmatter.name "${name}" must match filename "${stem}"`);
  }

  // ── description ───────────────────────────────────────────────────────────
  const desc = frontmatter.description ? String(frontmatter.description).trim() : '';
  if (!desc) {
    fileErrors.push('frontmatter.description is required');
  } else if (/^[>|]-?$/.test(desc)) {
    fileErrors.push(
      `description parsed as YAML block indicator "${desc}" — ` +
      'check >- block scalar indentation'
    );
  } else {
    if (desc.length < MIN_DESCRIPTION_LENGTH) {
      fileErrors.push(
        `description too short: ${desc.length} chars (minimum ${MIN_DESCRIPTION_LENGTH}). ` +
        'Add WHEN + WHEN NOT clauses with Salesforce keywords.'
      );
    }
    if (desc.length > MAX_DESCRIPTION_LENGTH) {
      fileErrors.push(
        `description too long: ${desc.length} chars (maximum ${MAX_DESCRIPTION_LENGTH}). ` +
        'Shorten the WHEN + WHEN NOT contract.'
      );
    }

    const kwCount = countSFKeywords(desc);
    if (kwCount < MIN_SF_KEYWORDS) {
      fileErrors.push(
        `description has ${kwCount} Salesforce keyword(s) — need at least ${MIN_SF_KEYWORDS}. ` +
        'Include terms like: Apex, SOQL, DML, governor limit, LWC, trigger, Agentforce, etc.'
      );
    }

    if (!/\buse\s+(?:proactively\s+)?when\b|\bwhen\s+(you|the|a|an|user)\b/i.test(desc)) {
      fileErrors.push(
        'description missing WHEN clause — add "Use when [trigger conditions]"'
      );
    }

    if (!/do not|don't|not for|except|excluding/i.test(desc)) {
      warn(relPath, 'description missing WHEN NOT clause — add "Do NOT use for [exclusions]"');
    }

    // Claude Code auto-delegates based on description. "Use proactively"
    // encourages auto-delegation without the user explicitly asking.
    if (!/\buse proactively\b/i.test(desc)) {
      warn(relPath,
        'description missing PROACTIVE clause — add "Use PROACTIVELY when [trigger]" ' +
        'to enable auto-delegation by Claude Code'
      );
    }
  }

  // ── origin ────────────────────────────────────────────────────────────────
  const origin = frontmatter.origin ? String(frontmatter.origin).trim() : '';
  if (!origin) {
    fileErrors.push('frontmatter.origin is required — must be "SCC"');
  } else if (origin.toUpperCase() !== 'SCC') {
    fileErrors.push(`frontmatter.origin is "${origin}" — must be "SCC"`);
  }

  // ── model ─────────────────────────────────────────────────────────────────
  if (!frontmatter.model || String(frontmatter.model).trim() === '') {
    fileErrors.push('frontmatter.model is required');
  } else {
    const model = String(frontmatter.model).trim().toLowerCase();
    if (!VALID_MODELS.has(model)) {
      fileErrors.push(
        `frontmatter.model "${frontmatter.model}" invalid — ` +
        `must be one of: ${[...VALID_MODELS].sort().join(', ')}`
      );
    }
  }

  // ── tools ─────────────────────────────────────────────────────────────────
  let toolsList = [];
  if (frontmatter.tools === undefined || frontmatter.tools === null || frontmatter.tools === '') {
    fileErrors.push('frontmatter.tools is required (must be an array)');
  } else if (!Array.isArray(frontmatter.tools)) {
    fileErrors.push(`frontmatter.tools must be an array (got: ${JSON.stringify(frontmatter.tools)})`);
  } else {
    toolsList = frontmatter.tools.map(t => String(t).trim().toLowerCase());
    if (toolsList.length === 0) {
      warn(relPath, 'frontmatter.tools is an empty array');
    }
  }

  // ── readonly vs tools consistency ─────────────────────────────────────────
  // readonly means no file writes — Bash is allowed (used for diagnostics/scanners)
  const FILE_WRITE_TOOLS = new Set(['write', 'edit', 'multiedit']);
  const readonly = parseBool(frontmatter.readonly);
  const hasFileWriteTools = toolsList.some(t => FILE_WRITE_TOOLS.has(t));
  if (readonly === true && hasFileWriteTools) {
    const writeTools = toolsList.filter(t => FILE_WRITE_TOOLS.has(t));
    fileErrors.push(
      `readonly: true but tools includes file-write tools: [${writeTools.join(', ')}]`
    );
  }

  // ── maxTurns ──────────────────────────────────────────────────────────────
  const maxTurns = frontmatter.maxTurns;
  if (maxTurns !== undefined) {
    const mt = parseInt(String(maxTurns), 10);
    if (isNaN(mt)) {
      fileErrors.push(`maxTurns must be an integer (got: "${maxTurns}")`);
    } else if (mt < 5 || mt > 50) {
      warn(relPath, `maxTurns ${mt} is outside recommended range 5–50`);
    }
  }

  // ── effort ────────────────────────────────────────────────────────────────
  const effort = frontmatter.effort ? String(frontmatter.effort).trim() : '';
  if (effort && !VALID_EFFORTS.has(effort)) {
    fileErrors.push(`effort "${effort}" invalid — must be one of: ${[...VALID_EFFORTS].sort().join(', ')}`);
  }

  // ── memory ────────────────────────────────────────────────────────────────
  const memory = frontmatter.memory ? String(frontmatter.memory).trim() : '';
  if (memory && !VALID_MEMORY.has(memory)) {
    fileErrors.push(`memory "${memory}" invalid — must be one of: ${[...VALID_MEMORY].sort().join(', ')}`);
  }

  // ── skills list — validate every name exists ──────────────────────────────
  let skillsList = [];
  const skillsRaw = frontmatter.skills;
  if (skillsRaw) {
    if (Array.isArray(skillsRaw)) {
      skillsList = skillsRaw.map(s => String(s).trim()).filter(Boolean);
    } else if (typeof skillsRaw === 'string') {
      skillsList = skillsRaw.split(',').map(s => s.trim()).filter(Boolean);
    }
  }

  for (const skillName of skillsList) {
    if (availableSkills.size > 0 && !availableSkills.has(skillName)) {
      fileErrors.push(
        `skills: references "${skillName}" but this skill does not exist in skills/`
      );
    }
  }

  // ── plugin restrictions ───────────────────────────────────────────────────
  for (const restricted of PLUGIN_RESTRICTED) {
    if (frontmatter[restricted] !== undefined) {
      fileErrors.push(`plugin agent cannot define "${restricted}" in frontmatter`);
    }
  }

  // ── body ──────────────────────────────────────────────────────────────────
  const bodyText = body || '';
  const bodyLines = bodyText.split('\n').length;

  if (bodyText.trim().length < MIN_BODY_LENGTH) {
    fileErrors.push('agent body too short — must have meaningful content');
  }
  if (bodyLines > 500) {
    fileErrors.push(`body is ${bodyLines} lines — exceeds 500-line limit`);
  } else if (bodyLines > 350) {
    warn(relPath, `body is ${bodyLines} lines — approaching 500-line limit`);
  }

  // ── required sections ─────────────────────────────────────────────────────
  if (!/##\s*when to use/i.test(bodyText)) {
    fileErrors.push('missing "## When to Use" section');
  }

  if (!/##\s*(workflow|coordination plan|analysis process)/i.test(bodyText)) {
    fileErrors.push(
      'missing "## Workflow" / "## Coordination Plan" / "## Analysis Process" section'
    );
  }

  // ── step count — agents must have ≥2 steps ───────────────────────────────
  const stepPattern = /###\s+(?:(?:step|phase)\s+\d|\d+[.\-–]\s*\S|\d+\s+[-–]\s+\S)/gi;
  const stepMatches = bodyText.match(stepPattern) || [];
  if (stepMatches.length < 2) {
    fileErrors.push(
      'agent has fewer than 2 declared steps — single-step workflows should be skills, not agents'
    );
  }

  // ── escalation section required for file-writing agents ────────────────────
  if (hasFileWriteTools) {
    if (!/##\s*escalation/i.test(bodyText)) {
      fileErrors.push(
        'file-writing agent (has Write/Edit tools) must have "## Escalation" section'
      );
    }
  }

  // ── inspector-specific ────────────────────────────────────────────────────
  if (name && name.toLowerCase().includes('inspector')) {
    if (readonly !== true) {
      warn(relPath, 'inspector agent should have readonly: true');
    }
    if (hasFileWriteTools) {
      fileErrors.push('inspector agent must not have write tools — inspectors are read-only');
    }
  }

  // ── constraint language in body ───────────────────────────────────────────
  if (/\b(never write|never use|always use|always write|prohibited|forbidden)\b/i.test(bodyText)) {
    warn(relPath, 'agent body contains constraint language — move to a constraint skill');
  }

  // ── Related section ───────────────────────────────────────────────────────
  if (!/##\s*related/i.test(bodyText)) {
    warn(relPath, 'no "## Related" section — add links to related agents and skills');
  }

  // ── Finalise ──────────────────────────────────────────────────────────────
  if (fileErrors.length > 0) {
    for (const e of fileErrors) err(relPath, e);
  } else {
    validCount++;
  }
}

// ── Folder-level checks ──────────────────────────────────────────────────────

function checkContextBudget() {
  const files = listFilesRecursive(agentsDir).filter(f => f.endsWith('.md'));
  let total = 0;
  const breakdown = [];

  for (const f of files) {
    const content = fs.readFileSync(f, 'utf8');
    const { frontmatter } = parseFrontmatter(content);
    const descLen = frontmatter.description ? String(frontmatter.description).length : 0;
    total += descLen;
    breakdown.push({ name: path.basename(f, '.md'), chars: descLen });
  }

  const label = 'agents/ (context budget)';
  if (total >= BUDGET_ERROR_CHARS) {
    err(label, `Total description size is ${total} chars — exceeds ${BUDGET_ERROR_CHARS} limit`);
  } else if (total >= BUDGET_WARN_CHARS) {
    warn(label, `Total description size is ${total} chars (warn: ${BUDGET_WARN_CHARS}, limit: ${BUDGET_ERROR_CHARS})`);
  } else {
    warnings.push(`  [INFO] Context budget: ${total} chars used of ~${BUDGET_ERROR_CHARS} (${Math.round(total / BUDGET_ERROR_CHARS * 100)}%)`);
  }

  for (const { name: n, chars } of breakdown) {
    if (chars > MAX_DESCRIPTION_LENGTH) {
      warn(`agents/${n}.md`, `description is ${chars} chars — must be under ${MAX_DESCRIPTION_LENGTH}`);
    }
  }
}

function checkRedundancy() {
  const files = listFilesRecursive(agentsDir).filter(f => f.endsWith('.md'));
  const agents = [];

  for (const f of files) {
    const content = fs.readFileSync(f, 'utf8');
    const { frontmatter } = parseFrontmatter(content);
    const desc = frontmatter.description ? String(frontmatter.description).toLowerCase() : '';
    if (desc) agents.push({ name: path.basename(f, '.md'), desc });
  }

  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
      const wordsA = new Set(agents[i].desc.split(/\s+/));
      const wordsB = new Set(agents[j].desc.split(/\s+/));
      const intersection = [...wordsA].filter(w => wordsB.has(w)).length;
      const overlap = intersection / Math.min(wordsA.size, wordsB.size);
      if (overlap > 0.6) {
        warn('agents/',
          `"${agents[i].name}" and "${agents[j].name}" have ${Math.round(overlap * 100)}% description overlap — check for redundancy`
        );
      }
    }
  }
}

// ── Run ──────────────────────────────────────────────────────────────────────

if (!fs.existsSync(agentsDir)) {
  console.error(`[ERROR] agents/ directory not found at: ${agentsDir}`);
  process.exit(1);
}

const availableSkills = loadAvailableSkills();
const files = listFilesRecursive(agentsDir).filter(f => f.endsWith('.md'));

if (files.length === 0) {
  console.warn('[WARN] No .md files found in agents/');
  process.exit(0);
}

checkContextBudget();
checkRedundancy();

for (const filePath of files) {
  validateAgent(filePath, availableSkills);
}

// ── Report ───────────────────────────────────────────────────────────────────

const divider = '─'.repeat(60);

if (warnings.length > 0) {
  console.log(`\n${divider}\nWARNINGS (${warnings.length})\n${divider}`);
  for (const w of warnings) console.warn(w);
}

if (errors.length > 0) {
  console.log(`\n${divider}\nFAILURES (${errors.length})\n${divider}`);
  for (const e of errors) console.error(e);
  console.log(`\n${divider}`);
  console.error(`FAILED — ${errors.length} error(s), ${validCount}/${totalCount} passed`);
  console.log(divider);
  process.exit(1);
}

console.log(`\n${divider}`);
console.log(`Agent validation PASSED — ${validCount}/${totalCount} agent(s) validated.`);
if (warnings.length > 0) console.log(`${warnings.length} warning(s) to address before next release`);
console.log(divider);
process.exit(0);
