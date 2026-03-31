#!/usr/bin/env bash
set -e

# Continuous Learning — Observation Hook (SCC)
#
# Captures tool use events for pattern analysis by the learning-engine agent.
# Claude Code passes hook data via stdin as JSON.
#
# Adapted from ECC continuous-learning-v2/hooks/observe.sh for SCC.
# Registered via hooks/hooks.json (PreToolUse + PostToolUse, standard+strict profiles).

HOOK_PHASE="${1:-post}"

# ─────────────────────────────────────────────
# Read stdin (before any processing)
# ─────────────────────────────────────────────

INPUT_JSON=$(cat)

if [ -z "$INPUT_JSON" ]; then
  exit 0
fi

# ─────────────────────────────────────────────
# Find a Python interpreter
# ─────────────────────────────────────────────

resolve_python_cmd() {
  if command -v python3 >/dev/null 2>&1; then
    printf '%s\n' python3
    return 0
  fi
  if command -v python >/dev/null 2>&1; then
    printf '%s\n' python
    return 0
  fi
  return 1
}

PYTHON_CMD="$(resolve_python_cmd 2>/dev/null || true)"
if [ -z "$PYTHON_CMD" ]; then
  exit 0
fi

# ─────────────────────────────────────────────
# Session guards — skip automated/subagent sessions
# ─────────────────────────────────────────────

# Only run for interactive CLI sessions
case "${CLAUDE_CODE_ENTRYPOINT:-cli}" in
  cli|sdk-ts) ;;
  *) exit 0 ;;
esac

# Minimal profile suppresses non-essential hooks
[ "${SCC_HOOK_PROFILE:-standard}" = "minimal" ] && exit 0

# Cooperative skip for automated sessions
[ "${SCC_SKIP_OBSERVE:-0}" = "1" ] && exit 0

# Skip subagent sessions
_AGENT_ID=$(echo "$INPUT_JSON" | "$PYTHON_CMD" -c "import json,sys; print(json.load(sys.stdin).get('agent_id',''))" 2>/dev/null || true)
[ -n "$_AGENT_ID" ] && exit 0

# ─────────────────────────────────────────────
# Project detection
# ─────────────────────────────────────────────

STDIN_CWD=$(echo "$INPUT_JSON" | "$PYTHON_CMD" -c '
import json, sys
try:
    data = json.load(sys.stdin)
    print(data.get("cwd", ""))
except (KeyError, TypeError, ValueError):
    print("")
' 2>/dev/null || echo "")

# Determine project ID from git or cwd
if [ -n "$STDIN_CWD" ] && [ -d "$STDIN_CWD" ]; then
  PROJECT_ROOT="$STDIN_CWD"
else
  PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
fi

PROJECT_ID=$(cd "$PROJECT_ROOT" 2>/dev/null && git rev-parse --show-toplevel 2>/dev/null | shasum -a 256 | cut -c1-16 || echo "global")

# ─────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────

CONFIG_DIR="${HOME}/.claude/homunculus"
PROJECT_DIR="${CONFIG_DIR}/projects/${PROJECT_ID}"
mkdir -p "$PROJECT_DIR"

OBSERVATIONS_FILE="${PROJECT_DIR}/observations.jsonl"
MAX_FILE_SIZE_MB=10

# Skip if disabled
if [ -f "${CONFIG_DIR}/disabled" ]; then
  exit 0
fi

# Auto-purge observation files older than 30 days (runs once per day)
PURGE_MARKER="${PROJECT_DIR}/.last-purge"
if [ ! -f "$PURGE_MARKER" ] || [ "$(find "$PURGE_MARKER" -mtime +1 2>/dev/null)" ]; then
  find "${PROJECT_DIR}" -name "observations-*.jsonl" -mtime +30 -delete 2>/dev/null || true
  touch "$PURGE_MARKER" 2>/dev/null || true
fi

# ─────────────────────────────────────────────
# Parse tool event and write observation
# ─────────────────────────────────────────────

PARSED=$(echo "$INPUT_JSON" | HOOK_PHASE="$HOOK_PHASE" "$PYTHON_CMD" -c '
import json, sys, os

try:
    data = json.load(sys.stdin)
    hook_phase = os.environ.get("HOOK_PHASE", "post")
    event = "tool_start" if hook_phase == "pre" else "tool_complete"

    tool_name = data.get("tool_name", data.get("tool", "unknown"))
    tool_input = data.get("tool_input", data.get("input", {}))
    tool_output = data.get("tool_response", data.get("tool_output", data.get("output", "")))
    session_id = data.get("session_id", "unknown")
    tool_use_id = data.get("tool_use_id", "")

    # Truncate large values
    if isinstance(tool_input, dict):
        tool_input_str = json.dumps(tool_input)[:5000]
    else:
        tool_input_str = str(tool_input)[:5000]

    if isinstance(tool_output, dict):
        tool_output_str = json.dumps(tool_output)[:5000]
    else:
        tool_output_str = str(tool_output)[:5000]

    print(json.dumps({
        "parsed": True,
        "event": event,
        "tool": tool_name,
        "input": tool_input_str if event == "tool_start" else None,
        "output": tool_output_str if event == "tool_complete" else None,
        "session": session_id,
        "tool_use_id": tool_use_id
    }))
except Exception as e:
    print(json.dumps({"parsed": False, "error": str(e)}))
')

PARSED_OK=$(echo "$PARSED" | "$PYTHON_CMD" -c "import json,sys; print(json.load(sys.stdin).get('parsed', False))" 2>/dev/null || echo "False")

if [ "$PARSED_OK" != "True" ]; then
  exit 0
fi

# Archive if file too large
if [ -f "$OBSERVATIONS_FILE" ]; then
  file_size_mb=$(du -m "$OBSERVATIONS_FILE" 2>/dev/null | cut -f1)
  if [ "${file_size_mb:-0}" -ge "$MAX_FILE_SIZE_MB" ]; then
    archive_dir="${PROJECT_DIR}/observations.archive"
    mkdir -p "$archive_dir"
    mv "$OBSERVATIONS_FILE" "$archive_dir/observations-$(date +%Y%m%d-%H%M%S)-$$.jsonl" 2>/dev/null || true
  fi
fi

# Write observation with secret scrubbing
timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

export PROJECT_ID_ENV="$PROJECT_ID"
export TIMESTAMP="$timestamp"

echo "$PARSED" | "$PYTHON_CMD" -c '
import json, sys, os, re

parsed = json.load(sys.stdin)
observation = {
    "timestamp": os.environ["TIMESTAMP"],
    "event": parsed["event"],
    "tool": parsed["tool"],
    "session": parsed["session"],
    "project_id": os.environ.get("PROJECT_ID_ENV", "global")
}

# Scrub secrets
_SECRET_RE = re.compile(
    r"(?i)(api[_-]?key|token|secret|password|authorization|credentials?|auth)"
    r"""([\"'"'"'"'"'"'\s:=]+)"""
    r"([A-Za-z]+\s+)?"
    r"([A-Za-z0-9_\-/.+=]{8,})"
)

def scrub(val):
    if val is None:
        return None
    return _SECRET_RE.sub(lambda m: m.group(1) + m.group(2) + (m.group(3) or "") + "[REDACTED]", str(val))

if parsed["input"]:
    observation["input"] = scrub(parsed["input"])
if parsed["output"] is not None:
    observation["output"] = scrub(parsed["output"])

print(json.dumps(observation))
' >> "$OBSERVATIONS_FILE"

exit 0
