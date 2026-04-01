# Integration Patterns — Reference

> Source: <https://architect.salesforce.com/fundamentals/integration-patterns>
> Source: <https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_callouts_timeouts.htm>
> Source: <https://help.salesforce.com/s/articleView?id=xcloud.nc_auth_protocols.htm>
> Last verified: API v66.0, Spring '26 (2026-03-28)

## Apex Callout Limits

| Limit | Value |
|---|---|
| Max callouts per transaction | 100 |
| Max cumulative timeout (all callouts) | 120 s |
| Default timeout per callout | 10 s |
| Max configurable timeout per callout | 120 s (120,000 ms) |
| Max request size (sync) | 6 MB |
| Max request size (async) | 12 MB |
| Max response size (sync) | 6 MB |
| Max response size (async) | 12 MB |
| Continuation max timeout | 120 s |
| Continuation max callouts per request | 3 |
| Max redirects followed | 5 |

## Composite API Limits

| Resource | Max Subrequests | Notes |
|---|---|---|
| **Composite** | 25 | Supports references between subrequests; max 5 query/sObject Collections ops |
| **Composite Batch** | 25 | Independent subrequests; no inter-reference |
| **Composite Graph** | 500 | Up to 500 nodes across all graphs in one request |
| **sObject Tree** | 200 records | Insert only; max 5 levels deep |
| **sObject Collections** | 200 records | Create/update/upsert/delete per request |

Each full Composite request counts as **1 API call** against org limits regardless of subrequest count.

## Named Credentials Architecture (New Model, Winter '23+)

Legacy Named Credentials are deprecated. New model splits into two components:

| Component | Purpose |
|---|---|
| **Named Credential** | Defines callout endpoint URL + HTTP transport protocol |
| **External Credential** | Defines authentication protocol + user identity mapping |

One External Credential can back multiple Named Credentials.

### External Credential — Authentication Protocols

| Protocol | Variants |
|---|---|
| **OAuth 2.0** | Client Credentials (client secret), Client Credentials (JWT assertion), JWT Bearer, Browser Flow |
| **JWT** | Signing certificate from subscriber org |
| **AWS Signature V4** | Standard (access key + secret), STS (temporary credentials), STS Roles Anywhere (certificate-based) |
| **Custom** | User-defined headers/tokens; populated via API or per-user |
| **No Authentication** | Anonymous callouts |

### Identity Types

| Type | Behavior |
|---|---|
| **Named Principal** | Single credential shared across all users |
| **Per User** | Each user maps to their own external credential |
| **Anonymous** | No authentication sent |

## Integration Pattern Decision Matrix

| Pattern | Direction | Timing | Protocols / Mechanisms | Volume | Use When |
|---|---|---|---|---|---|
| **Request and Reply** | SF -> External | Sync | Apex REST/SOAP callout, External Services | Small | Need response in same transaction |
| **Fire and Forget** | SF -> External | Async | Platform Events, CDC, Outbound Messages, Pub/Sub API | Small-Med | No response needed; eventual consistency OK |
| **Batch Data Sync** | Bidirectional | Async | Bulk API 2.0, Data Loader, Composite API, ETL | Large (2K+) | Scheduled bulk data movement |
| **Remote Call-In** | External -> SF | Sync | REST API, SOAP API, Composite, Bulk API 2.0, Pub/Sub API | Any | External system initiates CRUD or event publish |
| **UI Update on Data Change** | Internal | Async | CDC, Platform Events, Streaming API, Emp API (LWC) | Real-time | Push UI updates without polling |
| **Data Virtualization** | SF -> External | Sync | Apex HTTP callouts, Salesforce Connect (OData), External Objects | Small | Real-time read without persisting external data |

## Platform Event Limits (Reference)

| Limit | Value |
|---|---|
| Event publish (Apex) | 150 per transaction |
| Event publish (Flow) | 150 per transaction |
| Event publish (API) | Based on API limits |
| Event delivery retention | 72 hours (standard), 24 hours (high-volume) |
| CometD subscribers per org | 2,000 |
| Max event message size | 1 MB |

## External Services Limits

| Limit | Value |
|---|---|
| Schema format | OpenAPI 2.0 and 3.0 |
| Max schema upload size | 10 MB |
| Callouts per Apex transaction | 100 (shared with all Apex callouts) |
| Supported invocation | Flow, Apex, Agentforce Actions |
| Inbound webhooks | Not supported |

## Callout Best Practices (Quick Reference)

- Always use **Named Credentials** — never hard-code endpoints or tokens in Apex.
- Use **Continuations** for long-running callouts in LWC/Aura to avoid holding a thread.
- Use **Queueable** or **@future(callout=true)** to move callouts out of trigger context.
- Use **Composite API** (not individual REST calls) when external systems call into Salesforce to reduce API consumption.
- Use **Platform Events** or **CDC** for fire-and-forget; prefer over Outbound Messages for new builds.
- Use **Bulk API 2.0** (not REST/SOAP) for anything over 2,000 records.
- Set explicit **timeout values** — the 10 s default is often too short for third-party APIs.
