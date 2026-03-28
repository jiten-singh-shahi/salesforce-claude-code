# Flow Automation Example

Sample Record-Triggered Flow with best practices for review.

## Structure

```text
force-app/main/default/flows/
  Account_Set_Rating.flow-meta.xml
```

## Flow Design: Account Rating Auto-Set

**Type:** Record-Triggered Flow (After Save)
**Object:** Account
**When:** A record is created or updated

### Logic

1. **Entry Criteria:** Annual Revenue is not null
2. **Decision:** Evaluate revenue ranges
   - Revenue > 1,000,000 → Set Rating = "Hot"
   - Revenue > 100,000 → Set Rating = "Warm"
   - Revenue <= 100,000 → Set Rating = "Cold"
3. **Update:** Set the Rating field on the Account

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
```
