---
name: sf-lwc-constraints
description: >-
  Enforce LWC naming, security, accessibility, and performance rules. Use when writing or reviewing ANY LWC component, template, or JS controller. Do NOT use for Apex, Aura, Visualforce, or Flow.
---

# LWC Constraints

## When to Use

This skill auto-activates when writing, reviewing, or modifying any Lightning Web Component, template, or JavaScript controller. It enforces naming, security, accessibility, and performance rules for all LWC artifacts.

Hard rules for Lightning Web Component development. Violations must be flagged
or fixed before code is considered complete.

For lifecycle hooks, reactive property rules, wire service rules, event
propagation, and slot rules see @../_reference/LWC_PATTERNS.md.

---

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Component folder & files | camelCase | `accountList/accountList.js` |
| HTML tag in markup | kebab-case with namespace | `<c-account-list>` |
| Public properties (`@api`) | camelCase in JS, kebab-case in HTML | JS: `@api maxRecords` / HTML: `max-records="10"` |
| Private fields | camelCase, prefix `_` for backing fields | `_wiredResult`, `isLoading` |
| Custom events | lowercase, no spaces, hyphens allowed | `opportunityselect`, `row-action` |
| CSS classes | SLDS utilities or BEM for custom | `slds-p-around_medium`, `card__title` |

**Never** use PascalCase or UPPER_CASE for component folder names or file names.

---

## Never Do

| Rule | Reason |
|------|--------|
| Direct DOM manipulation (`document.createElement`, `innerHTML`, `appendChild`) | Breaks Shadow DOM encapsulation and LWS security model. Use template directives (`lwc:if`, `for:each`) and reactive state instead. |
| Imperative Apex when `@wire` works | Wire provides caching via LDS, automatic re-provisioning on param change, and offline support. Use imperative calls only for DML or non-cacheable operations. |
| Inline styles (`style="color:red"`) | Violates SLDS theming, breaks dark mode (SLDS 2.0), and bypasses component-scoped CSS. Use SLDS utility classes or CSS custom properties. |
| `querySelector('#id')` for shadow or slotted elements | Element IDs are transformed at render time. Use `this.template.querySelector('.class')` for shadow elements, `this.querySelector('.class')` for light DOM. |
| Update `@wire` config inside `renderedCallback()` | Creates an infinite re-render loop: render -> renderedCallback -> wire config change -> re-provision -> re-render. |
| Mutate `@wire` result data directly | Wire data is immutable (read-only). Shallow-copy (`{...data}` or `[...data]`) before mutating. |
| Use deprecated `if:true` / `if:false` directives | Replaced by `lwc:if` / `lwc:elseif` / `lwc:else` (GA). Deprecated directives will be removed. |
| Skip `super()` in `constructor()` | Required by the Custom Elements spec. Omitting it throws a runtime error. |
| Access DOM in `constructor()` | Shadow DOM is not attached yet. No `this.template`, no child elements, no attributes. |
| Dispatch events with `bubbles:true, composed:true` without namespacing | Composed events cross all shadow boundaries and become public API. Namespace the event name to avoid collisions. |
| Use `localStorage`/`sessionStorage` without namespace awareness | Under LWS, storage is namespace-scoped. Keys that worked under Locker may behave differently. |
| Heavy logic in `renderedCallback()` without a guard | Fires on every render cycle. Unguarded work causes performance degradation or infinite loops if it updates reactive state. |

---

## Always Do

| Rule | Detail |
|------|--------|
| Use `@api` for all public properties and methods | Defines the component's contract. Without `@api`, properties are private and invisible to parent components and App Builder. |
| Use kebab-case for component tags in HTML | `<c-account-list>`, never `<c-accountList>`. The framework maps kebab-case tags to camelCase folder names automatically. |
| Use camelCase for JS properties | `@api maxRecords`, not `@api max_records`. Kebab-to-camelCase mapping applies when attributes are set in HTML. |
| Provide `alternative-text` on `<lightning-spinner>` | Required for screen-reader accessibility. Omitting it is a WCAG violation. |
| Provide `label` on all `<lightning-input>` elements | Required for accessibility. Use `variant="label-hidden"` if visual label must be hidden, but never omit `label` entirely. |
| Set `key` on iterated elements | `for:each` requires a unique, stable `key` attribute (use record `Id`, not array index). Missing keys cause rendering bugs. |
| Use `lwc:if` / `lwc:elseif` / `lwc:else` for conditionals | Modern directive (GA). Always prefer over deprecated `if:true`/`if:false`. |
| Implement `errorCallback(error, stack)` or wrap with error boundary | Catches descendant lifecycle and render errors. Without it, a child error crashes the entire component tree. |
| Clean up in `disconnectedCallback()` | Remove `window`/`document` event listeners, `unsubscribe()` from message channels, clear timers. Prevents memory leaks. |
| Store bound references for event listeners | `this._boundHandler = this.handler.bind(this)` in constructor, so `removeEventListener` gets the same reference as `addEventListener`. |
| Set `<apiVersion>66.0</apiVersion>` in `.js-meta.xml` | Target Spring '26. Older API versions miss LWS, SLDS 2.0 styling hooks, and new wire adapters. |
| Use `WITH USER_MODE` in backing Apex SOQL | Enforces FLS/CRUD. Required for security review. The LWC itself does not bypass object permissions, but its Apex must not either. |
| Prefer SLDS utility classes over custom CSS | Ensures dark mode compatibility (SLDS 2.0), consistent spacing, and responsive layout. |

---

## Anti-Pattern Table

| Anti-Pattern | Correct Pattern | Why |
|-------------|----------------|-----|
| `document.querySelector('.my-class')` | `this.template.querySelector('.my-class')` | Shadow DOM scoping. `document` queries cannot reach inside shadow roots. |
| `@track` on primitives or simple reassignments | Remove `@track`; all fields are reactive since Spring '20 | `@track` is only needed for deep observation of object/array mutations in place. Overuse adds confusion. |
| Imperative Apex in `connectedCallback` for cacheable reads | `@wire(getRecord, ...)` or `@wire(apexMethod, ...)` | Wire caches via LDS, re-provisions automatically, and works offline. Imperative calls bypass the cache. |
| `setTimeout` to wait for DOM | `renderedCallback()` with a guard flag | The DOM is guaranteed available in `renderedCallback`. `setTimeout` is fragile and race-prone. |
| `event.target` inside shadow boundary listeners | `event.currentTarget` or `event.target.dataset.*` | `event.target` is retargeted at shadow boundaries. Use `currentTarget` for the element the listener is attached to. |
| Hardcoded field API names as strings | Import from `@salesforce/schema` | Schema imports give compile-time validation, refactoring safety, and dependency tracking. |
| `console.log` left in production code | Remove or guard with `IS_DEBUG` flag | Console output is visible to end users in browser dev tools and degrades performance at scale. |
| Fetching all records then paginating client-side | Server-side pagination via `OFFSET`/`LIMIT` or SOQL cursors (v66.0+) | Client-side pagination loads all data upfront; breaks on large datasets. |
| `if:true={property}` | `lwc:if={property}` | `if:true`/`if:false` are deprecated. `lwc:if` supports `elseif`/`else` chains and will be the only option going forward. |
| Inline `style="width:100px"` | CSS class or SLDS utility `slds-size_full` | Inline styles bypass theming, break dark mode, and cannot be overridden by styling hooks. |
| Missing `.js-meta.xml` `<targets>` | Declare all intended surfaces (`RecordPage`, `AppPage`, etc.) | Component will not appear in App Builder or Flow without explicit target declarations. |

---

## Wire Service Constraints

1. **All** `$`-prefixed reactive params must be defined (non-`undefined`) before the wire adapter fires.
2. Wire data arrives **non-deterministically** -- never assume it is available in `connectedCallback`.
3. Wire chains (`$record.data.fieldName`) are valid but add latency; keep chains to two hops max.
4. Use `refreshApex(wiredResult)` after imperative DML -- store the full wire result reference (`_wiredResult`) for this purpose.
5. For `@wire` with Apex, the Apex method must be annotated `@AuraEnabled(cacheable=true)`.

---

## Event Constraints

1. Default to `{ bubbles: false, composed: false }` for parent-child communication.
2. Always use `CustomEvent` with a `detail` property for data payload -- never custom properties on the event object.
3. Parent listens with `on{eventname}` (all lowercase, no hyphens in the `on` prefix).
4. If `composed: true` is required, namespace the event name (e.g., `myns__recordupdate`) to prevent collisions.

---

## Accessibility Constraints

1. Every interactive element must be keyboard-operable (focusable, activatable via Enter/Space).
2. Every `<lightning-spinner>` must have `alternative-text`.
3. Every `<lightning-input>` must have `label` (use `variant="label-hidden"` to visually hide).
4. Every `<lightning-icon>` used as a meaningful indicator must have `alternative-text`; decorative icons should set `aria-hidden="true"`.
5. Color must never be the sole indicator of state -- pair with text, icon, or ARIA attributes.
6. Custom components exposing interactive regions should set appropriate `role` and `aria-*` attributes.

---

## Meta XML Constraints

1. Always include `<apiVersion>66.0</apiVersion>` (Spring '26).
2. Set `<isExposed>true</isExposed>` for any component intended for App Builder, Flow, or Experience Cloud.
3. Declare every intended surface in `<targets>`.
4. Expose configurable `@api` properties via `<targetConfigs>` with `label`, `type`, and `description`.
