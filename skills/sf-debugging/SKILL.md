---
name: sf-debugging
description: "Salesforce debugging — debug logs, SOQL explain plan, Flow debug, LWC DevTools, error resolution. Use when diagnosing Apex exceptions, governor breaches, or Flow failures. Do NOT use for tests or build errors."
origin: SCC
user-invocable: true
---

# Salesforce Debugging Techniques

Reference: @../_reference/DEBUGGING_TOOLS.md

## When to Use

- When an Apex exception occurs and you need to trace it through logs
- When a governor limit is being exceeded and you need the root cause
- When a Flow or Process Builder is failing silently or producing unexpected results
- When an LWC component is not rendering data or throwing JavaScript errors
- When a callout is failing and you need to inspect request/response payloads
- When onboarding to a new org and diagnosing pre-existing error patterns

---

## Debug Log Setup

### Enabling Debug Logging

**Via SF CLI (stream live logs):**

```bash
# Stream all logs for the org in real time
sf apex tail log --target-org myOrg

# Stream logs with specific debug level
sf apex tail log \
    --target-org myOrg \
    --debug-level SFDC_DevConsole

# Retrieve a specific log by ID
sf apex get log \
    --log-id 07L5e000000XXXXX \
    --target-org myOrg

# List recent logs
sf apex list log --target-org myOrg

# Run anonymous Apex and capture log
sf apex run \
    --file scripts/apex/debug-script.apex \
    --target-org myOrg

# Run and save full log
sf apex run \
    --file scripts/apex/debug-script.apex \
    --target-org myOrg > debug-output.txt
```

**Via Setup UI:**

1. Setup > Debug Logs (under Environments)
2. Click "New" under Monitored Users
3. Select user, set expiration and log level
4. Reproduce the issue
5. Click the log entry to open it

**Via Developer Console:**

1. Open: `sf org open --target-org myOrg`
2. Click "Developer Console" (gear icon or App Launcher)
3. Debug > Change Log Levels
4. Set user-specific debug levels

---

## Reading Debug Logs

Debug logs have a maximum size of 20 MB. Logs exceeding this are truncated from the middle. If you see gaps, reduce log level verbosity or narrow the operation scope.

### Key Sections in a Log

```
15:23:01.001 (1234567)|EXECUTION_STARTED
15:23:01.012 (12345678)|CODE_UNIT_STARTED|[EXTERNAL]|execute_anonymous_apex
15:23:01.015 (15000000)|SOQL_EXECUTE_BEGIN|[12]|Aggregations:0|SELECT Id FROM Account
15:23:01.045 (45000000)|SOQL_EXECUTE_END|[12]|Rows:150
15:23:01.050 (50000000)|USER_DEBUG|[15]|DEBUG|Processing 150 accounts
15:23:01.200 (200000000)|DML_BEGIN|[22]|Op:Insert|Type:Contact|Rows:150
15:23:01.350 (350000000)|DML_END|[22]
15:23:01.400 (400000000)|CUMULATIVE_LIMIT_USAGE
                         Number of SOQL queries: 3 out of 100
                         Number of DML rows: 150 out of 10000
                         Maximum CPU time: 452 out of 10000
15:23:01.401 (401000000)|EXECUTION_FINISHED
```

### Finding CPU Hogs

Compare timestamps between BEGIN/END pairs to identify slow operations:

```bash
# Find slow operations by comparing BEGIN/END timestamps
grep -E "SOQL_EXECUTE_BEGIN|SOQL_EXECUTE_END|DML_BEGIN|DML_END" debug.log
```

---

## Developer Console

### Anonymous Apex Execution

```apex
// Open Developer Console > Execute Anonymous (Ctrl+E / Cmd+E)
Account acc = [SELECT Id FROM Account WHERE Name = 'Test Corp' LIMIT 1];
AccountService svc = new AccountService();
AccountService.AccountResult result = svc.getAccount(acc.Id);
System.debug(LoggingLevel.ERROR, JSON.serializePretty(result));
```

### Query Editor

```sql
-- Developer Console > Query Editor tab
SELECT Id, Name, StageName, Amount, CloseDate
FROM Opportunity
WHERE StageName = 'Negotiation'
  AND CloseDate = THIS_QUARTER
ORDER BY Amount DESC
LIMIT 25
```

Use "Query Plan" button to analyse query performance (see SOQL Query Plan section below).

### Checkpoints (Heap Inspection)

1. Debug > Add/Remove Checkpoint (on a code line)
2. Execute code that runs through the checkpointed line
3. Debug > Checkpoint Inspector -- see heap contents, variable values

---

## SOQL Query Plan (Explain Plan)

### How to Access

1. Developer Console > Query Editor
2. Write your query
3. Click "Query Plan" button (not "Execute")

### Optimising Based on Plan

```soql
-- BAD: Cost = 2.5 (TableScan)
SELECT Id FROM Account WHERE Description LIKE '%enterprise%'

-- GOOD: Cost = 0.1 (Index on ExternalId__c)
SELECT Id FROM Account WHERE ExternalId__c = 'ACC-001'

-- GOOD: Cost = 0.3 (Index on OwnerId)
SELECT Id FROM Account WHERE OwnerId = :currentUserId
```

---

## VS Code Apex Debugger

### Apex Replay Debugger (Free)

Available in all editions with the Salesforce Extension Pack:

1. Capture a debug log (via SF CLI, Developer Console, or Setup)
2. Open the `.log` file in VS Code
3. Command Palette: "SFDX: Launch Apex Replay Debugger with Current File"
4. Set breakpoints in `.cls` files
5. Step through execution, inspect variables and the call stack

### Interactive Apex Debugger (Paid)

Requires Performance Edition, Unlimited Edition, or Enterprise Edition add-on. Not available in Developer Edition.

#### Launch Configuration

```json
// .vscode/launch.json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Launch Apex Debugger",
            "type": "apex",
            "request": "launch",
            "userIdFilter": [],
            "requestTypeFilter": [],
            "entryPointFilter": "",
            "salesforceProject": "${workspaceRoot}"
        }
    ]
}
```

#### Debugging Steps

1. Set breakpoints in `.cls` files (click gutter)
2. Run > Start Debugging (F5) with "Launch Apex Debugger"
3. Reproduce the action in Salesforce UI
4. VS Code pauses at breakpoint
5. Inspect variables, Step Over (F10), Step Into (F11), Continue (F5)

---

## Common Errors: Root Causes and Fixes

### System.LimitException: Too many SOQL queries: 101

**Root cause:** SOQL query inside a loop

```apex
// WRONG -- SOQL in loop
for (Account acc : Trigger.new) {
    List<Contact> contacts = [SELECT Id FROM Contact WHERE AccountId = :acc.Id];
}

// FIX -- single query outside loop
Map<Id, List<Contact>> contactsByAccount = new Map<Id, List<Contact>>();
for (Contact c : [SELECT Id, AccountId FROM Contact WHERE AccountId IN :Trigger.newMap.keySet()]) {
    if (!contactsByAccount.containsKey(c.AccountId)) {
        contactsByAccount.put(c.AccountId, new List<Contact>());
    }
    contactsByAccount.get(c.AccountId).add(c);
}
```

### Apex CPU time limit exceeded

**Root cause:** Complex nested loops, excessive string operations

```apex
// WRONG -- O(n^2) loop
for (Account acc : accounts) {
    for (Contact con : allContacts) {
        if (con.AccountId == acc.Id) { /* ... */ }
    }
}

// FIX -- use Map for O(1) lookup
Map<Id, List<Contact>> contactsByAccount = buildContactMap(allContacts);
for (Account acc : accounts) {
    List<Contact> accountContacts = contactsByAccount.get(acc.Id);
}
```

### System.NullPointerException

**Root cause:** Unchecked null reference

```apex
// PREFERRED (API 56.0+) -- null-safe navigation
String upperName = account.Name?.toUpperCase() ?? '';
String accountName = contact?.Account?.Name ?? 'No Account';
```

### UNABLE_TO_LOCK_ROW

**Root cause:** Two concurrent transactions updating the same record(s). Fix with retry logic (Queueable), `FOR UPDATE` in SOQL, or reducing batch size.

### MIXED_DML_OPERATION

**Root cause:** Setup objects (User, Profile) and non-setup objects in the same transaction. Separate with `@future` or `System.runAs()` in tests.

### Too many DML rows: 10001

**Root cause:** DML on >10,000 records. Use Batch Apex to process in chunks.

### Callout from triggers are not supported

**Root cause:** Synchronous callout in trigger context. Use `@future(callout=true)`.

---

## Flow Debugging

### Flow Debug Mode

1. Setup > Flows > Open Flow Builder
2. Click "Debug" button (top right)
3. Set input variables and "Run as" user
4. Click "Run"
5. Step through elements, inspect variable values
6. "Rollback" checkbox: undo DML changes during debug

### Common Flow Errors

| Error | Root Cause | Fix |
|-------|-----------|-----|
| "An unhandled fault has occurred" | Missing fault connectors | Add fault paths on all DML/callout elements |
| Flow SOQL 101 limit exceeded | Get Records inside a loop | Move Get Records outside loop, use Collection Filtering |
| "This flow can't access the variable" | Variable not marked for input/output | Enable "Available for input/output" on the variable |

---

## LWC Debugging

### Browser Developer Tools

```javascript
import { LightningElement, wire } from 'lwc';

export default class AccountCard extends LightningElement {
    connectedCallback() {
        console.group('AccountCard mounted');
        console.log('accountId:', this.accountId);
        console.groupEnd();
    }

    handleError(error) {
        console.error('AccountCard error:', JSON.stringify(error));
    }
}
```

### Enable Lightning Debug Mode

1. Setup > Session Settings
2. Enable "Enable Debug Mode for Lightning Components"
3. Slower but provides better error messages and unminified source

### Chrome Extensions

Install "Salesforce Inspector Reloaded" for real-time metadata browsing, direct record access, API Inspector, and SOQL query runner.

---

## Integration Debugging

### Capture Callout Logs

```apex
public class DebugCalloutService {
    public static HttpResponse send(HttpRequest req) {
        System.debug(LoggingLevel.INFO, 'CALLOUT REQUEST: ' + req.getMethod() + ' ' + req.getEndpoint());
        System.debug(LoggingLevel.FINE, 'REQUEST BODY: ' + req.getBody());
        Http http = new Http();
        HttpResponse res = http.send(req);
        System.debug(LoggingLevel.INFO, 'CALLOUT RESPONSE: ' + res.getStatusCode());
        System.debug(LoggingLevel.FINE, 'RESPONSE BODY: ' + res.getBody());
        return res;
    }
}
```

### Viewing Callout Details in Debug Log

With `CALLOUT: FINE` level enabled:

```
CALLOUT_REQUEST|....|POST https://api.example.com/orders
CALLOUT_RESPONSE|....|200 {"orderId":"123","status":"OK"}
```

---

## Related

- **Agent**: `sf-code-reviewer` -- for interactive, in-depth guidance
- **Constraints**: `sf-apex-constraints` -- governor limits and Apex coding rules
