---
name: security-scan
description: >-
  Use when scanning Salesforce org Claude Code configuration for security vulnerabilities, deploy misconfigurations, and injection risks in CLAUDE.md, hooks, and MCP servers. Do NOT use for Apex code review — use sf-security.
---

> **External tool:** AgentShield is published as `ecc-agentshield` on npm by affaan-m.
> It is a third-party security scanner, not part of SCC itself.
> **Maintenance risk:** This package has no SLA or maintenance guarantee. If it becomes unavailable, use the manual scanning section below as a fallback.

# Security Scan Skill

Audit your Claude Code configuration for security issues using [AgentShield](https://github.com/affaan-m/agentshield).

## When to Use

- Before submitting an AppExchange managed package for security review
- When running a pre-deployment security gate in CI/CD pipelines
- When auditing a new codebase for SOQL injection, XSS, or FLS violations
- When a PMD or Checkmarx scan surfaces violations that need triaging
- When validating that new Apex contributors follow secure coding patterns

## What It Scans

| File | Checks |
|------|--------|
| `CLAUDE.md` | Hardcoded secrets, auto-run instructions, prompt injection patterns |
| `settings.json` | Overly permissive allow lists, missing deny lists, dangerous bypass flags |
| `mcp.json` | Risky MCP servers, hardcoded env secrets, npx supply chain risks |
| `hooks/` | Command injection via interpolation, data exfiltration, silent error suppression |
| `agents/*.md` | Unrestricted tool access, prompt injection surface, missing model specs |

## Salesforce-Specific Security Checks

Beyond configuration scanning, watch for these Salesforce vulnerability patterns:

### SOQL Injection

```apex
// VULNERABLE — user input concatenated into query
String query = 'SELECT Id FROM Account WHERE Name = \'' + userInput + '\'';

// SAFE — bind variables
List<Account> results = [SELECT Id FROM Account WHERE Name = :userInput];

// SAFE — Database.queryWithBinds for dynamic SOQL
Map<String, Object> binds = new Map<String, Object>{ 'userInput' => userInput };
List<Account> results = Database.queryWithBinds(
    'SELECT Id FROM Account WHERE Name = :userInput',
    binds, AccessLevel.USER_MODE
);
```

### FLS/CRUD Bypass

| Pattern | Risk | Fix |
|---------|------|-----|
| SOQL without `WITH USER_MODE` | Reads fields user can't see | Add `WITH USER_MODE` |
| `Database.insert(records)` without AccessLevel | Skips FLS on write | Use `AccessLevel.USER_MODE` |
| `WITH SECURITY_ENFORCED` | Throws on inaccessible fields, no sharing enforcement | Prefer `WITH USER_MODE` |

### Sharing Model Violations

- `without sharing` on class with `@AuraEnabled` methods — privilege escalation
- `without sharing` on class with `@RemoteAction` — same risk via Visualforce
- Missing sharing declaration — inherits calling class context

### XSS Patterns

- **Visualforce:** `{!userInput}` without `JSENCODE`, `HTMLENCODE`, or `URLENCODE`
- **LWC:** `lwc:dom="manual"` with `innerHTML` from user data
- **Aura:** `$A.util.isEmpty()` doesn't sanitize — validate before DOM insertion

## Usage

### AgentShield Scan

```bash
# Install and scan
npm install -g ecc-agentshield
npx ecc-agentshield scan

# With severity filter and JSON output for CI
npx ecc-agentshield scan --min-severity medium --format json

# Auto-fix safe issues
npx ecc-agentshield scan --fix
```

### Severity Levels

| Grade | Score | Meaning |
|-------|-------|---------|
| A | 90-100 | Secure configuration |
| B | 75-89 | Minor issues |
| C | 60-74 | Needs attention |
| D | 40-59 | Significant risks |
| F | 0-39 | Critical vulnerabilities |

## Manual Scanning (Without AgentShield)

```bash
# SOQL Injection — string concatenation in queries
grep -rn "Database.query" force-app/ --include="*.cls" | grep -v "bind"

# Missing sharing declaration
grep -rEL "with sharing|without sharing|inherited sharing" force-app/main/default/classes/*.cls

# Hardcoded Salesforce IDs (15 or 18 char)
grep -rnE "'00[0-9a-zA-Z]{12,15}'" force-app/ --include="*.cls"

# Missing CRUD/FLS on DML
grep -rn "insert \|update \|delete \|upsert " force-app/ --include="*.cls" | grep -v "stripInaccessible\|USER_MODE\|SECURITY_ENFORCED\|isAccessible\|@IsTest"

# Hardcoded endpoints
grep -rn "https://\|http://" force-app/ --include="*.cls" | grep -v "Named\|test\|mock\|example.com"
```

## SF Code Analyzer Integration

```bash
# Full PMD scan
sf code-analyzer run --target force-app --format table

# Security-focused scan
sf code-analyzer run --target force-app --category "Security" --format table
```

## Remediation Patterns

| Finding | Vulnerable Code | Fixed Code |
|---------|----------------|------------|
| **SOQL Injection** | `Database.query('...WHERE Name=\'' + name + '\'')` | `[SELECT Id FROM Account WHERE Name = :name]` |
| **Missing Sharing** | `public class MyService {` | `public with sharing class MyService {` |
| **FLS Bypass** | `insert records;` | `Database.insert(records, AccessLevel.USER_MODE);` |
| **Hardcoded ID** | `'012000000000ABC'` | `Schema.SObjectType.Account.getRecordTypeInfosByDeveloperName().get('Customer').getRecordTypeId()` |
| **XSS (VF)** | `{!userInput}` | `{!HTMLENCODE(userInput)}` |

## Related

- Constraint: sf-security-constraints (co-activates for enforcement rules)
- Action: sf-security (CRUD/FLS implementation procedures)
