#!/bin/bash
# Backup OpenWA Docker volume (sessions, SQLite DB, media, AI data).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${OPENWA_BACKUP_DIR:-$PROJECT_DIR/backups}"
VOLUME_NAME="${OPENWA_VOLUME_NAME:-openwa-main_openwa-data}"
STAMP="$(date +%Y%m%d-%H%M%S)"
ARCHIVE="$BACKUP_DIR/openwa-backup-$STAMP.tar.gz"

mkdir -p "$BACKUP_DIR"

echo "Backing up volume: $VOLUME_NAME"
docker run --rm \
  -v "$VOLUME_NAME:/data:ro" \
  -v "$BACKUP_DIR:/backup" \
  alpine \
  tar czf "/backup/$(basename "$ARCHIVE")" -C /data .

echo "Backup saved: $ARCHIVE"
ls -lh "$ARCHIVE"
