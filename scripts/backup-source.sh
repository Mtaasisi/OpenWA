#!/usr/bin/env bash
# Latest source code only — no node_modules, runtimes, data, secrets, or old backups.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PARENT="$(dirname "$ROOT")"
NAME="$(basename "$ROOT")"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="${ROOT}/backups"
OUT="${BACKUP_DIR}/openwa-source-${STAMP}.tar.gz"

mkdir -p "$BACKUP_DIR"
export COPYFILE_DISABLE=1

tar -czf "$OUT" \
  --exclude='.git' \
  --exclude='._*' \
  --exclude='*/._*' \
  --exclude='node_modules' \
  --exclude='dashboard/node_modules' \
  --exclude='desktop/node_modules' \
  --exclude='desktop/runtimes' \
  --exclude='dist' \
  --exclude='dist-desktop' \
  --exclude='dashboard/dist' \
  --exclude='desktop/dist' \
  --exclude='desktop/.bundle' \
  --exclude='build' \
  --exclude='.next' \
  --exclude='out' \
  --exclude='coverage' \
  --exclude='.env' \
  --exclude='.env.local' \
  --exclude='.env.production' \
  --exclude='.env.development.local' \
  --exclude='.env.test.local' \
  --exclude='.env.production.local' \
  --exclude='.vps-credentials.local' \
  --exclude='logs' \
  --exclude='data' \
  --exclude='media' \
  --exclude='uploads' \
  --exclude='.wwebjs_auth' \
  --exclude='.wwebjs_cache' \
  --exclude='.docker' \
  --exclude='.worktrees' \
  --exclude='.agent' \
  --exclude='.claude' \
  --exclude='backups/*.tar.gz' \
  --exclude='*.db' \
  --exclude='*.sqlite' \
  --exclude='*.sqlite3' \
  -C "$PARENT" "$NAME"

echo "Created: $OUT"
echo "Size: $(du -h "$OUT" | cut -f1)"
echo -n "._ entries: "
tar -tzf "$OUT" | grep -c '\._' || echo 0
echo -n ".git entries: "
tar -tzf "$OUT" | grep -c '/\.git/' || echo 0
