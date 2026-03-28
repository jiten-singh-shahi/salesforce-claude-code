# Plugin Schema Notes

Gotchas and validation notes for `plugin.json`.

## Required Fields

- `name` — Plugin display name (string)
- `version` — Semantic version (string, e.g., "1.0.0")
- `description` — One-line description (string)

## Common Validation Issues

1. **Version format** — Must be valid semver (x.y.z)
2. **Feature counts** — Must match actual file counts in the repo
3. **Schema reference** — `$schema` should point to `../schemas/plugin.schema.json`
4. **No trailing commas** — JSON does not allow trailing commas

## Hook Events

Only these lifecycle events are valid in `hooks/hooks.json`:

- `SessionStart`
- `PreToolUse`
- `PostToolUse`
- `PreCompact`
- `Stop`
- `SessionEnd`
- `Notification`
- `SubagentStop`

## Plugin Root Variable

Hook commands use `${CLAUDE_PLUGIN_ROOT}` which expands to the plugin installation directory at runtime.
