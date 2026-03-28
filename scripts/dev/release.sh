#!/usr/bin/env bash
set -euo pipefail

# Release script for setting a specific SCC version and publishing.
# For auto-bumping, use the commit-msg hook (feat→minor, fix→patch, feat!→major).
# This script is for manual releases when you want to set an exact version.
#
# Usage: ./scripts/dev/release.sh VERSION

VERSION="${1:-}"

usage() {
  echo "Usage: $0 VERSION"
  echo "Example: $0 2.0.0"
  exit 1
}

if [[ -z "$VERSION" ]]; then
  echo "Error: VERSION argument is required"
  usage
fi

if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: VERSION must be in semver format (e.g., 2.0.0)"
  exit 1
fi

CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo "Error: Must be on main branch (currently on $CURRENT_BRANCH)"
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Error: Working tree is not clean. Commit or stash changes first."
  exit 1
fi

# Use bump-version.js to update all 5 files consistently
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
node "$SCRIPT_DIR/bump-version.js" --set "$VERSION"

# Stage, commit, tag, and push
git add package.json .claude-plugin/plugin.json .claude-plugin/marketplace.json .cursor-plugin/plugin.json .cursor-plugin/marketplace.json
[[ -f "VERSION" ]] && echo "$VERSION" > VERSION && git add VERSION

git commit -m "chore: release v$VERSION" --no-verify
git tag "v$VERSION"
git push origin main "v$VERSION"

echo "Released v$VERSION"
