---
name: resume-session
description: >-
  Use when resuming a previous Salesforce development session. Load saved org context and Apex
  work-in-progress to continue where the last session ended.
origin: SCC
user-invocable: true
---

# Resume Session — Restore and Orient from a Saved Session

Load the last saved session state and orient fully before doing any work.
This skill is the counterpart to the save-session skill.

## When to Use

- Starting a new session to continue work from a previous day
- After starting a fresh session due to context limits
- When handing off a session file from another source (just provide the file path)
- Any time you have a session file and want Claude to fully absorb it before proceeding

## Usage

```
/resume-session                                                      # loads most recent file in ~/.claude/sessions/
/resume-session 2026-03-18                                           # loads most recent session for that date
/resume-session ~/.claude/sessions/2026-03-18-apex-trig-session.md   # loads a specific file
```

## Process

### Step 1: Find the session file

If no argument provided:

1. Check `~/.claude/sessions/`
2. Pick the most recently modified `*-session.md` file
3. If the folder does not exist or has no matching files, tell the user:

   ```
   No session files found in ~/.claude/sessions/
   Run /save-session at the end of a session to create one.
   ```

   Then stop.

If an argument is provided:

- If it looks like a date (`YYYY-MM-DD`), search `~/.claude/sessions/` for matching files
  and load the most recently modified variant for that date
- If it looks like a file path, read that file directly
- If not found, report clearly and stop

### Step 2: Read the entire session file

Read the complete file. Do not summarize yet.

### Step 3: Confirm understanding

Respond with a structured briefing in this exact format:

```
SESSION LOADED: [actual resolved path to the file]

PROJECT: [project name / topic from file]

WHAT WE'RE BUILDING:
[2-3 sentence summary in your own words]

CURRENT STATE:
Working: [count] items confirmed
In Progress: [list files that are in progress]
Not Started: [list planned but untouched]

WHAT NOT TO RETRY:
[list every failed approach with its reason — this is critical]

OPEN QUESTIONS / BLOCKERS:
[list any blockers or unanswered questions]

NEXT STEP:
[exact next step if defined in the file]

Ready to continue. What would you like to do?
```

### Step 4: Wait for the user

Do NOT start working automatically. Do NOT touch any files. Wait for the user to say what to do next.

---

## Edge Cases

**Multiple sessions for the same date:**
Load the most recently modified matching file for that date.

**Session file references files that no longer exist:**
Note this during the briefing — "WARNING: `path/to/file.cls` referenced in session but not found on disk."

**Session file is from more than 7 days ago:**
Note the gap — "WARNING: This session is from N days ago. Things may have changed." — then proceed normally.

**Session file is empty or malformed:**
Report: "Session file found but appears empty or unreadable. You may need to create a new one with /save-session."

---

## Notes

- Never modify the session file when loading it — it's a read-only historical record
- The briefing format is fixed — do not skip sections even if they are empty
- "What Not To Retry" must always be shown, even if it just says "None"
- After resuming, the user may want to run `/save-session` again at the end of the new session
