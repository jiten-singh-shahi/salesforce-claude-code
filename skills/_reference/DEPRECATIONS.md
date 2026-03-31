# Salesforce Deprecations & Retirements

> Last verified: 2026-03-31
>
> **MAINTENANCE:**
> 1. Append new entries with `Added: YYYY-MM` when Salesforce announces deprecations
> 2. Remove entries older than 24 months (model knows them). Exception: "Retiring Soon" entries stay until retirement date + 24 months.
> 3. Update "Last verified" date
> 4. Releases and deprecations are INDEPENDENT — a new release does NOT deprecate the previous one

## Already Retired — NEVER Suggest These

| Feature | Retired | Replacement | Added |
|---------|---------|-------------|-------|
| Customizable Forecasting | Summer '20 | Collaborative Forecasting | 2026-03 |
| Original Territory Management | Summer '21 | Sales Territories (fka ETM 2.0) | 2026-03 |
| Classic Knowledge | Summer '25 | Lightning Knowledge (`Knowledge__kav` + Record Types) | 2026-03 |
| Salesforce Functions | Jan 2025 | External Services / Heroku | 2026-03 |
| API versions 21.0–30.0 | Summer '25 (v64.0) | Minimum supported: v31.0 | 2026-03 |
| SOAP `login()` at v65.0+ | Winter '26 (v65.0) | OAuth 2.0 (JWT Bearer, Web Server, Client Credentials) | 2026-03 |
| Legacy Chat / Live Agent / Embedded Chat | Feb 14, 2026 | Messaging for In-App and Web | 2026-03 |
| Pipeline Inspection Close Date Predictions | Jan 2025 | Einstein Opportunity Scoring | 2026-03 |
| Document Generation 1.0 | Jul 2025 | Document Generation 2.0 | 2026-03 |
| Einstein Automated Contacts | Spring '25 (v63.0) | Manual / Agentforce | 2026-03 |
| Service Setup Assistant (new orgs) | Spring '26 (v66.0) | Salesforce Go | 2026-03 |

## End of Sale — No New Licenses

| Feature | End of Sale | Successor | Added |
|---------|------------|-----------|-------|
| Salesforce CPQ | March 27, 2025 | Agentforce Revenue Management (ARM). NO automated migration path. | 2026-03 |
| Sales Dialer (new licenses) | Spring '26 | Partner telephony / Agentforce Contact Center | 2026-03 |

## Retiring Soon — WARN Users

| Feature | Retirement Date | Action Required | Added |
|---------|----------------|-----------------|-------|
| Standard Omni-Channel | June 1, 2026 | Migrate to Enhanced Omni-Channel before cutoff | 2026-03 |
| EWS for Einstein Activity Capture | Aug 2026 | Migrate to Microsoft Graph (one-way, per-user reconnect) | 2026-03 |
| Standard-Volume Platform Events | June 2027 | Migrate to High-Volume Platform Events | 2026-03 |
| Salesforce for Outlook | Dec 2027 | Outlook Integration + Einstein Activity Capture | 2026-03 |
| SOAP `login()` for API v31–64 | Summer '27 | OAuth 2.0 | 2026-03 |

## End of Support (Still Executes, No Bug Fixes)

| Feature | End of Support | Replacement | Added |
|---------|---------------|-------------|-------|
| Workflow Rules | Dec 31, 2025 | Flow Builder | 2026-03 |
| Process Builder | Dec 31, 2025 | Flow Builder | 2026-03 |

## Product Renames — Use Current Names

| Old Name | Current Name | Changed | Added |
|----------|-------------|---------|-------|
| Enterprise Territory Management 2.0 | Sales Territories | Summer '24 | 2026-03 |
| High Velocity Sales | Sales Engagement | Winter '24 | 2026-03 |
| Salesforce CPQ / Revenue Cloud Advanced | Agentforce Revenue Management (ARM) | Oct 2025 | 2026-03 |
| Sales Cloud (branding) | Agentforce Sales | Spring '26 | 2026-03 |
| Einstein Service Agent | Agentforce Service Agent | Jan 2025 | 2026-03 |
| Einstein Copilot | Agentforce | Jan 2025 | 2026-03 |
| Omni-Channel Supervisor | Command Center for Service | Spring '26 | 2026-03 |

## Beta Features — NOT Production-Ready

| Feature | Status | Notes | Added |
|---------|--------|-------|-------|
| RunRelevantTests | Beta (Spring '26 v66.0) | Do not rely on for production deployments | 2026-03 |
| LWC Complex Template Expressions | Beta/Pilot (Spring '26) | Explicitly "do not use in production" | 2026-03 |
| Agent Script | Public Beta (Nov 2025) | No GA date announced | 2026-03 |

## API Breaking Changes

| Change | API Version | Impact | Added |
|--------|------------|--------|-------|
| SOAP `login()` removed | v65.0+ (Winter '26) | Use OAuth 2.0 | 2026-03 |
| Abstract/override require explicit access modifier | v65.0+ (Winter '26) | Add public/protected/global to abstract/override methods | 2026-03 |
| Legacy hostnames return 404 | Spring '26 (v66.0) | Use MyDomain URLs only (na1.salesforce.com no longer works) | 2026-03 |
| Session IDs removed from outbound messages | Feb 16, 2026 | Use OAuth for callbacks instead of session ID | 2026-03 |
