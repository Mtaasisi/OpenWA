#!/usr/bin/env bash
# Build latest backend + dashboard + electron shell, then sync into the local .app bundle.
# Use this after code changes so the packaged app matches repo dist/ (no 10-minute codesign rebuild).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKIP_BUILD="${SKIP_BUILD:-0}"

resolve_app_bundle() {
  local arch
  arch="$(uname -m)"
  if [[ "$arch" == "arm64" && -d "$ROOT/dist-desktop/mac-arm64/Inauzwa CRM.app" ]]; then
    echo "$ROOT/dist-desktop/mac-arm64/Inauzwa CRM.app"
    return 0
  fi
  if [[ -d "$ROOT/dist-desktop/mac/Inauzwa CRM.app" ]]; then
    echo "$ROOT/dist-desktop/mac/Inauzwa CRM.app"
    return 0
  fi
  if [[ -d "$ROOT/dist-desktop/mac-arm64/Inauzwa CRM.app" ]]; then
    echo "$ROOT/dist-desktop/mac-arm64/Inauzwa CRM.app"
    return 0
  fi
  return 1
}

APP="$(resolve_app_bundle || true)"
if [[ -z "${APP:-}" ]]; then
  echo "No local Inauzwa CRM.app found under dist-desktop/."
  echo "Create one first: npm run desktop:repack"
  exit 1
fi

RES="$APP/Contents/Resources"
ASAR="$RES/app.asar"

echo "==> Sync target: $APP"

if [[ "$SKIP_BUILD" != "1" ]]; then
  echo "==> Building backend…"
  (cd "$ROOT" && npm run build:backend)
  echo "==> Building dashboard…"
  (cd "$ROOT" && npm run dashboard:build)
  echo "==> Building electron shell…"
  (cd "$ROOT/desktop" && npm run build)
else
  echo "==> SKIP_BUILD=1 — using existing dist/ artifacts"
fi

for req in "$ROOT/dist/main.js" "$ROOT/dashboard/dist/index.html" "$ROOT/desktop/dist/main/main.js"; do
  if [[ ! -f "$req" ]]; then
    echo "Missing build artifact: $req"
    echo "Run without SKIP_BUILD=1 or: npm run build:all"
    exit 1
  fi
done

echo "==> Syncing backend/dist → Resources/backend/dist"
mkdir -p "$RES/backend/dist"
rsync -a --delete "$ROOT/dist/" "$RES/backend/dist/"

echo "==> Syncing dashboard/dist → Resources/dashboard/dist"
mkdir -p "$RES/dashboard/dist"
rsync -a --delete "$ROOT/dashboard/dist/" "$RES/dashboard/dist/"

if [[ -f "$ASAR" ]]; then
  echo "==> Patching app.asar (electron main + preload)…"
  TMP_ASAR="$(mktemp -d)"
  trap 'rm -rf "$TMP_ASAR"' EXIT
  npx --yes @electron/asar extract "$ASAR" "$TMP_ASAR"
  rsync -a "$ROOT/desktop/dist/" "$TMP_ASAR/dist/"
  if [[ -d "$ROOT/desktop/renderer" ]]; then
    rsync -a "$ROOT/desktop/renderer/" "$TMP_ASAR/renderer/"
  fi
  npx --yes @electron/asar pack "$TMP_ASAR" "$ASAR"
  trap - EXIT
  rm -rf "$TMP_ASAR"
else
  echo "Warning: app.asar not found — electron shell not updated (run npm run desktop:repack)"
fi

INSTALLED="/Applications/Inauzwa CRM.app"
if [[ -d "$INSTALLED" && "$INSTALLED" != "$APP" ]]; then
  echo "==> Updating installed copy: $INSTALLED"
  rsync -a --delete "$RES/dashboard/dist/" "$INSTALLED/Contents/Resources/dashboard/dist/"
  rsync -a --delete "$RES/backend/dist/" "$INSTALLED/Contents/Resources/backend/dist/"
fi

echo "==> Desktop bundle synced from latest repo builds."
