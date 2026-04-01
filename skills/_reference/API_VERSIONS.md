# Salesforce API Versions — Feature Tracker

> Last verified: 2026-03-31 against Spring '26 (API v66.0)
> Source: <https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/dome_versions.htm>
>
> **MAINTENANCE:**
>
> 1. When a new release ships: add section at TOP with `Added: YYYY-MM`
> 2. Remove sections older than 24 months (model knows them by then)
> 3. Update "Last verified" date
> 4. Deprecations go in DEPRECATIONS.md (separate file, independent cadence)
> 5. Releases and deprecations are INDEPENDENT — a new release does NOT deprecate the previous one

## Spring '26 — API v66.0 (Current) `Added: 2026-03`

| Feature | Version | Status | Description |
|---------|---------|--------|-------------|
| `Database.Cursor` / `Database.getCursor()` | v66.0 | GA | Paginate up to 50M SOQL rows |
| `Database.PaginationCursor` | v66.0 | GA | `@AuraEnabled`-compatible cursor for LWC |
| GraphQL Mutations in LWC | v66.0 | GA | `executeMutation` for create/update/delete |
| Named Query API | v66.0 | GA | Custom SOQL exposed as REST endpoints |
| Autonomous Actions | v66.0 | GA | Expose Apex REST / `@AuraEnabled` as Agentforce actions via OpenAPI |
| SLDS 2.0 | v66.0 | GA | New Lightning Design System |
| `RunRelevantTests` test level | v66.0 | **Beta** | Smart test selection — do NOT rely on for production |
| `@testFor` annotation | v66.0 | **Beta** | Map test class to production class (pairs with RunRelevantTests) |
| LWC Complex Template Expressions | v66.0 | **Beta/Pilot** | Do NOT use in production |
| Agent Script | v66.0 | **Public Beta** | Deterministic + LLM blocks, no GA date |

## Winter '26 — API v65.0 `Added: 2026-03`

| Feature | Version | Status | Description |
|---------|---------|--------|-------------|
| SOAP `login()` removed | v65.0 | Breaking | Use OAuth 2.0 instead |
| Abstract/override access modifiers | v65.0 | Breaking | Must add explicit public/protected/global |
| GraphQL optional fields (`lightning/graphql`) | v65.0 | GA | Resilient queries with optional field support |
| Unified Logic Testing | v65.0 | GA | Apex + Flow tests in single command |
| External Services binary files | v65.0 | GA | Upload/download up to 16 MB via OpenAPI 3.0 |

## Summer '25 — API v64.0 `Added: 2026-03`

| Feature | Version | Status | Description |
|---------|---------|--------|-------------|
| API v21–30 retired | v64.0 | Breaking | Minimum supported version: v31.0 |
| OpenAPI support for REST API | v64.0 | GA | Client SDK generation from OpenAPI spec |
| Data Cloud Enrichment APIs | v64.0 | GA | Enriched related lists on Cases, Contracts |
| Streaming API disconnect handling | v64.0 | GA | `/meta/disconnect` channel for connection status |

## Stable Version-Gated Features (Older — retained for reference)

| Feature | Min API Version | Release | Notes |
|---|---|---|---|
| Null coalescing operator (`??`) | v60.0 | Spring '24 | `value ?? defaultValue` |
| `Database.queryWithBinds()` | v57.0 | Spring '23 | Safe dynamic SOQL with bind maps |
| `WITH USER_MODE` / `AccessLevel.USER_MODE` | v57.0 | Spring '23 GA | CRUD + FLS enforcement (Beta v55.0 Summer '22) |
| `Assert` class (`Assert.areEqual`, etc.) | v56.0 | Winter '23 | Replaces `System.assertEquals` |
| External Credentials | v54.0 | Spring '22 | Secure OAuth/JWT/API key storage |
| Null-safe navigation (`?.`) | v50.0 | Winter '21 | `obj?.field?.subfield` |
| `WITH SECURITY_ENFORCED` | v48.0 | Spring '20 | CRUD + FLS for reads (older pattern) |
| `Security.stripInaccessible()` | v48.0 | Spring '20 | Bulk FLS enforcement |

## Version Selection Guide

| Scenario | Recommendation |
|---|---|
| New project | Use v66.0 (Spring '26 GA) |
| Existing project | Match `sfdx-project.json` `sourceApiVersion` |
| Managed package | Pin to minimum supported version for subscriber compatibility |
| `RunRelevantTests` adoption | Requires `sourceApiVersion` >= v66.0 (Beta — not for production) |

## sfdx-project.json Version Setting

```json
{
  "sourceApiVersion": "66.0"
}
```

This controls the API version used for `sf project deploy` and `sf project retrieve`. Individual class `-meta.xml` files can override with their own `<apiVersion>` value.
