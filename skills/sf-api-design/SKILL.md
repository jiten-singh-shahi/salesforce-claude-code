---
name: sf-api-design
description: "Salesforce API design — custom REST endpoints, batch operations, Composite API, error envelopes, auth. Use when designing APIs exposed from Salesforce. Do NOT use for outbound callouts or Platform Events."
origin: SCC
user-invocable: false
---

# Salesforce API Design

Patterns for designing and implementing custom APIs on the Salesforce platform. Callout limits, Composite API limits, and Named Credential details live in the reference file.

@../_reference/INTEGRATION_PATTERNS.md

## When to Use

- Designing custom REST or SOAP APIs exposed from Salesforce using Apex
- Establishing consistent API response envelopes and error handling patterns
- Configuring authentication for inbound API access
- Building batch REST endpoints for bulk operations
- Reviewing Apex API code for security (CRUD/FLS, input validation, status codes)

---

## Custom REST API Pattern

```apex
@RestResource(urlMapping='/api/accounts/*')
global with sharing class AccountAPI {

    @HttpGet
    global static void getAccount() {
        RestRequest req = RestContext.request;
        RestResponse res = RestContext.response;

        String accountId = req.requestURI.substringAfterLast('/');

        try {
            Account acc = [
                SELECT Id, Name, Industry, AnnualRevenue
                FROM Account WHERE Id = :accountId
                WITH USER_MODE LIMIT 1
            ];

            res.statusCode = 200;
            res.responseBody = Blob.valueOf(JSON.serialize(
                new ApiResponse(true, acc, null)));
        } catch (QueryException e) {
            res.statusCode = 404;
            res.responseBody = Blob.valueOf(JSON.serialize(
                new ApiResponse(false, null, 'Account not found')));
        } catch (Exception e) {
            res.statusCode = 500;
            res.responseBody = Blob.valueOf(JSON.serialize(
                new ApiResponse(false, null, 'An internal error occurred')));
        }
    }

    @HttpPost
    global static void createAccount() {
        RestRequest req = RestContext.request;
        RestResponse res = RestContext.response;

        try {
            Object parsed = JSON.deserializeUntyped(req.requestBody.toString());
            if (!(parsed instanceof Map<String, Object>)) {
                res.statusCode = 400;
                res.responseBody = Blob.valueOf(JSON.serialize(
                    new ApiResponse(false, null,
                        'Expected JSON object, got ' +
                        (parsed instanceof List<Object> ? 'array' : 'primitive')
                    )));
                return;
            }
            Map<String, Object> body = (Map<String, Object>) parsed;
            Account acc = new Account(
                Name = (String) body.get('name'),
                Industry = (String) body.get('industry')
            );

            // stripInaccessible — check getRemovedFields() to avoid silent data loss
            SObjectAccessDecision decision = Security.stripInaccessible(
                AccessType.CREATABLE, new List<Account>{acc});
            if (!decision.getRemovedFields().isEmpty()) {
                res.statusCode = 403;
                res.responseBody = Blob.valueOf(JSON.serialize(
                    new ApiResponse(false, null,
                        'Insufficient field permissions for: ' +
                        decision.getRemovedFields())));
                return;
            }
            insert decision.getRecords();

            res.statusCode = 201;
            res.responseBody = Blob.valueOf(JSON.serialize(
                new ApiResponse(true, decision.getRecords()[0], null)));
        } catch (Exception e) {
            res.statusCode = 400;
            res.responseBody = Blob.valueOf(JSON.serialize(
                new ApiResponse(false, null, e.getMessage())));
        }
    }

    global class ApiResponse {
        public Boolean success;
        public Object data;
        public String error;

        public ApiResponse(Boolean success, Object data, String error) {
            this.success = success;
            this.data = data;
            this.error = error;
        }
    }
}
```

---

## Batch REST Endpoint Pattern

```apex
@HttpPost
global static void bulkCreate() {
    RestRequest req = RestContext.request;
    RestResponse res = RestContext.response;

    try {
        List<Object> items = (List<Object>) JSON.deserializeUntyped(
            req.requestBody.toString());
        List<Account> accounts = new List<Account>();

        for (Object item : items) {
            Map<String, Object> fields = (Map<String, Object>) item;
            accounts.add(new Account(
                Name = (String) fields.get('name'),
                Industry = (String) fields.get('industry')
            ));
        }

        SObjectAccessDecision decision = Security.stripInaccessible(
            AccessType.CREATABLE, accounts);
        List<Database.SaveResult> results =
            Database.insert(decision.getRecords(), false);

        List<Object> response = new List<Object>();
        for (Integer i = 0; i < results.size(); i++) {
            Map<String, Object> row = new Map<String, Object>();
            row.put('index', i);
            row.put('success', results[i].isSuccess());
            row.put('id', results[i].isSuccess() ? results[i].getId() : null);
            if (!results[i].isSuccess()) {
                row.put('errors', results[i].getErrors()[0].getMessage());
            }
            response.add(row);
        }

        res.statusCode = 200;
        res.responseBody = Blob.valueOf(JSON.serialize(
            new ApiResponse(true, response, null)));
    } catch (Exception e) {
        res.statusCode = 400;
        res.responseBody = Blob.valueOf(JSON.serialize(
            new ApiResponse(false, null, e.getMessage())));
    }
}
```

---

## Error Handling Patterns

Structured error codes for API consumers:

```apex
global class ApiError {
    public String code;
    public String message;
    public String field;

    public ApiError(String code, String message, String field) {
        this.code = code;
        this.message = message;
        this.field = field;
    }
}

// Standard error codes:
// FIELD_REQUIRED     — Missing required field
// RECORD_NOT_FOUND   — Record ID doesn't exist or no access
// GOVERNOR_LIMIT     — Operation would exceed governor limits
// INSUFFICIENT_ACCESS — User lacks CRUD/FLS permission
// VALIDATION_FAILED  — Validation rule or trigger prevented save
// DUPLICATE_VALUE    — Unique field constraint violated
```

---

## Authentication for Inbound APIs

| Method | Use When | Setup |
|--------|----------|-------|
| Named Principal | All API users share one Salesforce user | Connected App + single auth |
| Per-User | Each API caller maps to a Salesforce user | Connected App + OAuth per user |
| JWT Bearer | Server-to-server, no user interaction | Connected App + X.509 certificate |
| API Key (Custom) | Simple external tools | Custom Metadata + header validation |

---

## Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| God endpoint (all CRUD in one method) | Hard to maintain and test | One method per operation (@HttpGet, @HttpPost) |
| No pagination | Timeouts, governor limits | Add LIMIT + OFFSET or cursor-based pagination |
| Exposing internal Salesforce IDs | Security risk, breaks across orgs | Use external IDs or custom identifiers |
| No error codes | Consumers can't programmatically handle errors | Return structured error codes |
| No API versioning | Breaking changes affect all consumers | Version via URL path: `/api/v1/accounts/` |
| `WITHOUT SHARING` on API class | Bypasses record-level security | Use `WITH SHARING` on REST resources |
| Returning all fields | Wastes bandwidth, exposes sensitive data | Return only requested/needed fields |

---

## Best Practices

- Use `WITH USER_MODE` in SOQL and `AccessLevel.USER_MODE` in DML
- Use `Security.stripInaccessible()` when you need field-level enforcement on DML -- check `getRemovedFields()` for critical fields
- Return consistent response envelopes (success, data, error)
- Use proper HTTP status codes (200, 201, 400, 404, 500)
- Implement rate limiting awareness (API request limits)
- Version APIs via URL path (`/api/v1/accounts/`)
- Use `Database.insert(records, false)` for bulk APIs to support partial success

---

## Related

- Constraints: sf-security-constraints
- Reference: @../_reference/INTEGRATION_PATTERNS.md
