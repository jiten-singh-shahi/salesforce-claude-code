#!/usr/bin/env node
'use strict';

/**
 * validate-skills.js — CI validator for the target skill folder.
 *
 * Validates three kinds of content:
 *
 *   A) Reference files  <targetSkillFolder>/_reference/*.md
 *      - Must NOT have YAML frontmatter
 *      - Must be tabular facts (not prose)
 *
 *   B) Constraint skills  <targetSkillFolder>/sf-*-constraints/SKILL.md
 *      - Auto-activating only (user-invocable must be false/absent)
 *      - Must reference at least one _reference/ file
 *      - Must contain "Never Do" or "Always Do" section
 *      - Must NOT contain procedural how-to content
 *
 *   C) Action skills  <targetSkillFolder>/sf-[name]/SKILL.md
 *      - May be user-invocable
 *      - Should reference relevant constraint skill
 *      - Must contain a checklist or workflow
 *
 * Also validates every skill for:
 * - description: 50+ chars, 3+ SF keywords, WHEN clause, WHEN NOT clause
 * - DRY integrity: no inline governor limits, API versions, naming rules
 * - origin: SCC present
 * - @reference file integrity (referenced files must exist)
 * - Context budget across all skill descriptions
 * - Co-activation pairing (constraint ↔ action)
 *
 * Usage:
 *   node scripts/validate-skills.js --skills-dir <targetSkillFolder>
 *
 * --skills-dir is REQUIRED. No default is assumed.
 */

const fs = require('fs');
const path = require('path');
const { parseFrontmatter, parseBool, getPluginRoot } = require('../lib/utils');

// ── Args ──────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  let targetSkillFolder = 'skills';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--skills-dir' && args[i + 1]) {
      targetSkillFolder = args[i + 1];
      i++;
    }
  }

  return { targetSkillFolder };
}

// ── Config ────────────────────────────────────────────────────────────────────

const MIN_DESCRIPTION_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 250;
const MIN_SF_KEYWORDS = 3;
const MIN_BODY_LENGTH = 50;
const BUDGET_WARN_CHARS = 12000;  // 75% of ~16K — warn
const BUDGET_ERROR_CHARS = 15000;  // 94% — skills will be excluded from context

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
];

const DRY_VIOLATIONS = [
  {
    pattern: /\b(100|150|200|6\s*mb|6144|10[,\s]?000)\s*(soql|dml|queries|statements|heap|cpu)/i,
    message: 'Inline governor limit number — move to _reference/APEX_GOVERNOR_LIMITS.md and use @APEX_GOVERNOR_LIMITS.md',
  },
  {
    pattern: /api\s+v\d+\.\d+|version\s+\d{2,3}\.\d/i,
    message: 'Inline API version — move to _reference/API_VERSIONS.md and use @API_VERSIONS.md',
  },
  {
    pattern: /must\s+(start|end|begin)\s+with\s+["'`]?\w/i,
    message: 'Possible inline naming rule — if this is a Salesforce naming convention, move to _reference/APEX_NAMING_CONVENTIONS.md',
  },
];

// ── Setup ─────────────────────────────────────────────────────────────────────

const { targetSkillFolder } = parseArgs();

const pluginRoot = getPluginRoot();
const targetSkillDir = path.join(pluginRoot, targetSkillFolder);
const referenceDir = path.join(targetSkillDir, '_reference');

const errors = [];
const warnings = [];
let passed = 0;
let total = 0;

// ── Helpers ───────────────────────────────────────────────────────────────────

function err(label, msg) { errors.push(`  [FAIL] ${label}: ${msg}`); }
function warn(label, msg) { warnings.push(`  [WARN] ${label}: ${msg}`); }
function ok() { passed++; }

function relPath(p) { return path.relative(pluginRoot, p); }

function countSFKeywords(text) {
  const lower = text.toLowerCase();
  return SF_KEYWORDS.filter(kw => lower.includes(kw)).length;
}

function detectSkillType(name, body) {
  if (name && name.includes('-constraints')) return 'constraint';
  if (body && /^##\s+(never do|always do|never rules|prohibited|required)\b/im.test(body)) return 'constraint';
  return 'action';
}

// ── Reference file validator ──────────────────────────────────────────────────

function validateReferenceFile(file) {
  const label = relPath(file);
  const content = fs.readFileSync(file, 'utf8');
  total++;

  if (content.trimStart().startsWith('---')) {
    err(label, 'reference files must NOT have YAML frontmatter — remove the --- block');
    return;
  }

  if (!/^#\s+\S/m.test(content)) {
    err(label, 'reference file must start with a # heading');
    return;
  }

  if (!/\|.+\|.+\|/m.test(content)) {
    warn(label, 'reference file has no tables — facts should be in tabular format');
  }

  if (!/last verified/i.test(content)) {
    warn(label, 'missing "Last verified:" stamp — add so consumers know when facts were checked');
  }

  if (/⚠️\s*UNVERIFIED/i.test(content)) {
    warn(label, 'marked UNVERIFIED — manual review required before shipping');
  }

  ok();
}

// ── SKILL.md validator ────────────────────────────────────────────────────────

function validateSkill(skillDir, file) {
  const label = relPath(file);
  const content = fs.readFileSync(file, 'utf8');
  const { frontmatter, body } = parseFrontmatter(content);
  const fileErrors = [];
  total++;

  // ── name ──────────────────────────────────────────────────────────────────
  const name = frontmatter.name ? String(frontmatter.name).trim() : '';
  if (!name) {
    fileErrors.push('frontmatter.name is required and must be non-empty');
  } else {
    const dirName = path.basename(skillDir);
    if (name !== dirName) {
      fileErrors.push(`frontmatter.name "${name}" must match directory name "${dirName}"`);
    }
    if (!/^sf-/.test(name) && !['checkpoint', 'blueprint', 'deep-research', 'skill-architect'].includes(name)) {
      warn(label, `name "${name}" does not use sf- prefix — Salesforce skills must use sf- prefix`);
    }
  }

  // ── description ───────────────────────────────────────────────────────────
  const desc = frontmatter.description ? String(frontmatter.description).trim() : '';
  if (!desc) {
    fileErrors.push('frontmatter.description is required');
  } else if (/^[>|]-?$/.test(desc)) {
    fileErrors.push(
      `description parsed as YAML block indicator "${desc}" — ` +
      'ensure lib/utils.js parseFrontmatter handles >- block scalars correctly'
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

    if (!/\buse when\b|\bwhen\s+(you|the|a|an|user)\b/i.test(desc)) {
      fileErrors.push(
        'description missing WHEN clause — add "Use when [trigger conditions]"'
      );
    }

    if (!/do not|don\'t|not for|except|excluding/i.test(desc)) {
      warn(label, 'description missing WHEN NOT clause — add "Do NOT use for [exclusions]"');
    }
  }

  // ── origin ────────────────────────────────────────────────────────────────
  const origin = frontmatter.origin ? String(frontmatter.origin).trim() : '';
  if (!origin) {
    fileErrors.push('frontmatter.origin is required — must be "SCC"');
  } else if (origin.toUpperCase() !== 'SCC') {
    fileErrors.push(`frontmatter.origin is "${origin}" — must be "SCC"`);
  }

  // ── user-invocable ────────────────────────────────────────────────────────
  const userInvocableRaw = frontmatter['user-invocable'];
  const userInvocable = parseBool(userInvocableRaw);
  if (userInvocableRaw !== undefined && userInvocable === undefined) {
    fileErrors.push(`frontmatter.user-invocable must be true or false (got: "${userInvocableRaw}")`);
  }

  // ── body ──────────────────────────────────────────────────────────────────
  if (!body || body.trim().length < MIN_BODY_LENGTH) {
    fileErrors.push('skill body is too short — must have meaningful content');
  }
  if (body && !/##\s*when to use/i.test(body)) {
    fileErrors.push('"## When to Use" section is required');
  }

  // ── skill type checks ─────────────────────────────────────────────────────
  const skillType = detectSkillType(name, body);

  if (skillType === 'constraint') {
    if (userInvocable === true) {
      fileErrors.push('constraint skill must NOT be user-invocable — remove user-invocable: true');
    }
    if (body && !/@(\.\.\/(_reference\/)?)?[A-Z_]+\.md/.test(body)) {
      fileErrors.push(
        'constraint skill has no @reference file usage — ' +
        'must reference at least one _reference/*.md file (e.g. @../_reference/FILE.md or @FILE.md)'
      );
    }
    if (body && !/##\s*(never|always|constraints|prohibited|required)/i.test(body)) {
      warn(label, 'constraint skill should have "## Never Do" or "## Always Do" sections');
    }
    if (body && /##\s*(workflow|step \d|how to|procedure|implementation)/i.test(body)) {
      warn(label, 'constraint skill appears to contain procedural content — move to a matching action skill');
    }
  }

  if (skillType === 'action') {
    if (body && /\b(never write|never use|always use|always write|prohibited|forbidden)\b/i.test(body)) {
      warn(label, 'action skill contains constraint language — move to a constraint skill and reference it');
    }
    if (body && !/- \[[ x]\]|##\s*(checklist|workflow|steps)/i.test(body)) {
      warn(label, 'action skill has no checklist or workflow section');
    }
  }

  // ── allowed-tools ─────────────────────────────────────────────────────────
  const allowedTools = frontmatter['allowed-tools'];
  if (skillType === 'constraint') {
    if (!allowedTools) {
      fileErrors.push('constraint skill missing allowed-tools: Read, Grep, Glob');
    } else {
      const tools = Array.isArray(allowedTools)
        ? allowedTools.map(t => t.toLowerCase())
        : String(allowedTools).toLowerCase().split(/[,\s]+/);
      const writingTools = tools.filter(t =>
        ['write', 'edit', 'multiedit', 'bash', 'notebookedit'].includes(t)
      );
      if (writingTools.length > 0) {
        fileErrors.push(
          `constraint skill has write tools [${writingTools.join(', ')}] — must be read-only: Read, Grep, Glob`
        );
      }
    }
  }

  // ── disable-model-invocation for destructive skills ───────────────────────
  const disableModelInvocation = parseBool(frontmatter['disable-model-invocation']);
  const isDestructive = name && /deploy|commit|push|release|publish|send|delete|drop|migrate|upsert|remove/i.test(name);
  if (isDestructive && disableModelInvocation !== true) {
    fileErrors.push(
      `destructive skill "${name}" is missing disable-model-invocation: true`
    );
  }

  // ── plugin restrictions ───────────────────────────────────────────────────
  if (frontmatter['hooks'] !== undefined) {
    fileErrors.push('plugin SKILL.md cannot define hooks: — move to hooks/ directory');
  }
  if (frontmatter['permissionMode'] !== undefined) {
    fileErrors.push('plugin SKILL.md cannot define permissionMode: — remove this field');
  }
  if (frontmatter['mcpServers'] !== undefined) {
    fileErrors.push('plugin SKILL.md cannot define mcpServers: — remove this field');
  }

  // ── body size ─────────────────────────────────────────────────────────────
  if (body) {
    const bodyLines = body.split('\n').length;
    if (bodyLines > 500) {
      fileErrors.push(`skill body is ${bodyLines} lines — exceeds 500-line limit. Split into multiple skills.`);
    } else if (bodyLines > 350) {
      warn(label, `skill body is ${bodyLines} lines — approaching 500-line limit`);
    }
  }

  // ── inline bash detection ─────────────────────────────────────────────────
  if (body) {
    if (/```\s*(bash|sh)[\s\S]*?```/i.test(body) && !body.includes('scripts/')) {
      warn(label, 'bash/shell code blocks found — move executable logic to scripts/');
    }
  }

  // ── DRY integrity ─────────────────────────────────────────────────────────
  if (body) {
    for (const { pattern, message } of DRY_VIOLATIONS) {
      if (pattern.test(body)) {
        fileErrors.push(`DRY violation — ${message}`);
      }
    }
  }

  // ── Related section ───────────────────────────────────────────────────────
  if (body && !/##\s*related/i.test(body)) {
    warn(label, 'no "## Related" section — add links to related agents, skills, and reference files');
  }

  // ── Finalise ──────────────────────────────────────────────────────────────
  if (fileErrors.length > 0) {
    for (const e of fileErrors) err(label, e);
  } else {
    ok();
  }
}

// ── Folder scanner ────────────────────────────────────────────────────────────

function scanTargetFolder(dir) {
  if (!fs.existsSync(dir)) {
    console.error(`ERROR: target skill folder not found at: ${dir}`);
    console.error(`  Pass the correct folder name with --skills-dir`);
    process.exit(1);
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory() && entry.name === '_reference') {
      const refFiles = fs.readdirSync(fullPath).filter(f => f.endsWith('.md'));
      for (const rf of refFiles) {
        validateReferenceFile(path.join(fullPath, rf));
      }
      continue;
    }

    if (entry.isDirectory()) {
      const skillMd = path.join(fullPath, 'SKILL.md');
      if (fs.existsSync(skillMd)) {
        validateSkill(fullPath, skillMd);
      } else {
        const mdFiles = fs.readdirSync(fullPath).filter(f => f.endsWith('.md'));
        if (mdFiles.length === 0) {
          err(relPath(fullPath), 'directory has no .md files');
        } else {
          warn(relPath(fullPath), `no SKILL.md found in ${entry.name}/ — SKILL.md is required`);
          validateSkill(fullPath, path.join(fullPath, mdFiles[0]));
        }
      }
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.md')) {
      warn(relPath(fullPath),
        `flat .md file found at ${targetSkillFolder}/ root — skills must be in subdirectories: ` +
        `${targetSkillFolder}/<skill-name>/SKILL.md`
      );
    }
  }
}

// ── Context budget check ──────────────────────────────────────────────────────

function checkContextBudget() {
  if (!fs.existsSync(targetSkillDir)) return;

  const entries = fs.readdirSync(targetSkillDir, { withFileTypes: true });
  let totalChars = 0;
  const breakdown = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === '_reference') continue;
    const skillMd = path.join(targetSkillDir, entry.name, 'SKILL.md');
    if (!fs.existsSync(skillMd)) continue;

    const { frontmatter } = parseFrontmatter(fs.readFileSync(skillMd, 'utf8'));
    const descLen = frontmatter.description ? String(frontmatter.description).length : 0;
    totalChars += descLen;
    breakdown.push({ name: entry.name, chars: descLen });
  }

  const label = `${targetSkillFolder}/ (context budget)`;

  if (totalChars >= BUDGET_ERROR_CHARS) {
    err(label,
      `Total description size is ${totalChars} chars — exceeds ${BUDGET_ERROR_CHARS} char limit. ` +
      'Some skills will be excluded from context at runtime. Shorten descriptions.'
    );
  } else if (totalChars >= BUDGET_WARN_CHARS) {
    warn(label,
      `Total description size is ${totalChars} chars ` +
      `(warn: ${BUDGET_WARN_CHARS}, limit: ~${BUDGET_ERROR_CHARS}). ` +
      'Consider shortening descriptions before adding more skills.'
    );
  } else {
    warnings.push(
      `  [INFO] Context budget: ${totalChars} chars used of ~${BUDGET_ERROR_CHARS} ` +
      `(${Math.round(totalChars / BUDGET_ERROR_CHARS * 100)}%)`
    );
  }

  for (const { name: n, chars } of breakdown) {
    if (chars > MAX_DESCRIPTION_LENGTH) {
      warn(`${targetSkillFolder}/${n}/SKILL.md`,
        `description is ${chars} chars — must be under ${MAX_DESCRIPTION_LENGTH}`
      );
    }
  }
}

// ── Co-activation check ───────────────────────────────────────────────────────

function checkCoActivation() {
  if (!fs.existsSync(targetSkillDir)) return;

  const entries = fs.readdirSync(targetSkillDir, { withFileTypes: true });
  const skillDirs = entries.filter(e => e.isDirectory() && e.name !== '_reference').map(e => e.name);
  const constraintSkills = skillDirs.filter(n => n.includes('-constraints'));
  const actionSkills = skillDirs.filter(n => !n.includes('-constraints'));

  for (const cs of constraintSkills) {
    const domain = cs.replace(/^sf-/, '').replace(/-constraints$/, '');
    const hasAction = actionSkills.some(a => a.includes(domain));
    if (!hasAction) {
      warn(`${targetSkillFolder}/${cs}`,
        `constraint skill has no matching action skill for domain "${domain}". ` +
        `Consider creating ${targetSkillFolder}/sf-write-${domain}/ or ${targetSkillFolder}/sf-${domain}-*/`
      );
    }
  }
}

// ── @reference integrity check ────────────────────────────────────────────────

function checkReferenceIntegrity() {
  if (!fs.existsSync(targetSkillDir)) return;

  const entries = fs.readdirSync(targetSkillDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === '_reference') continue;
    const skillMd = path.join(targetSkillDir, entry.name, 'SKILL.md');
    if (!fs.existsSync(skillMd)) continue;

    const content = fs.readFileSync(skillMd, 'utf8');
    const refs = [...content.matchAll(/@(?:\.\.\/(?:_reference\/)?)?([A-Z_]+\.md)/g)].map(m => m[1]);

    for (const ref of refs) {
      const refPath = path.join(referenceDir, ref);
      if (!fs.existsSync(refPath)) {
        err(relPath(skillMd),
          `references @${ref} but _reference/${ref} does not exist. ` +
          'Create the reference file or correct the @reference name.'
        );
      }
    }
  }
}

// ── Run ───────────────────────────────────────────────────────────────────────

console.log(`Validating: ${targetSkillDir}`);

scanTargetFolder(targetSkillDir);
checkContextBudget();
checkCoActivation();
checkReferenceIntegrity();

// ── Report ────────────────────────────────────────────────────────────────────

const divider = '─'.repeat(60);

if (warnings.length > 0) {
  console.log(`\n${divider}\nWARNINGS (${warnings.length})\n${divider}`);
  for (const w of warnings) console.warn(w);
}

if (errors.length > 0) {
  console.log(`\n${divider}\nFAILURES (${errors.length})\n${divider}`);
  for (const e of errors) console.error(e);
  console.log(`\n${divider}`);
  console.error(`FAILED — ${errors.length} error(s), ${passed}/${total} passed`);
  console.log(divider);
  process.exit(1);
}

console.log(`\n${divider}`);
console.log(`PASSED — ${passed}/${total} skill(s) validated`);
if (warnings.length > 0) console.log(`${warnings.length} warning(s) to address before next release`);
console.log(divider);
process.exit(0);