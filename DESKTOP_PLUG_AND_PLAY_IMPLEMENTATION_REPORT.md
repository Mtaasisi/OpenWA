# Inauzwa CRM Desktop — Implementation Report

## Summary

OpenWA / Inauzwa CRM is now packaged as a **plug-and-play Electron desktop app** that:

- Auto-starts a **localhost-only** NestJS backend (`127.0.0.1:2886`)
- Serves the **existing React dashboard** from the same port
- Runs the **WhatsApp engine locally** with sessions/media under OS app-data
- Uses **Neon PostgreSQL** as the data database via `DATABASE_URL`
- Guides first-time users through an **8-step setup wizard**
- Exposes **tray controls**, **health checks**, and **Settings → Desktop App**

All existing business features (inbox, AI, campaigns, safety, SMS, etc.) are unchanged when not in desktop mode.

---

## Architecture

```
Electron Main Process
  ├── config-manager (encrypted local config + app.env)
  ├── backend-manager (spawns node dist/main.js)
  ├── window-manager (wizard + dashboard BrowserWindow)
  ├── tray-manager
  └── health-manager

Bundled Backend (child process)
  ├── NestJS API /api/*
  ├── Socket.IO /socket.io
  ├── Static dashboard (dashboard/dist)
  └── WhatsApp engine → local sessions/

Neon PostgreSQL (internet required)
Local app data (InauzwaCRM/)
```

---

## Files created

### Backend

| File | Purpose |
|------|---------|
| `src/common/utils/database-url.util.ts` | Parse/mask Neon `DATABASE_URL` |
| `src/common/utils/desktop-paths.util.ts` | OS app-data path resolution |
| `src/common/utils/database-url.util.spec.ts` | Unit tests |
| `src/common/utils/desktop-paths.util.spec.ts` | Unit tests |
| `src/modules/desktop/*` | DesktopModule, APIs, guard, entity |
| `src/database/migrations/1780980000000-AddDesktopDevices.ts` | `desktop_devices` + session lock columns |

### Electron (`desktop/`)

| File | Purpose |
|------|---------|
| `desktop/main/main.ts` | App lifecycle + IPC |
| `desktop/main/preload.ts` | Safe `window.desktop` bridge |
| `desktop/main/config-manager.ts` | Encrypted config + `app.env` |
| `desktop/main/backend-manager.ts` | Start/stop/restart backend |
| `desktop/main/window-manager.ts` | Wizard + dashboard windows |
| `desktop/main/tray-manager.ts` | System tray menu |
| `desktop/main/health-manager.ts` | Polls `/api/health/desktop` |
| `desktop/main/auto-launch-manager.ts` | Login item settings |
| `desktop/main/auto-update-manager.ts` | Update placeholder |
| `desktop/renderer/setup-wizard/*` | 8-page setup wizard |
| `desktop/shared/desktop-config.ts` | Config types |
| `desktop/package.json` | electron-builder config |
| `desktop/scripts/prepare-backend-bundle.js` | Pre-pack validation |

### Dashboard

| File | Purpose |
|------|---------|
| `dashboard/src/components/settings/DesktopAppSettingsPanel.tsx` | Settings → Desktop App |
| `dashboard/src/components/settings/DesktopAppSettingsPanel.css` | Panel styles |

### Documentation

| File | Purpose |
|------|---------|
| `DESKTOP_INSTALLATION_GUIDE.md` | End-user install guide |
| `DESKTOP_PLUG_AND_PLAY_IMPLEMENTATION_REPORT.md` | This report |

---

## Files modified

| File | Change |
|------|--------|
| `src/main.ts` | Desktop mode, static dashboard, localhost bind |
| `src/config/configuration.ts` | Desktop paths, port 2886 default |
| `src/common/utils/env-file.util.ts` | Desktop `app.env` path |
| `src/common/utils/production-security.util.ts` | Desktop CORS defaults |
| `src/app.module.ts` | DesktopModule + entities |
| `src/modules/session/entities/session.entity.ts` | Device lock columns |
| `src/modules/session/session.service.ts` | Claim session on desktop start |
| `dashboard/src/components/settings/settings-nav-registry.ts` | `desktop-app` panel |
| `dashboard/src/components/settings/SettingsPanelsRouter.tsx` | Route panel |
| `dashboard/src/i18n/locales/en.json` | i18n keys |
| `package.json` | `build:desktop`, `dist:windows`, `dist:mac` scripts |
| `.gitignore` | `dist-desktop/`, `desktop/node_modules/` |

---

## Backend bundling

- **Dev:** `npm run desktop:dev` builds backend + dashboard, runs Electron loading local `dist/main.js`.
- **Packaged:** `electron-builder` `extraResources` includes `dist/`, `dashboard/dist/`, root `node_modules/`, `package.json`.
- Backend spawned with `node dist/main.js` and env from encrypted config (`app.env`).
- `APP_DESKTOP_MODE=true`, `OPENWA_DATA_ROOT`, `DATABASE_URL`, path overrides applied at boot.

---

## Dashboard serving

Production desktop mode serves `dashboard/dist` from NestJS via Express static + SPA fallback on the **same port** as the API (`2886`). Relative `/api` and `/socket.io` URLs work without `.env` changes.

---

## Neon database flow

1. Wizard collects `DATABASE_URL`
2. Electron encrypts and writes `config/app.env`
3. `database-url.util` maps URL → `DATABASE_*` env vars
4. TypeORM `migrationsRun: true` applies pending migrations
5. `POST /api/desktop/setup/seed` runs idempotent seeds (branch profiles, safety defaults)

---

## Setup wizard screens

1. Welcome  
2. Database Connection (test + migrate)  
3. Business Setup  
4. Branch Setup  
5. Admin Account  
6. Storage Check  
7. WhatsApp Setup (start server)  
8. Finish (open dashboard)

---

## Local folders (desktop mode)

Under `%APPDATA%/InauzwaCRM` (Windows) or `~/Library/Application Support/InauzwaCRM` (macOS):

`config/`, `sessions/`, `media/`, `backups/`, `logs/`, `ai-knowledge/`, `ai-memory/`, `temp/`, `cache/`

---

## Desktop settings

**Settings → Desktop App** (admin): version, device ID, paths, DB status, masked URL, restart backend, open folders, export diagnostics, reset wizard.

---

## Health checks

`GET /api/health/desktop` returns app version, mode, uptime, database status, path checks, WhatsApp session counts, safety guard status.

---

## Tray features

Open Dashboard, Start/Stop/Restart Server, WhatsApp Sessions, Settings, Check Health, Quit. Close minimizes to tray by default.

---

## Packaging scripts

```bash
npm run build:backend
npm run build:dashboard
npm run build:desktop
npm run desktop:dev
npm run dist:windows   # → dist-desktop/Inauzwa CRM Setup.exe
npm run dist:mac       # → dist-desktop/Inauzwa CRM.dmg
```

---

## Security hardening

- Electron: `contextIsolation`, no `nodeIntegration`, preload whitelist
- Backend: bind `127.0.0.1` only in desktop mode
- Desktop APIs: localhost guard + setup token header
- Secrets encrypted at rest; masked in UI/logs/diagnostics

---

## Tests

| Test | Status |
|------|--------|
| `database-url.util.spec.ts` | Passed |
| `desktop-paths.util.spec.ts` | Passed |
| Backend `npm run build` | Passed |
| Dashboard `npm run build` | Passed |
| Desktop `npm run build` (tsc) | Passed |

---

## Build results

```
npm run build               — OK
npm run dashboard:build     — OK
desktop/npm run build       — OK
npm run prepare:desktop-pack  — OK (Node 22.14.0 + Chrome 146 bundled)
npm run dist:mac            — OK
Unit tests (desktop utils)  — 7 passed
```

**Installer produced (macOS arm64):**

`dist-desktop/Inauzwa CRM-0.1.6-arm64.dmg` (~381 MB)

Includes: Electron shell, backend `dist/`, `node_modules/`, dashboard static files, bundled Node 22, Puppeteer Chrome for Testing.

---

## Phase 2 additions (production runtime bundling)

| Item | Status |
|------|--------|
| `desktop/main/runtime-paths.ts` | Resolves bundled Node 22 + Chromium |
| `desktop/scripts/download-runtime.js` | Downloads Node + Puppeteer Chrome into `desktop/runtimes/` |
| `backend-manager` | Uses bundled Node when packaged |
| `config-manager` | Sets `PUPPETEER_EXECUTABLE_PATH` when Chromium is found |
| `npm run prepare:desktop-pack` | Full pre-dist build (backend + dashboard + runtimes + icons) |
| electron-builder `extraResources` | Includes `runtimes/` folder |

## Remaining manual steps

1. **Icons:** Replace `desktop/assets/icon.png` with a 512×512 brand asset (electron-builder generates platform icons).
2. **Code signing:** Sign Windows/macOS builds for distribution outside your org.
3. **Auto-update:** Set `UPDATE_SERVER_URL` and wire `electron-updater` when a release server exists.
4. **Neon:** Ensure `pgvector` extension is enabled for AI memory features.
5. **First installer build:** Run `npm run prepare:desktop-pack` then `npm run dist:mac` or `dist:windows` on the target OS.

---

## Non-goals preserved

- Docker/VPS deployment unchanged (`APP_DESKTOP_MODE` unset)
- No removal of existing dashboard features
- No database reset on upgrade — app data lives outside install directory
