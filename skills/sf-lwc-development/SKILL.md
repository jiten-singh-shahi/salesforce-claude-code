---
name: sf-lwc-development
description: "LWC development — components, reactive properties, wire service, Apex integration, events, lifecycle hooks. Use when building LWC components or debugging wire/reactivity. Do NOT use for Aura, Visualforce, or Flow."
origin: SCC
user-invocable: false
---

# LWC Development

Lightning Web Components (LWC) is Salesforce's modern component model based on web standards — Custom Elements, Shadow DOM, and ES modules.

## When to Use

- When building new Lightning Web Components from scratch
- When migrating Aura components to LWC
- When debugging reactive property or wire service issues
- When implementing parent-child communication with events or @api
- When adding LWC components to record pages, app pages, or Experience Cloud sites

@../_reference/LWC_PATTERNS.md

---

## Component Creation Procedure

Every LWC component is a folder with at minimum an HTML template and a JavaScript class.

```
force-app/main/default/lwc/
  accountList/
    accountList.html          <- Template
    accountList.js            <- Component class
    accountList.css           <- Component-scoped styles (optional)
    accountList.js-meta.xml   <- Metadata (targets, properties)
```

### Step 1 — HTML Template

```html
<template>
    <lightning-card title="Accounts" icon-name="standard:account">
        <template lwc:if={isLoading}>
            <lightning-spinner alternative-text="Loading" size="small"></lightning-spinner>
        </template>
        <template lwc:elseif={hasError}>
            <p class="slds-text-color_error">{errorMessage}</p>
        </template>
        <template lwc:else>
            <template for:each={accounts} for:item="account">
                <div key={account.Id} class="account-row">
                    <span>{account.Name}</span>
                    <lightning-button label="View" data-id={account.Id}
                        onclick={handleViewAccount}></lightning-button>
                </div>
            </template>
        </template>
    </lightning-card>
</template>
```

### Step 2 — JavaScript Class

```javascript
import { LightningElement, api, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import getAccounts from '@salesforce/apex/AccountsController.getAccounts';

export default class AccountList extends NavigationMixin(LightningElement) {
    @api recordId;
    @api maxRecords = 10;

    accounts = [];
    isLoading = false;
    error;

    get hasError() { return this.error !== undefined; }
    get isEmpty() { return !this.isLoading && this.accounts.length === 0; }
    get errorMessage() {
        return this.error?.body?.message ?? this.error?.message ?? 'An unknown error occurred.';
    }

    connectedCallback() { this.loadAccounts(); }

    handleViewAccount(event) {
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: { recordId: event.currentTarget.dataset.id,
                          objectApiName: 'Account', actionName: 'view' }
        });
    }

    async loadAccounts() {
        this.isLoading = true;
        this.error = undefined;
        try {
            this.accounts = await getAccounts({
                searchTerm: this.searchTerm, maxRecords: this.maxRecords
            });
        } catch (error) {
            this.error = error;
        } finally {
            this.isLoading = false;
        }
    }
}
```

### Step 3 — Meta XML

```xml
<?xml version="1.0" encoding="UTF-8"?>
<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>66.0</apiVersion>
    <isExposed>true</isExposed>
    <targets>
        <target>lightning__RecordPage</target>
        <target>lightning__AppPage</target>
        <target>lightning__HomePage</target>
    </targets>
    <targetConfigs>
        <targetConfig targets="lightning__RecordPage">
            <property name="maxRecords" type="Integer" default="10"
                      label="Maximum Records to Display" />
        </targetConfig>
    </targetConfigs>
</LightningComponentBundle>
```

---

## Wire Service Usage

The wire service declaratively connects components to Salesforce data and re-runs when reactive parameters change.

### Wire with Apex

```javascript
import { LightningElement, wire, api } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getAccountDetails from '@salesforce/apex/AccountsController.getAccountDetails';

export default class AccountDetails extends LightningElement {
    @api recordId;
    _wiredResult;

    @wire(getAccountDetails, { accountId: '$recordId' })
    wiredAccount(result) {
        this._wiredResult = result;
        if (result.data) {
            this.account = result.data;
            this.error = undefined;
        } else if (result.error) {
            this.error = result.error;
            this.account = undefined;
        }
    }

    async handleSave(event) {
        await updateAccount({ accountId: this.recordId, fields: event.detail.fields });
        await refreshApex(this._wiredResult);
    }
}
```

### Wire with Lightning Data Service

```javascript
import { LightningElement, api, wire } from 'lwc';
import { getRecord, getFieldValue, updateRecord } from 'lightning/uiRecordApi';
import ACCOUNT_NAME from '@salesforce/schema/Account.Name';
import ACCOUNT_INDUSTRY from '@salesforce/schema/Account.Industry';

export default class AccountHeader extends LightningElement {
    @api recordId;

    @wire(getRecord, { recordId: '$recordId', fields: [ACCOUNT_NAME, ACCOUNT_INDUSTRY] })
    account;

    get name() { return getFieldValue(this.account.data, ACCOUNT_NAME); }
    get industry() { return getFieldValue(this.account.data, ACCOUNT_INDUSTRY); }
}
```

---

## Event Handling — Component Communication

### Child to Parent: Custom Events

```javascript
// child: opportunityCard.js
handleSelect() {
    this.dispatchEvent(new CustomEvent('opportunityselect', {
        detail: { opportunityId: this.opportunity.Id },
        bubbles: false, composed: false
    }));
}
```

```html
<!-- parent template -->
<c-opportunity-card opportunity={opp}
    onopportunityselect={handleOpportunitySelect}></c-opportunity-card>
```

### Cross-Component: Lightning Message Service

```javascript
import { publish, subscribe, unsubscribe, MessageContext, APPLICATION_SCOPE }
    from 'lightning/messageService';
import CHANNEL from '@salesforce/messageChannel/OpportunitySelected__c';

// Publisher
@wire(MessageContext) messageContext;
handleSelect(event) {
    publish(this.messageContext, CHANNEL, { opportunityId: event.target.dataset.id });
}

// Subscriber
connectedCallback() {
    this.subscription = subscribe(this.messageContext, CHANNEL,
        (msg) => this.handleMessage(msg), { scope: APPLICATION_SCOPE });
}
disconnectedCallback() { unsubscribe(this.subscription); }
```

---

## Slots — Composition Patterns

```html
<!-- child: modalWrapper.html -->
<template>
    <div class="modal-header"><slot name="header"><h2>Default Header</h2></slot></div>
    <div class="modal-body"><slot></slot></div>
    <div class="modal-footer"><slot name="footer"></slot></div>
</template>

<!-- parent usage -->
<c-modal-wrapper>
    <span slot="header">Edit Account</span>
    <lightning-record-edit-form record-id={recordId} object-api-name="Account">
        <lightning-input-field field-name="Name"></lightning-input-field>
    </lightning-record-edit-form>
    <div slot="footer">
        <lightning-button label="Save" variant="brand" onclick={handleSave}></lightning-button>
    </div>
</c-modal-wrapper>
```

---

## Light DOM

Renders component markup directly into the parent DOM (no shadow boundary).

```javascript
export default class ThemedComponent extends LightningElement {
    static renderMode = 'light';
}
```

Use for: global CSS theming, third-party library integration, Experience Cloud sites, simple leaf components. Query with `this.querySelector()` instead of `this.template.querySelector()`.

---

## Spring '26 Features

### SLDS 2.0

Use `--slds-c-*` styling hooks (replaces `--lwc-*` design tokens). Run `npx slds-lint` to check compliance.

### TypeScript Support

```bash
npm install --save-dev @salesforce/lightning-types
```

### Complex Template Expressions (Beta)

```html
<p>{account.Name ?? 'Unknown Account'}</p>
<p>{formatRevenue(account.AnnualRevenue)}</p>
```

Use getters for production code until this reaches GA.

### LWC in Screen Flows

Expose components as Flow screen actions via `lightning__FlowScreen` target. Implement `@api validate()` for Flow navigation validation.

---

## Related

### Guardrails

- **sf-lwc-constraints** — Enforced rules for LWC naming, reactivity, security, and accessibility

### Agents

- **sf-lwc-reviewer** — For interactive, in-depth LWC review guidance
