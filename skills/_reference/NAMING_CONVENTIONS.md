# Naming Conventions — Salesforce Reference

> Last verified: API v66.0 (Spring '26)
> Source: Salesforce Apex Developer Guide + community standards

## Apex Naming

### Casing Rules

| Element | Casing | Example |
|---|---|---|
| Class names | PascalCase | `AccountService`, `OrderProcessor` |
| Interface names | PascalCase (prefix `I` optional) | `IAccountsSelector` |
| Method names | camelCase (start with verb) | `getActiveAccounts()`, `isEligible()` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT`, `STATUS_ACTIVE` |
| Variables / parameters | camelCase | `accountName`, `recordCount` |
| Instance fields | camelCase (no underscore prefix) | `private String accountName` |
| Enum values | UPPER_SNAKE_CASE | `Status.ACTIVE`, `Priority.HIGH` |

### Class Suffixes by Role

| Role | Suffix | Example |
|---|---|---|
| Service layer | `Service` | `AccountService` |
| Selector / data access | `Selector` | `AccountsSelector` |
| Domain / business logic | (object name, no suffix) | `Accounts` (FFLIB) |
| Trigger handler | `TriggerHandler` | `AccountTriggerHandler` |
| Batch job | `Batch` | `AccountAnnualReviewBatch` |
| Queueable job | `Job` or `Queueable` | `AccountProcessorJob` |
| Schedulable | `Scheduler` or `Schedule` | `AccountReviewScheduler` |
| Controller (LWC/Aura/VF) | `Controller` | `AccountPaginationController` |
| Test class | `Test` (suffix, not prefix) | `AccountServiceTest` |
| Exception | `Exception` | `AccountServiceException` |
| Utility / helper | `Util` or `Helper` | `StringUtil`, `QueryHelper` |

### Test Method Naming

Format: `test{MethodName}_{scenario}_{expectedResult}`

| Example | Pattern |
|---|---|
| `testCalculateDiscount_premiumTier_returns20Percent()` | Method + scenario + outcome |
| `testCreateAccount_duplicateName_throwsException()` | Method + edge case + error |
| `testProcessOrders_emptyList_noExceptionThrown()` | Method + boundary + success |

### Trigger Naming

One trigger per object: `{ObjectName}Trigger`

| Object | Trigger | Handler |
|---|---|---|
| Account | `AccountTrigger` | `AccountTriggerHandler` |
| Contact | `ContactTrigger` | `ContactTriggerHandler` |
| Opportunity | `OpportunityTrigger` | `OpportunityTriggerHandler` |

## LWC Naming

| Element | Convention | Example |
|---|---|---|
| Component folder | camelCase | `accountCard/` |
| Component files | Match folder name | `accountCard.js`, `accountCard.html` |
| HTML in markup | kebab-case with namespace | `<c-account-card>` |
| Properties | camelCase | `accountName`, `isLoading` |
| Event names | lowercase, no separators | `itemselected`, `recordchange` |
| CSS classes | kebab-case | `.account-header`, `.card-body` |

## Custom Object / Field Naming

| Element | Convention | Example |
|---|---|---|
| Custom object | PascalCase + `__c` | `Invoice__c`, `Order_Line_Item__c` |
| Custom field | PascalCase + `__c` | `Annual_Revenue__c`, `Is_Active__c` |
| Relationship name | PascalCase + `__r` | `Account__r`, `Primary_Contact__r` |
| Custom metadata type | PascalCase + `__mdt` | `Integration_Config__mdt` |
| Custom setting | PascalCase + `__c` | `Feature_Flags__c` |
| Platform event | PascalCase + `__e` | `Order_Status_Change__e` |

## General Rules

- Avoid abbreviations unless universally understood (`Id`, `URL`, `API`)
- No Hungarian notation (`strName`, `lstAccounts`)
- Boolean fields/methods: prefix with `is`, `has`, `can`, `should`
- Collections: use plural nouns (`accounts`, `contactsByAccountId`)
- Maps: name by pattern `{valueType}By{keyDescription}` (`accountById`, `contactsByAccountId`)
