# Plugin Schema Notes

Gotchas and validation notes for `plugin.json`.

## Required Fields

- `name` — Plugin identifier, lowercase kebab-case (string)
- `description` — One-line description (string)

## Optional Fields

- `version` — Semantic version (string, e.g., "1.0.0")
- `author` — Author name or object
- `skills` — Path to skills directory (auto-discovered from `skills/` if omitted)
- `agents` — Path to agents directory (auto-discovered from `agents/` if omitted)
- `hooks` — Path to hooks directory

## Common Validation Issues

1. **Name format** — Must be lowercase, kebab-case (alphanumerics, hyphens, periods)
2. **Feature counts** — Must match actual file counts in the repo
3. **No trailing commas** — JSON does not allow trailing commas
4. **Hooks format** — Hook commands must reference valid script paths

## Hook Events

Only these lifecycle events are valid in `.cursor/hooks.json`:

- `sessionStart`
- `sessionEnd`
- `preToolUse`
- `postToolUse`
- `postToolUseFailure`
- `subagentStart`
- `subagentStop`
- `beforeShellExecution`
- `afterShellExecution`
- `beforeMCPExecution`
- `afterMCPExecution`
- `beforeReadFile`
- `afterFileEdit`
- `beforeSubmitPrompt`
- `preCompact`
- `stop`

## Content Paths

This plugin points to `.cursor/` directories which contain adapter-transformed content from the source `agents/` and `skills/` directories. The adapters strip Claude Code-specific fields and map values to Cursor equivalents.

## Environment Variables

Hook scripts receive `CURSOR_PROJECT_DIR`, `CURSOR_VERSION`, `CURSOR_USER_EMAIL`, and `CLAUDE_PROJECT_DIR` (compat).
