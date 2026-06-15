#!/usr/bin/env bash
# Sync seed/ai-knowledge into the running openwa-api Docker volume and reindex.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONTAINER="${OPENWA_API_CONTAINER:-openwa-api}"
SEED="$ROOT/seed/ai-knowledge"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "Container $CONTAINER is not running." >&2
  exit 1
fi

if [[ ! -d "$SEED" ]]; then
  echo "Missing seed folder: $SEED" >&2
  exit 1
fi

echo "Copying knowledge files into $CONTAINER:/app/data/ai-knowledge/"
docker cp "$SEED/." "$CONTAINER:/app/data/ai-knowledge/"

API_KEY="${API_MASTER_KEY:-}"
if [[ -z "$API_KEY" && -f "$ROOT/.env" ]]; then
  API_KEY="$(grep '^API_MASTER_KEY=' "$ROOT/.env" | cut -d= -f2- || true)"
fi

if [[ -n "$API_KEY" ]]; then
  echo "Reindexing knowledge…"
  curl -sf -X POST -H "x-api-key: $API_KEY" "http://127.0.0.1:2785/api/ai/knowledge/reindex" | head -c 200
  echo
fi

echo "Done. SHOP.md size in container:"
docker exec "$CONTAINER" wc -c /app/data/ai-knowledge/SHOP.md
