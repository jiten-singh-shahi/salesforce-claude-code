---
name: sf-visualforce-development
description: "Visualforce development — pages, controllers, extensions, ViewState, JS Remoting, LWC migration. Use when maintaining VF pages, building PDFs, or planning VF-to-LWC migration. Do NOT use for LWC, Aura, or Flow."
origin: SCC
user-invocable: true
---

# Visualforce Development

Visualforce is Salesforce's server-side rendering framework. While LWC is the modern standard, Visualforce remains heavily used for PDF generation, email templates, custom overrides, and legacy applications.

## When to Use

- When maintaining or extending existing Visualforce pages in production
- When building PDF renderable pages (`renderAs="pdf"`) — LWC cannot do this
- When creating custom email templates with complex formatting
- When overriding standard buttons (New, Edit, View) with custom UIs
- When planning and executing migration from Visualforce to LWC
- When debugging ViewState issues or page performance problems

@../_reference/VISUALFORCE_PATTERNS.md

---

## Page Creation Procedure

### Step 1 — Choose Controller Type

| Type | When to Use |
|------|------------|
| Standard Controller | Single-record CRUD without custom logic |
| Standard List Controller | List views with built-in pagination |
| Custom Controller | Full control over logic, data, navigation |
| Controller Extension | Add functionality to standard/custom controllers |

### Step 2 — Create the Page

```html
<apex:page standardController="Account"
           extensions="AccountOverviewExtension"
           lightningStylesheets="true"
           docType="html-5.0"
           title="Account Overview">
    <apex:pageBlock title="Account Details">
        <apex:pageBlockSection columns="2">
            <apex:outputField value="{!Account.Name}" />
            <apex:outputField value="{!Account.Industry}" />
        </apex:pageBlockSection>
    </apex:pageBlock>
</apex:page>
```

### Step 3 — Custom Controller (if needed)

```apex
public with sharing class InvoiceController {
    public List<Invoice__c> invoices { get; private set; }
    public String searchTerm { get; set; }

    public InvoiceController() {
        searchTerm = '';
        loadInvoices();
    }

    public PageReference search() {
        loadInvoices();
        return null; // Stay on same page
    }

    private void loadInvoices() {
        String likeSearch = '%' + String.escapeSingleQuotes(searchTerm) + '%';
        invoices = [
            SELECT Id, Name, Amount__c, Status__c, CreatedDate
            FROM Invoice__c WHERE Name LIKE :likeSearch
            WITH USER_MODE ORDER BY CreatedDate DESC LIMIT 100
        ];
    }
}
```

### Step 4 — Controller Extension (if needed)

```apex
public with sharing class AccountOverviewExtension {
    private final Account account;

    // Required constructor signature
    public AccountOverviewExtension(ApexPages.StandardController stdController) {
        if (!Test.isRunningTest()) {
            stdController.addFields(new List<String>{ 'OwnerId', 'AnnualRevenue' });
        }
        this.account = (Account) stdController.getRecord();
    }

    public List<Contact> relatedContacts {
        get {
            if (relatedContacts == null) {
                relatedContacts = [
                    SELECT Id, Name, Email, Phone
                    FROM Contact WHERE AccountId = :account.Id
                    WITH USER_MODE ORDER BY Name LIMIT 50
                ];
            }
            return relatedContacts;
        }
        private set;
    }
}
```

---

## ViewState Management

ViewState is a hidden, encrypted form field that maintains page state across postbacks. **170KB limit** — exceeding it causes a runtime error.

### The `transient` Keyword

Mark variables that do not need to survive postbacks as `transient`:

```apex
public with sharing class ReportController {
    // IN ViewState — needed across postbacks
    public String selectedFilter { get; set; }
    public Integer currentPage { get; set; }

    // NOT in ViewState — recomputed on each request
    transient public List<AggregateResult> reportData { get; private set; }
    transient public Blob chartImage { get; private set; }
}
```

### Reduction Strategies

| Strategy | Impact |
|----------|--------|
| `transient` keyword on large/recomputable variables | High |
| `apex:outputPanel` + `reRender` (partial refresh) | Medium |
| Paginate large data sets | High |
| Use JavaScript Remoting (stateless) | High |
| Move read-only data outside `apex:form` | Medium |

---

## JavaScript Remoting

Stateless, high-performance Apex calls that bypass ViewState entirely.

### Apex Method

```apex
@RemoteAction
public static List<Account> findAccounts(String searchTerm) {
    String safeTerm = '%' + String.escapeSingleQuotes(searchTerm) + '%';
    return [
        SELECT Id, Name, Industry FROM Account
        WHERE Name LIKE :safeTerm WITH USER_MODE LIMIT 25
    ];
}
```

### JavaScript Invocation

```javascript
Visualforce.remoting.Manager.invokeAction(
    '{!$RemoteAction.AccountSearchController.findAccounts}',
    term,
    function(result, event) {
        if (event.status) {
            renderResults(result);
        } else {
            console.error(event.message);
        }
    },
    { escape: true, timeout: 30000 }
);
```

Use `{!$RemoteAction.ClassName.methodName}` (namespace-safe). Set `escape: true` to prevent XSS.

---

## Partial Page Refresh

```html
<apex:actionFunction name="refreshDashboard" action="{!refresh}"
                     reRender="dashPanel" status="loadingStatus" />

<apex:selectList value="{!selectedRegion}" size="1">
    <apex:selectOptions value="{!regionOptions}" />
    <apex:actionSupport event="onchange" action="{!filterByRegion}"
                        reRender="dashPanel" status="loadingStatus" />
</apex:selectList>

<apex:actionStatus id="loadingStatus">
    <apex:facet name="start"><img src="/img/loading.gif" alt="Loading..." /></apex:facet>
</apex:actionStatus>
```

---

## Migration to LWC

### Decision Matrix

| Keep Visualforce | Migrate to LWC |
|-----------------|----------------|
| PDF generation (`renderAs="pdf"`) | High-traffic pages needing performance |
| Email templates | New feature development |
| Complex server-state wizards | Pages using Apex controller only |

### Key VF-to-LWC Mappings

| Visualforce | LWC |
|------------|-----|
| `apex:pageBlockTable` | `lightning-datatable` |
| `apex:commandButton action="{!save}"` | `lightning-button onclick={handleSave}` + imperative Apex |
| `apex:inputField` | `lightning-input-field` (in `lightning-record-edit-form`) |
| JavaScript Remoting | `@wire` or imperative Apex import |
| `apex:actionSupport` | Standard DOM event handlers |
| `{!property}` merge fields | `{property}` template expressions |

### Embedding LWC in Visualforce (Lightning Out)

For incremental migration, embed LWC inside existing VF pages:

```html
<apex:includeLightning />
<div id="lwc-container"></div>
<script>
$Lightning.use("c:lwcOutApp", function() {
    $Lightning.createComponent("c:accountDashboard",
        { recordId: "{!Account.Id}" }, "lwc-container");
});
</script>
```

### Migration Checklist

1. **Inventory** — list all VF pages, controllers, usage frequency
2. **Categorize** — mark each page as Keep VF / Migrate / Retire
3. **Dependencies** — map controller extensions, custom components, static resources
4. **Security audit** — review XSS/injection issues before or during migration
5. **Feature parity** — replicate all VF functionality in LWC
6. **Test coverage** — write LWC Jest tests to match existing Apex test coverage
7. **Incremental rollout** — use Lightning Out to embed LWC in VF during transition
8. **Redirect** — update links, overrides, navigation to new LWC pages
9. **Deprecate** — mark old VF pages as inactive, remove after validation

---

## Related

### Constraints

- **sf-security-constraints** — Enforced rules for XSS prevention, SOQL injection, CRUD/FLS enforcement

### Agents

- **sf-visualforce-reviewer** — For interactive, in-depth Visualforce review guidance
