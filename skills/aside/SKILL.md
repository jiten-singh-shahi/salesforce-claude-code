---
name: aside
description: >-
  Use when you need a quick Salesforce answer mid-task. Answer a side question about Apex, org config,
  or metadata without losing context, then resume work automatically.
origin: SCC
user-invocable: true
---

# Aside — Quick Side Question Without Losing Context

Ask a question mid-task and get an immediate, focused answer — then continue right where you left off. The current task, files, and context are never modified.

## When to Use

- You're curious about something while Claude is working and don't want to lose momentum
- You need a quick explanation of code Claude is currently editing
- You want a second opinion or clarification on a decision without derailing the task
- You need to understand an error, concept, or pattern before Claude proceeds
- You want to ask something unrelated to the current task without starting a new session

## Usage

```
/aside <your question>
/aside what does this function actually return?
/aside is this pattern thread-safe?
/aside why are we using X instead of Y here?
/aside what's the difference between foo() and bar()?
/aside should we be worried about the SOQL in a loop we just added?
```

## Process

### Step 1: Freeze the current task state

Before answering anything, mentally note:

- What is the active task? (what file, feature, or problem was being worked on)
- What step was in progress at the moment the aside was invoked?
- What was about to happen next?

Do NOT touch, edit, create, or delete any files during the aside.

### Step 2: Answer the question directly

Answer the question in the most concise form that is still complete and useful.

- Lead with the answer, not the reasoning
- Keep it short — if a full explanation is needed, offer to go deeper after the task
- If the question is about the current file or code being worked on, reference it precisely (file path and line number if relevant)
- If answering requires reading a file, read it — but read only, never write

Format the response as:

```
ASIDE: [restate the question briefly]

[Your answer here]

— Back to task: [one-line description of what was being done]
```

### Step 3: Resume the main task

After delivering the answer, immediately continue the active task from the exact point it was paused. Do not ask for permission to resume unless the aside answer revealed a blocker or a reason to reconsider the current approach.

---

## Edge Cases

**No question provided (aside invoked with nothing after it):**
Respond:

```
ASIDE: no question provided

What would you like to know? (ask your question and I'll answer without losing the current task context)

— Back to task: [one-line description of what was being done]
```

**Question reveals a potential problem with the current task:**
Flag it clearly before resuming:

```
ASIDE: [answer]

Warning: This answer suggests [issue] with the current approach. Want to address this before continuing, or proceed as planned?
```

Wait for the user's decision before resuming.

**Question is actually a task redirect (not a side question):**
If the question implies changing what is being built, clarify:

```
ASIDE: That sounds like a direction change, not just a side question.
Do you want to:
  (a) Answer this as information only and keep the current plan
  (b) Pause the current task and change approach
```

Wait for the user's answer.

**No active task (nothing in progress when aside is invoked):**
Still use the standard wrapper:

```
ASIDE: [restate the question briefly]

[Your answer here]

— Back to task: no active task to resume
```

**Multiple aside questions in a row:**
Answer each one in sequence. After the last answer, resume the main task.
