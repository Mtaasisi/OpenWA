#!/usr/bin/env bash
# Create a GitHub release and upload desktop installers + auto-update manifests.
# Usage: ./scripts/create-desktop-release.sh v0.1.6-desktop "Release notes here"
set -euo pipefail

TAG="${1:-}"
NOTES="${2:-Desktop release for Inauzwa CRM}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ -z "$TAG" ]]; then
  echo "Usage: $0 <tag> [release-notes]"
  echo "Example: $0 v0.1.6-desktop"
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) is required. Install: https://cli.github.com/"
  exit 1
fi

shopt -s nullglob
INSTALLERS=("$ROOT/dist-desktop"/*.dmg "$ROOT/dist-desktop"/*.exe)
if [[ ${#INSTALLERS[@]} -eq 0 ]]; then
  echo "No installers found. Build first:"
  echo "  npm run dist:mac"
  echo "  npm run dist:windows   # on Windows"
  exit 1
fi

if gh release view "$TAG" >/dev/null 2>&1; then
  echo "Release $TAG already exists — uploading assets only"
else
  echo "Creating release $TAG"
  gh release create "$TAG" --title "$TAG" --notes "$NOTES"
fi

"$ROOT/scripts/publish-desktop-local.sh" "$TAG"
echo "Release ready: $(gh release view "$TAG" --json url -q .url)"
