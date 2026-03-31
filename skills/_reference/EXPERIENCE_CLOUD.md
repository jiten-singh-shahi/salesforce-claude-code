<!-- Source: https://developer.salesforce.com/docs/atlas.en-us.communities_dev.meta/communities_dev/communities_dev_intro.htm -->
<!-- Last verified: API v66.0 — 2026-03-29 -->
<!-- WARNING: Web fetch of canonical URL failed (LWR client-side rendering). Facts below extracted from sf-experience-cloud skill. -->

# Experience Cloud — Reference

## Site Types

| Site Type | Use Case | Key Features |
|-----------|----------|-------------|
| Customer Service | Self-service portal | Knowledge, Cases, Accounts |
| Partner Central | Channel partner management | Leads, Opportunities, deal registration |
| Build Your Own (LWR) | Custom branded site | Full customization, LWR framework |
| Help Center | Public knowledge base | Knowledge articles, search, no login required |
| Microsite | Event/campaign landing page | Lightweight, specific purpose |

## LWR vs Aura-Based Sites

| Aspect | LWR (Lightning Web Runtime) | Aura-Based |
|--------|----------------------------|------------|
| Performance | Faster, modern rendering | Heavier, legacy framework |
| Components | LWC only | Aura + LWC |
| SEO | Better (server-side rendering) | Limited |
| Theming | CSS custom properties, SLDS | Theme panel, limited CSS |
| CDN caching | Enabled by default | — |
| Light DOM | Supported (`static renderMode = 'light'`) | Not supported |
| Recommendation | New sites | Legacy/migration only |

## User Types and Licensing

| User Type | License | Access Level |
|-----------|---------|-------------|
| Customer Community | Community | Read/create own records only |
| Customer Community Plus | Community Plus | Read/create + sharing rules |
| Partner Community | Partner Community | Leads, Opps, deal registration |
| Guest User | None (unauthenticated) | Public read access only |

### External User Hierarchy (top = most access)

| Level | Access Model |
|-------|-------------|
| Internal Users | Full org access (role hierarchy) |
| Partner Users | Account-based + sharing rules |
| Customer Plus Users | Account-based + sharing rules |
| Customer Users | Own records only (no sharing rules) |
| Guest Users | Public records only (no login) |

## Guest User Security Rules

| Rule | Detail |
|------|--------|
| NEVER grant Create, Edit, or Delete | On ANY object for guest profile |
| ONLY grant Read | On objects explicitly needed for public display |
| NEVER grant View All Data / Modify All Data | Critical security violation |
| NEVER grant API access | To guest users |
| OWD setting | Must NOT be "Public Read/Write" for guest-accessible objects |
| Sharing rules | Use Guest User Sharing Rules (criteria-based) to control visible records |
| Apex controllers | MUST use `with sharing` (enforces record-level sharing) |
| SOQL in controllers | Use `WITH USER_MODE` (enforces CRUD/FLS) |
| `with sharing` alone | Necessary but NOT sufficient; Guest User Sharing Rules must also be configured |

## Sharing Model for External Users

| Mechanism | How It Works |
|-----------|-------------|
| Account-Based Sharing | External User -> Contact -> Account -> shared records |
| Sharing Sets | Grant access based on user's Account or Contact (admin config) |
| All Customer Portal Users | Auto share group for all community users |
| All Partner Users | Auto share group for all partner users |
| Apex Managed Sharing | `CustomObject__Share` with `RowCause = Manual` |

## LWC Targets for Experience Cloud

| Target | Purpose |
|--------|---------|
| `lightningCommunity__Page` | Experience Cloud page |
| `lightningCommunity__Default` | Default community context |
| `lightningCommunity__Page_Layout` | Page layout region |

### Community Context Imports

| Import | Module | Returns |
|--------|--------|---------|
| `communityId` | `@salesforce/community/Id` | Current community/site ID |
| `communityBasePath` | `@salesforce/community/basePath` | Site base URL path |
| `isGuest` | `@salesforce/user/isGuest` | Boolean: guest user check |
| `userId` | `@salesforce/user/Id` | Current user ID |

## Navigation in Experience Cloud

| Navigation Type | PageReference `type` | Key Attribute |
|----------------|---------------------|---------------|
| Record page | `standard__recordPage` | `recordId`, `actionName: 'view'` |
| Named community page | `comm__namedPage` | `name` (e.g., `'Home'`, `'Contact_Support'`) |
| External URL | `standard__webPage` | `url` |

## CMS Content

| Concept | Detail |
|---------|--------|
| CMS Workspace | Manages content types and items |
| Publishing | Content items published to Channels (Sites) |
| LWC API | `getContent` from `experience/cmsDeliveryApi` |
| Wire params | `channelId`, `contentKeyOrId` |
| Content fields | `data.title.value`, `data.body.value` |

## Deployment Metadata Types

| Metadata Type | Directory | Description |
|---------------|-----------|-------------|
| Network | `networks/` | Site definition (template, features, branding) |
| ExperienceBundle | `experiences/` | Pages, routes, views, themes |
| CustomSite | `sites/` | Site URL configuration |
| NavigationMenu | `navigationMenus/` | Site navigation structure |
| CommunityTemplateDefinition | `communityTemplateDefinitions/` | Template metadata |

### Deployment Commands

| Step | Command |
|------|---------|
| Retrieve Network | `sf project retrieve start --metadata Network:My_Community` |
| Retrieve ExperienceBundle | `sf project retrieve start --metadata ExperienceBundle:My_Community1` |
| Deploy experiences | `sf project deploy start --source-dir force-app/main/default/experiences` |
| Deploy networks | `sf project deploy start --source-dir force-app/main/default/networks` |
| Publish site | Via Experience Builder UI or `ConnectApi.Communities.publishCommunity(null, communityId)` in Apex |

**Note:** `sf community publish` CLI command was removed in SF CLI v2. Publish via UI or Apex only.

**Deploy order:** Network -> ExperienceBundle -> NavigationMenu -> dependent components (LWC, Apex, objects) -> Publish -> verify guest profile -> test with community user login.

## Performance, Auth, and SEO

| Area | Item | Detail |
|------|------|--------|
| Performance | CDN caching | Enabled by default (LWR sites) |
| Performance | Lazy loading | `loading="lazy"` on images |
| Performance | Apex caching | `@AuraEnabled(cacheable=true)` for read-only data |
| Auth | Custom Login Page | Settings > Login & Registration > Login Page Type |
| Auth | Self-Registration | Custom `Auth.RegistrationHandler` implementation |
| Auth | Social Login | Google, Facebook, Apple, LinkedIn out-of-box; custom via Auth Provider |
| SEO (LWR only) | Sitemap | Settings > SEO > Sitemap |
| SEO (LWR only) | Semantic URLs | `/orders/12345` not `/s/detail/a01xx...` |
| SEO (LWR only) | Multi-language | `/en/orders`, `/es/orders`; guest language from `Accept-Language` header |
