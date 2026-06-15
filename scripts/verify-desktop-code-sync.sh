#!/usr/bin/env bash
# Fail if packaged .app Resources drift from repo dist/ (stale desktop bundle).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

resolve_app_bundle() {
  if [[ -d "$ROOT/dist-desktop/mac-arm64/Inauzwa CRM.app" ]]; then
    echo "$ROOT/dist-desktop/mac-arm64/Inauzwa CRM.app"
    return 0
  fi
  if [[ -d "$ROOT/dist-desktop/mac/Inauzwa CRM.app" ]]; then
    echo "$ROOT/dist-desktop/mac/Inauzwa CRM.app"
    return 0
  fi
  return 1
}

sha_file() {
  if [[ -f "$1" ]]; then
    shasum -a 256 "$1" | awk '{print $1}'
  else
    echo "MISSING"
  fi
}

APP="$(resolve_app_bundle || true)"
if [[ -z "${APP:-}" ]]; then
  echo "FAIL: No Inauzwa CRM.app under dist-desktop/"
  exit 1
fi

RES="$APP/Contents/Resources"
FAIL=0

check_pair() {
  local label="$1"
  local repo="$2"
  local bundled="$3"
  local repo_sha bundled_sha
  repo_sha="$(sha_file "$repo")"
  bundled_sha="$(sha_file "$bundled")"
  if [[ "$repo_sha" == "MISSING" ]]; then
    echo "FAIL: $label — repo artifact missing ($repo)"
    FAIL=1
    return
  fi
  if [[ "$bundled_sha" == "MISSING" ]]; then
    echo "FAIL: $label — bundled artifact missing ($bundled)"
    FAIL=1
    return
  fi
  if [[ "$repo_sha" == "$bundled_sha" ]]; then
    echo "OK:   $label"
  else
    echo "FAIL: $label — out of sync"
    echo "      repo:    $repo"
    echo "      bundled: $bundled"
    FAIL=1
  fi
}

echo "Verifying desktop bundle matches repo builds…"
echo "App: $APP"
echo ""

check_pair "backend main.js" "$ROOT/dist/main.js" "$RES/backend/dist/main.js"
check_pair "dashboard index.html" "$ROOT/dashboard/dist/index.html" "$RES/dashboard/dist/index.html"

# Fingerprint the JS entry referenced by index.html (stable across unrelated chunks).
read_index_bundle() {
  local html="$1"
  if [[ ! -f "$html" ]]; then
    echo ""
    return
  fi
  grep -oE 'assets/index-[^"]+\.js' "$html" | head -1 | sed 's|^assets/||'
}

REPO_BUNDLE="$(read_index_bundle "$ROOT/dashboard/dist/index.html")"
APP_BUNDLE="$(read_index_bundle "$RES/dashboard/dist/index.html")"
if [[ -z "$REPO_BUNDLE" || -z "$APP_BUNDLE" ]]; then
  echo "FAIL: dashboard entry bundle not found in index.html"
  FAIL=1
elif [[ "$REPO_BUNDLE" == "$APP_BUNDLE" ]]; then
  echo "OK:   dashboard entry bundle ($REPO_BUNDLE)"
  check_pair "dashboard entry file" \
    "$ROOT/dashboard/dist/assets/$REPO_BUNDLE" \
    "$RES/dashboard/dist/assets/$APP_BUNDLE"
else
  echo "FAIL: dashboard entry bundle — out of sync"
  echo "      repo:    $REPO_BUNDLE"
  echo "      bundled: $APP_BUNDLE"
  FAIL=1
fi

if [[ -f "$ROOT/desktop/dist/main/main.js" && -f "$RES/app.asar" ]]; then
  TMP_ASAR="$(mktemp -d)"
  npx --yes @electron/asar extract "$RES/app.asar" "$TMP_ASAR" >/dev/null 2>&1 || true
  if [[ -f "$TMP_ASAR/dist/main/main.js" ]]; then
    check_pair "electron main.js" "$ROOT/desktop/dist/main/main.js" "$TMP_ASAR/dist/main/main.js"
  else
    echo "WARN: electron main.js inside app.asar not found — run npm run desktop:sync"
    FAIL=1
  fi
  rm -rf "$TMP_ASAR"
fi

echo ""
if [[ "$FAIL" -ne 0 ]]; then
  echo "Desktop app is STALE. Run: npm run desktop:sync"
  exit 1
fi

echo "All checked artifacts are in sync."
