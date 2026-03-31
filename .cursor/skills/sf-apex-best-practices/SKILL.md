---
name: sf-apex-best-practices
description: >-
  Use when writing production-ready Salesforce Apex classes — organization, error handling, collection patterns. Do NOT use for test classes or triggers.
---

# Apex Best Practices

Procedures for writing production-ready Apex. Constraint rules (never/always lists) live in `sf-apex-constraints`. This skill covers the _how_ — class organization, error handling patterns, null safety techniques, and collection usage.

Reference files:

@../_reference/GOVERNOR_LIMITS.md
@../_reference/NAMING_CONVENTIONS.md
@../_reference/SECURITY_PATTERNS.md

---

## When to Use

- When writing new Apex classes, triggers, or test classes for a Salesforce org
- When reviewing existing Apex code for structure or error handling issues
- When onboarding new developers to Salesforce Apex coding standards
- When refactoring legacy Apex code to improve readability and maintainability

---

## Class Organization

Organize class members in this order:

1. Constants (`static final`)
2. Static variables
3. Instance variables (fields)
4. Constructors
5. Public methods
6. Private/Protected methods
7. Inner classes

```apex
public with sharing class OrderProcessor {

    // 1. Constants
    private static final String STATUS_PENDING    = 'Pending';
    private static final String STATUS_PROCESSING = 'Processing';
    private static final String STATUS_COMPLETE   = 'Complete';
    private static final Integer MAX_LINE_ITEMS   = 500;

    // 2. Static variables
    private static Boolean isProcessing = false;

    // 3. Instance variables
    private List<Order__c> orders;
    private Map<Id, Account> accountMap;
    private OrderValidator validator;

    // 4. Constructor
    public OrderProcessor(List<Order__c> orders) {
        this.orders      = orders;
        this.accountMap  = new Map<Id, Account>();
        this.validator   = new OrderValidator();
    }

    // 5. Public methods
    public List<ProcessResult> processAll() {
        List<ProcessResult> results = new List<ProcessResult>();
        loadRelatedAccounts();
        for (Order__c order : orders) {
            results.add(processSingleOrder(order));
        }
        return results;
    }

    // 6. Private methods
    private void loadRelatedAccounts() {
        Set<Id> accountIds = new Set<Id>();
        for (Order__c order : orders) {
            if (order.AccountId != null) {
                accountIds.add(order.AccountId);
            }
        }
        for (Account acc : [SELECT Id, Name, CreditLimit__c FROM Account WHERE Id IN :accountIds]) {
            accountMap.put(acc.Id, acc);
        }
    }

    private ProcessResult processSingleOrder(Order__c order) {
        if (!validator.isValid(order)) {
            return new ProcessResult(order.Id, false, validator.getLastError());
        }
        order.Status__c = STATUS_PROCESSING;
        return new ProcessResult(order.Id, true, null);
    }

    // 7. Inner classes
    public class ProcessResult {
        public Id orderId     { get; private set; }
        public Boolean success { get; private set; }
        public String message  { get; private set; }

        public ProcessResult(Id orderId, Boolean success, String message) {
            this.orderId = orderId;
            this.success = success;
            this.message  = message;
        }
    }
}
```

---

## Error Handling

### Custom Exception Classes

Create domain-specific exception classes instead of using generic exceptions. This lets callers catch specifically what they care about.

```apex
// Define exceptions in their own files or as inner classes
public class AccountServiceException extends Exception {}
public class OrderValidationException extends Exception {}
public class IntegrationCalloutException extends Exception {}

// Inner exception (acceptable for tight coupling)
public class AccountService {
    public class AccountNotFoundException extends Exception {}
    public class DuplicateAccountException extends Exception {}
}
```

### Catch Scope

Catch the most specific exception type available. Catching `Exception` hides programming errors.

```apex
// Correct — catch what you expect, let others propagate
try {
    processAccount(account);
} catch (DmlException e) {
    throw new AccountServiceException('Failed to save account: ' + e.getDmlMessage(0), e);
} catch (CalloutException e) {
    throw new IntegrationCalloutException('External service unavailable: ' + e.getMessage(), e);
}
```

### Database.SaveResult Checking

When using partial-success DML, check every result.

```apex
List<Database.SaveResult> results = Database.insert(accounts, false);
List<String> errors = new List<String>();

for (Integer i = 0; i < results.size(); i++) {
    Database.SaveResult result = results[i];
    if (!result.isSuccess()) {
        for (Database.Error err : result.getErrors()) {
            errors.add(
                'Record ' + accounts[i].Name + ': ' +
                err.getStatusCode() + ' - ' + err.getMessage()
            );
        }
    }
}

if (!errors.isEmpty()) {
    throw new AccountServiceException(
        'Partial DML failure. Errors:\n' + String.join(errors, '\n')
    );
}
```

### Meaningful Error Messages

Include context in exception messages — what was being done, what record was involved, what the actual error was.

```apex
throw new AccountServiceException(
    String.format(
        'Failed to update Account {0} (Id: {1}) during credit limit recalculation. ' +
        'DML error: {2}',
        new List<Object>{ account.Name, account.Id, dmlError.getMessage() }
    )
);
```

---

## Single Responsibility Principle

Each class should have one reason to change. Split classes by responsibility, not by object type.

```apex
// Correct — each class has one job
public class AccountService        { public void createAccount() {} }
public class AccountNotificationService { public void sendWelcomeEmail() {} }
public class OpportunityService    { public void createFromAccount() {} }
public class ERPSyncService        { public void syncAccount() {} }
public class AccountDocumentService { public void generateOnboardingPDF() {} }
```

### Method Length

Methods longer than ~50 lines are doing too much. Extract private helper methods.

```apex
// Correct — orchestrator calling focused helpers
public void processNewCustomer(Account account) {
    validateNewCustomer(account);
    enrichFromExternalData(account);
    Account inserted = insertAccount(account);
    createDefaultOpportunity(inserted);
    sendWelcomeNotification(inserted);
}
```

---

## Access Modifiers

Start with `private`. Promote to `protected`, then `public`, only when necessary. Use `global` only for managed package APIs.

```apex
public with sharing class DiscountCalculator {

    // Private — internal state
    private Decimal baseRate;
    private Map<String, Decimal> tierRates;

    // Private — internal logic
    private Decimal lookupTierRate(String tier) {
        return tierRates.containsKey(tier) ? tierRates.get(tier) : baseRate;
    }

    // Protected — available to subclasses for extension
    protected Decimal applyMinimumDiscount(Decimal calculated) {
        return Math.max(calculated, 0.05);
    }

    // Public — the contract
    public Decimal calculateDiscount(String customerTier, Decimal orderAmount) {
        Decimal rate = lookupTierRate(customerTier);
        return applyMinimumDiscount(rate * orderAmount);
    }
}
```

---

## Null Safety

Check for null before dereferencing. Salesforce returns null (not empty collections) for uninitialized parent relationship fields. Child relationship sub-queries return empty lists, not null.

```apex
// Preferred — null-safe navigation operator (?.)
String city = account?.BillingAddress?.City;
String ownerEmail = contact?.Account?.Owner?.Email;

// Null-safe Map retrieval with null coalescing (requires minimum API version — see @../_reference/API_VERSIONS.md)
String value = myMap.get('key')?.toLowerCase() ?? '';
```

> **Note:** The `?.` operator prevents NullPointerException when the object reference is null. It does NOT prevent SObjectException when accessing fields not included in the SOQL query. Always ensure queried fields are in the SELECT clause.

---

## Collection Patterns

### Choosing List vs Set vs Map

```apex
// List — ordered, allows duplicates, use for DML and output
List<Account> accountsToInsert = new List<Account>();

// Set — unordered, no duplicates, use for Id lookup sets and deduplication
Set<Id> processedIds = new Set<Id>();

// Map — key-value lookup, use for joining data across queries
Map<Id, Account> accountById = new Map<Id, Account>(
    [SELECT Id, Name FROM Account WHERE Id IN :accountIds]
);
```

### Build Maps Inline from Queries

```apex
// Idiomatic Apex — Map constructor from query
Map<Id, Account> accountMap = new Map<Id, Account>(
    [SELECT Id, Name, OwnerId FROM Account WHERE Id IN :accountIds]
);
Account acc = accountMap.get(someId);
```

> **Note:** In Apex, `new List<String>(n)` creates a list pre-filled with n nulls (unlike Java). Use `new List<String>()` for an empty list.

---

## Comments

### Javadoc-Style for Public Methods

Document the contract, not the implementation.

```apex
/**
 * Calculates the renewal opportunity amount based on the original contract value
 * and the customer's tier-based renewal discount.
 *
 * @param contract  The original contract record. Must not be null. Must have
 *                  Amount__c and Customer_Tier__c populated.
 * @param renewalDate  The target renewal date. Used to determine active pricing tiers.
 * @return  The calculated renewal amount. Never negative. Returns 0 if contract
 *          amount is null.
 * @throws RenewalCalculationException  If no pricing tier is found for the contract's
 *                                      customer tier value.
 */
public Decimal calculateRenewalAmount(Contract__c contract, Date renewalDate) {
    // implementation
}
```

### Inline Comments

Only when logic is not obvious. Explain _why_, not _what_.

```apex
// Salesforce does not enforce uniqueness on Name by default; we enforce it
// here because duplicate account names break downstream ERP sync.
if (existingAccountNames.contains(acc.Name)) {
    acc.addError('An account with this name already exists. Use a unique trading name.');
}
```

---

## Complete Well-Structured Class Example

```apex
/**
 * Service class for credit limit management operations on Account records.
 * Enforces sharing rules; operates within the running user's data visibility.
 */
public with sharing class CreditLimitService {

    private static final Decimal DEFAULT_CREDIT_LIMIT    = 10000.00;
    private static final Decimal PREMIUM_CREDIT_LIMIT    = 100000.00;
    private static final String  TIER_PREMIUM            = 'Premium';
    private static final String  TIER_STANDARD           = 'Standard';

    private final List<Account> accounts;

    public CreditLimitService(List<Account> accounts) {
        if (accounts == null || accounts.isEmpty()) {
            throw new CreditLimitException('Account list must not be null or empty.');
        }
        this.accounts = accounts;
    }

    public Map<Id, Decimal> recalculateLimits() {
        Map<Id, Decimal> results = new Map<Id, Decimal>();
        for (Account acc : accounts) {
            results.put(acc.Id, calculateLimitForAccount(acc));
        }
        return results;
    }

    public List<String> saveLimits(Map<Id, Decimal> limitsByAccountId) {
        List<Account> toUpdate = buildUpdateRecords(limitsByAccountId);
        return executeDmlWithErrorCollection(toUpdate);
    }

    private Decimal calculateLimitForAccount(Account acc) {
        if (acc.Customer_Tier__c == TIER_PREMIUM) return PREMIUM_CREDIT_LIMIT;
        if (acc.Customer_Tier__c == TIER_STANDARD) return calculateStandardLimit(acc);
        return DEFAULT_CREDIT_LIMIT;
    }

    private Decimal calculateStandardLimit(Account acc) {
        if (acc.AnnualRevenue == null || acc.AnnualRevenue <= 0) return DEFAULT_CREDIT_LIMIT;
        return Math.min(acc.AnnualRevenue * 0.05, 50000.00);
    }

    private List<Account> buildUpdateRecords(Map<Id, Decimal> limitsByAccountId) {
        List<Account> records = new List<Account>();
        for (Id accId : limitsByAccountId.keySet()) {
            records.add(new Account(
                Id              = accId,
                CreditLimit__c  = limitsByAccountId.get(accId),
                Last_Credit_Review_Date__c = Date.today()
            ));
        }
        return records;
    }

    private List<String> executeDmlWithErrorCollection(List<Account> records) {
        List<Database.SaveResult> results = Database.update(records, false);
        List<String> errors = new List<String>();
        for (Integer i = 0; i < results.size(); i++) {
            if (!results[i].isSuccess()) {
                for (Database.Error err : results[i].getErrors()) {
                    errors.add('Account Id ' + records[i].Id + ': ' +
                        err.getStatusCode() + ' — ' + err.getMessage());
                }
            }
        }
        return errors;
    }

    public class CreditLimitException extends Exception {}
}
```

---

## Related

- **Agent**: `sf-apex-reviewer` — For interactive, in-depth guidance

### Constraints

- `sf-apex-constraints` — Enforces governor limits, naming rules, security requirements, and bulkification rules that apply to all Apex code
