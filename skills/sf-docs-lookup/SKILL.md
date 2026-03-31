---
name: sf-docs-lookup
description: >-
  Use when looking up official Salesforce documentation. Apex reference, LWC docs,
  platform guides, API references, and SF CLI commands via WebSearch.
origin: SCC
user-invocable: true
---

# Salesforce Documentation Lookup

Query Salesforce developer documentation for current, accurate answers. Uses WebSearch to find official documentation, then extracts and summarizes the relevant content.

## When to Use

- When you need to look up Apex class, method, or interface documentation
- When checking LWC component API, wire service, or lifecycle documentation
- When verifying SOQL/SOSL syntax, functions, or query limits
- When researching REST API, Metadata API, Tooling API, or Bulk API endpoints
- When looking up governor limits, security features, or platform event details
- When checking `sf` CLI command flags and usage
- When verifying whether a feature is deprecated or version-gated

## Usage

```text
sf-docs-lookup <query>
```

## Workflow

### Step 1 — Identify Topic Category

Classify the query into the correct Salesforce documentation area:

| Category | Documentation Source | Search Strategy |
|----------|---------------------|-----------------|
| Apex Classes/Interfaces | Apex Developer Guide | `site:developer.salesforce.com apex <class>` |
| Apex System Methods | Apex Reference | `site:developer.salesforce.com "System.<method>"` |
| LWC Components | LWC Dev Guide | `site:developer.salesforce.com lwc <topic>` |
| SOQL/SOSL | SOQL and SOSL Reference | `site:developer.salesforce.com soql <topic>` |
| REST API | REST API Developer Guide | `site:developer.salesforce.com rest api <endpoint>` |
| Metadata API | Metadata API Developer Guide | `site:developer.salesforce.com metadata api <type>` |
| Tooling API | Tooling API Reference | `site:developer.salesforce.com tooling api <resource>` |
| Bulk API | Bulk API 2.0 Developer Guide | `site:developer.salesforce.com bulk api <topic>` |
| Platform Events | Platform Events Developer Guide | `site:developer.salesforce.com platform events <topic>` |
| Flows | Flow Builder Guide | `site:help.salesforce.com flow <topic>` |
| Agentforce | Einstein/Agentforce Docs | `site:developer.salesforce.com agentforce <topic>` |
| Governor Limits | Apex Developer Guide | `site:developer.salesforce.com "execution governors" limits` |
| Security | Security Implementation Guide | `site:developer.salesforce.com security <topic>` |
| CLI (sf) | Salesforce CLI Reference | `site:developer.salesforce.com sf <command>` |

### Step 2 — Search Documentation

Use WebSearch with targeted site-scoped queries:

```
site:developer.salesforce.com <category-specific terms>
```

For admin/configuration topics, also check:
```
site:help.salesforce.com <topic>
```

### Step 3 — Extract and Format Answer

When presenting documentation results:

1. **Lead with the answer** -- do not make the user read through preamble
2. **Include code examples** -- Apex, LWC, or SOQL snippets when relevant
3. **Note API version** -- Salesforce features are version-gated; specify the minimum API version
4. **Link to source** -- provide the URL so the user can read more
5. **Flag deprecations** -- if the queried feature is deprecated, say so and recommend the replacement

### Step 4 — Cross-Reference with SCC Knowledge

After finding the official docs, check if SCC has relevant skills:
- Skills in `skills/` or `skills2/` that cover the topic in depth
- Mention relevant SCC resources: "For best practices on this, see the `sf-soql-optimization` skill."

## Integration with sf-docs-lookup Agent

For complex documentation queries spanning multiple topics, delegate to the `sf-docs-lookup` agent which can perform multi-step research across documentation sources.

## Examples

```text
sf-docs-lookup Wire service in LWC
sf-docs-lookup Database.Batchable interface
sf-docs-lookup Platform Events best practices
sf-docs-lookup SOQL aggregate functions
sf-docs-lookup WITH USER_MODE vs WITH SECURITY_ENFORCED
sf-docs-lookup sf project deploy start flags
sf-docs-lookup Trigger.operationType enum values
```

## Related

- **Agent**: `sf-docs-lookup` -- for multi-step documentation research
- **Constraints**: (none -- this is a search tool, no domain constraints apply)
