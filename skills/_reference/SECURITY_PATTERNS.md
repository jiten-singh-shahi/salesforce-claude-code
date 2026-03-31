# Security Patterns — Salesforce Reference

> Last verified: API v66.0 (Spring '26)
> Source: https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_security_guide.htm

## Salesforce Security Layers

```
Authentication & Authorization  →  Who can log in? (SSO, MFA, Login Flows)
Object-Level Security (CRUD)    →  Can user create/read/edit/delete this object? (Profiles, Permission Sets)
Field-Level Security (FLS)      →  Can user see/edit this field? (Profiles, Permission Sets)
Record-Level Security (Sharing) →  Can user see THIS specific record? (OWD, Sharing Rules, Role Hierarchy)
```

The UI enforces all layers automatically. Apex and SOQL require explicit enforcement.

## CRUD + FLS Enforcement

| Approach | Min API | Enforces | Behavior on Violation |
|---|---|---|---|
| `WITH USER_MODE` (SOQL) | v56.0 | CRUD + FLS | Throws `QueryException` |
| `AccessLevel.USER_MODE` (DML) | v56.0 | CRUD + FLS | Throws `DmlException` |
| `WITH SECURITY_ENFORCED` (SOQL) | v48.0 | CRUD + FLS (reads) | Throws `QueryException` |
| `Security.stripInaccessible()` | v48.0 | FLS only | Silently removes inaccessible fields |
| Manual `isAccessible()` / `isCreateable()` checks | All | CRUD only (per call) | Developer-controlled |

### Preferred: WITH USER_MODE / AccessLevel.USER_MODE

```apex
// SOQL — enforces CRUD + FLS for running user
List<Account> accounts = [SELECT Id, Name FROM Account WITH USER_MODE];

// DML — enforces CRUD + FLS for running user
Database.insert(records, false, AccessLevel.USER_MODE);
Database.update(records, false, AccessLevel.USER_MODE);
Database.delete(records, false, AccessLevel.USER_MODE);
```

### stripInaccessible Warning

`Security.stripInaccessible()` **silently removes** fields the user cannot access. Stripped fields become `null`. Always check `getRemovedFields()` before passing records downstream — otherwise `NullPointerException` can occur on fields assumed to be populated.

## Sharing Keywords

| Keyword | Behavior | Default For |
|---|---|---|
| `with sharing` | Enforces record-level sharing rules | User-facing classes (recommended default) |
| `without sharing` | Bypasses sharing rules — sees all records | System batch jobs (must justify) |
| `inherited sharing` | Adopts caller's sharing context | Utility/helper classes |
| (none specified) | Defaults to `without sharing` for existing code | — (always specify explicitly) |

### Decision Tree

```
User-facing code (LWC, VF, Aura, REST API)?  →  with sharing
Utility class called by different contexts?    →  inherited sharing
Scheduled batch / system processing?           →  without sharing (with justification)
When in doubt?                                 →  with sharing
```

### Critical Rule

Sharing context does **NOT** propagate to called classes. A `with sharing` class calling a `without sharing` class — the called method runs **without sharing**. Each class enforces its own declared keyword independently.

## SOQL Injection Prevention

| Approach | Security Level | When to Use |
|---|---|---|
| Static SOQL with `:bindVariable` | Safest | When query structure is fixed |
| `Database.queryWithBinds()` | Safe | When query structure must be dynamic |
| `String.escapeSingleQuotes()` | Legacy — adequate | When bind variables are not possible |
| String concatenation | **VULNERABLE** | Never |

### Safe Dynamic SOQL Pattern

When dynamic fields/sort are needed, **whitelist-validate** every dynamic component against known-safe values. Only filter values should use bind variables.

## XSS Prevention

### Visualforce

| Context | Encoding Function |
|---|---|
| HTML body | `{!HTMLENCODE(value)}` |
| HTML attribute | `{!HTMLENCODE(value)}` |
| JavaScript string | `{!JSENCODE(value)}` |
| JS inside HTML attribute | `{!JSINHTMLENCODE(value)}` |
| URL parameter | `{!URLENCODE(value)}` |
| Auto-safe components | `<apex:outputField>`, `<apex:outputText escape="true">` |

### LWC

LWC templates auto-encode HTML by default. Avoid `element.innerHTML = userInput` — use `textContent` or `<lightning-formatted-rich-text>` instead.

## Named Credentials & External Credentials

| Rule | Detail |
|---|---|
| Use `callout:NamedCredential` prefix | Salesforce injects auth at runtime |
| Never hardcode API keys/tokens in Apex | Use External Credentials (API v54.0+) |
| Never hardcode Record IDs | Differ per org/sandbox |
| Never hardcode endpoint URLs | Use Named Credentials or Custom Metadata |
| Never log secrets via `System.debug` | Exposed in debug logs |

## Security Review Checklist

- [ ] All user-facing SOQL uses `WITH USER_MODE` or explicit CRUD/FLS checks
- [ ] No SOQL string concatenation with user input
- [ ] Service classes declared `with sharing` by default
- [ ] `without sharing` justified and documented
- [ ] No hardcoded IDs, credentials, or endpoint URLs
- [ ] No `System.debug` of sensitive field values
- [ ] DML for user-facing operations uses `AccessLevel.USER_MODE`
- [ ] Callouts use Named Credentials / External Credentials
- [ ] Configuration uses Custom Metadata or Custom Settings

## Common Security Review Failures

| Pattern | Risk | Fix |
|---|---|---|
| Missing CRUD check on DML | Unauthorized data access | `AccessLevel.USER_MODE` |
| Missing FLS check on field access | Sensitive data exposure | `WITH USER_MODE` or `stripInaccessible` |
| Dynamic SOQL with string concatenation | SOQL injection | Bind variables or `queryWithBinds` |
| `without sharing` on user-facing class | Record-level bypass | `with sharing` |
| Hardcoded credentials | Credential exposure | Named Credentials |
| Sensitive data in debug logs | Data leakage | Remove debug statements |
| `element.innerHTML = userInput` | XSS | `textContent` or sanitized component |
