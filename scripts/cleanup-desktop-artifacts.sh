#!/usr/bin/env bash
# Keep only the latest local desktop build (mac-arm64 .app). Remove stale DMGs and duplicate arch folders.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/dist-desktop"
KEEP_APP="$DIST/mac-arm64/Inauzwa CRM.app"

if [[ ! -d "$KEEP_APP" ]]; then
  echo "No latest app at: $KEEP_APP"
  echo "Build first: CSC_IDENTITY_AUTO_DISCOVERY=false npm run desktop:repack"
  exit 1
fi

echo "Keeping: $KEEP_APP"
du -sh "$KEEP_APP"

shopt -s nullglob
for f in "$DIST"/*.dmg "$DIST"/*.dmg.blockmap "$DIST"/*.exe "$DIST"/*.exe.blockmap; do
  echo "Removing stale installer: $(basename "$f")"
  rm -f "$f"
done

if [[ -d "$DIST/mac" && "$DIST/mac" != "$DIST/mac-arm64" ]]; then
  echo "Removing stale mac (x64) folder"
  rm -rf "$DIST/mac"
fi

rm -f "$DIST/builder-debug.yml" "$DIST/latest-mac.yml" 2>/dev/null || true

echo ""
echo "dist-desktop contents:"
ls -lah "$DIST"
echo ""
echo "Installed copy (if present):"
ls -d "/Applications/Inauzwa CRM.app" 2>/dev/null && du -sh "/Applications/Inauzwa CRM.app" || echo "  (not in /Applications)"
