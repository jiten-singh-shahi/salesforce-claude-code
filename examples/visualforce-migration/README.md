# Migrating Visualforce to LWC

Side-by-side examples showing how to convert a Visualforce page with an Apex controller to a Lightning Web Component using modern patterns.

## When to Use This Pattern

- Modernizing legacy Visualforce pages to Lightning Experience
- Converting controller-based pages to wire-service LWC components
- Replacing `apex:form` with `lightning-record-edit-form`
- Migrating page navigation from `PageReference` to `NavigationMixin`
- Preparing for retirement of Visualforce in Lightning-only orgs

## Original Visualforce Page

### Visualforce Markup

```html
<!-- AccountEditor.page -->
<apex:page controller="AccountEditorController" lightningStylesheets="true">
    <apex:form>
        <apex:pageBlock title="Edit Account" mode="edit">
            <apex:pageMessages />

            <apex:pageBlockButtons>
                <apex:commandButton action="{!save}" value="Save" />
                <apex:commandButton action="{!cancel}" value="Cancel" immediate="true" />
            </apex:pageBlockButtons>

            <apex:pageBlockSection columns="2">
                <apex:inputField value="{!account.Name}" required="true" />
                <apex:inputField value="{!account.Industry}" />
                <apex:inputField value="{!account.Phone}" />
                <apex:inputField value="{!account.Website}" />
                <apex:inputField value="{!account.AnnualRevenue}" />
                <apex:inputField value="{!account.Description}" />
            </apex:pageBlockSection>

            <apex:pageBlockSection title="Related Contacts" columns="1">
                <apex:pageBlockTable value="{!contacts}" var="c">
                    <apex:column value="{!c.Name}" />
                    <apex:column value="{!c.Email}" />
                    <apex:column value="{!c.Phone}" />
                </apex:pageBlockTable>
            </apex:pageBlockSection>
        </apex:pageBlock>
    </apex:form>
</apex:page>
```

### Visualforce Controller

```apex
public with sharing class AccountEditorController {
    public Account account { get; set; }
    public List<Contact> contacts { get; set; }

    public AccountEditorController() {
        Id accountId = ApexPages.currentPage().getParameters().get('id');
        if (accountId != null) {
            account = [
                SELECT Id, Name, Industry, Phone, Website, AnnualRevenue, Description
                FROM Account WHERE Id = :accountId
            ];
            contacts = [
                SELECT Id, Name, Email, Phone
                FROM Contact WHERE AccountId = :accountId
                ORDER BY Name
            ];
        } else {
            account = new Account();
            contacts = new List<Contact>();
        }
    }

    public PageReference save() {
        try {
            upsert account;
            return new PageReference('/' + account.Id);
        } catch (DmlException e) {
            ApexPages.addMessages(e);
            return null;
        }
    }

    public PageReference cancel() {
        if (account.Id != null) {
            return new PageReference('/' + account.Id);
        }
        return new PageReference('/001'); // Account list view
    }
}
```

## Equivalent LWC Component

### LWC HTML

```html
<!-- accountEditor.html -->
<template>
    <lightning-card title="Edit Account" icon-name="standard:account">
        <!-- Record Edit Form replaces apex:form + apex:inputField -->
        <lightning-record-edit-form
            record-id={recordId}
            object-api-name="Account"
            onsuccess={handleSuccess}
            onerror={handleError}>

            <lightning-messages></lightning-messages>

            <div class="slds-grid slds-wrap slds-gutters">
                <div class="slds-col slds-size_1-of-2 slds-p-around_small">
                    <lightning-input-field field-name="Name" required></lightning-input-field>
                </div>
                <div class="slds-col slds-size_1-of-2 slds-p-around_small">
                    <lightning-input-field field-name="Industry"></lightning-input-field>
                </div>
                <div class="slds-col slds-size_1-of-2 slds-p-around_small">
                    <lightning-input-field field-name="Phone"></lightning-input-field>
                </div>
                <div class="slds-col slds-size_1-of-2 slds-p-around_small">
                    <lightning-input-field field-name="Website"></lightning-input-field>
                </div>
                <div class="slds-col slds-size_1-of-2 slds-p-around_small">
                    <lightning-input-field field-name="AnnualRevenue"></lightning-input-field>
                </div>
                <div class="slds-col slds-size_1-of-1 slds-p-around_small">
                    <lightning-input-field field-name="Description"></lightning-input-field>
                </div>
            </div>

            <div class="slds-m-top_medium slds-p-around_small">
                <lightning-button variant="brand" type="submit" label="Save"></lightning-button>
                <lightning-button label="Cancel" onclick={handleCancel} class="slds-m-left_x-small"></lightning-button>
            </div>
        </lightning-record-edit-form>

        <!-- Related Contacts section -->
        <template if:true={contacts.data}>
            <div class="slds-p-around_small slds-m-top_medium">
                <h2 class="slds-text-heading_small slds-m-bottom_small">Related Contacts</h2>
                <lightning-datatable
                    key-field="Id"
                    data={contacts.data}
                    columns={contactColumns}
                    hide-checkbox-column>
                </lightning-datatable>
            </div>
        </template>
    </lightning-card>
</template>
```

### LWC JavaScript

```javascript
// accountEditor.js
import { LightningElement, api, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getRelatedContacts from '@salesforce/apex/AccountEditorLwcController.getRelatedContacts';

const CONTACT_COLUMNS = [
    { label: 'Name', fieldName: 'Name', type: 'text' },
    { label: 'Email', fieldName: 'Email', type: 'email' },
    { label: 'Phone', fieldName: 'Phone', type: 'phone' }
];

export default class AccountEditor extends NavigationMixin(LightningElement) {
    @api recordId;
    contactColumns = CONTACT_COLUMNS;

    @wire(getRelatedContacts, { accountId: '$recordId' })
    contacts;

    handleSuccess(event) {
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Success',
                message: 'Account saved successfully',
                variant: 'success'
            })
        );

        // Navigate to the record page (replaces PageReference)
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: event.detail.id,
                objectApiName: 'Account',
                actionName: 'view'
            }
        });
    }

    handleError(event) {
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Error',
                message: event.detail.message,
                variant: 'error'
            })
        );
    }

    handleCancel() {
        if (this.recordId) {
            // Navigate back to the record (replaces PageReference)
            this[NavigationMixin.Navigate]({
                type: 'standard__recordPage',
                attributes: {
                    recordId: this.recordId,
                    objectApiName: 'Account',
                    actionName: 'view'
                }
            });
        } else {
            // Navigate to the Account list view (replaces PageReference('/001'))
            this[NavigationMixin.Navigate]({
                type: 'standard__objectPage',
                attributes: {
                    objectApiName: 'Account',
                    actionName: 'list'
                },
                state: {
                    filterName: 'Recent'
                }
            });
        }
    }
}
```

### LWC Metadata

```xml
<!-- accountEditor.js-meta.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>66.0</apiVersion>
    <isExposed>true</isExposed>
    <targets>
        <target>lightning__RecordPage</target>
        <target>lightning__AppPage</target>
    </targets>
    <targetConfigs>
        <targetConfig targets="lightning__RecordPage">
            <objects>
                <object>Account</object>
            </objects>
        </targetConfig>
    </targetConfigs>
</LightningComponentBundle>
```

### Apex Controller (Simplified)

```apex
public with sharing class AccountEditorLwcController {
    @AuraEnabled(cacheable=true)
    public static List<Contact> getRelatedContacts(Id accountId) {
        return [
            SELECT Id, Name, Email, Phone
            FROM Contact
            WHERE AccountId = :accountId
            WITH SECURITY_ENFORCED
            ORDER BY Name
            LIMIT 100
        ];
    }
}
```

## Migration Mapping Reference

| Visualforce | LWC Equivalent |
|-------------|----------------|
| `apex:page` | LWC component with `lightning-card` |
| `apex:form` | `lightning-record-edit-form` |
| `apex:inputField` | `lightning-input-field` |
| `apex:commandButton action="{!save}"` | `lightning-button type="submit"` |
| `apex:pageMessages` | `lightning-messages` |
| `apex:pageBlockTable` | `lightning-datatable` |
| `ApexPages.addMessages(e)` | `ShowToastEvent` |
| `new PageReference('/id')` | `NavigationMixin.Navigate` |
| Controller constructor query | `@wire` with `@AuraEnabled(cacheable=true)` |
| `ApexPages.currentPage().getParameters().get('id')` | `@api recordId` |
| `apex:outputPanel rendered="{!condition}"` | `template if:true={condition}` |
| `apex:repeat` | `template for:each={items}` |
| `apex:actionFunction` | Imperative Apex call |

## Key Principles

- Use `lightning-record-edit-form` instead of custom save logic when editing standard/custom object fields
- Replace all `PageReference` navigation with `NavigationMixin` for Lightning Experience compatibility
- Use `@wire` for read operations and imperative calls for mutations
- Move field-level rendering logic from controller to reactive properties in JS
- LWC automatically handles CRUD/FLS when using `lightning-record-edit-form`

## Common Pitfalls

- Forgetting to extend `NavigationMixin(LightningElement)` before calling Navigate
- Using imperative Apex for cacheable reads instead of `@wire` (loses caching and reactivity)
- Not adding `WITH SECURITY_ENFORCED` in the LWC controller Apex methods
- Trying to replicate the exact VF layout instead of adopting SLDS grid patterns
- Hardcoding record type IDs or key prefixes (like `/001`) that were common in VF pages
- Missing the `isExposed` and `targets` configuration in the meta XML

## SCC Skills

- `/sf-visualforce-development` -- audit a Visualforce page for migration readiness
- `/sf-lwc-development` -- review the migrated LWC component for best practices
- `/sf-apex-best-practices` -- review the simplified Apex controller
- `/sf-security` -- verify security enforcement in the new component
