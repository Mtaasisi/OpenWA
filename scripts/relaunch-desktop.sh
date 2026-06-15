#!/usr/bin/env bash
# Build latest code, sync into the local .app, quit any running instance, and reopen.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ "$(uname)" != "Darwin" ]]; then
  echo "relaunch:desktop is macOS-only"
  exit 1
fi

if [[ "${SKIP_SYNC:-0}" != "1" ]]; then
  bash "$ROOT/scripts/ensure-dev-ports.sh" desktop
  bash "$ROOT/scripts/sync-desktop-resources.sh"
  bash "$ROOT/scripts/verify-desktop-code-sync.sh"
fi

APP=""
for candidate in \
  "$ROOT/dist-desktop/mac-arm64/Inauzwa CRM.app" \
  "$ROOT/dist-desktop/mac/Inauzwa CRM.app"; do
  if [[ -d "$candidate" ]]; then
    APP="$candidate"
    break
  fi
done

if [[ -z "$APP" ]]; then
  echo "Build not found under dist-desktop/"
  echo "Run: npm run desktop:repack"
  exit 1
fi

osascript -e 'quit app "Inauzwa CRM"' 2>/dev/null || pkill -f "Inauzwa CRM.app" 2>/dev/null || true
sleep 1
pkill -9 -f "Inauzwa CRM.app" 2>/dev/null || true
sleep 1
open "$APP"
echo "Launched: $APP"
