---
name: sf-2gp-security-review
description: >-
  Use when user asks for a 2GP security review, AppExchange readiness check, or pass/fail prediction for Apex, LWC, SOQL. Do NOT use for general security patterns.
disable-model-invocation: true
---

# Salesforce 2GP Managed Package Security Review

## When to Use

- User asks for a 2GP managed package security review or AppExchange readiness assessment
- User wants a pass/fail prediction for their managed package security review submission
- User needs a 2GP license qualification checklist or submission readiness scoring

This skill performs a comprehensive security review of a Salesforce 2GP managed package,
assesses readiness for AppExchange security review, and produces a pass/fail prediction
with actionable remediation steps.

## How This Skill Works

When invoked, you will:

1. **Discover** the package structure (scan for Apex, LWC, objects, permissions, config)
2. **Audit** every file against the security review criteria below
3. **Score** each category (PASS / WARN / FAIL)
4. **Produce** a structured report with an overall pass/fail prediction and remediation plan

The output is a detailed markdown report saved to the project's `docs/security/` directory.

---

## Step 1 — Package Discovery

Before auditing, build a complete inventory of the package contents. Run these searches
against the project's `force-app/` directory:

```
Apex classes:      force-app/**/classes/*.cls
Apex triggers:     force-app/**/triggers/*.trigger
LWC components:    force-app/**/lwc/*/
Aura components:   force-app/**/aura/*/
Visualforce pages: force-app/**/pages/*.page
Custom objects:    force-app/**/objects/*/
Permission sets:   force-app/**/permissionsets/*/
Custom metadata:   force-app/**/customMetadata/*/
Static resources:  force-app/**/staticresources/*/
Named credentials: force-app/**/namedCredentials/*/
Remote site settings: force-app/**/remoteSiteSettings/*/
Connected apps:    force-app/**/connectedApps/*/
```

Record the count of each metadata type. This inventory becomes the header of your report.

---

## Step 2 — Security Audit Categories

Audit every file from Step 1 against 15 categories. For each category, assign a status:
PASS (no issues), WARN (minor issues, unlikely to fail review), or FAIL (will likely
fail AppExchange security review).

Audit criteria, grep patterns, and PASS/WARN/FAIL thresholds for all 15 categories:

@../_reference/APPEXCHANGE_REVIEW.md

Supporting reference for implementation patterns:

- CRUD/FLS, sharing, injection, XSS, Named Credentials: @../_reference/SECURITY_PATTERNS.md
- Sharing model details: @../_reference/SHARING_MODEL.md
- Testing standards and annotations: @../_reference/TESTING_STANDARDS.md
- Namespace, versioning, package CLI: @../_reference/PACKAGE_DEVELOPMENT.md
- Governor limits and anti-patterns: @../_reference/GOVERNOR_LIMITS.md
- LWC lifecycle and patterns: @../_reference/LWC_PATTERNS.md

**Categories:**

1. CRUD/FLS Enforcement (CRITICAL — #1 failure reason)
2. Sharing Model Enforcement
3. SOQL/DML Injection Prevention
4. Sensitive Data Exposure
5. XSS and Content Security Policy
6. External Callout Security
7. Third-Party Library Vulnerabilities
8. Code Coverage
9. Namespace and Packaging Compliance
10. Permission Model
11. Governor Limit Safety
12. Lightning Web Security (LWS) Compliance
13. Connected App and OAuth Configuration
14. Data at Rest and in Transit
15. Documentation and Submission Readiness

---

## Step 3 — 2GP License Qualification Checklist

After the security audit, assess readiness for 2GP licensing and AppExchange distribution.
Check every item and mark as DONE, NOT DONE, or N/A.

Full checklist (Dev Hub, package config, code quality, submission, ISV, post-review):

@../_reference/APPEXCHANGE_REVIEW.md (section: 2GP License Qualification Checklist)

---

## Step 4 — Pass/Fail Prediction

After completing the audit and checklist, calculate the overall score using the scoring
rules and produce one of these verdicts: READY TO SUBMIT / NEEDS REMEDIATION / MAJOR
REWORK NEEDED.

Scoring rules and verdict criteria:

@../_reference/APPEXCHANGE_REVIEW.md (section: Scoring Rules)

---

## Step 5 — Report Output

Generate a markdown report with this structure and save it to `docs/security/security-review-report.md`:

```markdown
# Security Review Report — [Package Name]
Generated: [Date]
Package Version: [version from sfdx-project.json]
Namespace: [namespace]

## Package Inventory
| Metadata Type | Count |
|--------------|-------|
| Apex Classes | X |
| ... | ... |

## Security Audit Results
### Overall Verdict: [READY TO SUBMIT / NEEDS REMEDIATION / MAJOR REWORK]
Score: X/15 categories passing

### Category Results
| # | Category | Status | Issues |
|---|----------|--------|--------|
| 1 | CRUD/FLS Enforcement | PASS/WARN/FAIL | Details |
| ... | ... | ... | ... |

### Critical Findings (FAIL)
[List each FAIL with file path, line number, and specific remediation]

### Warnings
[List each WARN with recommendation]

## 2GP License Qualification
[Checklist with DONE/NOT DONE status for each item]

## Remediation Plan
[Prioritized list of fixes, ordered by: automatic fails first, then likely fails, then warnings]

## Appendix: Scanner Commands
[Commands the user should run for Code Analyzer, Checkmarx, etc.]
```

---

## Related

- Scanner commands: @../_reference/APPEXCHANGE_REVIEW.md (section: Scanner Commands)
- Top 20 failures: @../_reference/APPEXCHANGE_REVIEW.md (section: Top 20 Failures)
- 2026 platform changes: @../_reference/APPEXCHANGE_REVIEW.md (section: 2026 Considerations)
