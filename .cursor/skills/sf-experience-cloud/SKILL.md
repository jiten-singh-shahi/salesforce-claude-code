---
name: sf-experience-cloud
description: >-
  Salesforce Experience Cloud — site setup, guest users, external sharing, LWC in communities, CMS, auth. Use when building portals or partner communities. Do NOT use for internal Lightning apps.
---

# Salesforce Experience Cloud

## When to Use

- When building customer self-service portals, partner communities, or public-facing sites
- When configuring guest user access and reviewing external user security
- When developing LWC components for Experience Cloud sites
- When managing Experience Cloud deployment (Network, ExperienceBundle metadata)
- When designing sharing models for community/external users

@../_reference/EXPERIENCE_CLOUD.md

---

## Site Setup Procedure

### Step 1 — Choose Site Type

| Site Type | Use Case |
|-----------|----------|
| Customer Service | Self-service portal (Knowledge, Cases) |
| Partner Central | Channel partner management (Leads, Opps) |
| Build Your Own (LWR) | Custom branded site, full customization |
| Help Center | Public knowledge base, no login required |

For new sites, use LWR (Lightning Web Runtime) for better performance, SEO, and LWC-only components.

### Step 2 — Configure User Licensing

| User Type | License | Access |
|-----------|---------|--------|
| Customer Community | Community | Read/create own records |
| Customer Community Plus | Community Plus | Read/create + sharing rules |
| Partner Community | Partner Community | Leads, Opps, deal registration |
| Guest User | None | Public read access only |

### Step 3 — Set Up Sharing Model

External users see records based on their Account association:

```
External User -> Contact -> Account -> Records shared with that Account
```

Configure Sharing Sets in Setup for account-based access. Each community has automatic share groups: All Customer Portal Users, All Partner Users.

---

## Guest User Configuration

Guest users access your site without logging in. This is the highest-risk area for data exposure.

### Profile Permissions

- Grant Read only on objects explicitly needed for public display
- Review: Setup > Digital Experiences > [Site] > Guest User Profile

### Guest User Sharing Rules

Configure in Setup > Sharing Settings > Guest User Sharing Rules:

```
Object: Knowledge__kav
  Criteria: IsPublished__c = TRUE AND Channel__c includes 'Public'
  Access: Read Only
  Shared With: Guest User (site-specific)
```

### Securing Apex Controllers for Guest Access

```apex
// Use "with sharing" to enforce sharing rules
// Use WITH USER_MODE for CRUD/FLS enforcement
public with sharing class PublicKnowledgeController {
    @AuraEnabled(cacheable=true)
    public static List<Knowledge__kav> getPublicArticles() {
        return [
            SELECT Title, Summary FROM Knowledge__kav
            WHERE PublishStatus = 'Online' AND IsVisibleInPkb = true
            WITH USER_MODE
        ];
    }
}
```

`with sharing` is necessary but not sufficient for guest users. You must also configure Guest User Sharing Rules. Without them, the query returns zero results.

---

## LWC in Experience Cloud

### Component Meta XML

```xml
<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>66.0</apiVersion>
    <isExposed>true</isExposed>
    <targets>
        <target>lightningCommunity__Page</target>
        <target>lightningCommunity__Default</target>
    </targets>
    <targetConfigs>
        <targetConfig targets="lightningCommunity__Default">
            <property name="title" type="String" label="Card Title" default="Welcome"/>
        </targetConfig>
    </targetConfigs>
</LightningComponentBundle>
```

### Accessing Community Context

```javascript
import communityId from '@salesforce/community/Id';
import communityBasePath from '@salesforce/community/basePath';
import isGuest from '@salesforce/user/isGuest';
```

### Light DOM for Theming

LWR sites support Light DOM, allowing site-level CSS to style component internals:

```javascript
export default class ThemedComponent extends LightningElement {
    static renderMode = 'light';
}
```

### Navigation

```javascript
import { NavigationMixin } from 'lightning/navigation';

// Navigate to a community named page
this[NavigationMixin.Navigate]({
    type: 'comm__namedPage',
    attributes: { name: 'Home' }
});
```

---

## CMS Content

Manage content via CMS Workspaces, publish to site channels.

```javascript
import { getContent } from 'experience/cmsDeliveryApi';

@wire(getContent, { channelId: '$channelId', contentKeyOrId: '$contentId' })
content;

get title() { return this.content?.data?.title?.value; }
```

---

## Custom Authentication

### Self-Registration Handler

```apex
global class CustomRegistrationHandler implements Auth.RegistrationHandler {
    global User createUser(Id portalId, Auth.UserData data) {
        Account portalAccount = [SELECT Id FROM Account WHERE Name = 'Community Users' LIMIT 1];
        Contact c = new Contact(
            AccountId = portalAccount.Id, FirstName = data.firstName,
            LastName = data.lastName, Email = data.email
        );
        insert c;

        Profile p = [SELECT Id FROM Profile WHERE Name = 'Customer Community User'];
        return new User(
            ContactId = c.Id, ProfileId = p.Id,
            Username = data.email + '.community',
            FirstName = data.firstName, LastName = data.lastName,
            Email = data.email, Alias = data.firstName != null ? data.firstName.left(8) : 'guest',
            EmailEncodingKey = 'UTF-8', LanguageLocaleKey = 'en_US',
            LocaleSidKey = 'en_US', TimeZoneSidKey = 'America/Los_Angeles'
        );
    }

    global void updateUser(Id userId, Id portalId, Auth.UserData data) {
        update new User(Id = userId, FirstName = data.firstName,
            LastName = data.lastName, Email = data.email);
    }
}
```

Social login: configure in Settings > Login & Registration > Social Sign-On (Google, Facebook, Apple, LinkedIn, or custom OAuth providers).

---

## Deployment Steps

### Metadata Components

| Metadata Type | Directory |
|---------------|-----------|
| Network | `networks/` |
| ExperienceBundle | `experiences/` |
| CustomSite | `sites/` |
| NavigationMenu | `navigationMenus/` |

### Deploy Procedure

```bash
sf project deploy start --source-dir force-app/main/default/experiences
sf project deploy start --source-dir force-app/main/default/networks
```

Publish via Experience Builder UI or Apex: `ConnectApi.Communities.publishCommunity(null, communityId);`

### Deployment Checklist

1. Deploy Network metadata (site configuration)
2. Deploy ExperienceBundle (pages, themes, routes)
3. Deploy NavigationMenu and dependent components (LWC, Apex, objects)
4. Publish the site
5. Verify guest user profile permissions
6. Test with community user login

---

## SEO and Performance

- Configure sitemap in Settings > SEO (LWR sites only)
- Use semantic URLs (`/orders/12345` not `/s/detail/a01xx000003ABC`)
- Enable CDN caching for static assets (default for LWR)
- Use `@AuraEnabled(cacheable=true)` for read-only data
- Use Custom Labels for multi-language support

---

## Related

### Constraints

- **sf-security-constraints** — Enforced rules for guest user permissions, sharing, and CRUD/FLS

### Agents

- **sf-lwc-reviewer** — For LWC components used in Experience Cloud sites
