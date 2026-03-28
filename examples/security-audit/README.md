# Security Audit Walkthrough

Step-by-step security audit for Salesforce Apex code covering CRUD/FLS, SOQL injection, sharing model, and static analysis.

## When to Use This Pattern

- Before deploying Apex code to production
- During security reviews or AppExchange security submissions
- When refactoring legacy code that bypasses security controls
- After a Salesforce security health check flags issues

## CRUD/FLS Enforcement

### Before (Insecure)

```apex
// BAD: No CRUD or FLS checks — any user can read/update regardless of permissions
public class AccountService {
    public static List<Account> getAccounts() {
        return [SELECT Id, Name, AnnualRevenue, Phone FROM Account];
    }

    public static void updateRevenue(Id accountId, Decimal newRevenue) {
        Account acc = new Account(Id = accountId, AnnualRevenue = newRevenue);
        update acc;
    }
}
```

### After (Secure — WITH SECURITY_ENFORCED)

```apex
// GOOD: CRUD/FLS enforced at the query level
public with sharing class AccountService {
    public static List<Account> getAccounts() {
        return [
            SELECT Id, Name, AnnualRevenue, Phone
            FROM Account
            WITH SECURITY_ENFORCED
        ];
    }

    public static void updateRevenue(Id accountId, Decimal newRevenue) {
        // Check field-level access before DML
        if (!Schema.sObjectType.Account.fields.AnnualRevenue.isUpdateable()) {
            throw new SecurityException('Insufficient access to update AnnualRevenue');
        }

        Account acc = new Account(Id = accountId, AnnualRevenue = newRevenue);
        update acc;
    }

    public class SecurityException extends Exception {}
}
```

### After (Secure — stripInaccessible)

```apex
// GOOD: stripInaccessible silently removes inaccessible fields instead of throwing
public with sharing class AccountService {
    public static List<Account> getAccounts() {
        List<Account> accounts = [SELECT Id, Name, AnnualRevenue, Phone FROM Account];
        SObjectAccessDecision decision = Security.stripInaccessible(AccessType.READABLE, accounts);
        return (List<Account>) decision.getRecords();
    }

    public static void updateRevenue(Id accountId, Decimal newRevenue) {
        List<Account> toUpdate = new List<Account>{
            new Account(Id = accountId, AnnualRevenue = newRevenue)
        };
        SObjectAccessDecision decision = Security.stripInaccessible(AccessType.UPDATABLE, toUpdate);
        update decision.getRecords();
    }
}
```

## SOQL Injection Prevention

### Before (Vulnerable)

```apex
// BAD: User input concatenated directly into query string
public class AccountSearch {
    @AuraEnabled
    public static List<Account> search(String searchTerm) {
        String query = 'SELECT Id, Name FROM Account WHERE Name LIKE \'%' + searchTerm + '%\'';
        return Database.query(query);
    }
}
```

### After (Safe — Bind Variables)

```apex
// GOOD: Bind variable prevents injection
public with sharing class AccountSearch {
    @AuraEnabled(cacheable=true)
    public static List<Account> search(String searchTerm) {
        String safeTerm = '%' + String.escapeSingleQuotes(searchTerm) + '%';
        return [
            SELECT Id, Name
            FROM Account
            WHERE Name LIKE :safeTerm
            WITH SECURITY_ENFORCED
            LIMIT 50
        ];
    }
}
```

### After (Safe — Dynamic Query with Escaping)

```apex
// GOOD: When dynamic SOQL is unavoidable, escape input and enforce CRUD/FLS
public with sharing class AccountSearch {
    @AuraEnabled(cacheable=true)
    public static List<Account> search(String searchTerm, String sortField) {
        // Whitelist allowed sort fields
        Set<String> allowedSortFields = new Set<String>{ 'Name', 'CreatedDate', 'AnnualRevenue' };
        if (!allowedSortFields.contains(sortField)) {
            sortField = 'Name';
        }

        String safeTerm = '%' + String.escapeSingleQuotes(searchTerm) + '%';
        String query = 'SELECT Id, Name FROM Account'
            + ' WHERE Name LIKE :safeTerm'
            + ' WITH SECURITY_ENFORCED'
            + ' ORDER BY ' + sortField
            + ' LIMIT 50';
        return Database.query(query);
    }
}
```

## Sharing Model Review

```apex
// with sharing — enforces the running user's sharing rules (default for most classes)
public with sharing class OpportunityService {
    public List<Opportunity> getMyOpportunities() {
        return [SELECT Id, Name, Amount FROM Opportunity WITH SECURITY_ENFORCED];
    }
}

// without sharing — intentional escalation (document WHY)
// Use case: Background process that needs org-wide visibility
public without sharing class OpportunityRollupService {
    /**
     * Runs in system context because rollup calculations require
     * access to all child records regardless of the triggering user's
     * sharing rules. Called only from a trusted trigger handler.
     */
    public static void recalculateRollups(Set<Id> accountIds) {
        // System-level aggregation
        List<AggregateResult> results = [
            SELECT AccountId, SUM(Amount) totalAmount
            FROM Opportunity
            WHERE AccountId IN :accountIds AND IsClosed = true AND IsWon = true
            GROUP BY AccountId
        ];
        // ... update accounts with rollup values
    }
}

// inherited sharing — inherits context from the caller
// Use case: Utility classes that should respect whatever context invokes them
public inherited sharing class QueryHelper {
    public static List<SObject> queryWithLimit(String objectName, Integer recordLimit) {
        String safeObject = String.escapeSingleQuotes(objectName);
        return Database.query(
            'SELECT Id, Name FROM ' + safeObject + ' WITH SECURITY_ENFORCED LIMIT :recordLimit'
        );
    }
}
```

## Running SFDX Scanner

```bash
# Install the scanner plugin (one-time setup)
sf plugins install @salesforce/sfdx-scanner

# Scan all Apex classes for security issues
sf scanner run --target "force-app/main/default/classes/**/*.cls" \
    --category "Security" \
    --format table

# Scan with PMD rules and generate a report
sf scanner run --target "force-app/main/default/classes/**/*.cls" \
    --engine pmd \
    --format csv \
    --outfile scanner-results.csv

# Scan for specific security rules
sf scanner run --target "force-app/main/default/classes/AccountService.cls" \
    --category "Security,Best Practices" \
    --format table \
    --severity-threshold 2

# Run the full AppExchange-style security review
sf scanner run --target "force-app/" \
    --category "Security" \
    --engine "pmd,retire-js" \
    --format html \
    --outfile security-report.html
```

## Security Checklist

| Check | Status | How to Verify |
|-------|--------|---------------|
| All classes use `with sharing` or document why not | | Search for `without sharing` and verify justification |
| SOQL uses `WITH SECURITY_ENFORCED` or `stripInaccessible` | | Search for `Database.query` and `[SELECT` without enforcement |
| No raw user input in SOQL/SOSL strings | | Search for string concatenation in queries |
| DML operations check field-level access | | Check `isCreateable()`, `isUpdateable()`, `stripInaccessible` |
| `@AuraEnabled` methods validate input parameters | | Review all `@AuraEnabled` methods |
| No hardcoded credentials or secrets | | Search for passwords, tokens, API keys in source |
| Named Credentials used for external callouts | | Search for `HttpRequest` and verify endpoint source |
| CSRF tokens on Visualforce pages | | Ensure forms are not using `GET` actions with state changes |
| Guest user profiles have minimal permissions | | Review site guest user profile in Setup |
| Sensitive data not logged or exposed in debug | | Search for `System.debug` with sensitive field names |

## Key Principles

- Default to `with sharing` on every class; only use `without sharing` with documented justification
- Prefer `WITH SECURITY_ENFORCED` for reads and `stripInaccessible` when you need graceful degradation
- Never concatenate user input into SOQL/SOSL; use bind variables or `String.escapeSingleQuotes`
- Whitelist dynamic field/object names rather than relying solely on escaping
- Run SFDX Scanner in CI to catch regressions before deployment

## Common Pitfalls

- Assuming `with sharing` enforces FLS (it only enforces record-level sharing rules, not field access)
- Using `String.escapeSingleQuotes` alone without also whitelisting dynamic identifiers
- Forgetting to add `WITH SECURITY_ENFORCED` to SOQL inside batch/schedulable classes
- Marking utility classes as `without sharing` out of convenience
- Not testing with a non-admin user profile to catch missing permissions

## SCC Skills

- `/sf-security` -- run a comprehensive security audit on your codebase
- `/sf-apex-best-practices` -- review Apex code including security best practices
- `/sf-governor-limits` -- check for governor limit issues (overlaps with security for SOQL)
