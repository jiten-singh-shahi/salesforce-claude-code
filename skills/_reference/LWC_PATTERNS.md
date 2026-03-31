# LWC Patterns — Reference

> Source: <https://developer.salesforce.com/docs/platform/lwc/guide/>
> Last verified: API v66.0, Spring '26 (2026-03-28)

## Lifecycle Hooks (Execution Order)

| # | Hook | Fires when | Direction | Key constraints |
|---|------|-----------|-----------|----------------|
| 1 | `constructor()` | Component instantiated | — | No DOM access. No attributes/public props. Call `super()` first. |
| 2 | `connectedCallback()` | Inserted into DOM | Parent → child | Can fire more than once (reorder/reinsert). Cannot access child elements. Use `this.isConnected` to check. |
| 3 | `render()` | Before each render | — | Return alternate template import. Rarely needed. |
| 4 | `renderedCallback()` | Render complete | Child → parent | Fires every render. Guard one-time logic with a boolean. Updating state here risks infinite loops. |
| 5 | `disconnectedCallback()` | Removed from DOM | Parent → child | Clean up listeners, caches, message-channel subscriptions. |
| 6 | `errorCallback(error, stack)` | Descendant error | Child → parent | Catches errors in descendant lifecycle/render. Acts as boundary. |

## Reactive Property Rules

| Decorator | Reactivity scope | When required |
|-----------|-----------------|---------------|
| *(none)* | Shallow (`===`) on primitives, new assignment on objects/arrays | Default since Spring '20. All fields are reactive. |
| `@track` | Deep — observes internal mutations on plain `{}` and `[]` | Mutating object properties or array elements in place. Does NOT observe `Date`, `Set`, `Map`, or class instances. |
| `@api` | Shallow — reactive when parent sets new value | Exposing public properties/methods. Defines component API. |
| `@wire` | Reactive via `$`-prefixed params | Binding to wire adapters or Apex methods. |

**Re-render trigger**: only fields accessed during the previous render cycle. New/unaccessed properties do not trigger re-render even with `@track`.

## Wire Service Rules

- `@wire` provisions an **immutable stream**; data objects are read-only (shallow-copy to mutate).
- `$`-prefixed params are reactive; changes re-provision data. Only top-level config values use `$`.
- Wire evaluates only when **all** dynamic params are defined (non-`undefined`).
- Data may come from LDS cache (no network call). Arrival time is **non-deterministic**.
- Do NOT update wire config in `renderedCallback()` (infinite loop).
- Wire chains: one `@wire` output can feed another via `$record.data.fieldName`.
- On init: `constructor` → LDS provisions `{data: undefined, error: undefined}` → `connectedCallback` → `render` → `renderedCallback` → data arrives → re-render.

## Wire Adapters by Module

| Module | Wire adapters | Functions |
|--------|--------------|-----------|
| `lightning/uiRecordApi` | `getRecord`, `getRecords`, `getRecordCreateDefaults` | `createRecord`, `updateRecord`, `deleteRecord`, `notifyRecordUpdateAvailable`, `getFieldValue`, `getFieldDisplayValue`, `generateRecordInputForCreate`, `generateRecordInputForUpdate`, `createRecordInputFilteredByEditedFields` |
| `lightning/uiObjectInfoApi` | `getObjectInfo`, `getObjectInfos`, `getPicklistValues`, `getPicklistValuesByRecordType` | — |
| `lightning/uiListApi` *(deprecated)* | `getListUi` | — |
| `lightning/uiListsApi` | `getListInfoByName`, `getListInfosByListReference` | — |
| `lightning/uiRelatedListApi` | `getRelatedListRecords`, `getRelatedListCount`, `getRelatedListInfo`, `getRelatedListsInfo`, `getRelatedListRecordsBatch`, `getRelatedListInfoBatch` | — |
| `lightning/uiLayoutApi` | `getLayoutUserState` | `updateLayoutUserState` |
| `lightning/graphql` | `graphql` | — |
| `lightning/messageService` | — | `publish`, `subscribe`, `unsubscribe`, `createMessageContext`, `releaseMessageContext` |
| `@salesforce/apex` | Apex methods via `@wire` | Imperative `method({params})` |

## Event Propagation

| `bubbles` | `composed` | Behavior |
|-----------|-----------|----------|
| `false` | `false` | **Default / recommended.** Does not bubble. Does not cross shadow boundary. Listener must be on dispatching element. |
| `true` | `false` | Bubbles within owner's shadow tree. Stops at shadow boundary. Works across slots. |
| `true` | `true` | Bubbles to document root, crosses all shadow boundaries. Becomes public API — namespace event names. |
| `false` | `true` | Uncommon. Does not bubble but crosses shadow boundary. |

- **Retargeting**: `Event.target` is retargeted at each shadow boundary to the host element.
- `Event.composedPath()` returns the full propagation path.
- Always use `CustomEvent` with a `detail` property for data payload.
- Event names: lowercase, no spaces, use hyphens if needed.

## Slot Rules

| Rule | Detail |
|------|--------|
| Unnamed slot | `<slot></slot>` — receives any unslotted child markup. One per component recommended. |
| Named slot | `<slot name="header"></slot>` — parent targets via `slot="header"`. `name` must be a static string. |
| Fallback content | Markup inside `<slot>` renders when no content is passed. |
| Ownership | Slotted content is owned by the **parent** (provider), not the component declaring the `<slot>`. |
| CSS | Parent styles apply to slotted content. Component styles do not pierce into slotted content. |
| DOM access | Slotted elements: `this.querySelector()`. Shadow elements: `this.template.querySelector()`. |
| `slotchange` event | Fires when direct children of a slot change. Does NOT fire for nested child changes. Bubbles but does not cross shadow boundary. |
| Aura interop | Cannot pass Aura components into LWC slots. |
| Conditional slots | Use `lwc:if` / `lwc:else` on `<template>` wrapping slots. Avoid deprecated `if:true`. |
| No ID selectors | IDs are transformed at render time; never use `querySelector('#id')` for slotted or shadow elements. |
