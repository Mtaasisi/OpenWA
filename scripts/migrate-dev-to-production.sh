#!/usr/bin/env bash
# Copy local dev SQLite + AI files into production Neon + VPS volume.
# Usage:
#   export DATABASE_HOST=ep-xxxx-pooler....
#   export DATABASE_USERNAME=neondb_owner
#   export DATABASE_PASSWORD='your-password'
#   export DATABASE_NAME=openwa
#   export VPS_HOST=root@187.77.101.136
#   export VPS_SSH_KEY=~/.ssh/openwa_vps
#   ./scripts/migrate-dev-to-production.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

VPS_HOST="${VPS_HOST:-root@187.77.101.136}"
VPS_SSH_KEY="${VPS_SSH_KEY:-$HOME/.ssh/openwa_vps}"
SSH=(ssh -i "$VPS_SSH_KEY" "$VPS_HOST")

echo "==> SQLite → Neon"
python3 "$SCRIPT_DIR/migrate-dev-sqlite-to-neon.py"

echo "==> AI knowledge + memory files → VPS volume"
VOLUME_PATH="$("${SSH[@]}" "docker volume inspect openwa_openwa-data --format '{{.Mountpoint}}'")"
rsync -avz -e "ssh -i $VPS_SSH_KEY" \
  "$PROJECT_DIR/data/ai-knowledge/" \
  "$PROJECT_DIR/data/ai-memory/" \
  "$VPS_HOST:$VOLUME_PATH/"

if [[ -n "${API_MASTER_KEY:-}" ]]; then
  echo "==> Reindex AI on production"
  "${SSH[@]}" "curl -sf -X POST http://127.0.0.1:2785/api/ai/knowledge/reindex -H 'x-api-key: $API_MASTER_KEY' && echo && curl -sf -X POST http://127.0.0.1:2785/api/ai/memory/reindex -H 'x-api-key: $API_MASTER_KEY' && echo"
fi

echo "Done. Open production dashboard and verify Settings → AI."
