#!/usr/bin/env bash
# Build a signed + notarized macOS DMG when desktop/.env.signing is configured.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SIGNING_FILE="$ROOT/desktop/.env.signing"

if [[ -f "$SIGNING_FILE" ]]; then
  echo "Loading signing env from desktop/.env.signing"
  set -a
  # shellcheck disable=SC1090
  source "$SIGNING_FILE"
  set +a
else
  echo "No desktop/.env.signing — building unsigned (ad-hoc) DMG"
  echo "Copy desktop/.env.signing.example to desktop/.env.signing to enable signing"
fi

cd "$ROOT"
npm run dist:mac
