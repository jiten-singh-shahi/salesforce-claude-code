---
name: sf-approval-processes
description: >-
  Use when designing Salesforce Apex approval processes, multi-step approvals, or Flow-integrated submissions. Do NOT use for general Apex or Flow-only work.
---

# Salesforce Approval Processes

@../_reference/APPROVAL_PROCESSES.md

## When to Use

- Designing multi-step approval workflows (discounts, expenses, contracts)
- Building Apex-driven approval submissions or programmatic approvals/rejections
- Integrating approval logic with Flows (Spring '26 Integrated Approval Screen component)
- Troubleshooting approval routing, locked records, or missing approval history
- Migrating from email-based approvals to in-app approval workflows

---

## Approval Process Architecture

```
┌─────────────────────────────────────────────────────┐
│                 Approval Process                     │
├─────────────────────────────────────────────────────┤
│  Entry Criteria     │ WHO can submit? WHEN?          │
│  Initial Submitter  │ Record owner, specific users   │
├─────────────────────────────────────────────────────┤
│  Step 1: Manager    │ Approver: Manager field         │
│  Step 2: VP         │ Approver: Related user field    │
│  Step 3: Finance    │ Approver: Queue                 │
├─────────────────────────────────────────────────────┤
│  Initial Actions    │ Lock record, set Status         │
│  Approval Actions   │ Unlock, update field, email     │
│  Rejection Actions  │ Unlock, set Status to Rejected  │
│  Recall Actions     │ Unlock, clear approval fields   │
└─────────────────────────────────────────────────────┘
```

### Entry Criteria

```
Amount__c > 10000 AND Status__c = 'Draft'
RecordType.Name = 'Enterprise' AND Discount__c > 20

Formula:
AND(Amount__c > 10000, ISPICKVAL(Status__c, 'Draft'), NOT(ISBLANK(OwnerId)))
```

### Approval Steps

| Property | Options |
|---|---|
| Approver | User field, Manager field, Queue, Related user |
| Criteria | All records OR filter criteria (step-specific) |
| Reject behavior | Final rejection OR go to previous step |
| Unanimity | All must approve OR first response |

### Parallel Approvals

- **Unanimous**: All assigned approvers must approve
- **First Response**: First approver's decision applies
- For true parallel independent steps (Legal AND Finance simultaneously), use multiple processes or custom Apex

---

## Approval Actions

### Initial Submission Actions

- Field Update: `Status__c = "Pending Approval"`
- Email Alert: Notify approver(s)
- Record Lock: Prevent edits during approval
- Outbound Message: Notify external system

### Final Approval Actions

- Field Update: `Status__c = "Approved"`
- Email Alert: Notify submitter
- Record Unlock: Allow edits again

### Final Rejection Actions

- Field Update: `Status__c = "Rejected"`
- Email Alert: Notify submitter with rejection reason
- Record Unlock

---

## Apex Approval Processing

### Submitting a Record for Approval

```apex
public class ApprovalService {
    public static void submitForApproval(Id recordId, String comments) {
        Approval.ProcessSubmitRequest request = new Approval.ProcessSubmitRequest();
        request.setObjectId(recordId);
        request.setSubmitterId(UserInfo.getUserId());
        request.setComments(comments);

        Approval.ProcessResult result = Approval.process(request);
        if (result.isSuccess()) {
            System.debug('Submitted. Instance ID: ' + result.getInstanceId());
        } else {
            for (Database.Error err : result.getErrors()) {
                System.debug(LoggingLevel.ERROR, 'Failed: ' + err.getMessage());
            }
        }
    }
}
```

### Approving or Rejecting Programmatically

```apex
public static void approveRecord(Id workItemId, String comments) {
    Approval.ProcessWorkitemRequest request = new Approval.ProcessWorkitemRequest();
    request.setWorkitemId(workItemId);
    request.setAction('Approve');
    request.setComments(comments);

    Approval.ProcessResult result = Approval.process(request);
    if (!result.isSuccess()) {
        throw new ApprovalException('Approval failed: ' + result.getErrors());
    }
}

public static void rejectRecord(Id workItemId, String comments) {
    Approval.ProcessWorkitemRequest request = new Approval.ProcessWorkitemRequest();
    request.setWorkitemId(workItemId);
    request.setAction('Reject');
    request.setComments(comments);

    Approval.ProcessResult result = Approval.process(request);
    if (!result.isSuccess()) {
        throw new ApprovalException('Rejection failed: ' + result.getErrors());
    }
}
```

### Querying Approval Status

```apex
// Pending work items for current user
List<ProcessInstanceWorkitem> pendingItems = [
    SELECT Id, ProcessInstance.TargetObjectId, ProcessInstance.Status,
           ProcessInstance.TargetObject.Name, CreatedDate
    FROM ProcessInstanceWorkitem
    WHERE ActorId = :UserInfo.getUserId()
    ORDER BY CreatedDate DESC
];

// Approval history for a record
List<ProcessInstanceStep> history = [
    SELECT StepStatus, Comments, Actor.Name, CreatedDate
    FROM ProcessInstanceStep
    WHERE ProcessInstance.TargetObjectId = :recordId
    ORDER BY CreatedDate ASC
];

// Active work item for a specific record
ProcessInstanceWorkitem workItem = [
    SELECT Id FROM ProcessInstanceWorkitem
    WHERE ProcessInstance.TargetObjectId = :recordId
      AND ProcessInstance.Status = 'Pending'
    LIMIT 1
];
```

---

## Flow Integration

### Submitting for Approval from Flow

Use the **Submit for Approval** action element: specify the record ID, optionally the approval process name, submitter, and comments.

### Spring '26 — Integrated Approval Screen Component

Screen Flows can include an Integrated Approval component for in-flow approve/reject:

```
Screen Flow:
  1. Show Record Details
  2. Integrated Approval Component (history, Approve/Reject buttons, comments)
  3. Decision: Check outcome
  4. Update Records based on outcome
```

### Dynamic Approvers via Flow

```
Autolaunched Flow (invoked by Approval Process):
  1. Get Records: record's Region__c and Amount__c
  2. Decision: Route by amount and region
     - > 500K → VP Finance
     - > 100K → Regional Manager
     - Otherwise → Direct Manager
  3. Return approver User ID
```

---

## Design Patterns

### Delegation and Backup Approvers

- Configure Delegated Approvers in user settings for vacation coverage
- Use Queues as approvers so any queue member can approve
- Set approval step timeout for auto-escalation

### Approval History Tracking

```apex
public static List<Map<String, Object>> getApprovalHistory(Id recordId) {
    List<Map<String, Object>> trail = new List<Map<String, Object>>();
    for (ProcessInstance pi : [
        SELECT Id, Status, CreatedDate,
            (SELECT StepStatus, Comments, Actor.Name, CreatedDate
             FROM StepsAndWorkitems ORDER BY CreatedDate)
        FROM ProcessInstance
        WHERE TargetObjectId = :recordId
        ORDER BY CreatedDate DESC
    ]) {
        for (ProcessInstanceHistory step : pi.StepsAndWorkitems) {
            trail.add(new Map<String, Object>{
                'status' => step.StepStatus,
                'approver' => step.Actor.Name,
                'comments' => step.Comments,
                'date' => step.CreatedDate
            });
        }
    }
    return trail;
}
```

---

## Testing Approval Processes

These tests require an approval process to be deployed in the org's metadata. Approval processes cannot be created programmatically in tests.

```apex
@isTest
static void testApprovalSubmission() {
    Account testAccount = new Account(Name = 'Test Account', AnnualRevenue = 50000);
    insert testAccount;

    Test.startTest();
    Approval.ProcessSubmitRequest request = new Approval.ProcessSubmitRequest();
    request.setObjectId(testAccount.Id);
    request.setSubmitterId(UserInfo.getUserId());
    Approval.ProcessResult result = Approval.process(request);
    Test.stopTest();

    System.assert(result.isSuccess(), 'Approval submission should succeed');
    System.assertEquals('Pending', result.getInstanceStatus());
}

@isTest
static void testApprovalProcess() {
    Account testAccount = new Account(Name = 'Test', AnnualRevenue = 50000);
    insert testAccount;

    Approval.ProcessSubmitRequest submitReq = new Approval.ProcessSubmitRequest();
    submitReq.setObjectId(testAccount.Id);
    Approval.ProcessResult submitResult = Approval.process(submitReq);

    Id workItemId = submitResult.getNewWorkitemIds()[0];

    Approval.ProcessWorkitemRequest approveReq = new Approval.ProcessWorkitemRequest();
    approveReq.setWorkitemId(workItemId);
    approveReq.setAction('Approve');
    approveReq.setComments('Looks good');

    Test.startTest();
    Approval.ProcessResult approveResult = Approval.process(approveReq);
    Test.stopTest();

    System.assert(approveResult.isSuccess());
    System.assertEquals('Approved', approveResult.getInstanceStatus());
}
```

---

## Metadata Deployment

```
approvalProcesses/
  Discount_Approval.approvalProcess-meta.xml
```

Include in `package.xml`:

```xml
<types>
    <members>Opportunity.Discount_Approval</members>
    <name>ApprovalProcess</name>
</types>
```

Approval processes reference users, queues, and email templates. Ensure dependencies exist in the target org before deployment.

---

## Related

- **Constraints**: `sf-apex-constraints` — Governor limits and Apex safety rules
