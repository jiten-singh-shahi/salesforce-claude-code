# AppExchange Security Review — Salesforce Reference

> Last verified: API v66.0 (Spring '26)
> Source: <https://developer.salesforce.com/docs/atlas.en-us.packagingGuide.meta/packagingGuide/security_review_overview.htm>

## 15 Audit Categories

For each category: AppExchange-specific audit criteria, grep patterns, and PASS/WARN/FAIL
thresholds. General security implementation patterns live in dedicated reference files
(SECURITY_PATTERNS.md, TESTING_STANDARDS.md, PACKAGE_DEVELOPMENT.md, GOVERNOR_LIMITS.md).

### Category 1: CRUD/FLS Enforcement (CRITICAL — #1 Failure Reason)

> For CRUD/FLS implementation patterns, see SECURITY_PATTERNS.md.

**Grep patterns to find violations:**

```
Database.query(   — check if AccessLevel.USER_MODE is passed
[SELECT           — check if WITH USER_MODE is appended
Database.insert(  — check for AccessLevel.USER_MODE parameter
Database.update(  — same
Database.delete(  — same
Database.upsert(  — same
insert             — bare DML without stripInaccessible wrapper
update             — same
delete             — same
upsert             — same
```

- **FAIL:** Any SOQL query or DML statement operates in system mode without explicit justification.
- **WARN:** Legacy `isAccessible()` pattern used instead of modern `USER_MODE` — functional but dated.
- **PASS:** All queries/DML use `USER_MODE` or `Security.stripInaccessible()`.

### Category 2: Sharing Model Enforcement

> For sharing keywords and decision tree, see SECURITY_PATTERNS.md and SHARING_MODEL.md.

**Grep patterns:**

```
class.*{                    — find all class declarations
with sharing                — should be present on data-access classes
without sharing             — must have justification comment nearby
inherited sharing           — acceptable for utility classes
```

- **FAIL:** Data-access classes omit the sharing keyword or use `without sharing` without justification.
- **PASS:** Every class explicitly declares sharing behavior.

### Category 3: SOQL/DML Injection Prevention

> For injection prevention patterns, see SECURITY_PATTERNS.md.

**Grep patterns:**

```
Database.query(.*+          — dynamic query with concatenation
' + .*+ '                   — string concatenation in queries
String.escapeSingleQuotes   — check if used where needed
```

- **FAIL:** Any dynamic SOQL uses unescaped string concatenation.
- **PASS:** All queries use bind variables or properly escaped parameters.

### Category 4: Sensitive Data Exposure

**What to check:**

- No `System.debug()` calls that log sensitive data (credentials, tokens, PII, full query results)
- No hardcoded API keys, passwords, tokens, or secrets anywhere in code
- Error messages shown to users don't expose stack traces or system internals
- `AuraHandledException` messages are user-friendly, not technical

**Grep patterns:**

```
System.debug         — audit every instance for sensitive data
password             — should never appear as a literal
api_key|apikey       — should never be hardcoded
secret               — check context
token                — check if it's a hardcoded value vs variable name
```

- **FAIL:** Hardcoded credentials or sensitive data in debug statements found.
- **WARN:** Debug statements present but don't contain sensitive data (should be removed before production).
- **PASS:** No sensitive data exposure detected.

### Category 5: XSS and Content Security Policy (LWC/Aura)

> For VF/LWC encoding patterns, see SECURITY_PATTERNS.md. For LWC lifecycle and patterns, see LWC_PATTERNS.md.

**What to check in LWC components:**

- No use of `innerHTML` with unsanitized user input (use `lwc:dom="manual"` carefully)
- No inline `<script>` tags or inline event handlers (`onclick=`, `onload=`)
- All third-party JavaScript loaded from Static Resources, never external CDNs
- No `eval()`, `Function()`, or `setTimeout(string)` calls
- CSS doesn't use absolute positioning that breaks component encapsulation

**What to check in Aura components:**

- `$A.util.escapeHtml()` used for dynamic content rendering
- No `{!v.unsanitizedContent}` without `aura:text` or escaping
- Components don't break Lightning Locker Service isolation

- **FAIL:** innerHTML with user input, inline scripts, or external CDN dependencies found.
- **PASS:** All dynamic content is properly escaped and CSP-compliant.

### Category 6: External Callout Security

**What to check:**

- All HTTP callouts use HTTPS (never plain HTTP)
- Remote Site Settings and Named Credentials use HTTPS URLs
- SSL/TLS endpoints support TLS 1.2+ (A grade from SSL checker)
- Named Credentials used instead of hardcoded endpoints where possible
- No credentials passed in URL parameters (use headers or body)
- All certificates properly configured and not self-signed

- **FAIL:** HTTP endpoints, credentials in URLs, or missing Named Credentials for integrations.
- **PASS:** All callouts use HTTPS with proper credential management.
- **N/A:** Package makes no external callouts.

### Category 7: Third-Party Library Vulnerabilities

**What to check:**

- All static resources containing JavaScript libraries are current versions
- No known CVE vulnerabilities in bundled libraries (especially jQuery, lodash, moment.js)
- `package.json` dependencies (if any) don't have known vulnerabilities
- No deprecated or end-of-life libraries

**How to check:**

- Examine every static resource for library version numbers
- Cross-reference versions against known vulnerability databases
- Check `package.json` devDependencies for outdated packages

- **FAIL:** Libraries with known critical CVEs are included.
- **WARN:** Libraries are outdated but no known CVEs.
- **PASS:** All libraries are current or no third-party JS is used.

### Category 8: Code Coverage

> For test patterns, annotations, and assertion API, see TESTING_STANDARDS.md.

**How to assess (without running tests):**

- Count test classes vs. production classes (healthy ratio is ~1:1)
- Check test methods for assertions
- Verify test data factory exists and is used consistently
- Look for edge case and error path tests

- **FAIL:** Missing test classes, `@SeeAllData` used, or triggers lack coverage.
- **WARN:** Coverage likely below 85% based on test method count vs. code complexity.
- **PASS:** Comprehensive test coverage with assertions and negative tests.

### Category 9: Namespace and Packaging Compliance

> For namespace rules, versioning, and package CLI, see PACKAGE_DEVELOPMENT.md.

**What to check (audit-specific):**

- Apex code references fields with namespace prefix (e.g., `agentsiq__Field__c`)
- Metadata XML defines fields WITHOUT namespace prefix (Salesforce adds it at deploy)
- No hardcoded Salesforce IDs (use dynamic queries or Custom Metadata)
- All metadata is packageable (no org-specific dependencies)

- **FAIL:** Namespace mismatches, hardcoded IDs, or unpackageable metadata found.
- **PASS:** All namespace conventions are followed correctly.

### Category 10: Permission Model

**What to check:**

- At least one Permission Set defined for the package
- Permission Sets follow least-privilege principle
- Object CRUD permissions are assigned per role/tier
- Field-level security is configured per Permission Set
- No custom profiles (use Permission Sets for 2GP)
- Protected Custom Metadata Types are truly protected (not public)
- Feature gating mechanism exists for tiered products

- **FAIL:** No Permission Sets, or all fields/objects are wide-open.
- **PASS:** Well-structured permission model with appropriate access levels.

### Category 11: Governor Limit Safety

> For limits tables and anti-patterns, see GOVERNOR_LIMITS.md.

**Grep patterns:**

```
for.*{.*\[SELECT         — SOQL inside loop
for.*{.*insert           — DML inside loop
for.*{.*update           — DML inside loop
while.*{.*Database       — DML inside while loop
```

- **FAIL:** SOQL or DML inside loops found.
- **WARN:** Complex CPU operations without async offloading.
- **PASS:** All operations are bulk-safe and governor-friendly.

### Category 12: Lightning Web Security (LWS) Compliance

**What to check:**

- LWC components follow namespace isolation rules
- No attempts to access global window properties outside LWS sandbox
- Component API version is 60.0+ (supports LWS)
- Components tested with LWS enabled
- No cross-namespace DOM manipulation

- **FAIL:** Components break LWS isolation or target deprecated API versions.
- **PASS:** All LWC components are LWS-compliant at API v60.0+.

### Category 13: Connected App and OAuth Configuration

**What to check:**

- OAuth scopes follow least-privilege (no `full` scope without justification)
- Connected Apps use HTTPS callback URLs
- No client secrets or OAuth tokens hardcoded in source
- Refresh token handling is secure
- Named Credentials used for org-to-org authentication

- **FAIL:** Overly broad OAuth scopes or hardcoded secrets.
- **N/A:** Package doesn't use Connected Apps or OAuth flows.

### Category 14: Data at Rest and in Transit

**What to check:**

- Sensitive data stored in Protected Custom Settings or Protected Custom Metadata
- No plain-text storage of API keys, tokens, or credentials
- All external communication encrypted (TLS 1.2+)
- Platform Encryption considered for PII fields
- Custom Settings marked as Protected in managed package context

- **FAIL:** Sensitive data stored in plain text or unprotected settings.
- **PASS:** All sensitive data properly encrypted/protected.

### Category 15: Documentation and Submission Readiness

**What to check:**

- Security architecture documentation exists
- API callout documentation (all external endpoints listed)
- False positive documentation prepared for scanner findings
- Test environment credentials documented
- Install/upgrade guide exists
- Post-install script documented (if applicable)
- Release notes maintained

- **FAIL:** No security documentation exists.
- **WARN:** Partial documentation — needs completion before submission.
- **PASS:** Complete documentation ready for security review team.

---

## Scoring Rules

### Automatic FAIL (any one = will not pass security review)

- CRUD/FLS violations found in any Apex class
- Hardcoded credentials or API keys in source code
- SOQL injection vulnerabilities (dynamic queries with string concatenation)
- HTTP (non-HTTPS) external callouts
- `@SeeAllData` in test classes
- Apex triggers without test coverage
- Code coverage below 75%
- Static resources with known critical CVE vulnerabilities

### Likely FAIL (2+ together = high risk of failure)

- Classes missing explicit sharing keyword
- Debug statements with sensitive data
- No security documentation
- OAuth scope broader than needed
- Unprotected Custom Settings storing secrets

### WARN (won't fail alone but should fix)

- Legacy CRUD/FLS patterns instead of modern `USER_MODE`
- Debug statements present (even without sensitive data)
- Outdated but non-vulnerable libraries
- Missing negative test cases
- Partial documentation

### Verdicts

- **READY TO SUBMIT** — Zero FAILs, zero or few WARNs. Package should pass security review.
- **NEEDS REMEDIATION** — Has FAILs that must be fixed before submission. List each FAIL with specific file, line number, and remediation steps.
- **MAJOR REWORK NEEDED** — Multiple critical FAILs across categories. Provide a prioritized remediation plan.

---

## 2GP License Qualification Checklist

### Dev Hub & Environment

- [ ] Dev Hub org enabled (Developer, Enterprise, Unlimited, or Performance edition)
- [ ] "Unlocked Packages and Second-Generation Managed Packages" enabled in Dev Hub
- [ ] Namespace registered and linked to Dev Hub
- [ ] Using ONE Dev Hub per partner company (not multiple)
- [ ] Scratch org definition file configured correctly
- [ ] CI/CD pipeline set up for automated package builds

### Package Configuration

- [ ] `sfdx-project.json` has valid namespace, package name, and API version
- [ ] Package type is "Managed" (not Unlocked)
- [ ] Dependencies declared in `sfdx-project.json` if applicable
- [ ] Semantic versioning followed (major.minor.patch.build)
- [ ] Package aliases configured for readable references

### Code Quality Gates

- [ ] Apex code coverage at 75%+ (minimum) — aim for 85%+
- [ ] Every Apex trigger has test coverage
- [ ] All test classes use `@IsTest` annotation
- [ ] No `@SeeAllData` in any test class
- [ ] Test data factory exists and is used consistently
- [ ] All test methods have `System.assert*` calls
- [ ] Salesforce Code Analyzer run with `--rule-selector AppExchange`
- [ ] All critical and high severity findings resolved
- [ ] False positives documented with justification

### Security Review Submission

- [ ] Salesforce Code Analyzer scan report generated
- [ ] Source Code Scanner (Checkmarx) report generated via Partner Security Portal
- [ ] DAST scan report generated (Chimera retired June 2025 — use alternative)
- [ ] All scan reports uploaded to security review submission
- [ ] Security architecture documentation complete
- [ ] Test org credentials prepared for review team
- [ ] API callout documentation complete (all external endpoints)
- [ ] False positive justifications written

### ISV Partner Program

- [ ] Salesforce Partner Program Agreement (SPPA) signed
- [ ] AppExchange Partner category selected
- [ ] License Management App (LMA) installed in Partner Business Org
- [ ] License type decided (per-user, site-wide, or permission set license)
- [ ] Feature Parameters defined for tiered pricing (if applicable)
- [ ] Trialforce Source Org configured (if offering free trials)

### Post-Security Review

- [ ] Publishing Partner Console access confirmed
- [ ] AppExchange listing content prepared (description, screenshots, pricing)
- [ ] Post-install script tested (if applicable)
- [ ] Push upgrade strategy planned (batch size, scheduling, communication)
- [ ] Annual re-review calendar reminder set
- [ ] Version attestation process understood (no re-review for minor updates)

---

## Scanner Commands

```bash
# Install Salesforce Code Analyzer (if not installed)
sf plugins install @salesforce/sfdx-scanner

# Run Code Analyzer with AppExchange ruleset
sf scanner run --target "force-app/" --rule-selector AppExchange --format html --outfile security-scan-report.html

# Run PMD analysis
sf scanner run --target "force-app/" --engine pmd --format csv --outfile pmd-report.csv

# Run ESLint on LWC
sf scanner run --target "force-app/**/lwc/**" --engine eslint --format html --outfile eslint-report.html

# Run RetireJS for vulnerable libraries
sf scanner run --target "force-app/**/staticresources/**" --engine retire-js --format html --outfile retirejs-report.html

# Check code coverage
sf apex run test --code-coverage --result-format human --output-dir coverage-results/

# Create package version with coverage check
sf package version create --package "PackageName" --code-coverage --installation-key "key" --wait 20
```

---

## Top 20 AppExchange Security Review Failures

Ranked by frequency:

1. CRUD/FLS enforcement gaps (by far #1)
2. Sensitive data in debug logs
3. Known vulnerabilities in third-party libraries
4. SSL/TLS compliance issues
5. SOQL injection vulnerabilities
6. Cross-site scripting (XSS)
7. Insufficient input validation
8. Hardcoded credentials/secrets
9. OAuth scope misuse
10. Inadequate session security
11. API version misconfiguration
12. Broken authentication
13. Insufficient encryption
14. Path traversal issues
15. Missing access controls
16. Insecure deserialization
17. Broken cryptography
18. Using blacklisted APIs
19. Unvalidated redirects
20. Information leakage

Source: developer.salesforce.com — "The Top 20 Vulnerabilities Found in the AppExchange Security Review"

---

## 2026 Considerations

Flag these recent changes that may affect the package:

- **Chimera DAST Scanner retired** (June 2025) — use alternative DAST tools
- **MFA mandatory for all users** (June 2026) — phishing-resistant methods required for admins
- **Email domain verification** (April 2026) — unverified domains silently drop emails
- **Connected App creation restricted by default** (Spring '26) — only via package install
- **Named Credentials default to developer control** (Feb 2026) — subscribers can't edit endpoints
- **CA-signed certificates limited to 200 days** (March 2026) — plan renewal cycles
- **Salesforce Code Analyzer mandatory** for AppExchange submissions (replaces sfdx-scanner)
