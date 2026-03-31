<!-- Source: https://developer.salesforce.com/docs/atlas.en-us.lightning.meta/lightning/intro_framework.htm -->
<!-- Last verified: API v66.0 — 2026-03-29 -->
<!-- WARNING: Web fetch of canonical URL failed (JS-rendered page). Facts extracted from SCC skill sf-aura-development. Verify against official docs before relying on framework details. -->

# Aura Components Reference

## Status

Aura is in **maintenance mode** (since LWC introduction, 2019). Use LWC for all new development.

## Component Bundle Structure

| File | Extension | Required | Purpose |
|------|-----------|----------|---------|
| Component markup | `.cmp` | Yes | XML template with markup and attributes |
| Client-side controller | `Controller.js` | No | Action handlers (thin; delegates to helper) |
| Helper | `Helper.js` | No | Reusable business logic |
| Renderer | `Renderer.js` | No | Custom rendering overrides (rare) |
| Styles | `.css` | No | Component-scoped CSS |
| Design | `.design` | No | App Builder property editor config |
| Documentation | `.auradoc` | No | Displayed in Component Library |
| SVG icon | `.svg` | No | Custom icon (60x60) |
| Metadata | `.cmp-meta.xml` | Yes (deploy) | apiVersion, description |

Bundle path: `force-app/main/default/aura/<ComponentName>/`

## Attribute Types

| Category | Types |
|----------|-------|
| Primitive | `String`, `Integer`, `Decimal`, `Boolean`, `Date` |
| Collection | `String[]`, `Account[]`, `Map` |
| SObject | Any SObject name (e.g., `Contact`, `Account`) |
| Generic | `Object` (use sparingly) |

## Attribute Rules

- Always provide `default` for collection types to avoid null reference errors.
- Use `access="private"` for internal-only attributes.
- Use `type="Object"` sparingly; prefer typed attributes.

## Event Model

| Aspect | Component Event | Application Event |
|--------|----------------|-------------------|
| Type attribute | `type="COMPONENT"` | `type="APPLICATION"` |
| Scope | Parent-child only | Any component on the page |
| Propagation | Bubbles up containment hierarchy | Broadcast to all handlers |
| Registration | `<aura:registerEvent>` in child | `<aura:registerEvent>` in sender |
| Handling | `<aura:handler>` in parent | `<aura:handler>` anywhere |
| Performance | Lightweight | Heavier (all handlers evaluated) |
| LWC equivalent | `CustomEvent` | Lightning Message Service |

## Lifecycle Handlers

| Handler | Fires When | LWC Equivalent |
|---------|-----------|----------------|
| `aura:handler name="init"` | Component initialized | `connectedCallback()` |
| `aura:handler name="render"` | After render | `renderedCallback()` |
| `aura:handler name="destroy"` | Component destroyed | `disconnectedCallback()` |
| `aura:handler name="change"` | Attribute value changes | Reactive `@api` setter |

## Server-Side Communication

| Pattern | Code | Description |
|---------|------|-------------|
| Enqueue action | `$A.enqueueAction(action)` | All Apex calls go through the action queue |
| Set parameters | `action.setParams({...})` | Pass arguments to `@AuraEnabled` method |
| Callback states | `SUCCESS`, `ERROR`, `INCOMPLETE` | Always handle all three |
| Storable action | `action.setStorable()` | Client-side caching; only for `cacheable=true` methods |
| Background action | `action.setBackground()` | Lower priority; does not block UI queue |

## Storable Action Rules

- Only use on `@AuraEnabled(cacheable=true)` methods.
- Callback may fire twice: once from cache, once from server.
- Never use for DML operations.
- Cache key = action name + parameters.

## Security Model

| Layer | Scope |
|-------|-------|
| Locker Service (legacy) | DOM isolation via SecureElement wrappers; namespace-scoped `document.cookie` |
| Lightning Web Security (current) | Standard APIs with fewer restrictions |
| CSP restrictions | No `eval()`, no `new Function()`, no inline `onclick` attributes |
| `$A.getCallback()` | Required for all async code outside Aura lifecycle (setTimeout, Promises) |

## Key Framework Objects

| Object | Purpose |
|--------|---------|
| `$A` | Framework namespace; `$A.enqueueAction()`, `$A.get()`, `$A.getCallback()`, `$A.createComponent()` |
| `component` | Current component instance; `.get()`, `.set()`, `.find()`, `.getEvent()`, `.isValid()`, `.getGlobalId()` |
| `event` | Event object; `.getParam()`, `.setParams()`, `.fire()`, `.stopPropagation()`, `.getPhase()`, `.getSource()` |
| `helper` | Shared across all instances of the component on the same page |

## Common Interfaces

| Interface | Purpose |
|-----------|---------|
| `force:appHostable` | Can be used as a Lightning app tab |
| `flexipage:availableForAllPageTypes` | Available in App Builder on all page types |
| `force:hasRecordId` | Receives record ID from record pages |
| `force:hasSObjectName` | Receives object API name |

## Aura-to-LWC Migration Map

| Aura | LWC |
|------|-----|
| `aura:attribute` | `@api` property |
| `aura:handler name="init"` | `connectedCallback()` |
| `aura:handler name="render"` | `renderedCallback()` |
| `aura:handler name="destroy"` | `disconnectedCallback()` |
| `aura:if` / `aura:set else` | `lwc:if` / `lwc:elseif` / `lwc:else` |
| `aura:iteration` | `for:each` / `iterator` (requires `key`) |
| `$A.enqueueAction()` | `@wire` or imperative `async/await` import |
| `component.get("v.attr")` | `this.propertyName` |
| `component.set("v.attr", val)` | `this.propertyName = val` (reactive) |
| `component.find("auraId")` | `this.template.querySelector()` |
| `action.setStorable()` | `@wire` with `cacheable=true` |
| Helper.js (separate file) | Class methods in single JS file |
| `$A.getCallback()` | Not needed (LWC handles async natively) |
| `$A.createComponent()` | `lwc:component` with `lwc:is` (API 59+) |
| Application events | Lightning Message Service |
| Component events | `CustomEvent` |
| Locker Service | Lightning Web Security |
| `aura:dependency` | ES module `import` |

## Migration Strategy (ordered)

| Step | Action |
|------|--------|
| 1 | Inventory all Aura components, dependencies, and usage locations |
| 2 | Prioritize leaf components (no child Aura dependencies) |
| 3 | Wrap: replace Aura parents with LWC, keep Aura children via interop |
| 4 | Convert: rewrite using LWC patterns |
| 5 | Test: validate behavior parity |
| 6 | Deploy: replace Aura references on pages/apps |

## LWC-in-Aura Interop Rules

- LWC components embed directly in Aura markup: `<c:lwcChild record-id="{!v.recordId}" />`
- Aura passes data to LWC via attributes mapped to `@api` properties.
- LWC sends data to Aura via `CustomEvent`; Aura reads via `event.getParam("detail")`.
- Pubsub pattern is deprecated; use Lightning Message Service for cross-framework communication.
