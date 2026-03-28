# LWC Component Example

Sample Lightning Web Component with wire service, Apex calls, and Jest tests.

## Structure

```text
force-app/main/default/lwc/
  accountList/
    accountList.html
    accountList.js
    accountList.js-meta.xml
    accountList.css
    __tests__/
      accountList.test.js
```

## Component (HTML)

```html
<template>
    <lightning-card title="Accounts" icon-name="standard:account">
        <template if:true={accounts.data}>
            <lightning-datatable
                key-field="Id"
                data={accounts.data}
                columns={columns}
                onrowaction={handleRowAction}>
            </lightning-datatable>
        </template>
        <template if:true={accounts.error}>
            <p class="slds-text-color_error">Error loading accounts: {errorMessage}</p>
        </template>
        <template if:false={accounts.data}>
            <lightning-spinner alternative-text="Loading"></lightning-spinner>
        </template>
    </lightning-card>
</template>
```

## Component (JS)

```javascript
import { LightningElement, wire } from 'lwc';
import getAccounts from '@salesforce/apex/AccountController.getAccounts';

const COLUMNS = [
    { label: 'Name', fieldName: 'Name', type: 'text' },
    { label: 'Industry', fieldName: 'Industry', type: 'text' },
    { label: 'Revenue', fieldName: 'AnnualRevenue', type: 'currency' },
    {
        type: 'action',
        typeAttributes: { rowActions: [{ label: 'View', name: 'view' }] }
    }
];

export default class AccountList extends LightningElement {
    columns = COLUMNS;

    @wire(getAccounts)
    accounts;

    get errorMessage() {
        return this.accounts?.error?.body?.message || 'Unknown error';
    }

    handleRowAction(event) {
        const { action, row } = event.detail;
        if (action.name === 'view') {
            this.dispatchEvent(new CustomEvent('viewaccount', { detail: { accountId: row.Id } }));
        }
    }
}
```

## Jest Tests

```javascript
import { createElement } from 'lwc';
import AccountList from 'c/accountList';
import getAccounts from '@salesforce/apex/AccountController.getAccounts';

const { emit } = require('jestMocks/apex');

jest.mock('@salesforce/apex/AccountController.getAccounts', () => ({
    default: jest.fn()
}), { virtual: true });

const MOCK_ACCOUNTS = [
    { Id: '001xx001', Name: 'Acme', Industry: 'Tech', AnnualRevenue: 100000 },
    { Id: '001xx002', Name: 'Global', Industry: 'Finance', AnnualRevenue: 500000 },
];

describe('c-account-list', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    it('renders datatable when data is available', async () => {
        getAccounts.mockResolvedValue(MOCK_ACCOUNTS);
        const element = createElement('c-account-list', { is: AccountList });
        document.body.appendChild(element);

        await Promise.resolve();
        await Promise.resolve();

        const datatable = element.shadowRoot.querySelector('lightning-datatable');
        expect(datatable).not.toBeNull();
    });

    it('shows error message on failure', async () => {
        getAccounts.mockRejectedValue({ body: { message: 'Test error' } });
        const element = createElement('c-account-list', { is: AccountList });
        document.body.appendChild(element);

        await Promise.resolve();
        await Promise.resolve();

        const error = element.shadowRoot.querySelector('.slds-text-color_error');
        expect(error).not.toBeNull();
        expect(error.textContent).toContain('Test error');
    });

    it('dispatches viewaccount event on row action', async () => {
        getAccounts.mockResolvedValue(MOCK_ACCOUNTS);
        const element = createElement('c-account-list', { is: AccountList });
        const handler = jest.fn();
        element.addEventListener('viewaccount', handler);
        document.body.appendChild(element);

        await Promise.resolve();
        await Promise.resolve();

        const datatable = element.shadowRoot.querySelector('lightning-datatable');
        datatable.dispatchEvent(
            new CustomEvent('rowaction', {
                detail: { action: { name: 'view' }, row: MOCK_ACCOUNTS[0] }
            })
        );

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler.mock.calls[0][0].detail.accountId).toBe('001xx001');
    });

    it('shows spinner when data is loading', () => {
        const element = createElement('c-account-list', { is: AccountList });
        document.body.appendChild(element);

        const spinner = element.shadowRoot.querySelector('lightning-spinner');
        expect(spinner).not.toBeNull();
    });
});
```
