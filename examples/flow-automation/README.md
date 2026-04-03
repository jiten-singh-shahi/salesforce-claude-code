# Flow Automation Example

Sample Record-Triggered Flow with best practices for review. API version 66.0 (Spring '26).

## Structure

```text
force-app/main/default/flows/
  Account_Set_Rating.flow-meta.xml
```

## Flow Design: Account Rating Auto-Set

**Type:** Record-Triggered Flow (Before Save)
**Object:** Account
**When:** A record is created or updated
**Why Before Save:** Same-record field updates in a Before Save flow require no extra DML statement, making it more efficient than After Save for this use case.

### Logic

1. **Entry Criteria:** Annual Revenue is not null AND has changed (prevents recursion)
2. **Decision:** Evaluate revenue ranges (ordered most-specific first)
   - Revenue > 1,000,000 → Set Rating = "Hot"
   - Revenue > 100,000 → Set Rating = "Warm"
   - Revenue <= 100,000 → Set Rating = "Cold"
3. **Assignment:** Set the Rating field on `$Record` (no Update element needed in Before Save)

## Flow Metadata

```xml
<!-- Account_Set_Rating.flow-meta.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>66.0</apiVersion>
    <description>Sets Account Rating based on Annual Revenue ranges.
    Before-save flow — no DML needed for same-record updates.</description>
    <interviewLabel>Account Set Rating {!$Flow.CurrentDateTime}</interviewLabel>
    <label>Account Set Rating</label>
    <processType>AutoLaunchedFlow</processType>
    <status>Active</status>

    <!-- Entry point: triggers on Account create/update -->
    <start>
        <locationX>50</locationX>
        <locationY>0</locationY>
        <connector>
            <targetReference>Check_Revenue</targetReference>
        </connector>
        <filterFormula>
            NOT(ISNULL({!$Record.AnnualRevenue}))
            &amp;&amp; ISCHANGED({!$Record.AnnualRevenue})
        </filterFormula>
        <object>Account</object>
        <recordTriggerType>CreateAndUpdate</recordTriggerType>
        <triggerType>RecordBeforeSave</triggerType>
    </start>

    <!-- Decision: evaluate revenue ranges -->
    <decisions>
        <name>Check_Revenue</name>
        <label>Check Revenue</label>
        <locationX>182</locationX>
        <locationY>158</locationY>
        <defaultConnector>
            <targetReference>Set_Rating_Cold</targetReference>
        </defaultConnector>
        <defaultConnectorLabel>Cold</defaultConnectorLabel>
        <rules>
            <name>Is_Hot</name>
            <conditionLogic>and</conditionLogic>
            <conditions>
                <leftValueReference>$Record.AnnualRevenue</leftValueReference>
                <operator>GreaterThan</operator>
                <rightValue>
                    <numberValue>1000000</numberValue>
                </rightValue>
            </conditions>
            <connector>
                <targetReference>Set_Rating_Hot</targetReference>
            </connector>
            <label>Hot</label>
        </rules>
        <rules>
            <name>Is_Warm</name>
            <conditionLogic>and</conditionLogic>
            <conditions>
                <leftValueReference>$Record.AnnualRevenue</leftValueReference>
                <operator>GreaterThan</operator>
                <rightValue>
                    <numberValue>100000</numberValue>
                </rightValue>
            </conditions>
            <connector>
                <targetReference>Set_Rating_Warm</targetReference>
            </connector>
            <label>Warm</label>
        </rules>
    </decisions>

    <!-- Assignment elements: set Rating on $Record (Before Save = no DML) -->
    <assignments>
        <name>Set_Rating_Hot</name>
        <label>Set Rating Hot</label>
        <locationX>50</locationX>
        <locationY>334</locationY>
        <assignmentItems>
            <assignToReference>$Record.Rating</assignToReference>
            <operator>Assign</operator>
            <value>
                <stringValue>Hot</stringValue>
            </value>
        </assignmentItems>
    </assignments>
    <assignments>
        <name>Set_Rating_Warm</name>
        <label>Set Rating Warm</label>
        <locationX>182</locationX>
        <locationY>334</locationY>
        <assignmentItems>
            <assignToReference>$Record.Rating</assignToReference>
            <operator>Assign</operator>
            <value>
                <stringValue>Warm</stringValue>
            </value>
        </assignmentItems>
    </assignments>
    <assignments>
        <name>Set_Rating_Cold</name>
        <label>Set Rating Cold</label>
        <locationX>314</locationX>
        <locationY>334</locationY>
        <assignmentItems>
            <assignToReference>$Record.Rating</assignToReference>
            <operator>Assign</operator>
            <value>
                <stringValue>Cold</stringValue>
            </value>
        </assignmentItems>
    </assignments>
</Flow>
```

### Review Checklist

- [ ] Uses Record-Triggered Flow (not Process Builder or Workflow)
- [ ] Entry criteria prevents unnecessary executions
- [ ] Decision elements are ordered most-specific to least-specific
- [ ] No DML operations inside loops
- [ ] Bulkification-safe (handles 200+ records)
- [ ] Error handling with fault paths
- [ ] Description filled in for all elements
- [ ] Flow is versioned (not overwriting active version)

## Anti-Patterns to Avoid

1. **Loops with DML** — Never put Create/Update/Delete inside a Loop element
2. **Missing fault paths** — Always add fault connectors to DML elements
3. **Recursive triggers** — Use `$Record__Prior` to check if values actually changed
4. **Too many flows per object** — Consolidate into fewer flows with decision elements
5. **Hardcoded values** — Use Custom Metadata or Custom Labels instead

## Testing

```apex
@IsTest
static void shouldSetRatingToHotForHighRevenue() {
    Account acc = new Account(Name = 'Test', AnnualRevenue = 2000000);
    insert acc;

    Account result = [SELECT Rating FROM Account WHERE Id = :acc.Id];
    System.assertEquals('Hot', result.Rating, 'High revenue should set rating to Hot');
}

@IsTest
static void shouldSetRatingToColdForLowRevenue() {
    Account acc = new Account(Name = 'Small Co', AnnualRevenue = 50000);
    insert acc;

    Account result = [SELECT Rating FROM Account WHERE Id = :acc.Id];
    System.assertEquals('Cold', result.Rating, 'Low revenue should set rating to Cold');
}
```

## SCC Skills

- `sf-flow-development` -- Flow best practices and anti-patterns
- `sf-governor-limits` -- verify flow doesn't accumulate DML in loops
- `sf-apex-testing` -- write Apex tests that fire record-triggered flows
