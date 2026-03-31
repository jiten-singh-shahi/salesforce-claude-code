<!-- Source: https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_process_classes.htm -->
<!-- Last verified: API v66.0 — 2026-03-29 -->
<!-- WARNING: Web fetch of canonical URL failed (JS-rendered page). Facts extracted from SCC skill sf-approval-processes. Verify against official docs before relying on class signatures. -->

# Approval Processes Reference

## Apex Approval Classes

| Class | Purpose |
|-------|---------|
| `Approval.ProcessSubmitRequest` | Submit a record for approval |
| `Approval.ProcessWorkitemRequest` | Approve, reject, or remove a pending work item |
| `Approval.ProcessResult` | Result returned by `Approval.process()` |

## Approval.ProcessSubmitRequest Methods

| Method | Parameter | Description |
|--------|-----------|-------------|
| `setObjectId(Id)` | Record ID | Record to submit for approval |
| `setSubmitterId(Id)` | User ID | User submitting the request |
| `setComments(String)` | Text | Submission comments |
| `setSkipEntryCriteria(Boolean)` | true/false | Bypass entry criteria check |
| `setProcessDefinitionNameOrId(String)` | Name or ID | Target a specific approval process |
| `setNextApproverIds(List<Id>)` | User IDs | Explicitly set next approver(s) |

## Approval.ProcessWorkitemRequest Methods

| Method | Parameter | Description |
|--------|-----------|-------------|
| `setWorkitemId(Id)` | Work item ID | The pending work item to act on |
| `setAction(String)` | `'Approve'` / `'Reject'` / `'Remove'` | Action to take |
| `setComments(String)` | Text | Approver/rejector comments |

## Approval.ProcessResult Methods

| Method | Return Type | Description |
|--------|-------------|-------------|
| `isSuccess()` | `Boolean` | Whether the operation succeeded |
| `getInstanceId()` | `Id` | ProcessInstance ID |
| `getInstanceStatus()` | `String` | `'Pending'`, `'Approved'`, `'Rejected'` |
| `getNewWorkitemIds()` | `List<Id>` | Work item IDs created by this step |
| `getErrors()` | `List<Database.Error>` | Error details on failure |

## Entry Point

| Method | Signature |
|--------|-----------|
| `Approval.process()` | `Approval.ProcessResult Approval.process(Approval.ProcessSubmitRequest req)` |
| `Approval.process()` | `Approval.ProcessResult Approval.process(Approval.ProcessWorkitemRequest req)` |

## Approval Step Properties

| Property | Options |
|----------|---------|
| Approver type | User field, Manager field, Queue, Related user |
| Step criteria | All records OR filter criteria (step-specific) |
| Reject behavior | Final rejection OR go to previous step |
| Unanimity | All must approve OR first response |

## Approval Actions by Phase

| Phase | Available Actions |
|-------|-------------------|
| Initial Submission | Field Update, Email Alert, Record Lock, Outbound Message |
| Final Approval | Field Update, Email Alert, Record Unlock, Workflow Task, Outbound Message |
| Final Rejection | Field Update, Email Alert, Record Unlock |
| Recall | Record Unlock, Field Update |

## Related Standard Objects

| Object | Purpose | Key Fields |
|--------|---------|------------|
| `ProcessInstance` | One approval submission | `TargetObjectId`, `Status`, `CreatedDate` |
| `ProcessInstanceWorkitem` | A pending approval task | `ActorId`, `ProcessInstanceId` |
| `ProcessInstanceStep` | One completed step in history | `StepStatus`, `Comments`, `ActorId`, `CreatedDate` |
| `ProcessInstanceHistory` | Union of steps and work items | `StepStatus`, `Comments`, `Actor.Name` |

## Key SOQL Queries

| Purpose | Object | Filter |
|---------|--------|--------|
| Pending items for current user | `ProcessInstanceWorkitem` | `WHERE ActorId = :UserInfo.getUserId()` |
| Approval history for a record | `ProcessInstanceStep` | `WHERE ProcessInstance.TargetObjectId = :recordId` |
| Active work item for a record | `ProcessInstanceWorkitem` | `WHERE ProcessInstance.TargetObjectId = :recordId AND ProcessInstance.Status = 'Pending'` |

## Metadata Deployment

| Item | Path | package.xml Type |
|------|------|------------------|
| Approval process | `approvalProcesses/<Object>.<Name>.approvalProcess-meta.xml` | `ApprovalProcess` |
| Member format | `<Object>.<ProcessName>` (e.g., `Opportunity.Discount_Approval`) | -- |

## Spring '26 Feature

| Feature | Detail |
|---------|--------|
| Integrated Approval Screen Component | Screen Flow component for in-flow approve/reject with history display |

## Key Rules

- Approval processes cannot be created programmatically in Apex tests; deploy via metadata.
- Record locking is enforced at the UI/API level, not within Apex test context.
- Dependencies (users, queues, email templates) must exist in target org before deploying approval processes.
- Use Queues as approvers for vacation coverage; any queue member can approve.
- Use Flow-based dynamic approvers to route based on amount, region, or other criteria.
