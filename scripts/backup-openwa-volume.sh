#!/usr/bin/env bash
# Backup openwa-data Docker volume (WhatsApp session auth + main.sqlite + media).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"
DATE="$(date +%F-%H%M)"
ARCHIVE="$BACKUP_DIR/openwa-data-$DATE.tar.gz"

mkdir -p "$BACKUP_DIR"

echo "Backing up openwa-data volume to $ARCHIVE"
docker run --rm \
  -v openwa-data:/data:ro \
  -v "$BACKUP_DIR:/backup" \
  alpine \
  tar czf "/backup/openwa-data-$DATE.tar.gz" -C /data .

echo "Done: $ARCHIVE"
