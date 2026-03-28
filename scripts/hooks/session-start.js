#!/usr/bin/env node
'use strict';

/**
 * session-start.js — SessionStart hook for SCC.
 *
 * Detects Salesforce project context and prints a summary:
 *   - sfdx-project.json detection
 *   - SF CLI version
 *   - Connected scratch orgs
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const CWD = process.cwd();

/**
 * Run a command and return stdout string, or null on failure.
 */
function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    encoding: 'utf8',
    timeout: 8000,
    cwd: options.cwd || CWD,
    env: process.env,
  });
  if (result.status !== 0 || result.error) return null;
  return (result.stdout || '').trim();
}

/**
 * Parse sfdx-project.json for project metadata.
 */
function readSfdxProject(dir) {
  const filePath = path.join(dir, 'sfdx-project.json');
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Walk up directories to find sfdx-project.json.
 */
function findSfdxRoot(startDir) {
  let dir = startDir;
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(dir, 'sfdx-project.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/**
 * Get SF CLI version.
 */
function getSfCliVersion() {
  // Try 'sf' first (v2), then 'sfdx' (v1)
  const sfVersion = run('sf', ['--version']);
  if (sfVersion) return { cli: 'sf', version: sfVersion };

  const sfdxVersion = run('sfdx', ['--version']);
  if (sfdxVersion) return { cli: 'sfdx', version: sfdxVersion, deprecated: true };

  return null;
}

/**
 * List connected Salesforce orgs.
 */
function listOrgs() {
  // Try sf org list
  const sfOut = run('sf', ['org', 'list', '--json']);
  if (sfOut) {
    try {
      const data = JSON.parse(sfOut);
      const orgs = [];
      const result = data.result || data;

      // Non-scratch orgs (devhubs, sandboxes, etc.)
      const nonScratch = Array.isArray(result.nonScratchOrgs) ? result.nonScratchOrgs : [];
      for (const org of nonScratch) {
        orgs.push({
          alias: org.alias || org.username,
          username: org.username,
          type: org.connectedStatus === 'Connected' ? 'connected' : 'disconnected',
          isDevHub: org.isDevHub || false,
          orgType: 'non-scratch',
        });
      }

      // Scratch orgs
      const scratch = Array.isArray(result.scratchOrgs) ? result.scratchOrgs : [];
      for (const org of scratch) {
        orgs.push({
          alias: org.alias || org.username,
          username: org.username,
          type: org.connectedStatus === 'Connected' ? 'connected' : 'disconnected',
          isDefaultOrg: org.isDefaultOrg || false,
          expirationDate: org.expirationDate || null,
          orgType: 'scratch',
        });
      }

      return orgs;
    } catch { /* fall through */ }
  }

  // Fallback: sfdx force:org:list
  const sfdxOut = run('sfdx', ['force:org:list', '--json']);
  if (sfdxOut) {
    try {
      const data = JSON.parse(sfdxOut);
      const result = data.result || {};
      const orgs = [];
      for (const org of [...(result.nonScratchOrgs || []), ...(result.scratchOrgs || [])]) {
        orgs.push({
          alias: org.alias || org.username,
          username: org.username,
          type: org.connectedStatus === 'Connected' ? 'connected' : 'disconnected',
        });
      }
      return orgs;
    } catch { /* ignore */ }
  }

  return null;
}

// ── Main ─────────────────────────────────────────────────────────────────────

const sfdxRoot = findSfdxRoot(CWD);
const isSalesforceProject = sfdxRoot !== null;

if (!isSalesforceProject) {
  // Not a Salesforce project — exit silently
  process.exit(0);
}

const projectData = readSfdxProject(sfdxRoot);
const cliInfo = getSfCliVersion();

console.log('\n── Salesforce Dev Context ─────────────────────────────');

if (sfdxRoot !== CWD) {
  console.log(`Project root : ${sfdxRoot}`);
} else {
  console.log(`Project      : ${path.basename(sfdxRoot)}`);
}

if (projectData) {
  if (projectData.name) console.log(`Name         : ${projectData.name}`);
  if (projectData.namespace) console.log(`Namespace    : ${projectData.namespace}`);
  if (Array.isArray(projectData.packageDirectories)) {
    const pkgDirs = projectData.packageDirectories.map(d => d.path || d).join(', ');
    console.log(`Package dirs : ${pkgDirs}`);
  }
  if (projectData.sourceApiVersion) console.log(`API version  : ${projectData.sourceApiVersion}`);
}

if (cliInfo) {
  if (cliInfo.deprecated) {
    console.log(`SF CLI       : ${cliInfo.version} [DEPRECATED — upgrade to sf v2]`);
  } else {
    console.log(`SF CLI       : ${cliInfo.version}`);
  }
} else {
  console.log(`SF CLI       : not found (install with: npm install -g @salesforce/cli)`);
}

if (process.env.SF_ORG_ALIAS) {
  console.log(`Default org  : ${process.env.SF_ORG_ALIAS} (SF_ORG_ALIAS)`);
}

// List orgs (only if SF CLI is available)
if (cliInfo) {
  const orgs = listOrgs();
  if (orgs && orgs.length > 0) {
    const connectedOrgs = orgs.filter(o => o.type === 'connected');
    const scratchOrgs = orgs.filter(o => o.orgType === 'scratch');
    console.log(`Connected    : ${connectedOrgs.length} org(s)`);
    if (scratchOrgs.length > 0) {
      console.log(`Scratch orgs : ${scratchOrgs.length} (${scratchOrgs.filter(o => o.type === 'connected').length} active)`);
    }
    // Show default org
    const defaultOrg = orgs.find(o => o.isDefaultOrg);
    if (defaultOrg) {
      const expiry = defaultOrg.expirationDate ? ` (expires: ${defaultOrg.expirationDate})` : '';
      console.log(`Default org  : ${defaultOrg.alias || defaultOrg.username}${expiry}`);
    }
  } else if (orgs !== null) {
    console.log(`Orgs         : none connected`);
  }
}

console.log('───────────────────────────────────────────────────────\n');
