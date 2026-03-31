---
name: save-session
description: >-
  Use when saving current Salesforce development session state. Persist org context, Apex progress,
  and pending work to a dated file for future session resumption.
origin: SCC
user-invocable: true
disable-model-invocation: true
---

# Save Session — Capture and Persist Session Context

Capture everything that happened in this session — what was built, what worked, what failed, what's left — and write it to a dated file so the next session can pick up exactly where this one left off.

## When to Use

- End of a work session before closing Claude Code
- Before hitting context limits (run this first, then start a fresh session)
- After solving a complex Salesforce problem you want to remember
- Any time you need to hand off context to a future session

## Process

### Step 1: Gather context

Before writing the file, collect:

- Read all files modified during this session (use git diff or recall from conversation)
- Review what was discussed, attempted, and decided
- Note any errors encountered and how they were resolved (or not)
- Check current test/sf-deployment status if relevant
- Note org-specific details (scratch org alias, connected org, CLI version)

### Step 2: Create the sessions folder if it doesn't exist

```bash
mkdir -p ~/.claude/sessions
```

### Step 3: Write the session file

Create `~/.claude/sessions/YYYY-MM-DD-<short-id>-session.md`, using today's actual date and a short-id:

- Allowed characters: lowercase `a-z`, digits `0-9`, hyphens `-`
- Minimum length: 8 characters
- No uppercase letters, no underscores, no spaces

Full valid filename example: `2026-03-18-apex-trig-session.md`

The short-id should include the project name to enable cross-project isolation (e.g., `myapp-apex-trig` instead of just `apex-trig`). This prevents session file collisions when working across multiple Salesforce projects that share the same `~/.claude/sessions/` directory.

### Step 4: Populate the file with all sections below

Keep session files under ~500 lines. Focus on decisions, blockers, and next steps — not full code dumps. If you need to reference large code blocks, point to file paths instead.

Write every section honestly. Do not skip sections — write "Nothing yet" or "N/A" if a section genuinely has no content.

### Step 5: Show the file to the user

After writing, display the full contents and ask:

```
Session saved to [actual resolved path to the session file]

Does this look accurate? Anything to correct or add before we close?
```

Wait for confirmation. Make edits if requested.

---

## Session File Format

```markdown
# Session: YYYY-MM-DD

**Started:** [approximate time if known]
**Last Updated:** [current time]
**Project:** [project name or path]
**Topic:** [one-line summary of what this session was about]

---

## What We Are Building

[1-3 paragraphs describing the feature, bug fix, or task. Include enough
context that someone with zero memory of this session can understand the goal.
Include: what it does, why it's needed, how it fits into the Salesforce org.]

---

## What WORKED (with evidence)

[List only things that are confirmed working. For each item include WHY you
know it works — test passed, deployment succeeded, scratch org validated, etc.
Without evidence, move it to "Not Tried Yet" instead.]

- **[thing that works]** — confirmed by: [specific evidence]

If nothing is confirmed working yet: "Nothing confirmed working yet."

---

## What Did NOT Work (and why)

[This is the most important section. List every approach tried that failed.
For each failure write the EXACT reason so the next session doesn't retry it.
Be specific: "threw X error because Y" is useful. "didn't work" is not.]

- **[approach tried]** — failed because: [exact reason / error message]

If nothing failed: "No failed approaches yet."

---

## What Has NOT Been Tried Yet

[Approaches that seem promising but haven't been attempted.]

- [approach / idea]

If nothing is queued: "No specific untried approaches identified."

---

## Current State of Files

[Every file touched this session. Be precise about what state each file is in.]

| File              | Status         | Notes                      |
| ----------------- | -------------- | -------------------------- |
| `path/to/file.cls` | Complete    | [what it does]             |
| `path/to/file.cls` | In Progress | [what's done, what's left] |
| `path/to/file.js` | Broken      | [what's wrong]             |

If no files were touched: "No files modified this session."

---

## Decisions Made

[Architecture choices, tradeoffs accepted, approaches chosen and why.]

- **[decision]** — reason: [why this was chosen over alternatives]

If no significant decisions: "No major decisions made this session."

---

## Blockers & Open Questions

[Anything unresolved that the next session needs to address.]

- [blocker / open question]

If none: "No active blockers."

---

## Exact Next Step

[The single most important thing to do when resuming.]

---

## Environment & Setup Notes

[Only fill if relevant — scratch org alias, connected org, SF CLI version, etc.]
```

---

## Notes

- Each session gets its own file — never append to a previous session's file
- The "What Did NOT Work" section is the most critical — future sessions will blindly retry failed approaches without it
- The file is meant to be read by Claude at the start of the next session via the resume-session skill
- Use the canonical global session store: `~/.claude/sessions/`

## Examples

```
/save-session
/save-session Save progress on the AccountManagement feature refactor
/save-session Checkpoint before switching to the hotfix branch
```
