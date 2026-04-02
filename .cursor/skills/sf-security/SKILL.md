---
name: sf-security
description: >-
  Use when implementing Salesforce Apex security — CRUD/FLS enforcement, sharing keywords, SOQL injection prevention, AppExchange review prep. Do NOT use for general Apex or LWC patterns.
---

# Salesforce Security

Salesforce has a layered security model. Each layer must be respected in Apex code, SOQL queries, and UI components.

@../_reference/SECURITY_PATTERNS.md
@../_reference/SHARING_MODEL.md

## When to Use

- Preparing for a Salesforce security review or ISV managed package submission
- Apex classes missing `with sharing` or using unexplained `without sharing`
- SOQL queries using dynamic strings without bind variables
- CRUD/FLS checks absent from controller or service classes
- Running a security health check before a major deployment
- A penetration test or AppExchange security review flags vulnerabilities

## CRUD Enforcement in Apex

### WITH USER_MODE / AccessLevel.USER_MODE (see @../_reference/API_VERSIONS.md for minimum version)

The modern standard for CRUD + FLS enforcement. This replaces explicit CRUD checks and `Security.stripInaccessible` for most use cases.

```apex
// SOQL enforces both object CRUD and FLS for the running user
List<Account> accounts = [SELECT Id, Name FROM Account WITH USER_MODE];

// For DML, use Database methods with AccessLevel
Database.insert(records, false, AccessLevel.USER_MODE);
Database.update(records, false, AccessLevel.USER_MODE);
Database.delete(records, false, AccessLevel.USER_MODE);
```

### When to Check CRUD

| Context | Check CRUD? |
|---|---|
| Apex called from LWC/Aura/VF page | Yes |
| Service layer called by user-facing code | Yes |
| Internal utility called by system batch | Usually no — runs in system context |
| Apex REST/SOAP API endpoint | Yes |
| Scheduled/Batch internal processing | Usually no — document justification |

---

## Field-Level Security (FLS)

### Security.stripInaccessible — Bulk FLS Enforcement

`stripInaccessible()` silently removes fields the user cannot access. The returned records look normal but stripped fields are `null`. Check `getRemovedFields()` before passing records downstream.

```apex
public List<Account> getAccountsForDisplay() {
    List<Account> accounts = [
        SELECT Id, Name, AnnualRevenue, SSN__c, Internal_Notes__c
        FROM Account WHERE Type = 'Customer'
    ];

    SObjectAccessDecision decision = Security.stripInaccessible(
        AccessType.READABLE, accounts
    );

    Map<String, Set<String>> removed = decision.getRemovedFields();
    if (removed.containsKey('Account')) {
        System.debug(LoggingLevel.WARN, 'Stripped fields: ' + removed.get('Account'));
    }

    return decision.getRecords();
}
```

### WITH USER_MODE for FLS in SOQL

`WITH USER_MODE` throws a `QueryException` if the running user lacks field-level access to any field in the SELECT or WHERE clause. Use `Security.stripInaccessible()` when you need to silently remove inaccessible fields instead of throwing.

```apex
// Defensive approach: check accessibility first
List<String> selectFields = new List<String>{ 'Id', 'Name' };
if (Schema.SObjectType.Account.Fields.AnnualRevenue.getDescribe().isAccessible()) {
    selectFields.add('AnnualRevenue');
}
// ... build and execute dynamic SOQL with validated fields
```

---

## Sharing Keywords

### with sharing (Default)

```apex
public with sharing class AccountsSelector {
    public List<Account> selectAll() {
        return [SELECT Id, Name FROM Account]; // Only returns records user can see
    }
}
```

### without sharing (Use Sparingly)

```apex
/**
 * Batch processor for automated data enrichment.
 * Uses without sharing because:
 * 1. Runs as a system user (scheduled job)
 * 2. Needs to process ALL accounts regardless of ownership
 * 3. Sharing is irrelevant for automated system processing
 */
public without sharing class AccountEnrichmentBatch
        implements Database.Batchable<SObject> {
    // ...
}
```

### inherited sharing

```apex
// Adopts the sharing mode of the calling class
public inherited sharing class QueryHelper {
    public List<Account> getAccountsForCaller() {
        return [SELECT Id, Name FROM Account];
        // If called by "with sharing" class: enforces sharing
        // If called by "without sharing" class: bypasses sharing
        // If top-level: defaults to "with sharing"
    }
}
```

### Decision Tree

```
User-facing (LWC, VF, Aura, REST API)?  → with sharing
Utility that respects caller's context?  → inherited sharing
Scheduled/batch as system user?          → without sharing (documented)
Permission elevation utility?            → without sharing (narrow scope, documented)
Unsure?                                  → with sharing
```

> Sharing context does NOT propagate to called classes. A `with sharing` class calling a `without sharing` class runs the called method **without sharing**.

---

## SOQL Injection Prevention

### Static SOQL with Bind Variables (Preferred)

```apex
public List<Account> searchAccounts(String nameFilter) {
    return [SELECT Id, Name FROM Account WHERE Name = :nameFilter WITH USER_MODE];
}
```

### Database.queryWithBinds (For Dynamic SOQL)

```apex
public List<Account> searchAccounts(String nameFilter) {
    Map<String, Object> binds = new Map<String, Object>{
        'nameFilter' => nameFilter
    };
    return Database.queryWithBinds(
        'SELECT Id, Name FROM Account WHERE Name = :nameFilter WITH USER_MODE',
        binds, AccessLevel.USER_MODE
    );
}
```

### Safe Dynamic SOQL with Whitelist Validation

```apex
public class SafeDynamicQueryBuilder {
    private static final Set<String> ALLOWED_SORT_FIELDS = new Set<String>{
        'Name', 'CreatedDate', 'AnnualRevenue', 'Type'
    };
    private static final Set<String> ALLOWED_DIRECTIONS = new Set<String>{
        'ASC', 'DESC'
    };

    public List<Account> getAccountsSorted(String sortField, String sortDirection) {
        if (!ALLOWED_SORT_FIELDS.contains(sortField)) {
            sortField = 'Name';
        }
        if (!ALLOWED_DIRECTIONS.contains(sortDirection?.toUpperCase())) {
            sortDirection = 'ASC';
        }

        String query = 'SELECT Id, Name, AnnualRevenue, Type '
                     + 'FROM Account WITH USER_MODE '
                     + 'ORDER BY ' + sortField + ' ' + sortDirection
                     + ' LIMIT 200';
        return Database.query(query);
    }
}
```

---

## XSS Prevention

### Visualforce — Use Context-Appropriate Encoding

```xml
<!-- HTML body → HTMLENCODE -->
<div>{!HTMLENCODE(accountDescription)}</div>

<!-- JS string → JSENCODE -->
<script>var accountName = '{!JSENCODE(account.Name)}';</script>

<!-- JS in HTML attribute → JSINHTMLENCODE -->
<div onclick="handleClick('{!JSINHTMLENCODE(account.Name)}')">Click</div>

<!-- URL parameter → URLENCODE -->
<a href="/mypage?name={!URLENCODE(account.Name)}">View</a>

<!-- Safe by default -->
<apex:outputField value="{!account.Name}" />
<apex:outputText value="{!account.Description}" escape="true" />
```

### LWC — Safe by Default

LWC templates auto-encode HTML. Avoid `innerHTML`:

```javascript
// Safe — LWC encodes the value as text content
this.accountName = '<script>alert(1)</script>'; // Rendered as literal text

// Use textContent, not innerHTML
this.template.querySelector('.description').textContent = userProvidedContent;

// For rich text, use lightning-formatted-rich-text (sanitizes automatically)
```

---

## Named Credentials and External Credentials

### Secure Callout Pattern

```apex
public class ERPIntegrationService {
    public HttpResponse callERPEndpoint(String path, String method, String body) {
        HttpRequest req = new HttpRequest();
        req.setEndpoint('callout:ERP_System' + path);
        req.setMethod(method);
        req.setHeader('Content-Type', 'application/json');
        if (String.isNotBlank(body)) {
            req.setBody(body);
        }
        return new Http().send(req);
    }
}
```

### What Belongs in Named/External Credentials

- OAuth client secrets, API keys, JWT private keys
- Endpoint URLs (use Named Credentials, not hardcoded strings)
- Per-user vs Named Principal authentication

### Custom Metadata for Configuration

```apex
// No SOQL limits, deployable config
Map<String, Service_Config__mdt> configs = new Map<String, Service_Config__mdt>();
for (Service_Config__mdt config : Service_Config__mdt.getAll().values()) {
    configs.put(config.DeveloperName, config);
}
```

---

## Enterprise Security Features

### Shield Platform Encryption

| Encryption Type | Query Support | Use Case |
|---|---|---|
| Deterministic | Exact match only in WHERE | SSN lookup, email search |
| Probabilistic | No SOQL filtering | Health data, financial records |

Encrypted fields cannot be used in ORDER BY, GROUP BY, or LIKE queries (probabilistic). Code must handle null returns when user lacks decryption permission.

### Event Monitoring

- **Login Events** — detect unauthorized access
- **API Events** — detect data exfiltration
- **Report Export Events** — data loss prevention

### Transaction Security

Real-time threat detection: block large data exports, enforce MFA for sensitive operations, block restricted locations.

---

## Common Security Review Failures

| Failure | Fix |
|---|---|
| CRUD not checked before DML | Use `AccessLevel.USER_MODE` |
| FLS not checked before field access | Use `WITH USER_MODE` or `stripInaccessible` |
| Dynamic SOQL with string concatenation | Use bind variables or `queryWithBinds()` |
| `without sharing` on user-facing class | Switch to `with sharing` |
| Hardcoded credentials | Use Named/External Credentials |
| Sensitive data in debug logs | Remove `System.debug` of PII |
| Unrestricted SOQL rows | Add WHERE + LIMIT |
| innerHTML with user input | Use textContent or sanitized components |

---

## Related

- **Agent**: `sf-review-agent` — For interactive, in-depth guidance
- **Constraints**: `sf-security-constraints` — Hard rules for security compliance
