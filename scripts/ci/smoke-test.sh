#!/usr/bin/env bash
# Local smoke test — mirrors the CI install-smoke-test job.
# Run from repo root: bash scripts/ci/smoke-test.sh
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

PASS=0
FAIL=0
TEST_DIR=$(mktemp -d)

pass() { echo -e "  ${GREEN}PASS${NC}  $1"; PASS=$((PASS + 1)); }
fail() { echo -e "  ${RED}FAIL${NC}  $1"; FAIL=$((FAIL + 1)); }
section() { echo -e "\n${CYAN}── $1 ──${NC}"; }

cleanup() {
  rm -rf "$TEST_DIR"
  rm -f scc-universal-*.tgz
}
trap cleanup EXIT

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

# ── Pack ────────────────────────────────────────────────────────────────────
section "npm pack"

npm pack --quiet > /dev/null 2>&1
TARBALL=$(ls scc-universal-*.tgz 2>/dev/null | head -1)

if [ -n "$TARBALL" ] && [ -f "$TARBALL" ]; then
  SIZE=$(stat -f%z "$TARBALL" 2>/dev/null || stat --format=%s "$TARBALL" 2>/dev/null)
  if [ "$SIZE" -gt 100000 ]; then
    pass "tarball created (${SIZE} bytes)"
  else
    fail "tarball too small (${SIZE} bytes)"
  fi
else
  fail "tarball not created"
fi

# ── CLI help & version ──────────────────────────────────────────────────────
section "CLI commands"

if node scripts/scc.js --help 2>&1 | grep -q "SCC — Salesforce Claude Code CLI"; then
  pass "scc --help"
else
  fail "scc --help"
fi

if node scripts/scc.js --version 2>&1 | grep -qE "^[0-9]+\.[0-9]+\.[0-9]+"; then
  pass "scc --version"
else
  fail "scc --version"
fi

# ── Create test project ────────────────────────────────────────────────────
section "Setup test project"

mkdir -p "$TEST_DIR/force-app/main/default/classes"
echo '{ "packageDirectories": [{ "path": "force-app", "default": true }] }' > "$TEST_DIR/sfdx-project.json"
cd "$TEST_DIR"
npm init -y > /dev/null 2>&1
npm install "$REPO_ROOT/$TARBALL" > /dev/null 2>&1
pass "test project created and tarball installed"

# ── Install apex ────────────────────────────────────────────────────────────
section "scc install apex"

npx scc install apex > /dev/null 2>&1

# Core agents
for f in sf-blueprint-planner.md sf-code-reviewer.md sf-tdd-guide.md; do
  if [ -f ".claude/agents/$f" ]; then pass "core agent: $f"; else fail "core agent: $f"; fi
done

# Apex agents
for f in sf-apex-reviewer.md sf-trigger-architect.md sf-performance-optimizer.md; do
  if [ -f ".claude/agents/$f" ]; then pass "apex agent: $f"; else fail "apex agent: $f"; fi
done

# Security + devops agents
if [ -f ".claude/agents/sf-security-reviewer.md" ]; then pass "security agent"; else fail "security agent"; fi
if [ -f ".claude/agents/sf-devops-deployment.md" ]; then pass "devops agent"; else fail "devops agent"; fi

# Core skills
for f in sf-help sf-quickstart model-route; do
  if [ -f ".claude/skills/$f/SKILL.md" ]; then pass "core skill: $f"; else fail "core skill: $f"; fi
done

# Apex skills
for f in sf-trigger-frameworks sf-apex-async-patterns sf-apex-testing sf-apex-best-practices sf-apex-constraints sf-soql-constraints; do
  if [ -f ".claude/skills/$f/SKILL.md" ]; then pass "apex skill: $f"; else fail "apex skill: $f"; fi
done

# Security skills
for f in sf-security sf-governor-limits sf-soql-optimization; do
  if [ -f ".claude/skills/$f/SKILL.md" ]; then pass "security skill: $f"; else fail "security skill: $f"; fi
done

# Devops skills
for f in sf-deployment sf-deployment-constraints; do
  if [ -f ".claude/skills/$f/SKILL.md" ]; then pass "devops skill: $f"; else fail "devops skill: $f"; fi
done

# Hooks
if [ -f ".claude/hooks/hooks.json" ]; then pass "hooks installed"; else fail "hooks installed"; fi

# Reference files
if [ -d ".claude/skills/_reference" ]; then pass "reference dir exists"; else fail "reference dir exists"; fi

# Negative: no extended content
if [ ! -f ".claude/agents/sf-agentforce-builder.md" ]; then pass "no extended agent (correct)"; else fail "extended agent leaked into apex profile"; fi
if [ ! -f ".claude/skills/sf-flow-development/SKILL.md" ]; then pass "no extended skill (correct)"; else fail "extended skill leaked into apex profile"; fi

# ── Uninstall ───────────────────────────────────────────────────────────────
section "scc uninstall"

npx scc uninstall --yes > /dev/null 2>&1

if [ ! -f ".claude/agents/sf-apex-reviewer.md" ]; then pass "uninstall removed agents"; else fail "uninstall did not remove agents"; fi
if [ ! -f ".claude/skills/sf-apex-testing/SKILL.md" ]; then pass "uninstall removed skills"; else fail "uninstall did not remove skills"; fi

# ── Install all ─────────────────────────────────────────────────────────────
section "scc install all"

npx scc install all > /dev/null 2>&1

# Extended agents
for f in sf-agentforce-builder.md sf-flow-reviewer.md sf-visualforce-reviewer.md sf-aura-reviewer.md sf-admin.md; do
  if [ -f ".claude/agents/$f" ]; then pass "extended agent: $f"; else fail "extended agent: $f"; fi
done

# Extended skills
for f in sf-flow-development sf-agentforce-development sf-visualforce-development sf-aura-development sf-experience-cloud; do
  if [ -f ".claude/skills/$f/SKILL.md" ]; then pass "extended skill: $f"; else fail "extended skill: $f"; fi
done

# Platform agents
for f in deep-researcher.md sf-integration-architect.md sf-build-resolver.md; do
  if [ -f ".claude/agents/$f" ]; then pass "platform agent: $f"; else fail "platform agent: $f"; fi
done

# ── Install lwc (after clean) ──────────────────────────────────────────────
section "scc install lwc"

npx scc uninstall --yes > /dev/null 2>&1
npx scc install lwc > /dev/null 2>&1

if [ -f ".claude/agents/sf-lwc-reviewer.md" ]; then pass "lwc agent"; else fail "lwc agent"; fi
for f in sf-lwc-development sf-lwc-testing sf-lwc-constraints; do
  if [ -f ".claude/skills/$f/SKILL.md" ]; then pass "lwc skill: $f"; else fail "lwc skill: $f"; fi
done

# Negative: no apex agents in lwc profile
if [ ! -f ".claude/agents/sf-apex-reviewer.md" ]; then pass "no apex agent in lwc (correct)"; else fail "apex agent leaked into lwc profile"; fi
if [ ! -f ".claude/agents/sf-trigger-architect.md" ]; then pass "no trigger agent in lwc (correct)"; else fail "trigger agent leaked into lwc profile"; fi

# ── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════"
echo -e "Results: ${GREEN}${PASS} passed${NC}, ${RED}${FAIL} failed${NC} ($((PASS + FAIL)) total)"
echo "════════════════════════════════════════════════════════"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
