# Storage & Backup Management Report

Implementation date: 2026-06-09

## Summary

Storage & Backup Management adds layered storage settings, gated WhatsApp media auto-download, usage/cleanup APIs, structured backups, an admin Settings page, inbox manual-download UX, and dashboard/storage warnings—without removing existing Infrastructure export/import or auto-deleting CRM data.

---

## Files created

### Backend
- `src/common/utils/conversation-type.util.ts`
- `src/modules/storage/storage.module.ts`
- `src/modules/storage/storage.controller.ts`
- `src/modules/storage/storage.types.ts`
- `src/modules/storage/storage.enums.ts`
- `src/modules/storage/storage-settings.service.ts`
- `src/modules/storage/storage-policy.service.ts`
- `src/modules/storage/storage-usage.service.ts`
- `src/modules/storage/storage-cleanup.service.ts`
- `src/modules/storage/entities/storage-config.entity.ts`
- `src/modules/storage/entities/storage-session-override.entity.ts`
- `src/modules/storage/dto/cleanup.dto.ts`
- `src/modules/storage/guards/storage-permission.guard.ts`
- `src/modules/storage/utils/storage-policy.util.ts`
- `src/modules/storage/utils/storage-policy.util.spec.ts`
- `src/modules/storage/utils/permissions.util.ts`
- `src/modules/backup/backup.module.ts`
- `src/modules/backup/backup.controller.ts`
- `src/modules/backup/backup.service.ts`
- `src/modules/backup/backup-restore.service.ts`
- `src/modules/backup/backup-scheduler.service.ts`
- `src/modules/backup/dto/backup.dto.ts`
- `src/modules/backup/entities/backup-settings.entity.ts`
- `src/modules/backup/entities/backup-record.entity.ts`
- `src/database/migrations/1780800000000-AddStorageBackup.ts`

### Dashboard
- `dashboard/src/pages/StorageBackup.tsx`
- `dashboard/src/pages/StorageBackup.css`
- `dashboard/src/hooks/useStoragePermissions.ts`
- `dashboard/src/components/InboxMediaStarButton.tsx`
- `dashboard/src/lib/storage-i18n.ts`
- `src/modules/backup/utils/restore-sql.util.ts`

---

## Files modified

### Backend
- `src/app.module.ts` — register `StorageManagementModule`, `BackupModule`, entity globs
- `src/common/storage/storage.service.ts` — add `deleteFile()`
- `src/modules/message/message.service.ts` — media gating, `mediaStatus`, `forceDownloadMedia()`
- `src/modules/message/message.module.ts` — import storage module
- `src/modules/audit/entities/audit-log.entity.ts` — storage/backup audit actions

### Dashboard
- `dashboard/src/App.tsx` — route `/settings/storage-backup`
- `dashboard/src/pages/Settings.tsx` — admin nav link
- `dashboard/src/pages/Settings.css` — nav link style
- `dashboard/src/services/api.ts` — `storageApi`, `backupApi`
- `dashboard/src/pages/inbox-media.ts` — manual download helpers
- `dashboard/src/pages/InboxMessageBubble.tsx` — placeholder + Download button
- `dashboard/src/pages/Inbox.css` — placeholder/download styles
- `dashboard/src/pages/InboxMessageAlbumGrid.tsx` — album manual download
- `dashboard/src/pages/InboxTacticalMedia.tsx` — tactical manual download
- `dashboard/src/components/SystemStatusBanner.tsx` — storage warnings
- `dashboard/src/hooks/useDashboardData.ts` — admin storage alerts

---

## Auto-download rules

Settings merge order: **global → chat type → session override**.

| Chat type | Default |
|-----------|---------|
| `direct_customer` | Images ON; documents/videos/audio/voice/stickers OFF |
| `group` | All OFF; manual download only |
| `broadcast`, `internal`, `system`, `unknown` | All OFF |

| Global | Default |
|--------|---------|
| `maxAutoDownloadSizeMb` | 5 |
| `keepMediaDays` | 90 |
| `excludeStarredMediaFromCleanup` | true |
| `allowGroupAutoDownload` | false |
| `manualDownloadOnlyForGroups` | true |

**Media statuses** (in `messages.metadata.media`): `not_downloaded`, `downloading`, `downloaded`, `failed`, `deleted`.

**Safety**
- Outbound/staff-sent media always cached
- Existing `storagePath` treated as downloaded
- `GET /messages/:id/media` does not trigger background download when status is `not_downloaded`
- Manual download: `POST /storage/media/:messageId/download`
- Star media (protect from cleanup): `POST /storage/media/:messageId/star`

---

## API endpoints

### Storage (`/api/storage`)
| Method | Path | Permission |
|--------|------|------------|
| GET | `/permissions` | authenticated |
| GET | `/usage` | `storage:view_usage` |
| GET | `/settings` | `storage:view_usage` |
| POST | `/settings` | `storage:manage_settings` |
| POST | `/media/:messageId/download` | `storage:download_media` |
| POST | `/media/:messageId/star` | `storage:download_media` |
| POST | `/cleanup/preview` | `storage:run_cleanup` |
| POST | `/cleanup/run` | `storage:run_cleanup` |

### Backup (`/api/backup`)
| Method | Path | Permission |
|--------|------|------------|
| GET | `/settings` | `storage:view_usage` |
| POST | `/settings` | `storage:manage_settings` |
| POST | `/create` | `storage:create_backup` |
| GET | `/history` | `storage:view_usage` |
| GET | `/:id/download` | `storage:create_backup` |
| POST | `/:id/restore-preview` | `storage:restore_backup` |
| POST | `/:id/restore` | `storage:restore_backup` (body: `{ confirm, mode?: 'merge' \| 'upsert' }`) |

---

## Backup options

**Backup types:** `messagesOnly`, `crmOnly`, `messagesAndCrm`, `mediaOnly`, `full`

**Media scope:** `exclude`, `imagesOnly`, `documentsOnly`, `all`

**Archive format:** compressed tar.gz at `data/backups/backup-{id}.tar.gz` with sidecar `{id}.meta.json`

**Metadata:** backup id, created at, created by, backup type, included modules, media included, file size, app version, database version

**Restore:** preview first; requires `confirm: true`; merge/skip via `INSERT OR IGNORE` (SQLite); audit logged; never silent overwrite messaging in preview

---

## Cleanup safety rules

- Preview required; `confirmToken` expires in 15 minutes
- Deletes **media files only** — message text, customers, follow-ups, quotes preserved
- Options: age (30/60/90 days), group-only, failed-only, videos-only, documents-only
- Default keeps starred media and quote-linked threads (by session+chatId)
- Sets `mediaStatus = deleted`, clears `storagePath`
- Confirmation required in UI before run

---

## Permissions

| Role | Default permissions |
|------|---------------------|
| Admin | All storage/backup permissions |
| Operator | `view_usage`, `download_media` (customer care) |
| Operator + custom `storage:manage_*` on API key | Manager-level settings/cleanup/backup |
| Viewer | None (placeholders only in inbox) |

---

## Dashboard UI

- Page: **Settings → Storage & Backup** (`/settings/storage-backup`)
- Sections: overview, usage by type/account, auto-download settings, group rules, cleanup, backup settings, backup history
- Inbox: media placeholder + **Download** when `not_downloaded`; **Star** toggle on downloaded media (protects from cleanup)
- Warnings in `SystemStatusBanner` and admin dashboard system panel

---

## Build verification

- Backend: `npm run build` — **passed**
- Dashboard: `cd dashboard && npm run build` — **passed**

---

## Implemented vs future-ready

| Feature | Status |
|---------|--------|
| Layered storage settings (global/chat/session) | Implemented |
| Gated auto-download + manual download | Implemented |
| Group media safety defaults | Implemented |
| Storage usage API | Implemented |
| Cleanup preview/run with confirmation | Implemented |
| Structured backups (compressed + metadata) | Implemented |
| Restore preview + confirmed restore | Implemented (SQLite-oriented merge) |
| Storage & Backup settings page | Implemented |
| Dashboard/storage warnings | Implemented |
| Permission model | Implemented |
| Scheduled backup cron | Implemented (`BackupSchedulerService` runs due daily/weekly/monthly backups) |
| S3/R2 backup destination | Implemented (mirror to `backups/` on S3 when Infrastructure S3 is configured; local copy retained) |
| Starred media UI toggle | Implemented (`InboxMediaStarButton` on bubbles, album, tactical, lightbox) |
| Manager API key alias | Implemented (`storage:manage` / `storage:manager` grants settings/cleanup/backup permissions) |
| Manager role gate | Implemented (settings/cleanup/backup endpoints use `@RequireRole(OPERATOR)` + permission guard) |
| Legacy uncached media | Implemented (policy applied on first `GET` media; sets `not_downloaded`) |
| Lightbox manual download | Implemented |
| Dashboard AttentionAlerts | Implemented (i18n via `storage-i18n.ts`; links to `/settings/storage-backup`) |
| Storage warning i18n | Implemented (`systemStatus.storage.warnings.*` in en/he) |
| Storage & Backup page i18n | Implemented (`settings.storageBackup.*` in en/he) |
| Postgres restore merge | Implemented (`ON CONFLICT DO NOTHING` via `restore-sql.util.ts`) |
| Postgres restore upsert | Implemented (`upsert` mode updates rows with matching `id`; others merge) |
| Restore preview i18n | Implemented (structured message ids + translated restore dialog) |

---

## Relationship to Infrastructure

**Infrastructure** (`/settings?integration=infrastructure`) remains for S3/local engine wiring and raw tar DB migration.

**Storage & Backup** handles operational media policy, usage, CRM-aware cleanup, and structured backups.
