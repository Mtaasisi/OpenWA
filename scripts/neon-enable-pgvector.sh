#!/usr/bin/env bash
# Enable pgvector on Neon/Postgres before OpenWA AI memory migrations.
# Usage: source .env && ./scripts/neon-enable-pgvector.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

if [[ -f "$PROJECT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$PROJECT_DIR/.env"
  set +a
fi

if [[ -n "${DATABASE_URL:-}" ]]; then
  CONN="$DATABASE_URL"
elif [[ "${DATABASE_TYPE:-}" == "postgres" && -n "${DATABASE_HOST:-}" ]]; then
  CONN="postgresql://${DATABASE_USERNAME}:${DATABASE_PASSWORD}@${DATABASE_HOST}:${DATABASE_PORT:-5432}/${DATABASE_NAME}?sslmode=require"
else
  echo "Set DATABASE_URL or postgres vars in .env" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found. Enable pgvector manually in Neon Console → Extensions → vector" >&2
  exit 1
fi

echo "Enabling pgvector extension..."
psql "$CONN" -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS vector;"
echo "pgvector ready."
