---
name: update-platform-docs
description: >-
  Update Salesforce platform reference docs with latest release features and deprecation announcements. Use when SessionStart hook warns docs are outdated or a new Salesforce release has shipped. Do NOT use for Apex or LWC development.
disable-model-invocation: true
---

# Update Platform Reference Docs

## When to Use

- When the SessionStart hook warns that platform docs are outdated (>4 months since last verified)
- When a new Salesforce release has shipped (Spring, Summer, or Winter)
- When you hear about new Salesforce feature deprecations or retirements

## Files to Update

Two reference files in `skills/_reference/`:

1. **API_VERSIONS.md** — Release feature tracker (24-month rolling window)
2. **DEPRECATIONS.md** — Retired features, upcoming retirements, naming changes (cumulative)

## Update Procedure

### Step 1 — Research current release

WebSearch for the latest Salesforce release information:

```
Search: "Salesforce [Season] '[Year] release notes new features developer site:developer.salesforce.com"
Search: "Salesforce [Season] '[Year] release highlights"
```

### Step 2 — Research deprecations

WebSearch for deprecation and retirement announcements:

```
Search: "Salesforce feature retirements [current year] site:help.salesforce.com"
Search: "Salesforce deprecated features [current year]"
```

### Step 3 — Update API_VERSIONS.md

1. Read current `skills/_reference/API_VERSIONS.md`
2. Add new release section at TOP with `Added: YYYY-MM` tag
3. Include all new GA features, Beta features (marked clearly), and breaking changes
4. Remove any sections where `Added:` date is older than 24 months
5. Update the "Last verified" date
6. Update "Current" label to point to the new release

### Step 4 — Update DEPRECATIONS.md

1. Read current `skills/_reference/DEPRECATIONS.md`
2. Append any NEW deprecation entries with `Added: YYYY-MM` tag
3. Move "Retiring Soon" entries to "Already Retired" if retirement date has passed
4. Remove entries where `Added:` date is older than 24 months (exception: keep "Retiring Soon" entries until retirement date + 24 months)
5. Check for new product renames and add them
6. Update Beta feature status (promote to GA if applicable, remove if GA'd >24 months ago)
7. Update the "Last verified" date

### Step 5 — Verify

After updating, confirm changes:

```bash
# Check no v62.0 or other old version references leaked back
grep -r "old_version" skills/_reference/API_VERSIONS.md skills/_reference/DEPRECATIONS.md

# Run CI validation
node scripts/ci/validate-skills.js
```

## Important Rules

- Releases and deprecations are INDEPENDENT — a new release does NOT deprecate the previous one
- Every entry gets an `Added: YYYY-MM` tag for 24-month retention tracking
- Beta features must be clearly marked as "Beta" or "Pilot" with "do NOT use in production"
- Use current product names (see Product Renames table in DEPRECATIONS.md)
- Only add information verified from official Salesforce sources (developer.salesforce.com, help.salesforce.com)

## Related

- **Hook**: `check-platform-docs-age.js` — SessionStart hook that triggers this skill's warning
- **Reference**: `@../_reference/API_VERSIONS.md` — Feature tracker
- **Reference**: `@../_reference/DEPRECATIONS.md` — Deprecation guard
