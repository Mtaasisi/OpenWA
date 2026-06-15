#!/usr/bin/env bash
# Quick local checks before handing the desktop app to a user.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OK=0
WARN=0

pass() { echo "  ✓ $1"; OK=$((OK + 1)); }
warn() { echo "  ! $1"; WARN=$((WARN + 1)); }
fail() { echo "  ✗ $1"; exit 1; }

echo "Inauzwa CRM — desktop install verification"
echo ""

echo "Installers"
shopt -s nullglob
DMGS=("$ROOT/dist-desktop"/*.dmg)
EXES=("$ROOT/dist-desktop"/*.exe)
if [[ ${#DMGS[@]} -gt 0 ]]; then
  for f in "${DMGS[@]}"; do pass "$(basename "$f") ($(du -h "$f" | cut -f1))"; done
else
  warn "No DMG in dist-desktop/ — run npm run dist:mac"
fi
if [[ ${#EXES[@]} -gt 0 ]]; then
  for f in "${EXES[@]}"; do pass "$(basename "$f")"; done
else
  warn "No Windows EXE — build on Windows with npm run dist:windows"
fi

echo ""
echo "macOS app bundle"
APP="$ROOT/dist-desktop/mac-arm64/Inauzwa CRM.app"
if [[ -d "$APP" ]]; then
  pass "Inauzwa CRM.app present"
  ASAR="$APP/Contents/Resources/app.asar"
  if [[ -f "$ASAR" ]]; then
    TMP_ASAR="$(mktemp -d)"
    if npx --yes @electron/asar extract "$ASAR" "$TMP_ASAR" >/dev/null 2>&1; then
      if [[ -f "$TMP_ASAR/renderer/setup-wizard/index.html" ]]; then
        pass "Setup wizard bundled in app.asar (renderer/setup-wizard/)"
      elif [[ -f "$TMP_ASAR/dist/renderer/setup-wizard/index.html" ]]; then
        warn "Wizard at legacy path dist/renderer/ — rebuild after window-manager fix"
      else
        fail "Setup wizard missing from app.asar — rebuild with npm run dist:mac"
      fi
      rm -rf "$TMP_ASAR"
    else
      warn "Could not inspect app.asar"
    fi
  fi
else
  warn "Built .app not found (DMG may still be valid)"
fi

echo ""
echo "Backend smoke (optional)"
if SMOKE_PORT=$((2900 + RANDOM % 500)) npm run smoke:desktop-packaged --silent 2>/dev/null; then
  pass "Packaged backend smoke test"
else
  warn "Smoke test skipped or failed — run npm run smoke:desktop-packaged"
fi

echo ""
echo "GitHub publish"
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  pass "gh CLI authenticated — run: npm run release:desktop -- v0.1.6-desktop"
else
  warn "Run gh auth login then: npm run release:desktop -- v0.1.6-desktop"
fi

echo ""
echo "User app data (if app was opened)"
DATA="$HOME/Library/Application Support/Inauzwa CRM"
if [[ -d "$DATA/config" ]]; then
  pass "App data at ~/Library/Application Support/Inauzwa CRM/"
  if [[ -f "$DATA/config/desktop-config.json" ]]; then
    if grep -q '"setupCompleted": true' "$DATA/config/desktop-config.json" 2>/dev/null; then
      pass "Setup wizard completed"
    else
      warn "Setup not completed — open app and finish wizard with Neon DATABASE_URL"
    fi
  fi
else
  warn "App not opened yet — npm run open:desktop"
fi

echo ""
echo "Done ($OK checks passed, $WARN warnings)"
