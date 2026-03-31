<!-- Source: https://developer.salesforce.com/docs/atlas.en-us.api_analytics.meta/api_analytics/sforce_analytics_rest_api_intro.htm -->
<!-- Last verified: API v66.0 — 2026-03-29 -->

# Reporting & Analytics API — Salesforce Reference

## Report Formats

| Format | Grouping | Summary Fields | Use Case |
|---|---|---|---|
| Tabular | None | Column totals only | Flat lists, CSV export |
| Summary | Up to 3 row groupings | Subtotals per group | Grouped data with subtotals |
| Matrix | Row AND column groupings | Intersection summaries | Cross-tabulation / pivot |
| Joined | Per-block groupings (up to 5 blocks) | Per-block summaries | Side-by-side comparisons |

## Analytics REST API Endpoints

Base path: `/services/data/v{version}/analytics`

### Report Endpoints

| Method | URI | Description |
|---|---|---|
| GET | `/reports` | List up to 200 recently viewed reports |
| POST | `/reports` | Create a new report |
| GET | `/reports/{id}` | Retrieve report metadata |
| PUT | `/reports/{id}` | Save report changes |
| DELETE | `/reports/{id}` | Delete a report |
| GET | `/reports/{id}/describe` | Get report structure (fields, groupings, filters) |
| GET | `/reports/{id}/instances` | List async report run instances |
| POST | `/reports/{id}/instances` | Execute report asynchronously |
| GET | `/reports/{id}/instances/{instanceId}` | Retrieve async execution results |

### Dashboard Endpoints

| Method | URI | Description |
|---|---|---|
| GET | `/dashboards` | List recently viewed dashboards |
| GET | `/dashboards/{id}` | Retrieve dashboard metadata and status |
| PUT | `/dashboards/{id}` | Update dashboard |
| DELETE | `/dashboards/{id}` | Delete dashboard |
| GET | `/dashboards/{id}/describe` | Dashboard structure info |
| POST | `/dashboards/{id}/instances` | Execute async dashboard refresh |

### Report Type Endpoints (API v39.0+)

| Method | URI | Description |
|---|---|---|
| GET | `/reportTypes` | List available report types |
| GET | `/reportTypes/{type}` | Get single report type detail |

## API Limits

| Limit | Value |
|---|---|
| Synchronous report runs per hour (org) | 500 |
| Concurrent synchronous report requests | 20 |
| Detail rows returned per run | 2,000 (sync); larger via async |
| Async report instances listed | Up to 2,000 |
| Async results retention | 24-hour rolling window |
| Dashboard refreshes per hour (org) | 200 |
| Custom field filters at runtime | Up to 20 |
| Dashboard filters per dashboard | Up to 5 |

## Apex Analytics API Classes

| Class | Purpose |
|---|---|
| `Reports.ReportManager` | Run, describe, list reports |
| `Reports.ReportResults` | Access fact map, metadata, totals |
| `Reports.ReportMetadata` | Read/modify filters, groupings, columns |
| `Reports.ReportExtendedMetadata` | Aggregate column info, detail columns |
| `Reports.ReportFilter` | Set column, operator, value for runtime filter |
| `Reports.ReportInstance` | Handle async report execution + status |
| `Reports.ReportFactWithDetails` | Traverse row data + aggregates |
| `Reports.SummaryValue` | Individual aggregate value (label + value) |
| `Reports.ReportDetailRow` | Single row of detail data |
| `Reports.ReportDataCell` | Single cell (label + value) |

## Fact Map Keys

| Key | Meaning |
|---|---|
| `T!T` | Grand total row and column |
| `0!T` | First row grouping, all columns |
| `T!0` | All rows, first column grouping |
| `0!0` | First row grouping, first column grouping |
| `{row}_{col}` | Specific intersection in matrix report |

## Custom Report Type Relationship Patterns

| Pattern | Description | SQL Equivalent |
|---|---|---|
| A with B | A must have related B records | INNER JOIN |
| A with or without B | A included even without B | LEFT OUTER JOIN |
| A with B, B with C | Three-level relationship | Double JOIN |

Max objects in a custom report type: 4 (A-B-C-D chain).

## Dashboard Component Types

| Component | Best For | Data Source |
|---|---|---|
| Chart (bar, line, pie, donut, funnel) | Visual trends, comparisons | Source report |
| Gauge | Progress toward a target value | Source report + target |
| Metric | Single KPI number | Source report |
| Table | Tabular data in dashboard | Source report |
| Lightning Component | Custom interactive widget | Custom LWC |

## Filter Types

| Filter Type | Scope | Example |
|---|---|---|
| Standard Filter | Predefined (Show Me, Date) | "My accounts", "This quarter" |
| Field Filter | Any field on report type | `Amount > 50000` |
| Cross Filter | Related object existence | "Accounts WITH Opportunities" |
| Row Limit | Cap result count | "Top 10 by Amount" |
| Bucket Field | Group values without formula | Amount ranges: Small/Medium/Large |

## Report Metadata Source Format

```
reports/<FolderName>/<ReportName>.report-meta.xml
dashboards/<FolderName>/<DashboardName>.dashboard-meta.xml
```

## CLI Commands

| Command | Purpose |
|---|---|
| `sf project retrieve start --metadata Report:<folder/name>` | Retrieve a report |
| `sf project deploy start --source-dir force-app/main/default/reports` | Deploy reports |
| `sf project retrieve start --metadata Dashboard:<folder/name>` | Retrieve a dashboard |

## Performance Anti-Patterns

| Anti-Pattern | Fix |
|---|---|
| Large object reports without date filters | Always add date range filter |
| More than 3 cross-filters | Use custom report types instead |
| Custom report type with 4+ objects | Limit to 2-3; use formula fields |
| Dashboard with 20+ components | Keep to 10-12 focused components |
| Hardcoded report IDs in Apex | Store DeveloperName in Custom Metadata |
| Synchronous `runReport()` for >2,000 rows | Use `runAsyncReport()` or Batch Apex |
