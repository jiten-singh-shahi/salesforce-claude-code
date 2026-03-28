#!/usr/bin/env node
'use strict';

/**
 * Skills Health Dashboard
 *
 * Scans the skills/ directory and generates a health report:
 * - Inventory of all skills
 * - Completeness check (required sections)
 * - Size distribution
 * - Staleness detection
 *
 * Usage:
 *   node scripts/dev/skills-health.js                # Full dashboard
 *   node scripts/dev/skills-health.js --json          # JSON output
 *   node scripts/dev/skills-health.js --panel <name>  # Specific panel
 */

const fs = require('fs');
const path = require('path');
const { getPluginRoot } = require('../lib/utils');

const REQUIRED_SECTIONS = ['When to Use', 'How It Works', 'Examples'];
const STALE_THRESHOLD_DAYS = 30;

function parseArgs(argv) {
  const args = argv.slice(2);
  return {
    json: args.includes('--json'),
    panel: args.includes('--panel') ? args[args.indexOf('--panel') + 1] : null,
  };
}

function scanSkills(skillsDir) {
  if (!fs.existsSync(skillsDir)) return [];

  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  const skills = [];

  for (const entry of entries) {
    const fullPath = path.join(skillsDir, entry.name);

    if (entry.isFile() && entry.name.endsWith('.md')) {
      skills.push(analyzeSkill(fullPath, entry.name));
    } else if (entry.isDirectory()) {
      // Check for SKILL.md inside subdirectory
      const skillFile = path.join(fullPath, 'SKILL.md');
      if (fs.existsSync(skillFile)) {
        skills.push(analyzeSkill(skillFile, entry.name));
      }
      // Also check for .md files inside subdirectory
      try {
        const subFiles = fs.readdirSync(fullPath).filter(f => f.endsWith('.md'));
        for (const sf of subFiles) {
          if (sf !== 'SKILL.md') {
            skills.push(analyzeSkill(path.join(fullPath, sf), `${entry.name}/${sf}`));
          }
        }
      } catch { /* ignore */ }
    }
  }

  return skills;
}

function analyzeSkill(filePath, name) {
  const stat = fs.statSync(filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  const sizeKB = (stat.size / 1024).toFixed(1);
  const lastModified = stat.mtime;
  const daysSinceModified = Math.floor((Date.now() - lastModified.getTime()) / (1000 * 60 * 60 * 24));

  const missingSections = [];
  for (const section of REQUIRED_SECTIONS) {
    const patterns = [
      new RegExp(`^#+\\s+${section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'mi'),
      new RegExp(`^#+\\s+${section.replace(/\s+/g, '\\s+')}`, 'mi'),
    ];
    const found = patterns.some(p => p.test(content));
    if (!found) missingSections.push(section);
  }

  return {
    name: name.replace(/\.md$/, ''),
    path: filePath,
    sizeKB: parseFloat(sizeKB),
    complete: missingSections.length === 0,
    missingSections,
    lastModified: lastModified.toISOString().split('T')[0],
    daysSinceModified,
    stale: daysSinceModified > STALE_THRESHOLD_DAYS,
  };
}

function formatDaysAgo(days) {
  if (days === 0) return 'today';
  if (days === 1) return '1d ago';
  return `${days}d ago`;
}

function renderDashboard(skills, panel) {
  const completeCount = skills.filter(s => s.complete).length;
  const staleCount = skills.filter(s => s.stale).length;

  const lines = [];

  if (!panel || panel === 'inventory') {
    lines.push('Skill Health Dashboard');
    lines.push('═'.repeat(50));
    lines.push('');
    lines.push(`Inventory: ${skills.length} skills found`);
    lines.push(`Complete:  ${completeCount}/${skills.length} (${skills.length ? Math.round(completeCount / skills.length * 100) : 0}%)`);
    lines.push(`Stale:     ${staleCount} skills (not modified in ${STALE_THRESHOLD_DAYS}+ days)`);
    lines.push('');
  }

  if (!panel || panel === 'completeness') {
    const incomplete = skills.filter(s => !s.complete);
    if (incomplete.length > 0) {
      lines.push('Incomplete Skills:');
      for (const s of incomplete) {
        lines.push(`  ${s.name}: Missing ${s.missingSections.join(', ')}`);
      }
      lines.push('');
    }
  }

  if (!panel || panel === 'size') {
    lines.push('Size Distribution:');
    const sorted = [...skills].sort((a, b) => b.sizeKB - a.sizeKB);
    for (const s of sorted.slice(0, 10)) {
      const marker = s.complete ? '\u2713' : '\u2717';
      lines.push(`  ${marker} ${s.name.padEnd(30)} ${String(s.sizeKB).padStart(6)} KB   ${formatDaysAgo(s.daysSinceModified)}`);
    }
    if (sorted.length > 10) lines.push(`  ... and ${sorted.length - 10} more`);
    lines.push('');
  }

  if (!panel || panel === 'staleness') {
    const stale = skills.filter(s => s.stale).sort((a, b) => b.daysSinceModified - a.daysSinceModified);
    if (stale.length > 0) {
      lines.push('Stale Skills (consider updating):');
      for (const s of stale) {
        lines.push(`  ${s.name}: ${formatDaysAgo(s.daysSinceModified)}`);
      }
      lines.push('');
    }
  }

  if (!panel) {
    const recommendations = [];
    for (const s of skills) {
      if (!s.complete) {
        recommendations.push(`${s.name}: Missing "${s.missingSections[0]}" section`);
      }
    }
    for (const s of skills.filter(sk => sk.stale)) {
      recommendations.push(`${s.name}: Consider updating (${s.daysSinceModified} days old)`);
    }
    if (recommendations.length > 0) {
      lines.push('Recommendations:');
      for (const r of recommendations.slice(0, 5)) {
        lines.push(`  - ${r}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

function main() {
  const { json, panel } = parseArgs(process.argv);
  const pluginRoot = getPluginRoot();
  const skillsDir = path.join(pluginRoot, 'skills');
  const skills = scanSkills(skillsDir);

  if (json) {
    console.log(JSON.stringify({
      total: skills.length,
      complete: skills.filter(s => s.complete).length,
      stale: skills.filter(s => s.stale).length,
      skills,
    }, null, 2));
    return;
  }

  if (skills.length === 0) {
    console.log('No skills found in', skillsDir);
    return;
  }

  console.log(renderDashboard(skills, panel));
}

if (require.main === module) {
  main();
}

module.exports = { scanSkills, analyzeSkill, renderDashboard, parseArgs };
