# Deploy OpenWA on Hostinger VPS + Neon PostgreSQL

## Prerequisites

- Hostinger VPS (Ubuntu 24.04, 4 GB+ RAM recommended)
- Neon PostgreSQL project with **pgvector** enabled
- Rotated Neon password (never commit `.env`)

## 1. VPS bootstrap (run once as root)

```bash
ssh root@YOUR_VPS_IP
git clone <your-openwa-repo> /opt/openwa
cd /opt/openwa
sudo ./scripts/vps-bootstrap.sh
```

Open firewall in hPanel → VPS → Firewall: allow TCP **22**, **2886** (or **443** with SSL).

## 2. Configure environment

```bash
cp .env.production.example .env
chmod 600 .env
nano .env
```

**Use only the `openwa` database** on your Neon project. The old shared `neondb` (other app tables) was removed — do not recreate it for OpenWA.

```bash
# One-time: create dedicated DB if missing (connect via postgres, not neondb)
psql "$NEON_URL/postgres?sslmode=require" -c "CREATE DATABASE openwa;"
psql "$NEON_URL/openwa?sslmode=require" -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

**First boot** — use Neon **direct** host (no `-pooler`):

```
DATABASE_HOST=ep-xxxx.us-east-1.aws.neon.tech
DATABASE_SSL=true
DATABASE_NAME=openwa
CORS_ORIGINS=https://your-domain.com
API_MASTER_KEY=<long-random-key>
```

Enable pgvector:

```bash
./scripts/neon-enable-pgvector.sh
```

Or Neon Console → Extensions → **vector**.

## 3. Deploy

```bash
./scripts/deploy-vps-production.sh
```

## 4. After migrations succeed

Switch `DATABASE_HOST` to the **pooler** hostname (`-pooler` in hostname), then:

```bash
./scripts/openwa.sh restart
```

## 5. Post-deploy

1. Open `http://YOUR_VPS_IP:2886`
2. Sign in with email/password (`BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` on first boot)
3. Settings → Staff users — add team accounts; Service API keys remain for scripts/SDK only
4. Create session → scan WhatsApp QR
4. Run `./scripts/smoke-production.sh`
5. Schedule backups: `./scripts/backup-openwa-volume.sh`

## 6. Hostinger MCP (local Cursor)

```bash
export HOSTINGER_API_TOKEN="your-token"
```

Update `~/.cursor/mcp.json` (already uses `${env:HOSTINGER_API_TOKEN}`), restart Cursor.

Disable non-VPS MCP products in hPanel if the server fails to load (>100 tools).

## Troubleshooting

| Issue | Fix |
|-------|-----|
| CORS crash on boot | Set explicit `CORS_ORIGINS`, not `*` |
| DB SSL error | `DATABASE_SSL=true` |
| Migration fails on pooler | Use direct Neon host first |
| Sessions lost after restart | Never delete `openwa-data` volume |
| OOM / Chromium killed | Add swap (`vps-bootstrap.sh`), limit to 1–2 sessions |
