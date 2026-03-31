# Apex Enterprise Patterns (FFLIB) -- Reference

> Source: [fflib-apex-common](https://github.com/apex-enterprise-patterns/fflib-apex-common), [fflib.dev](https://fflib.dev/docs)
> Last verified: API v66.0, Spring '26 (2026-03-28)

## Layer Architecture

| Layer | Responsibility | Allowed Dependencies |
|---|---|---|
| **Selector** | All SOQL/SOSL queries for one SObject. No business logic. | None (data access only) |
| **Domain** | Single-object logic: validation, defaults, trigger handling. No cross-object ops, no direct SOQL. | Selector (same object) |
| **Service** | Multi-object orchestration, transaction control, business logic entry point. No direct SOQL/DML. | Domain, Selector, other Services, Unit of Work |
| **Unit of Work** | Transactional DML aggregation. Register ops, commit once. | None (passed into Service) |
| **Implementation** | Entry points: Controllers, Batch, Queueable, REST, Invocable. Minimal logic. | Service only |

**Call direction**: Implementation -> Service -> Domain / Selector. Never reverse.

## Class Naming Conventions

| Layer | Class Name | Interface Name | Example |
|---|---|---|---|
| Selector | `{Object}sSelector` | `I{Object}sSelector` | `AccountsSelector`, `IAccountsSelector` |
| Domain | `{Object}s` (plural) | `I{Object}s` | `Accounts`, `IAccounts` |
| Service | `{Object}sService` | `I{Object}sService` | `AccountsService`, `IAccountsService` |
| Unit of Work | (use `fflib_SObjectUnitOfWork`) | `fflib_ISObjectUnitOfWork` | -- |
| Trigger Handler | `{Object}sTriggerHandler` | -- | `AccountsTriggerHandler` |

Domain classes use **plural names** to emphasize bulk processing (e.g., `Opportunities`, not `Opportunity`).

## Application Factory Registration

| Factory | Constructor Argument | Maps To |
|---|---|---|
| `UnitOfWorkFactory` | `List<SObjectType>` (parent-first order) | `fflib_ISObjectUnitOfWork` |
| `ServiceFactory` | `Map<Type, Type>` (interface -> impl) | Service instances |
| `SelectorFactory` | `Map<SObjectType, Type>` (object -> selector class) | `fflib_ISObjectSelector` |
| `DomainFactory` | `Application.Selector` + `Map<SObjectType, Type>` | `fflib_ISObjectDomain` |

**UoW SObjectType order** matters -- parent objects first (respects DML dependency).
DomainFactory depends on SelectorFactory (domain construction queries via selector).

## Key Interfaces

### fflib_ISObjectSelector

| Method | Signature |
|---|---|
| `sObjectType` | `Schema.SObjectType sObjectType()` |
| `selectSObjectsById` | `List<SObject> selectSObjectsById(Set<Id> idSet)` |

### fflib_ISObjectDomain

| Method | Signature |
|---|---|
| `sObjectType` | `Schema.SObjectType sObjectType()` |
| `getRecords` | `List<SObject> getRecords()` |

### fflib_ISObjectUnitOfWork (key methods)

| Method | Signature |
|---|---|
| `registerNew` | `void registerNew(SObject record)` |
| `registerNew` | `void registerNew(SObject record, SObjectField relField, SObject parent)` |
| `registerDirty` | `void registerDirty(SObject record)` |
| `registerDirty` | `void registerDirty(SObject record, List<SObjectField> dirtyFields)` |
| `registerDeleted` | `void registerDeleted(SObject record)` |
| `registerRelationship` | `void registerRelationship(SObject record, SObjectField relField, SObject relTo)` |
| `registerUpsert` | `void registerUpsert(SObject record)` |
| `commitWork` | `void commitWork()` |

All `register*` methods also accept `List<SObject>` overloads.

## Base Class Methods to Override

### fflib_SObjectSelector (abstract)

| Type | Method |
|---|---|
| **abstract** | `Schema.SObjectType getSObjectType()` |
| **abstract** | `List<Schema.SObjectField> getSObjectFieldList()` |
| virtual | `String getOrderBy()` |
| virtual | `List<Schema.FieldSet> getSObjectFieldSetList()` |

Constructor options: `(Boolean includeFieldSetFields, Boolean enforceCRUD, Boolean enforceFLS)`.

### fflib_SObjectDomain (virtual trigger handlers)

| Phase | Method |
|---|---|
| Defaults | `void onApplyDefaults()` |
| Before | `void onBeforeInsert()` |
| Before | `void onBeforeUpdate(Map<Id,SObject> existing)` |
| Before | `void onBeforeDelete()` |
| Validation | `void onValidate()` |
| Validation | `void onValidate(Map<Id,SObject> existing)` |
| After | `void onAfterInsert()` |
| After | `void onAfterUpdate(Map<Id,SObject> existing)` |
| After | `void onAfterDelete()` |
| After | `void onAfterUndelete()` |

Constructor: `fflib_SObjectDomain(List<SObject> records)`.

## Dependency Rules (Strict)

| Rule | Description |
|---|---|
| Selectors never call Services or Domains | Query-only layer |
| Domains never call Services | Prevents circular dependencies |
| Services own the Unit of Work | Create UoW in Service, pass to Domain if needed |
| `Application.Domain` factory depends on `Application.Selector` | Domain construction queries records via Selector |
| No direct DML in Service or Domain | All DML through Unit of Work |
| No direct SOQL in Service | All queries through Selectors |

## Testing with Mocks

| Factory | setMock Signature |
|---|---|
| `Application.Selector` | `.setMock(SObjectType, fflib_ISObjectSelector)` |
| `Application.Domain` | `.setMock(SObjectType, fflib_ISObjectDomain)` |
| `Application.Service` | `.setMock(Type interfaceType, Object mockImpl)` |

Mocking via `fflib-apex-mocks` eliminates DML/SOQL in unit tests.
