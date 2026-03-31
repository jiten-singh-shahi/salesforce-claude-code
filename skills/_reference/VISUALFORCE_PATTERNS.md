<!-- Source: https://developer.salesforce.com/docs/atlas.en-us.pages.meta/pages/pages_intro.htm -->
<!-- Last verified: API v66.0 — 2026-03-29 -->
<!-- WARNING: Web fetch of canonical URL failed (LWR client-side rendering). Facts below extracted from sf-visualforce-development skill. -->

# Visualforce Patterns — Reference

## Page Structure

| Attribute | Purpose | Notes |
|-----------|---------|-------|
| `standardController` | Binds to standard SObject controller | Mutually exclusive with `controller` |
| `controller` | Custom Apex controller class | Mutually exclusive with `standardController` |
| `extensions` | Comma-separated controller extensions | Works with either controller type |
| `renderAs` | Output format (`"pdf"` for PDF generation) | LWC cannot do this natively |
| `lightningStylesheets` | Apply SLDS styling | Use for Lightning-compatible look |
| `docType` | HTML doctype | Use `"html-5.0"` for modern pages |
| `sidebar` | Show/hide Classic sidebar | Boolean |
| `showHeader` | Show/hide Classic header | Boolean |
| `applyBodyTag` | Generate `<body>` tag | Set `false` for full HTML control |

## Controller Types

| Type | Class Pattern | Constructor Signature | Use Case |
|------|--------------|----------------------|----------|
| Standard Controller | Built-in (no Apex) | N/A | Single-record CRUD without custom logic |
| Standard List Controller | Built-in (`recordSetVar`) | N/A | List views with pagination (`hasNext`, `hasPrevious`) |
| Custom Controller | `public with sharing class Ctrl` | No-arg: `public Ctrl()` | Full control over logic, data, navigation |
| Controller Extension | `public with sharing class Ext` | `public Ext(ApexPages.StandardController sc)` | Add functionality to standard/custom controllers |

## ViewState

| Fact | Value |
|------|-------|
| Maximum ViewState size | **170 KB** (runtime error if exceeded) |
| Storage mechanism | Hidden, encrypted form field |
| Survives across | Postbacks (form submissions) |

### What Counts Toward ViewState

- All non-transient controller/extension instance variables
- Component tree state
- Expressions evaluated in the page

### ViewState Reduction Strategies

| Strategy | Impact |
|----------|--------|
| `transient` keyword on large/recomputable variables | High |
| `apex:outputPanel` + `reRender` (partial refresh) | Medium |
| Paginate large data sets (store only current page) | High |
| JavaScript Remoting instead of action methods (stateless) | High |
| Move read-only data to `<apex:repeat>` outside `<apex:form>` | Medium |
| Store IDs only, re-query on postback | Medium |

## Encoding Functions (XSS Prevention)

| Function | Context | Example |
|----------|---------|---------|
| `HTMLENCODE()` | HTML attributes, raw HTML | `<div title="{!HTMLENCODE(val)}">` |
| `JSENCODE()` | JavaScript strings in `<script>` blocks | `var x = '{!JSENCODE(val)}';` |
| `URLENCODE()` | URL parameters | `?q={!URLENCODE(val)}` |
| `JSINHTMLENCODE()` | JS inside HTML event handlers only | `onclick="fn('{!JSINHTMLENCODE(val)}')"` |

## Security Patterns

| Threat | Prevention |
|--------|-----------|
| XSS | Auto-escaped by `apex:outputText`, `apex:outputField`; never use `escape="false"` with user data |
| CSRF | Use `<apex:form>` (auto-includes CSRF token); never raw `<form>` tags |
| SOQL Injection | Use bind variables (`:term`) or `String.escapeSingleQuotes()`; prefer `Database.queryWithBinds()` |
| CRUD/FLS bypass | Controllers run in system mode; use `WITH USER_MODE` in SOQL, `AccessLevel.USER_MODE` in DML |
| Rich text XSS | Use `apex:outputField` for rich text fields; `String.stripHtmlTags()` to strip all HTML |

## Key Components

| Component | Purpose |
|-----------|---------|
| `apex:page` | Page container (defines controller, attributes) |
| `apex:form` | Form with CSRF token |
| `apex:pageBlock` / `apex:pageBlockSection` | Structured layout blocks |
| `apex:pageBlockTable` | Data table bound to collection |
| `apex:commandButton` / `apex:commandLink` | Server-side action triggers |
| `apex:inputField` / `apex:outputField` | CRUD/FLS-aware field input/output |
| `apex:actionFunction` | Call controller from JavaScript |
| `apex:actionSupport` | Fire action on DOM event |
| `apex:actionPoller` | Periodic server poll (interval in seconds) |
| `apex:actionStatus` | Loading indicator |
| `apex:outputPanel` | Rerenderable container |
| `apex:repeat` | Non-table iteration |
| `apex:includeLightning` | Enables Lightning Out (embed LWC in VF) |
| `apex:pageMessages` | Display ApexPages.addMessage feedback |
| `apex:slds` | Include SLDS stylesheets |

## JavaScript Remoting

| Fact | Value |
|------|-------|
| Annotation | `@RemoteAction` (must be `public static`) |
| Invocation | `Visualforce.remoting.Manager.invokeAction()` |
| Reference syntax | `{!$RemoteAction.ClassName.methodName}` (namespace-safe) |
| ViewState impact | None (fully stateless) |
| `escape: true` | Auto-escapes HTML in response (prevents XSS) |
| `timeout` | Configurable in ms (e.g., `30000` for 30s) |

## Migration Decision: Keep VF vs Migrate to LWC

| Keep Visualforce | Migrate to LWC |
|-----------------|----------------|
| PDF generation (`renderAs="pdf"`) | High-traffic pages needing performance |
| Email templates (VF/HTML) | Standard controller overrides |
| Complex server-state wizards | New feature development (always LWC) |
| | Pages using Apex controller only (easy migration) |

## Lightning Out (Embed LWC in VF)

| Step | Detail |
|------|--------|
| 1 | Add `<apex:includeLightning />` to VF page |
| 2 | Create Aura app extending `ltng:outApp` with `<aura:dependency>` |
| 3 | Call `$Lightning.use("c:appName", callback)` |
| 4 | Call `$Lightning.createComponent("c:lwcName", attrs, containerId)` |
