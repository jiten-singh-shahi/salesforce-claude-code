# Metadata Types — Salesforce Reference

> Source: https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_types_list.htm
> Registry: https://github.com/forcedotcom/source-deploy-retrieve (metadataRegistry.json)
> Last verified: API v66.0, Spring '26 (2026-03-28)

## Common Metadata Types

| package.xml Name | directoryName | suffix | inFolder | Wildcard (`*`) |
|---|---|---|---|---|
| ApexClass | classes | .cls | No | Yes |
| ApexTrigger | triggers | .trigger | No | Yes |
| ApexComponent | components | .component | No | Yes |
| ApexPage | pages | .page | No | Yes |
| AuraDefinitionBundle | aura | (bundle) | No | Yes |
| LightningComponentBundle | lwc | (bundle) | No | Yes |
| CustomObject | objects | .object | No | Yes |
| CustomField | fields | .field | No | No (child of CustomObject) |
| CustomMetadata | customMetadata | .md | No | Yes |
| CustomLabels | labels | .labels | No | Yes |
| CustomTab | tabs | .tab | No | Yes |
| CustomApplication | applications | .app | No | Yes |
| CustomPermission | customPermissions | .customPermission | No | Yes |
| Layout | layouts | .layout | No | Yes |
| CompactLayout | compactLayouts | .compactLayout | No | No (child of CustomObject) |
| FlexiPage | flexipages | .flexipage | No | Yes |
| Flow | flows | .flow | No | Yes |
| Profile | profiles | .profile | No | Yes |
| PermissionSet | permissionsets | .permissionset | No | Yes |
| PermissionSetGroup | permissionsetgroups | .permissionsetgroup | No | Yes |
| StaticResource | staticresources | .resource | No | Yes |
| Report | reports | .report | Yes | No (use folder paths) |
| Dashboard | dashboards | .dashboard | Yes | No (use folder paths) |
| Document | documents | (varies) | Yes | No (use folder paths) |
| EmailTemplate | email | .email | Yes | No (use folder paths) |
| Workflow | workflows | .workflow | No | Yes |
| ValidationRule | validationRules | .validationRule | No | No (child of CustomObject) |
| RecordType | recordTypes | .recordType | No | No (child of CustomObject) |
| ListView | listViews | .listView | No | No (child of CustomObject) |
| QuickAction | quickActions | .quickAction | No | Yes |
| GlobalValueSet | globalValueSets | .globalValueSet | No | Yes |
| StandardValueSet | standardValueSets | .standardValueSet | No | Yes |
| ConnectedApp | connectedApps | .connectedApp | No | Yes |
| RemoteSiteSetting | remoteSiteSettings | .remoteSite | No | Yes |
| NamedCredential | namedCredentials | .namedCredential | No | Yes |
| ExternalDataSource | dataSources | .dataSource | No | Yes |
| SharingRules | sharingRules | .sharingRules | No | No |
| AssignmentRules | assignmentRules | .assignmentRules | No | No |
| ApprovalProcess | approvalProcesses | .approvalProcess | No | Yes |
| ExperienceBundle | experiences | (bundle) | No | Yes |
| PlatformEventChannel | platformEventChannels | .platformEventChannel | No | Yes |
| PathAssistant | pathAssistants | .pathAssistant | No | Yes |

## Wildcard Rules

- **Yes** — `<members>*</members>` retrieves all components of that type.
- **No (child)** — child metadata (CustomField, ValidationRule, RecordType, ListView, CompactLayout) must be qualified: `ObjectName.FieldName`.
- **No (inFolder)** — folder-based types (Report, Dashboard, Document, EmailTemplate) require folder-qualified members: `FolderName` or `FolderName/ReportName`.
- **AssignmentRules / SharingRules / EscalationRules** — must specify the object: `Case`, `Lead`.

## Deployment Order (Recommended)

Deploy in this sequence to avoid reference errors:

| Order | Types | Reason |
|---|---|---|
| 1 | CustomObject, CustomField, GlobalValueSet, StandardValueSet, RecordType | Schema must exist before anything references it |
| 2 | CustomMetadata, CustomLabels, CustomPermission, CustomTab | Referenced by code and configuration |
| 3 | ApexClass (non-test) | Business logic depends on schema |
| 4 | ApexTrigger | Triggers depend on classes and schema |
| 5 | Flow, Workflow, ApprovalProcess, AssignmentRules, SharingRules | Automation depends on schema + classes |
| 6 | Layout, CompactLayout, FlexiPage, PathAssistant, QuickAction | UI depends on fields and actions |
| 7 | LightningComponentBundle, AuraDefinitionBundle, ApexPage, ApexComponent, StaticResource | UI components |
| 8 | Profile, PermissionSet, PermissionSetGroup | Access control references all of the above |
| 9 | Report, Dashboard, Document, EmailTemplate | Content depends on schema + access |
| 10 | ConnectedApp, NamedCredential, RemoteSiteSetting, ExternalDataSource | Integration config (often environment-specific) |
| 11 | ApexClass (test), ExperienceBundle | Tests and experiences deployed last |

## Bundle Types (No Single Suffix)

| Type | Directory | Contents |
|---|---|---|
| LightningComponentBundle | lwc/`componentName`/ | `.js`, `.html`, `.css`, `.js-meta.xml` |
| AuraDefinitionBundle | aura/`componentName`/ | `.cmp`, `.js`, `.css`, `.design`, `.svg`, `-meta.xml` |
| ExperienceBundle | experiences/`siteName`/ | Multiple config files and directories |

## package.xml Snippet

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
  <types>
    <members>*</members>
    <name>ApexClass</name>
  </types>
  <types>
    <members>*</members>
    <name>ApexTrigger</name>
  </types>
  <types>
    <members>*</members>
    <name>CustomObject</name>
  </types>
  <types>
    <members>MyFolder</members>
    <members>MyFolder/MyReport</members>
    <name>Report</name>
  </types>
  <types>
    <members>Account.MyField__c</members>
    <name>CustomField</name>
  </types>
  <version>66.0</version>
</Package>
```
