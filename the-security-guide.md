# Salesforce Security Guide

Comprehensive security practices for Salesforce development with SCC.

## Table of Contents

- [CRUD/FLS Enforcement](#crudfls-enforcement)
- [SOQL Injection Prevention](#soql-injection-prevention)
- [XSS Prevention](#xss-prevention)
- [CSRF Protection](#csrf-protection)
- [Sharing Model](#sharing-model)
- [Callout Security](#callout-security)
- [Lightning Security](#lightning-security)
- [Platform Encryption](#platform-encryption)
- [Session Security](#session-security)
- [Sensitive Data](#sensitive-data)
- [Apex Security Scanner](#apex-security-scanner)
- [Security Review Checklist](#security-review-checklist)

---

## CRUD/FLS Enforcement

Always enforce field-level security on data access.

### WITH SECURITY_ENFORCED

```apex
List<Account> accounts = [
    SELECT Id, Name, AnnualRevenue
    FROM Account
    WHERE Industry = 'Technology'
    WITH SECURITY_ENFORCED
];
```

### WITH USER_MODE (Winter '23+)

```apex
// Preferred modern approach — enforces CRUD, FLS, and sharing in one clause
List<Account> accounts = [
    SELECT Id, Name, AnnualRevenue
    FROM Account
    WITH USER_MODE
];

// Also works with Database methods
Database.query('SELECT Id FROM Account', AccessLevel.USER_MODE);
```

### Security.stripInaccessible

```apex
List<Account> accounts = [SELECT Id, Name, Secret_Field__c FROM Account];
SObjectAccessDecision decision = Security.stripInaccessible(AccessType.READABLE, accounts);
List<Account> safeAccounts = decision.getRecords();
// Secret_Field__c is removed if user lacks FLS access

// Also works for DML — strip inaccessible fields before insert/update
SObjectAccessDecision createDecision = Security.stripInaccessible(AccessType.CREATABLE, newRecords);
insert createDecision.getRecords();
```

### Anti-Pattern: Manual Schema Describes

```apex
// BAD — verbose, error-prone, easily forgotten on new fields
if (Schema.sObjectType.Account.fields.Name.isAccessible()) {
    // query...
}

// GOOD — use WITH SECURITY_ENFORCED or WITH USER_MODE instead
// The platform handles all fields in a single declaration
```

## SOQL Injection Prevention

Never concatenate user input into SOQL queries.

### Static SOQL (Preferred)

```apex
// BAD — vulnerable to injection
String query = 'SELECT Id FROM Account WHERE Name = \'' + userInput + '\'';
List<Account> results = Database.query(query);

// GOOD — use bind variables (compile-time safe)
List<Account> accounts = [SELECT Id FROM Account WHERE Name = :userInput];
```

### Dynamic SOQL

```apex
// BAD — concatenating user input into dynamic SOQL
String query = 'SELECT Id FROM ' + objectName + ' WHERE ' + fieldName + ' = \'' + value + '\'';

// GOOD — escapeSingleQuotes for string values
String safeValue = String.escapeSingleQuotes(userInput);
String query = 'SELECT Id FROM Account WHERE Name = \'' + safeValue + '\'';

// BETTER — use bind variables with Database.queryWithBinds (API 57.0+)
Map<String, Object> bindMap = new Map<String, Object>{ 'name' => userInput };
String query = 'SELECT Id FROM Account WHERE Name = :name';
List<Account> results = Database.queryWithBinds(query, bindMap, AccessLevel.USER_MODE);

// IMPORTANT — validate object and field names against Schema
if (!Schema.getGlobalDescribe().containsKey(objectName.toLowerCase())) {
    throw new SecurityException('Invalid object: ' + objectName);
}
```

### Anti-Pattern: SOSL Injection

```apex
// BAD — SOSL is also injectable
String searchQuery = 'FIND \'' + userInput + '\' IN ALL FIELDS RETURNING Account(Id, Name)';

// GOOD — escape for SOSL
String safeInput = String.escapeSingleQuotes(userInput);
// Also escape SOSL special characters: ? & | ! { } [ ] ( ) ^ ~ * : \ "
```

## XSS Prevention

### Apex (Visualforce)

```apex
// BAD — raw output
String output = '<div>' + userInput + '</div>';

// GOOD — use HTMLENCODE for output
String safeOutput = String.valueOf(userInput).escapeHtml4();
```

### Visualforce Pages

```html
<!-- BAD — unescaped merge field -->
<apex:outputText value="{!userInput}" escape="false"/>

<!-- GOOD — escape is true by default -->
<apex:outputText value="{!userInput}"/>

<!-- BAD — JavaScript context without encoding -->
<script>var x = '{!userInput}';</script>

<!-- GOOD — use JSENCODE for JavaScript context -->
<script>var x = '{!JSENCODE(userInput)}';</script>

<!-- GOOD — use URLENCODE for URL context -->
<a href="/page?param={!URLENCODE(userInput)}">Link</a>
```

### LWC

LWC automatically escapes template expressions. Avoid using `innerHTML` or `lwc:dom="manual"`.

```javascript
// BAD — bypasses LWC template escaping
this.template.querySelector('div').innerHTML = userInput;

// GOOD — use template expressions (auto-escaped)
// In template: <div>{userInput}</div>

// BAD — lwc:dom="manual" opens XSS risk
// <div lwc:dom="manual"></div>
```

## CSRF Protection

### Visualforce CSRF

```html
<!-- Visualforce pages include a CSRF token automatically via <apex:form> -->
<apex:form>
    <apex:commandButton action="{!save}" value="Save"/>
</apex:form>

<!-- BAD — custom JavaScript POST without CSRF token -->
<!-- GOOD — always use <apex:form> or include the token manually -->
```

### @AuraEnabled Method Security

```apex
// BAD — no access control on Aura/LWC controller methods
@AuraEnabled
public static void deleteRecord(Id recordId) {
    delete [SELECT Id FROM Account WHERE Id = :recordId];
}

// GOOD — enforce CRUD/FLS and validate input
@AuraEnabled
public static void deleteRecord(Id recordId) {
    if (!Schema.sObjectType.Account.isDeletable()) {
        throw new AuraHandledException('Insufficient privileges');
    }
    // Validate the Id is actually an Account
    if (recordId.getSObjectType() != Account.SObjectType) {
        throw new AuraHandledException('Invalid record type');
    }
    delete [SELECT Id FROM Account WHERE Id = :recordId WITH USER_MODE];
}
```

### @AuraEnabled(cacheable=true)

```apex
// cacheable=true methods cannot perform DML — use for read-only operations
// This is a security feature: cached methods are GET requests (no CSRF token needed)
@AuraEnabled(cacheable=true)
public static List<Account> getAccounts() {
    return [SELECT Id, Name FROM Account WITH USER_MODE];
}
```

## Sharing Model

### With Sharing (Default)

```apex
public with sharing class AccountService {
    // Respects org's sharing rules
    // Users only see records they have access to
}
```

### Without Sharing (Use Sparingly)

```apex
public without sharing class SystemService {
    // Only when system-level access is required
    // Document WHY sharing is bypassed
    // Common use cases: rollup calculations, system integrations, batch jobs
}
```

### Inherited Sharing (API 43.0+)

```apex
public inherited sharing class FlexibleService {
    // Inherits sharing context from the calling class
    // If called from with sharing → runs with sharing
    // If called from without sharing → runs without sharing
    // If called from Visualforce/Lightning → runs with sharing (safe default)
    // Use for utility classes and service layers
}
```

### Anti-Pattern: Sharing Declaration Omission

```apex
// BAD — no sharing declaration defaults to "without sharing" in some contexts
public class AmbiguousService {
    // Behavior depends on calling context — unpredictable
}

// GOOD — always declare sharing explicitly
public with sharing class ExplicitService {
    // Intent is clear
}
```

## Callout Security

### Named Credentials (Required)

```apex
// BAD — hardcoded endpoint and credentials
HttpRequest req = new HttpRequest();
req.setEndpoint('https://api.example.com/data');
req.setHeader('Authorization', 'Bearer ' + apiKey); // Where did apiKey come from?

// GOOD — Named Credential handles auth automatically
HttpRequest req = new HttpRequest();
req.setEndpoint('callout:My_Named_Credential/data');
req.setMethod('GET');
// Auth header injected automatically by the platform
```

### External Credentials (New Framework)

```apex
// Modern approach using External Credentials + Named Credentials
// 1. Create External Credential (stores auth details)
// 2. Create Named Credential (references External Credential)
// 3. Assign Principal to Permission Set
// Benefits: per-user auth, OAuth 2.0 flows, credential rotation
```

### Certificate Pinning

```apex
// For mutual TLS (mTLS) callouts
HttpRequest req = new HttpRequest();
req.setEndpoint('callout:Secure_Service/api');
req.setClientCertificateName('MyCert'); // Cert stored in Certificate & Key Management
```

### Remote Site Settings

```apex
// All callout domains must be registered in Remote Site Settings
// or use Named Credentials (which auto-register)
// Never use "Allow All" in production — whitelist specific domains
```

## Lightning Security

### LockerService / Lightning Web Security (LWS)

```javascript
// LockerService (legacy) and LWS (modern) enforce component isolation
// Components can only access their own DOM
// Global objects (window, document) are proxied

// BAD — accessing another component's DOM
document.querySelector('.other-component-class');

// GOOD — use this.template.querySelector for own DOM
this.template.querySelector('.my-class');

// BAD — using eval or Function constructor
eval(someCode);

// GOOD — never use eval in Lightning components
```

### Content Security Policy (CSP)

```
# CSP headers are enforced by the Lightning platform
# Third-party scripts must be loaded as Static Resources
# External script URLs must be added to CSP Trusted Sites

# BAD — inline scripts (blocked by CSP)
<script>alert('blocked');</script>

# GOOD — scripts in separate .js files loaded as Static Resources
```

### lightning:isUrlAddressable

```javascript
// Validate URL parameters in addressable components
import { LightningElement, wire } from 'lwc';
import { CurrentPageReference } from 'lightning/navigation';

export default class SecureAddressable extends LightningElement {
    @wire(CurrentPageReference)
    handlePageRef(pageRef) {
        // Always validate and sanitize URL state parameters
        const recordId = pageRef?.state?.c__recordId;
        if (recordId && recordId.match(/^[a-zA-Z0-9]{15,18}$/)) {
            this.recordId = recordId;
        }
    }
}
```

## Platform Encryption

### Shield Platform Encryption

```
Shield Platform Encryption protects data at rest:
- Deterministic encryption: allows exact-match filtering, grouping, DISTINCT
- Probabilistic encryption: stronger security, no filtering capability

Field types supported:
- Text, Text Area, Long Text Area, Rich Text Area
- Email, Phone, URL
- Date, DateTime
- Custom fields on standard and custom objects

Key management:
- Tenant secrets rotate automatically (or manually)
- Bring Your Own Key (BYOK) available
- Cache-Only Keys for transient encryption
```

### Considerations for Code

```apex
// Deterministic encryption allows = and IN filters
List<Contact> contacts = [
    SELECT Id, Email  // Deterministic encrypted
    FROM Contact
    WHERE Email = :searchEmail  // Works with deterministic
];

// Probabilistic encryption does NOT allow filters
// BAD — this throws a runtime error
// SELECT Id FROM Contact WHERE SSN__c = :searchSSN  // If probabilistic

// GOOD — query by a non-encrypted unique identifier, then filter in code
List<Contact> contacts = [SELECT Id, SSN__c FROM Contact WHERE Id = :knownId];
```

## Session Security

### Session Settings Best Practices

```
Recommended session settings for production orgs:
- Session timeout: 2 hours (or less for sensitive orgs)
- Lock sessions to IP: Enable for internal users
- Lock sessions to domain: Enable
- Force logout on session timeout: Enable
- Require HttpOnly attribute: Enable
- Require secure connections (HTTPS): Enable
- Enable clickjack protection: Enable for all pages
- Enable CSRF protection: Enable (default)
- Enable Content Sniffing protection: Enable
```

### Clickjack Protection

```html
<!-- Salesforce sets X-Frame-Options automatically -->
<!-- For custom Visualforce pages that should NOT be framed: -->
<apex:page showHeader="false">
    <!-- Page content -->
    <!-- Platform adds X-Frame-Options: SAMEORIGIN by default -->
</apex:page>

<!-- To explicitly allow framing (rare, be cautious): -->
<apex:page showHeader="false" applyHtmlTag="false" applyBodyTag="false">
    <!-- Custom HTML without Salesforce frame protection -->
    <!-- Document WHY framing is allowed -->
</apex:page>
```

### Login IP Ranges

```
For profiles and permission sets:
- Restrict login IP ranges for admin profiles
- Use login hours to limit access windows
- Enable SMS/email verification for unfamiliar IPs
- Monitor Login History and Setup Audit Trail
```

## Sensitive Data

- Never hardcode credentials, API keys, or session IDs
- Use Named Credentials for external callouts
- Use Custom Metadata or Protected Custom Settings for secrets
- Never log sensitive data with System.debug
- Remove all System.debug before production deployment
- Use Platform Events (not debug logs) for production monitoring
- Mask sensitive data in error messages returned to users

### Anti-Pattern: Debug Log Exposure

```apex
// BAD — logging sensitive data
System.debug('User SSN: ' + contact.SSN__c);
System.debug('API Key: ' + apiKey);
System.debug('Session ID: ' + UserInfo.getSessionId());

// GOOD — log only identifiers, never values
System.debug('Processing contact: ' + contact.Id);
System.debug('Callout initiated to: My_Named_Credential');
```

## Apex Security Scanner

### SFDX Scanner (PMD)

```bash
# Run PMD-based static analysis
sf scanner run --target force-app/ --format table

# Run with specific security ruleset
sf scanner run --target force-app/ --pmdconfig security-ruleset.xml

# Common security rules detected:
# - ApexCRUDViolation: Missing CRUD/FLS checks
# - ApexSharingViolations: Missing sharing declaration
# - ApexSOQLInjection: SOQL injection risk
# - ApexXSSFromURLParam: XSS from URL parameters
# - ApexOpenRedirect: Open redirect vulnerability
# - ApexInsecureEndpoint: HTTP (not HTTPS) endpoint
```

### Salesforce Code Analyzer

```bash
# Install the Code Analyzer plugin
sf plugins install @salesforce/sfdx-scanner

# Run Graph Engine for deeper analysis (data flow tracking)
sf scanner run:dfa --target force-app/ --projectdir .

# Generate SARIF output for CI integration
sf scanner run --target force-app/ --format sarif --outfile results.sarif
```

### Security Review Preparation

```bash
# Run the full security suite before AppExchange submission
sf scanner run --target force-app/ --format csv --outfile scan-results.csv
sf scanner run:dfa --target force-app/ --projectdir . --format csv --outfile dfa-results.csv

# Address all Critical and High findings
# Document justifications for accepted Medium findings
```

## Security Review Checklist

### Data Access

- [ ] CRUD/FLS enforced on all queries and DML (WITH USER_MODE or WITH SECURITY_ENFORCED)
- [ ] No SOQL injection vulnerabilities (bind variables or escapeSingleQuotes)
- [ ] Sharing model explicitly declared on all Apex classes (with/without/inherited sharing)
- [ ] stripInaccessible used before DML when fields come from external input

### Frontend Security

- [ ] No XSS vulnerabilities in Visualforce (HTMLENCODE, JSENCODE, URLENCODE)
- [ ] No innerHTML or lwc:dom="manual" usage in LWC (or thoroughly reviewed if present)
- [ ] CSRF protection maintained (no custom POST endpoints without tokens)
- [ ] URL parameters validated and sanitized in addressable components

### Authentication & Secrets

- [ ] No hardcoded credentials, API keys, or session IDs
- [ ] Named Credentials used for all external callouts
- [ ] No sensitive data in debug logs (System.debug removed or sanitized)
- [ ] Protected Custom Settings or Custom Metadata for configuration secrets

### Infrastructure

- [ ] Permission Sets properly configured (least privilege)
- [ ] Guest user profiles locked down (minimum required access)
- [ ] Session security settings reviewed (timeout, IP lock, HTTPS)
- [ ] Clickjack protection enabled
- [ ] Remote Site Settings limited to required domains only

### Scanning

- [ ] SFDX Scanner run with zero Critical/High findings
- [ ] Graph Engine DFA analysis completed
- [ ] All findings documented and addressed
