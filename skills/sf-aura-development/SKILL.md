---
name: sf-aura-development
description: >-
  Salesforce Aura component development — bundles, events, server-side actions,
  Locker Service, and LWC migration. Use when maintaining or migrating Aura.
origin: SCC
user-invocable: true
---

# Aura Component Development

Aura is Salesforce's original Lightning component framework (introduced 2014). While LWC is the modern standard, thousands of production orgs still run Aura components. This skill covers authoring, maintaining, and migrating Aura components.

**Note:** Aura is in maintenance mode. For new development, use LWC (see sf-lwc-development).

## When to Use

- When maintaining or extending existing Aura components that cannot be rewritten immediately
- When migrating Aura components to LWC and needing to understand the source patterns
- When building interoperability layers between LWC and Aura
- When debugging Aura event propagation, server-side action callbacks, or Locker Service errors
- When working with features that still require Aura wrappers (Lightning Out, legacy AppExchange)

@../_reference/AURA_COMPONENTS.md

---

## Component Creation Procedure

An Aura component is a folder (bundle) containing up to eight files. Only the `.cmp` file is required.

```
force-app/main/default/aura/AccountManager/
    AccountManager.cmp           <- Component markup (required)
    AccountManagerController.js  <- Client-side controller (action handlers)
    AccountManagerHelper.js      <- Reusable logic (called by controller)
    AccountManagerRenderer.js    <- Custom rendering overrides (rare)
    AccountManager.css           <- Component-scoped styles
    AccountManager.design        <- App Builder property editor config
    AccountManager.cmp-meta.xml  <- Metadata (apiVersion, description)
```

### Component Markup (.cmp)

```xml
<aura:component controller="AccountController"
                implements="force:appHostable,flexipage:availableForAllPageTypes"
                access="global">
    <aura:attribute name="accounts" type="Account[]" default="[]" />
    <aura:attribute name="isLoading" type="Boolean" default="true" />
    <aura:attribute name="errorMessage" type="String" />

    <aura:registerEvent name="accountSelected" type="c:AccountSelectedEvent" />
    <aura:handler name="init" value="{!this}" action="{!c.doInit}" />

    <lightning:card title="Account Manager" iconName="standard:account">
        <aura:if isTrue="{!v.isLoading}">
            <lightning:spinner alternativeText="Loading" size="small" />
            <aura:set attribute="else">
                <aura:iteration items="{!v.accounts}" var="acct">
                    <lightning:tile label="{!acct.Name}">
                        <dl class="slds-list_horizontal slds-wrap">
                            <dt class="slds-item_label">Type:</dt>
                            <dd class="slds-item_detail">{!acct.Type}</dd>
                        </dl>
                    </lightning:tile>
                </aura:iteration>
            </aura:set>
        </aura:if>
    </lightning:card>
</aura:component>
```

---

## Event Handling

### Component Events (Parent-Child)

```xml
<!-- AccountSelectedEvent.evt -->
<aura:event type="COMPONENT" description="Fired when an account is selected">
    <aura:attribute name="accountId" type="String" />
</aura:event>
```

```javascript
// Child controller — firing
handleAccountClick: function(component, event, helper) {
    var compEvent = component.getEvent("accountSelected");
    compEvent.setParams({ accountId: event.currentTarget.dataset.accountId });
    compEvent.fire();
}
```

```xml
<!-- Parent — handling -->
<c:AccountTile onaccountSelected="{!c.handleAccountSelected}" />
```

### Application Events (Cross-Component)

```xml
<aura:event type="APPLICATION" description="Broadcast notification">
    <aura:attribute name="message" type="String" />
</aura:event>
```

```javascript
// Firing
var appEvent = $A.get("e.c:GlobalNotificationEvent");
appEvent.setParams({ message: "Record saved" });
appEvent.fire();
```

```xml
<!-- Any component can handle -->
<aura:handler event="c:GlobalNotificationEvent" action="{!c.handleNotification}" />
```

Prefer component events over application events. For new cross-component communication, use Lightning Message Service instead.

---

## Controller and Helper Patterns

Keep controllers thin; helpers do the work.

```javascript
// AccountManagerController.js
({
    doInit: function(component, event, helper) {
        helper.loadAccounts(component);
    },
    handleSearch: function(component, event, helper) {
        helper.loadAccounts(component);
    }
})
```

```javascript
// AccountManagerHelper.js
({
    loadAccounts: function(component) {
        component.set("v.isLoading", true);
        var action = component.get("c.getAccounts");
        action.setParams({
            searchTerm: component.get("v.searchTerm") || ""
        });
        action.setCallback(this, function(response) {
            var state = response.getState();
            if (state === "SUCCESS") {
                component.set("v.accounts", response.getReturnValue());
            } else if (state === "ERROR") {
                this.handleErrors(component, response.getError());
            } else if (state === "INCOMPLETE") {
                component.set("v.errorMessage", "Server unreachable.");
            }
            component.set("v.isLoading", false);
        });
        $A.enqueueAction(action);
    },

    handleErrors: function(component, errors) {
        var message = "Unknown error";
        if (errors && errors[0] && errors[0].message) {
            message = errors[0].message;
        }
        component.set("v.errorMessage", message);
    }
})
```

---

## Server-Side Communication

### $A.enqueueAction() Pattern

All Apex calls in Aura go through the action queue. Handle all three states: SUCCESS, ERROR, INCOMPLETE.

### Storable Actions (Client-Side Caching)

```javascript
var action = component.get("c.getPicklistValues");
action.setStorable(); // Only for @AuraEnabled(cacheable=true) methods
```

Callback may fire twice: once from cache, once from server. Do not use for DML operations.

### $A.getCallback() for Async Code

Any code executing outside the Aura lifecycle (setTimeout, Promises, third-party callbacks) must use `$A.getCallback()`:

```javascript
setTimeout($A.getCallback(function() {
    if (component.isValid()) {
        component.set("v.status", "Complete");
    }
}), 2000);
```

---

## Interoperability with LWC

### Embedding LWC Inside Aura

```xml
<!-- AuraWrapper.cmp -->
<aura:component>
    <c:lwcRecordDetail
        record-id="{!v.selectedRecordId}"
        onrecordupdate="{!c.handleRecordUpdate}" />
</aura:component>
```

**Aura to LWC** — pass data via attributes mapped to `@api` properties.
**LWC to Aura** — dispatch `CustomEvent`; Aura receives via `on{eventname}` handler, access detail via `event.getParam("detail")`.

---

## Migration to LWC

### Strategy

1. **Inventory** — list all Aura components, dependencies, usage locations
2. **Prioritize** — start with leaf components (no child Aura dependencies)
3. **Wrap** — replace Aura parents with LWC, keeping Aura children via interop
4. **Convert** — rewrite using LWC patterns
5. **Test** — validate behavior parity
6. **Deploy** — replace references on pages/apps

### Key Mappings

| Aura | LWC |
|------|-----|
| `aura:handler name="init"` | `connectedCallback()` |
| `aura:handler name="destroy"` | `disconnectedCallback()` |
| `aura:attribute` | `@api` properties |
| `aura:if` / `aura:set` | `lwc:if` / `lwc:elseif` / `lwc:else` |
| `aura:iteration` | `for:each` with `key` |
| `$A.enqueueAction()` | `@wire` or imperative `await` |
| `component.get("v.attr")` | `this.propertyName` |
| `component.set("v.attr", val)` | `this.propertyName = val` |
| `component.find("auraId")` | `this.template.querySelector()` |
| Component events | `CustomEvent` |
| Application events | Lightning Message Service |
| `$A.getCallback()` | Not needed (LWC handles async natively) |
| Helper.js (separate file) | Class methods (single JS file) |
| `$A.createComponent()` | `lwc:component` with `lwc:is` |

---

## Related

### Constraints

- **sf-lwc-constraints** — Enforced rules for LWC (relevant for interop and migration targets)

### Agents

- **sf-aura-reviewer** — For interactive, in-depth Aura review guidance
