#!/usr/bin/env bash
# Upload locally built desktop installers to an existing GitHub release.
# Usage: ./scripts/publish-desktop-local.sh v0.1.6
set -euo pipefail

TAG="${1:-}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ -z "$TAG" ]]; then
  echo "Usage: $0 <tag>   e.g. v0.1.6"
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) is required."
  exit 1
fi

echo "Generating electron-updater manifests (latest-mac.yml, latest.yml)…"
node "$ROOT/desktop/scripts/generate-update-manifests.js"

shopt -s nullglob
FILES=(
  "$ROOT/dist-desktop"/*.dmg
  "$ROOT/dist-desktop"/*.dmg.blockmap
  "$ROOT/dist-desktop"/*.exe
  "$ROOT/dist-desktop"/*.exe.blockmap
  "$ROOT/dist-desktop"/latest-mac.yml
  "$ROOT/dist-desktop"/latest-mac-arm64.yml
  "$ROOT/dist-desktop"/latest.yml
)

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "No installers in dist-desktop/. Run npm run dist:mac or dist:windows first."
  exit 1
fi

echo "Uploading ${#FILES[@]} file(s) to release $TAG"
gh release upload "$TAG" "${FILES[@]}" --clobber
echo "Done. Release: $(gh release view "$TAG" --json url -q .url)"
