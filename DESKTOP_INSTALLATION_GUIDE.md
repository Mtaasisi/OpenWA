# Inauzwa CRM — Desktop Installation Guide

This guide is for normal users installing **Inauzwa CRM** on Windows or macOS. No terminal or server configuration is required.

## Requirements

- Windows 10+ or macOS 11+ (Apple Silicon or Intel)
- ~2 GB free disk space
- Internet for WhatsApp messaging (CRM data is stored locally)

## Install on Windows

1. Download **Inauzwa CRM Setup.exe** from your release package (`dist-desktop/`).
2. Run the installer and follow the prompts.
3. Launch **Inauzwa CRM** from the Start menu.

## Install on Mac

1. Download **`Inauzwa CRM-0.1.6-arm64.dmg`** (Apple Silicon) or the Intel DMG from `dist-desktop/`.
2. Open the DMG and drag **Inauzwa CRM** to Applications.
3. Open the app from Applications (allow macOS security prompt if shown).
4. If macOS blocks the app (unsigned build): **System Settings → Privacy & Security → Open Anyway**.

## First run — automatic local setup

On first launch the app **automatically**:

- Creates local data folders (sessions, media, logs, backups)
- Starts the built-in server on port **2886**
- Creates a local **SQLite** database (no Neon/Postgres URL needed)
- Bundles WhatsApp Web engine + Chromium for QR linking

You only complete a short wizard:

| Step | What you do |
|------|-------------|
| **Welcome** | Read overview |
| **Business** | Business name, timezone, currency |
| **Branch** | Branch ID, name, city |
| **Admin** | Email + password — **skipped if users already exist** |
| **Ready** | App verifies storage + server, then opens **Sign in** |

After sign-in, use the dashboard normally. Connect WhatsApp from **Sessions** when ready (scan QR).

## No manual configuration needed

You do **not** need to:

- Paste a `DATABASE_URL` or Neon connection string
- Choose ports or edit `.env` files
- Run migrations or terminal commands
- Install Node, Redis, or PostgreSQL

All of that is handled by the desktop app.

## Scan WhatsApp QR

1. Sign in to the dashboard.
2. Open **Sessions**.
3. Create or start a session.
4. Scan the QR code with WhatsApp on your phone.

Sessions are stored locally and survive restarts.

## Check health

- **Menu bar / system tray** — server, database, and WhatsApp status.
- **Settings → Desktop App** (admin) — paths, health, restart actions.

## Restart the app

- Tray menu: **Restart Server** or quit and reopen.
- **Settings → Desktop App → Restart backend** (admin).

## Backup

- **Settings → Storage & Backup** (admin) for database backups.
- Local WhatsApp sessions and media live in your app data folder (see below).

## Where local files are stored

| OS | Location |
|----|----------|
| Windows | `%APPDATA%\Inauzwa CRM\` |
| macOS | `~/Library/Application Support/Inauzwa CRM/` |

Folders:

- `config/` — encrypted settings + SQLite databases
- `sessions/` — WhatsApp session data
- `media/` — downloaded message media
- `logs/` — app and server logs
- `backups/` — local backup exports

## Troubleshooting

| Problem | What to do |
|---------|------------|
| Server won't start | Quit other apps using port 2886; restart from tray |
| QR won't scan | Restart server; ensure one phone controls the session |
| Dashboard blank | Wait a few seconds; restart backend from tray |
| Forgot admin password | Ask an admin to reset in **Settings → Users**, or reset setup (developers) |

## Updates

- **Tray menu → Check for Updates** (release builds).
- Updates download in the background and prompt you to restart when ready.

## Developers

Build from source:

```bash
npm run prepare:desktop-pack
CSC_IDENTITY_AUTO_DISCOVERY=false npm run desktop:repack
open "dist-desktop/mac-arm64/Inauzwa CRM.app"
```

Install to Applications and remove stale DMGs:

```bash
npm run cleanup:desktop
cp -R "dist-desktop/mac-arm64/Inauzwa CRM.app" /Applications/
```

Sync code into an existing `.app` without full repack:

```bash
npm run desktop:repack:sync
npm run relaunch:desktop
```

Publish installers:

```bash
npm run dist:mac          # DMG → dist-desktop/
npm run release:desktop -- v0.1.6-desktop "Desktop installers"
```
