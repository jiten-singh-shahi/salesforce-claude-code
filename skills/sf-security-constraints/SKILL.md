---
name: sf-security-constraints
description: "Enforce CRUD/FLS, sharing model, SOQL injection prevention, and XSS protection for Apex and LWC. Use when writing or reviewing ANY Apex, trigger, LWC, or VF page. Do NOT use for Flow-only configuration."
origin: SCC
user-invocable: false
allowed-tools: Read, Grep, Glob
---

# Security Constraints for Salesforce Code

## When to Use

This skill auto-activates when writing, reviewing, or modifying any Apex class, trigger, LWC component, or Visualforce page. It enforces CRUD/FLS checks, sharing model compliance, SOQL injection prevention, and XSS protection for all Salesforce code.

Hard rules that apply to every Apex class, trigger, LWC component, and Visualforce page. Violating any constraint below is a blocking issue that must be fixed before the code is considered complete.

Reference: @../_reference/SECURITY_PATTERNS.md, @../_reference/SHARING_MODEL.md
@../_reference/DEPRECATIONS.md

---

## Never Do

| # | Constraint | Why |
|---|---|---|
| N1 | Skip CRUD/FLS checks on user-facing SOQL or DML | Exposes data the running user should not see or modify |
| N2 | Use `without sharing` without a written justification comment | Silently bypasses record-level security for every query in the class |
| N3 | Build SOQL with string concatenation of user input | SOQL injection -- attacker can read or modify arbitrary records |
| N4 | Trust client-side input without server-side validation | Client payloads are trivially forgeable; all validation must repeat in Apex |
| N5 | Use `element.innerHTML = userInput` in LWC | Direct XSS vector; LWC auto-encoding is bypassed |
| N6 | Hardcode API keys, tokens, passwords, or record IDs in Apex | Credentials leak via source control; IDs differ across orgs |
| N7 | Log sensitive field values with `System.debug` | Debug logs are accessible to admins and can be exported |
| N8 | Omit the sharing keyword on a class entirely | Defaults to `without sharing` in most contexts -- an implicit security bypass |

---

## Always Do

| # | Constraint | How |
|---|---|---|
| A1 | Enforce CRUD + FLS on user-facing queries | `WITH USER_MODE` in SOQL (see @../_reference/API_VERSIONS.md for minimum version) |
| A2 | Enforce CRUD + FLS on user-facing DML | `Database.insert(records, false, AccessLevel.USER_MODE)` |
| A3 | Use `with sharing` as the default class keyword | Switch to `inherited sharing` only for utility/helper classes |
| A4 | Use bind variables for SOQL filter values | Static SOQL `:bindVar` or `Database.queryWithBinds()` |
| A5 | Sanitize output in Visualforce | `HTMLENCODE`, `JSENCODE`, `JSINHTMLENCODE`, `URLENCODE` per context |
| A6 | Use `textContent` or `<lightning-formatted-rich-text>` in LWC | Never assign user-controlled strings to `innerHTML` |
| A7 | Store credentials in Named Credentials / External Credentials | Use `callout:NamedCredential` prefix in Apex HTTP requests |
| A8 | Document every `without sharing` usage | Include: why sharing bypass is needed, who approved, date reviewed |
| A9 | Whitelist-validate dynamic SOQL components | Sort fields, directions, object/field names must match a known-safe set |
| A10 | Use `Security.stripInaccessible()` when silent field removal is acceptable | Always check `getRemovedFields()` to avoid downstream `NullPointerException` |

---

## Sharing Keyword Decision

Apply the correct keyword on every class. Reference: @../_reference/SHARING_MODEL.md

```
User-facing code (LWC, VF, Aura, REST API)?     -->  with sharing
Utility / helper called from mixed contexts?     -->  inherited sharing
Scheduled batch / system-only processing?        -->  without sharing  (document justification)
Trigger handler?                                 -->  with sharing  (call without sharing helper only if justified)
Inner class?                                     -->  declare explicitly  (does NOT inherit outer class keyword)
Omitted / unsure?                                -->  with sharing
```

Key rule: sharing context does **not** propagate to called classes. A `with sharing` class calling a `without sharing` class runs the called method **without sharing**.

---

## Anti-Pattern Table

| Anti-Pattern | Security Impact | Correct Pattern |
|---|---|---|
| `Database.query('... WHERE Name = \'' + input + '\'')` | SOQL injection -- attacker reads/modifies arbitrary data | `[SELECT ... WHERE Name = :input WITH USER_MODE]` or `Database.queryWithBinds()` |
| `public class FooController { ... }` (no sharing keyword) | Implicit `without sharing` -- returns all records | `public with sharing class FooController { ... }` |
| `public without sharing class AccountCtrl` (user-facing) | All records visible regardless of OWD, role hierarchy, sharing rules | `public with sharing class AccountCtrl` |
| `insert records;` in user-facing code | No CRUD/FLS enforcement | `Database.insert(records, false, AccessLevel.USER_MODE);` |
| `element.innerHTML = serverData` in LWC | Stored/reflected XSS | `element.textContent = serverData` |
| `req.setHeader('Authorization', 'Bearer ' + hardcodedToken)` | Credential in source code; leaks via SCM | `callout:Named_Credential` with External Credentials |
| `{!rawMergeField}` in Visualforce | Reflected XSS | `{!HTMLENCODE(rawMergeField)}` or `<apex:outputText escape="true">` |
| `System.debug('SSN: ' + contact.SSN__c)` | PII in debug logs | Remove sensitive field logging; use opaque identifiers |
| `API_Keys__c.getOrgDefaults().Token__c` for auth | Secrets in queryable Custom Setting | External Credentials (see @../_reference/API_VERSIONS.md for minimum version) |
| SOQL without `LIMIT` in user-facing context | Unbounded query; governor limit risk + data exposure | Add `LIMIT` clause; paginate with `OFFSET` or cursor |

---

## CRUD/FLS Enforcement Quick Reference

Reference: @../_reference/SECURITY_PATTERNS.md

| Approach | Min API | Enforces | On Violation |
|---|---|---|---|
| `WITH USER_MODE` (SOQL) | See @../_reference/API_VERSIONS.md | CRUD + FLS | Throws `QueryException` |
| `AccessLevel.USER_MODE` (DML) | See @../_reference/API_VERSIONS.md | CRUD + FLS | Throws `DmlException` |
| `WITH SECURITY_ENFORCED` (SOQL) | See @../_reference/API_VERSIONS.md | CRUD + FLS (reads) | Throws `QueryException` |
| `Security.stripInaccessible()` | See @../_reference/API_VERSIONS.md | FLS only | Silently strips fields |
| Manual `isAccessible()` / `isCreateable()` | All | CRUD only | Developer-controlled |

Prefer `WITH USER_MODE` / `AccessLevel.USER_MODE` for all new code (see @../_reference/API_VERSIONS.md for minimum version). Fall back to `stripInaccessible` only when silent field removal is the desired behavior.

---

## Visualforce Encoding Quick Reference

| Output Context | Encoding Function | Example |
|---|---|---|
| HTML body | `HTMLENCODE` | `{!HTMLENCODE(account.Description)}` |
| HTML attribute | `HTMLENCODE` | `title="{!HTMLENCODE(account.Name)}"` |
| JavaScript string | `JSENCODE` | `var x = '{!JSENCODE(account.Name)}'` |
| JS in HTML attribute | `JSINHTMLENCODE` | `onclick="fn('{!JSINHTMLENCODE(val)}')"` |
| URL parameter | `URLENCODE` | `href="/page?q={!URLENCODE(val)}"` |

Use `<apex:outputField>` or `<apex:outputText escape="true">` where possible -- they handle encoding automatically.

---

## Enforcement Priority

When reviewing or writing code, check constraints in this order:

1. **Sharing keyword** declared on every class (N2, N8, A3)
2. **CRUD/FLS** enforced on all user-facing SOQL and DML (N1, A1, A2)
3. **SOQL injection** -- no string concatenation with user input (N3, A4, A9)
4. **XSS** -- correct encoding in VF; no innerHTML in LWC (N5, A5, A6)
5. **Credentials** -- no hardcoded secrets; use Named/External Credentials (N6, A7)
6. **Logging** -- no sensitive data in debug statements (N7)
