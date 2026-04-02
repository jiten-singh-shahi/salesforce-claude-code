---
name: sf-apex-enterprise-patterns
description: >-
  Use when implementing Salesforce Apex Enterprise Patterns (FFLIB) — Selector, Domain, Service, Unit of Work layers. Do NOT use for simple orgs or constraints.
---

# Apex Enterprise Patterns

Implementation guidance for Apex Enterprise Patterns (AEP / FFLIB). Covers the four-layer architecture, pragmatic adoption, and when NOT to use them. Constraint rules live in `sf-apex-constraints`.

Reference: @../_reference/ENTERPRISE_PATTERNS.md

---

## When to Use

- When building Apex applications that will scale beyond 5 developers or 50 custom classes
- When trigger logic is becoming complex and duplicated across multiple contexts
- When SOQL queries are scattered throughout classes instead of centralized
- When implementing FFLIB (Andy Fawcett) patterns in a Salesforce project
- When separating business logic from trigger context to improve testability
- When a service method needs to coordinate inserts, updates, and deletes atomically

## When NOT to Use

- **Simple automations**: A before-insert trigger that sets a default status
- **One-off scripts**: Data migration or fix scripts
- **Small orgs** (< 5 developers, < 50 custom classes)
- **Read-only visualizations**: A Selector is often sufficient

The rule: introduce a layer when the absence of that layer is causing a real problem.

---

## Architecture Overview

```
Trigger / Controller / API
        |
   Service Layer        <- Transaction boundary, orchestration
        |
  Domain Layer          <- Business rules on record collections
        |
  Selector Layer        <- All SOQL queries
        |
   Unit of Work         <- All DML (atomic commit)
```

---

## Selector Layer

Selectors own all SOQL queries for an object. No SOQL appears outside a Selector.

**Naming:** `{ObjectNamePlural}Selector` — e.g., `AccountsSelector`, `OpportunitiesSelector`

### Without FFLIB

```apex
public with sharing class AccountsSelector {

    @TestVisible
    private static AccountsSelector instance;

    public static AccountsSelector newInstance() {
        if (instance == null) instance = new AccountsSelector();
        return instance;
    }

    public List<Account> selectById(Set<Id> accountIds) {
        return [
            SELECT Id, Name, Type, OwnerId, AnnualRevenue,
                   Customer_Tier__c, CreditLimit__c
            FROM Account WHERE Id IN :accountIds
            WITH USER_MODE ORDER BY Name
        ];
    }

    public List<Account> selectWithOpenOpportunitiesById(Set<Id> accountIds) {
        return [
            SELECT Id, Name, AnnualRevenue, Customer_Tier__c,
                   (SELECT Id, Name, Amount, CloseDate, StageName
                    FROM Opportunities WHERE IsClosed = false
                    ORDER BY CloseDate ASC)
            FROM Account WHERE Id IN :accountIds WITH USER_MODE
        ];
    }
}
```

### With FFLIB

```apex
public with sharing class AccountsSelector extends fflib_SObjectSelector {

    public static AccountsSelector newInstance() {
        return (AccountsSelector) Application.Selector.newInstance(Account.SObjectType);
    }

    public Schema.SObjectType getSObjectType() { return Account.SObjectType; }

    public List<Schema.SObjectField> getSObjectFieldList() {
        return new List<Schema.SObjectField>{
            Account.Id, Account.Name, Account.Type,
            Account.OwnerId, Account.AnnualRevenue
        };
    }

    public List<Account> selectById(Set<Id> accountIds) {
        return (List<Account>) selectSObjectsById(accountIds);
    }
}
```

---

## Domain Layer

Encapsulates all business logic for a collection of records of the same type. Replaces trigger logic.

**Naming:** `{ObjectNamePlural}` — e.g., `Accounts`, `Opportunities`

```apex
public with sharing class Accounts {

    private final List<Account> records;
    private final Map<Id, Account> existingRecords;

    public static Accounts newInstance(List<Account> records) {
        return new Accounts(records, null);
    }

    public static Accounts newInstance(List<Account> records, Map<Id, Account> existing) {
        return new Accounts(records, existing);
    }

    private Accounts(List<Account> records, Map<Id, Account> existingRecords) {
        this.records         = records;
        this.existingRecords = existingRecords;
    }

    public void onBeforeInsert() {
        setDefaultCustomerTier();
        validateRequiredFields();
    }

    public void onBeforeUpdate() {
        validateRequiredFields();
        preventDowngradingPremiumTier();
    }

    public void setDefaultCustomerTier() {
        for (Account acc : records) {
            if (String.isBlank(acc.Customer_Tier__c)) acc.Customer_Tier__c = 'Standard';
        }
    }

    public void validateRequiredFields() {
        for (Account acc : records) {
            if (acc.Type == 'Customer' && String.isBlank(acc.Industry)) {
                acc.Industry.addError('Industry is required for Customer account type.');
            }
        }
    }

    public void preventDowngradingPremiumTier() {
        for (Account acc : records) {
            Account existing = existingRecords?.get(acc.Id);
            if (existing == null) continue;
            if (existing.Customer_Tier__c == 'Premium'
                    && acc.Customer_Tier__c != 'Premium') {
                acc.Customer_Tier__c.addError(
                    'Premium tier downgrade requires approval.'
                );
            }
        }
    }
}
```

### Trigger Using Domain Layer

```apex
trigger AccountTrigger on Account (
    before insert, before update, after insert, after update
) {
    if (Trigger.isBefore && Trigger.isInsert) {
        Accounts.newInstance(Trigger.new).onBeforeInsert();
    } else if (Trigger.isBefore && Trigger.isUpdate) {
        Accounts.newInstance(Trigger.new, Trigger.oldMap).onBeforeUpdate();
    }
}
```

---

## Service Layer

Orchestrates business processes that span multiple objects or require a full transaction boundary.

**Naming:** `{ObjectNamePlural}Service` — e.g., `AccountsService`

**Rules:**

1. Static methods only — services are stateless
2. No SOQL — delegate to Selectors
3. No direct DML — use Unit of Work
4. Owns the transaction boundary
5. Calls Domain methods for record-level rules

```apex
public with sharing class AccountsService {

    public static void upgradeToPremium(Set<Id> accountIds) {
        List<Account> accounts = AccountsSelector.newInstance()
            .selectWithOpenOpportunitiesById(accountIds);

        if (accounts.isEmpty()) {
            throw new UpgradeException('No accounts found for IDs: ' + accountIds);
        }

        // Validate
        List<String> errors = validateForUpgrade(accounts);
        if (!errors.isEmpty()) {
            throw new UpgradeException(String.join(errors, '\n'));
        }

        // Build Unit of Work
        fflib_ISObjectUnitOfWork uow = Application.UnitOfWork.newInstance();
        for (Account acc : accounts) {
            acc.Customer_Tier__c  = 'Premium';
            acc.CreditLimit__c    = 100000.00;
            uow.registerDirty(acc);

            uow.registerNew(new Opportunity(
                Name      = acc.Name + ' - Premium Welcome',
                AccountId = acc.Id,
                StageName = 'Qualification',
                CloseDate = Date.today().addDays(30)
            ));
        }

        uow.commitWork(); // One atomic DML transaction
    }

    public class UpgradeException extends Exception {}
}
```

---

## Unit of Work

Accumulates all DML operations and commits them in a single, ordered, atomic transaction.

### Lightweight Implementation (No FFLIB)

```apex
public class SimpleUnitOfWork {

    private List<SObject> toInsert  = new List<SObject>();
    private List<SObject> toUpdate  = new List<SObject>();
    private List<SObject> toDelete  = new List<SObject>();

    public void registerNew(SObject record) { toInsert.add(record); }
    public void registerDirty(SObject record) { toUpdate.add(record); }
    public void registerDeleted(SObject record) { toDelete.add(record); }

    public void commitWork() {
        Savepoint sp = Database.setSavepoint();
        try {
            if (!toInsert.isEmpty()) insert toInsert;
            if (!toUpdate.isEmpty()) update toUpdate;
            if (!toDelete.isEmpty()) delete toDelete;
        } catch (Exception e) {
            Database.rollback(sp);
            throw e;
        }
    }
}
```

### FFLIB Application Factory

```apex
public class Application {
    public static final fflib_Application.UnitOfWorkFactory UnitOfWork =
        new fflib_Application.UnitOfWorkFactory(
            new List<SObjectType>{
                Account.SObjectType,
                Contact.SObjectType,
                Opportunity.SObjectType
            }
        );

    public static final fflib_Application.SelectorFactory Selector =
        new fflib_Application.SelectorFactory(
            new Map<SObjectType, Type>{
                Account.SObjectType     => AccountsSelector.class,
                Opportunity.SObjectType => OpportunitiesSelector.class
            }
        );
}
```

---

## Pragmatic Adoption Path

### Phase 1: Selector + Service (Most Immediate Value)

Centralize SOQL into Selectors, business processes into Services. No FFLIB dependency needed.

### Phase 2: Add Domain Layer for Trigger Logic

When trigger logic grows beyond simple field defaults, introduce the Domain layer.

### Phase 3: Add Unit of Work for Complex Transactions

When a service needs to insert/update multiple related objects, introduce UoW for atomicity.

---

## FFLIB Installation

```bash
# Clone and deploy FFLIB
git clone https://github.com/apex-enterprise-patterns/fflib-apex-common.git
git clone https://github.com/apex-enterprise-patterns/fflib-apex-mocks.git
sf project deploy start --source-dir fflib-apex-common/sfdx-source --target-org my-org
sf project deploy start --source-dir fflib-apex-mocks/sfdx-source --target-org my-org
```

> FFLIB is typically deployed as unmanaged source code directly from the cloned repositories, not as a versioned managed package.

---

## Related

- **Agents**: `sf-review-agent`, `sf-architect` — For interactive guidance

### Guardrails

- `sf-apex-constraints` — Governs all Apex code including enterprise pattern implementations
