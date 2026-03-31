---
name: sessions
description: >-
  Use when managing Salesforce Claude Code session history. List, load, alias, and inspect saved Apex and org development sessions stored in ~/.claude/sessions/.
---

# Sessions — Session History Management

Manage Claude Code session history - list, load, alias, and inspect sessions stored in `~/.claude/sessions/`.

## When to Use

- Listing all saved sessions to find a specific one
- Loading a previous session by ID, date, or alias
- Creating memorable aliases for frequently referenced sessions
- Inspecting session metadata and statistics
- Managing session aliases (create, remove, list)

## Usage

`/sessions [list|load|alias|info|aliases|help] [options]`

`/sessions help` shows this usage guide.

## Actions

### List Sessions

Display all sessions with metadata, filtering, and pagination.

```bash
/sessions                              # List all sessions (default)
/sessions list                         # Same as above
/sessions list --limit 10              # Show 10 sessions
/sessions list --date 2026-03-18       # Filter by date
/sessions list --search apex           # Search by session ID
```

### Load Session

Load and display a session's content (by ID or alias).

```bash
/sessions load <id|alias>             # Load session
/sessions load 2026-03-18             # By date
/sessions load apex-trig              # By short ID
/sessions load my-alias               # By alias name
```

### Create Alias

Create a memorable alias for a session.

```bash
/sessions alias <id> <name>           # Create alias
/sessions alias 2026-03-18 trigger-work
```

### Remove Alias

Delete an existing alias.

```bash
/sessions alias --remove <name>        # Remove alias
/sessions unalias <name>               # Same as above
```

### Session Info

Show detailed information about a session.

```bash
/sessions info <id|alias>              # Show session details
```

### List Aliases

Show all session aliases.

```bash
/sessions aliases                      # List all aliases
```

## Arguments

- `list [options]` - List sessions
  - `--limit <n>` - Max sessions to show (default: 50)
  - `--date <YYYY-MM-DD>` - Filter by date
  - `--search <pattern>` - Search in session ID
- `load <id|alias>` - Load session content
- `alias <id> <name>` - Create alias for session
- `alias --remove <name>` - Remove alias
- `unalias <name>` - Same as `--remove`
- `info <id|alias>` - Show session statistics
- `aliases` - List all aliases
- `help` - Show this help

## Examples

```bash
# List all sessions
/sessions list

# Create an alias for today's session
/sessions alias 2026-03-18 trigger-work

# Load session by alias
/sessions load trigger-work

# Show session info
/sessions info trigger-work

# Remove alias
/sessions alias --remove trigger-work

# List all aliases
/sessions aliases
```

## Notes

- Sessions are stored as markdown files in `~/.claude/sessions/`
- Session IDs can be shortened (first 4-8 characters usually unique enough)
- Use aliases for frequently referenced sessions
