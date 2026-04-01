# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| latest  | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability in Salesforce Claude Code (SCC), please report it responsibly.

**Do not open a public issue for security vulnerabilities.**

Instead, use one of these methods:

1. **GitHub Security Advisories** (preferred): [Report a vulnerability](https://github.com/jiten-singh-shahi/salesforce-claude-code/security/advisories/new)
2. **Email**: jitencseng@gmail.com — include "SCC Security" in the subject line

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response Timeline

- **Acknowledgement**: Within 48 hours
- **Assessment**: Within 7 days
- **Fix**: Within 30 days for critical issues

### Scope

This policy covers:
- SCC plugin code (agents, skills, hooks, scripts)
- CLI tools (`npx scc`)
- CI/CD pipeline configuration
- Hook scripts that execute in user environments

This policy does not cover:
- Salesforce platform vulnerabilities (report to Salesforce directly)
- Third-party dependencies (report to the upstream maintainer)
