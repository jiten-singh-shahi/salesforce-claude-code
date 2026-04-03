---
name: sf-lwc-testing
description: >-
  LWC Jest testing — component mounting, wire/Apex mocking, user interaction simulation, toast/navigation verification. Use when writing or debugging LWC Jest tests. Do NOT use for Apex or Flow testing.
---

# LWC Testing with Jest

LWC uses Jest as its test runner. Salesforce provides `@salesforce/sfdx-lwc-jest` to handle Salesforce-specific imports. Tests run in Node.js — no browser, no Salesforce org.

## When to Use

- When writing Jest unit tests for Lightning Web Components
- When mocking Wire adapters, Apex imperative calls, or navigation in LWC tests
- When debugging flaky or async LWC tests
- When setting up LWC test infrastructure for a new project

@../_reference/LWC_PATTERNS.md
@../_reference/TESTING_STANDARDS.md

---

## Setup Procedure

### Step 1 — Install

```bash
npm install --save-dev @salesforce/sfdx-lwc-jest
```

### Step 2 — jest.config.js

```javascript
const { jestConfig } = require('@salesforce/sfdx-lwc-jest/config');
module.exports = {
    ...jestConfig,
    modulePathIgnorePatterns: ['<rootDir>/.localdevserver'],
    testEnvironment: 'jsdom',
    testMatch: ['**/__tests__/**/*.test.js'],
    setupFiles: ['<rootDir>/jest.setup.js']
};
```

### Step 3 — jest.setup.js

```javascript
global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(), unobserve: jest.fn(), disconnect: jest.fn()
}));
```

### Step 4 — Test File Location

```
lwc/accountSearch/
    accountSearch.html
    accountSearch.js
    __tests__/
        accountSearch.test.js
```

---

## Basic Component Rendering

```javascript
import { createElement } from 'lwc';
import AccountSearch from 'c/accountSearch';

describe('c-account-search', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    it('renders the search input', () => {
        const element = createElement('c-account-search', { is: AccountSearch });
        document.body.appendChild(element);

        const input = element.shadowRoot.querySelector('lightning-input[type="search"]');
        expect(input).not.toBeNull();
        expect(input.label).toBe('Search Accounts');
    });

    it('renders with public @api property', () => {
        const element = createElement('c-account-search', { is: AccountSearch });
        element.maxRecords = 25;
        document.body.appendChild(element);
        expect(element.maxRecords).toBe(25);
    });
});
```

---

## Wire Adapter Mocking (Modern Pattern)

Use `jest.mock()` with the wire adapter directly. The deprecated `registerApexTestWireAdapter` pattern should not be used in new projects.

```javascript
import { createElement } from 'lwc';
import AccountDetails from 'c/accountDetails';
import getAccountDetails from '@salesforce/apex/AccountsController.getAccountDetails';

jest.mock(
    '@salesforce/apex/AccountsController.getAccountDetails',
    () => ({ default: jest.fn() }),
    { virtual: true }
);

describe('c-account-details wire', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    it('displays account name when wire returns data', async () => {
        getAccountDetails.mockResolvedValue({
            Id: '001000000000001AAA', Name: 'Acme Corporation'
        });
        const element = createElement('c-account-details', { is: AccountDetails });
        element.recordId = '001000000000001AAA';
        document.body.appendChild(element);

        await Promise.resolve();
        await Promise.resolve();

        expect(element.shadowRoot.querySelector('.account-name').textContent)
            .toBe('Acme Corporation');
    });

    it('displays error state when wire returns error', async () => {
        getAccountDetails.mockRejectedValue({
            body: { message: 'Record not found' }, status: 404
        });
        const element = createElement('c-account-details', { is: AccountDetails });
        element.recordId = '001000000000001AAA';
        document.body.appendChild(element);

        await Promise.resolve();
        await Promise.resolve();

        expect(element.shadowRoot.querySelector('.error-container')).not.toBeNull();
    });
});
```

---

## Apex Imperative Call Mocking

```javascript
jest.mock(
    '@salesforce/apex/AccountSearchController.searchAccounts',
    () => jest.fn(),         // imperative: module IS the function
    { virtual: true }
);

import searchAccounts from '@salesforce/apex/AccountSearchController.searchAccounts';

it('calls Apex on search and displays results', async () => {
    searchAccounts.mockResolvedValue([
        { Id: '001000000000001AAA', Name: 'Acme Corp' }
    ]);
    const element = createElement('c-account-search', { is: AccountSearch });
    document.body.appendChild(element);

    // Trigger search
    const input = element.shadowRoot.querySelector('lightning-input');
    input.dispatchEvent(new CustomEvent('change', { detail: { value: 'Acme' } }));
    element.shadowRoot.querySelector('lightning-button[label="Search"]').click();

    await flushPromises();

    expect(searchAccounts).toHaveBeenCalledWith({ searchTerm: 'Acme' });
    const rows = element.shadowRoot.querySelectorAll('.account-row');
    expect(rows).toHaveLength(1);
});
```

Key distinction: for imperative Apex, mock as `() => jest.fn()`. For wired Apex, mock as `() => ({ default: jest.fn() })`.

---

## Async Testing — flushPromises

LWC re-renders are asynchronous. Use `flushPromises` instead of chaining multiple `Promise.resolve()` calls.

```javascript
function flushPromises() {
    return new Promise(resolve => setTimeout(resolve, 0));
}
```

---

## User Interaction Simulation

### Click Events and Custom Event Assertions

```javascript
it('dispatches select event when button clicked', () => {
    const element = createElement('c-account-card', { is: AccountCard });
    element.account = { Id: '001000000000001AAA', Name: 'Test Corp' };
    document.body.appendChild(element);

    const handler = jest.fn();
    element.addEventListener('accountselect', handler);

    element.shadowRoot.querySelector('[data-id="view-btn"]').click();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail).toEqual({
        accountId: '001000000000001AAA', accountName: 'Test Corp'
    });
});
```

### Input Value Changes

```javascript
const input = element.shadowRoot.querySelector('lightning-input[type="search"]');
input.dispatchEvent(new CustomEvent('change', { detail: { value: 'Acme' } }));
await Promise.resolve();
```

---

## Toast Notification Testing

```javascript
import { ShowToastEventName } from 'lightning/platformShowToastEvent';

it('shows success toast after save', async () => {
    const toastHandler = jest.fn();
    element.addEventListener(ShowToastEventName, toastHandler);

    element.shadowRoot.querySelector('[data-id="save-btn"]').click();
    await flushPromises();

    expect(toastHandler).toHaveBeenCalledTimes(1);
    expect(toastHandler.mock.calls[0][0].detail.variant).toBe('success');
});
```

---

## Navigation Mocking

```javascript
it('navigates to record page on view', () => {
    const { navigate } = require('lightning/navigation');
    const element = createElement('c-account-card', { is: AccountCard });
    element.account = { Id: '001000000000001AAA' };
    document.body.appendChild(element);

    element.shadowRoot.querySelector('[data-id="view"]').click();

    expect(navigate).toHaveBeenCalledWith(
        expect.objectContaining({
            type: 'standard__recordPage',
            attributes: expect.objectContaining({ recordId: '001000000000001AAA' })
        })
    );
});
```

---

## What to Test vs What Not to Test

### Test These

- Business logic in computed properties and event handlers
- Correct Apex method called with correct arguments
- Component response to wire data and errors
- User interactions and their effects on component state
- Edge cases: empty arrays, null values, error states

### Do Not Test These

- LWC framework behavior (that `for:each` renders items)
- Base component rendering (that `lightning-button` shows text)
- CSS styling or implementation details (internal variable names)

---

## Spring '26: Local Component Testing

Test LWC components in isolation without deploying to a scratch org.

```bash
npm install --save-dev @lwc/jest-preset
npx lwc-jest --watchAll=false
```

---

## TypeScript LWC Testing (Spring '26 Experimental)

Spring '26 introduces experimental TypeScript support for LWC. Test `.ts` component files with these adjustments.

### Jest Configuration

```javascript
// jest.config.js — add ts transform
const { jestConfig } = require('@salesforce/sfdx-lwc-jest/config');
module.exports = {
    ...jestConfig,
    transform: {
        ...jestConfig.transform,
        '^.+\\.ts$': ['@swc/jest']  // or 'ts-jest'
    },
    moduleFileExtensions: ['ts', 'js', 'html'],
    testMatch: ['**/__tests__/**/*.test.(js|ts)']
};
```

Install: `npm install --save-dev @swc/jest @swc/core` (faster) or `npm install --save-dev ts-jest typescript`.

### Typed Wire Adapter Mocking

```typescript
import { createElement } from 'lwc';
import AccountList from 'c/accountList';
import getAccounts from '@salesforce/apex/AccountController.getAccounts';

jest.mock('@salesforce/apex/AccountController.getAccounts',
    () => ({ default: jest.fn() }), { virtual: true });

const mockGetAccounts = getAccounts as jest.MockedFunction<typeof getAccounts>;

describe('c-account-list (TypeScript)', () => {
    afterEach(() => {
        while (document.body.firstChild) document.body.removeChild(document.body.firstChild);
        jest.clearAllMocks();
    });

    it('renders typed account data', async () => {
        mockGetAccounts.mockResolvedValue([
            { Id: '001xx0001', Name: 'Typed Corp', Industry: 'Technology' }
        ]);
        const element = createElement('c-account-list', { is: AccountList });
        document.body.appendChild(element);

        await Promise.resolve();
        await Promise.resolve();

        const rows = element.shadowRoot.querySelectorAll('.account-row');
        expect(rows).toHaveLength(1);
    });
});
```

### Typed Event Detail Assertions

```typescript
it('dispatches typed custom event', () => {
    const element = createElement('c-account-card', { is: AccountCard });
    document.body.appendChild(element);

    const handler = jest.fn();
    element.addEventListener('select', handler);
    element.shadowRoot.querySelector('[data-id="select-btn"]').click();

    const detail = handler.mock.calls[0][0].detail as { accountId: string };
    expect(detail.accountId).toBeDefined();
});
```

> **Note:** TypeScript LWC support is experimental in Spring '26. Type definitions and tooling may change in future releases. Pin `@salesforce/sfdx-lwc-jest` to a known-good version.

---

## Related

### Guardrails

- **sf-testing-constraints** — Enforced rules for test coverage, assertions, and test data patterns

### Agents

- **sf-lwc-agent** — For interactive, in-depth LWC review guidance
