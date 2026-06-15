#!/usr/bin/env bash
# Deploy OpenWA on VPS with Neon PostgreSQL.
# Prerequisites: .env configured from .env.production.example, Docker installed.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
err() { echo -e "${RED}✗${NC} $1"; exit 1; }

[[ -f .env ]] || err "Missing .env — copy .env.production.example to .env and fill secrets"

set -a
# shellcheck disable=SC1091
source .env
set +a

[[ "${DATABASE_TYPE:-}" == "postgres" ]] || warn "DATABASE_TYPE is not postgres"
[[ "${DATABASE_SSL:-}" == "true" ]] || warn "DATABASE_SSL should be true for Neon"
[[ -n "${API_MASTER_KEY:-}" ]] || err "Set API_MASTER_KEY in .env"
[[ -n "${JWT_SECRET:-}" ]] || err "Set JWT_SECRET in .env for dashboard login"
[[ "${NODE_ENV:-}" == "production" ]] || warn "NODE_ENV is not production"

if [[ "${CORS_ORIGINS:-}" == "*" && "${NODE_ENV:-}" == "production" && "${ALLOW_OPEN_CORS:-}" != "true" ]]; then
  err "CORS_ORIGINS=* will crash in production. Set explicit origin or ALLOW_OPEN_CORS=true"
fi

if [[ "${DATABASE_HOST:-}" == *"-pooler"* ]]; then
  warn "DATABASE_HOST uses pooler. First deploy should use DIRECT Neon host for migrations."
fi

if command -v psql >/dev/null 2>&1 && [[ "${DATABASE_TYPE:-}" == "postgres" ]]; then
  log "Enabling pgvector (if not already)..."
  ./scripts/neon-enable-pgvector.sh || warn "pgvector script failed — enable in Neon Console"
fi

log "Building images..."
./scripts/openwa.sh build

log "Starting stack..."
./scripts/openwa.sh start

log "Waiting for API health..."
for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:${API_PORT:-2785}/api/health" >/dev/null 2>&1; then
    log "API healthy"
    break
  fi
  sleep 2
  [[ $i -eq 30 ]] && err "API health check timed out — check: docker compose logs openwa-api"
done

log "Running smoke tests..."
./scripts/smoke-production.sh

log "Deploy complete."
echo "  Dashboard: http://$(hostname -I 2>/dev/null | awk '{print $1}'):${DASHBOARD_PORT:-2886}"
echo "  Login with API_MASTER_KEY from .env"
echo "  After migrations succeed, switch DATABASE_HOST to Neon pooler host and restart."
