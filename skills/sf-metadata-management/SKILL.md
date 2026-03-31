---
name: sf-metadata-management
description: >-
  Use when working with Salesforce metadata types, package.xml, or .forceignore.
  Source vs metadata format, retrieval, deployment, and org comparison.
origin: SCC
user-invocable: false
---

# Salesforce Metadata Management

Reference: @../_reference/METADATA_TYPES.md

## When to Use

- Retrieving or deploying specific metadata types between Salesforce orgs
- Understanding the difference between source format (DX) and metadata API format
- Configuring `.forceignore` to control which files are tracked by SF CLI
- Managing profiles vs permission sets in source control and CI/CD workflows
- Comparing metadata between two orgs or handling org conflicts

---

## Source Format (DX) vs Metadata Format

### Source Format (Salesforce DX -- what you have locally)

```
force-app/
  main/
    default/
      classes/
        AccountService.cls
        AccountService.cls-meta.xml
      triggers/
        AccountTrigger.trigger
        AccountTrigger.trigger-meta.xml
      lwc/
        accountCard/
          accountCard.js
          accountCard.html
          accountCard.css
          accountCard.js-meta.xml
      objects/
        Account/
          fields/
            Status__c.field-meta.xml
          recordTypes/
            Enterprise.recordType-meta.xml
          validationRules/
            RequirePhone.validationRule-meta.xml
```

### Metadata Format (Metadata API / Change Sets)

```
unpackaged/
  classes/
    AccountService.cls
    AccountService.cls-meta.xml
  objects/
    Account.object          <-- single file with ALL fields, validation rules, etc.
  package.xml
```

Key difference: in source format, each component has its own file. In metadata format, objects are a single monolithic XML file.

```bash
# Convert metadata format to source format
sf project convert mdapi --root-dir unpackaged --output-dir force-app

# Convert source format to metadata format
sf project convert source --source-dir force-app --output-dir unpackaged
```

---

## sfdx-project.json Explained

```json
{
    "packageDirectories": [
        {
            "path": "force-app",
            "default": true,
            "package": "MyApp",
            "versionName": "ver 1.0",
            "versionNumber": "1.0.0.NEXT",
            "definitionFile": "config/project-scratch-def.json"
        },
        {
            "path": "force-app-config",
            "default": false
        }
    ],
    "namespace": "",
    "sourceApiVersion": "66.0",
    "sfdcLoginUrl": "https://login.salesforce.com",
    "pushPackageDirectoriesSequentially": false,
    "packageAliases": {
        "MyApp": "0Ho...",
        "MyApp@1.0.0-1": "04t..."
    }
}
```

| Property                    | Purpose                                               |
|-----------------------------|-------------------------------------------------------|
| `packageDirectories`        | Directories containing Salesforce source              |
| `path`                      | Relative path to source directory                     |
| `default`                   | Whether this is the default deploy target             |
| `namespace`                 | Org namespace (empty string for most orgs)            |
| `sourceApiVersion`          | Metadata API version (update annually)                |
| `pushPackageDirectoriesSequentially` | Deploy directories in order (for dependencies) |

---

## .forceignore

Controls which files SF CLI ignores during push/pull/deploy operations. Syntax mirrors .gitignore.

```
# .forceignore

# Profiles -- use Permission Sets instead
**/profiles/**

# Standard Value Sets (cannot deploy, org-managed)
**/standardValueSets/**

# Managed Package components -- read-only
**/force-app/main/default/classes/fflib_*
**/force-app/main/default/classes/NPSP_*

# Experience Cloud templates (large, rarely need deploying)
**/experiences/**

# Reports and Dashboards (manage via UI)
**/reports/**
**/dashboards/**

# Translations (if not managing)
**/translations/**
```

---

## Retrieving Metadata

### Retrieve by Metadata Type

```bash
# Retrieve all Apex classes
sf project retrieve start \
    --metadata ApexClass \
    --target-org myOrg \
    --output-dir force-app

# Retrieve specific component
sf project retrieve start \
    --metadata "ApexClass:AccountService" \
    --target-org myOrg

# Retrieve multiple types
sf project retrieve start \
    --metadata "ApexClass,ApexTrigger,LightningComponentBundle,CustomObject" \
    --target-org myOrg
```

### Retrieve via package.xml

```bash
sf project retrieve start \
    --manifest manifest/package.xml \
    --target-org myOrg \
    --output-dir force-app
```

### Retrieve with Source Tracking (scratch orgs)

```bash
# Only retrieves what changed in org since last sync
sf project retrieve start \
    --source-dir force-app \
    --target-org myScratch
```

---

## Org Comparison Strategies

### List Available Metadata

```bash
sf org list metadata-types --target-org myOrg
sf org list metadata --metadata-type ApexClass --target-org myOrg
sf org list metadata --metadata-type Flow --target-org myOrg
```

### Compare Two Orgs

```bash
# Retrieve from source and target orgs
sf project retrieve start --manifest manifest/package.xml --target-org sourceOrg --output-dir /tmp/source-org
sf project retrieve start --manifest manifest/package.xml --target-org targetOrg --output-dir /tmp/target-org

# Diff using standard tools
diff -r /tmp/source-org /tmp/target-org
```

---

## Managing Profiles vs Permission Sets

> Deploying a Profile from source replaces the entire profile definition in the target org. Any permissions that exist in the org but are not in your source file will be revoked. Use Permission Sets instead of Profiles for deployable permission management.

```bash
# Add profile to .forceignore to stop tracking
echo "**/profiles/**" >> .forceignore

# Deploy permission sets instead
sf project deploy start \
    --metadata "PermissionSet:Sales_Manager_Permissions" \
    --target-org myOrg
```

When profiles cannot be avoided:

```bash
# Retrieve ONLY the profile
sf project retrieve start \
    --metadata "Profile:Admin" \
    --target-org myOrg
```

---

## Handling Org Conflicts

> `--ignore-conflicts` silently overwrites without prompting. Run `deploy preview` first to review what will be overwritten. Using `--ignore-conflicts` on a shared org can destroy another developer's uncommitted work.

```bash
# Preview conflicts before deploying
sf project deploy preview --source-dir force-app --target-org myScratch

# Force deploy (local wins)
sf project deploy start \
    --source-dir force-app \
    --ignore-conflicts \
    --target-org myScratch

# Force retrieve (org wins)
sf project retrieve start \
    --source-dir force-app \
    --ignore-conflicts \
    --target-org myScratch
```

---

## Custom Metadata Type Records

Custom Metadata Type records are metadata -- deploy them, not import them.

```xml
<!-- force-app/main/default/customMetadata/Service_Config.Production.md-meta.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>Production Config</label>
    <protected>false</protected>
    <values>
        <field>Endpoint_URL__c</field>
        <value xsi:type="xsd:string">https://api.example.com</value>
    </values>
    <values>
        <field>Timeout_Ms__c</field>
        <value xsi:type="xsd:double">10000</value>
    </values>
</CustomMetadata>
```

Benefits over Custom Settings: deployable, available in flows and formula fields, no governor limit on reads, can be packaged.

---

## Related

- **Constraints**: `sf-deployment-constraints` -- deployment safety rules
