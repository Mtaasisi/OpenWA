import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation, Trans } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Loader2,
  Download,
  Trash2,
  Save,
  ChevronLeft,
  AlertTriangle,
  History,
  CloudUpload,
} from 'lucide-react';
import { MaterialSymbol } from '../components/MaterialSymbol';
import { getAuthHeaders } from '../lib/auth-storage';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useToast } from '../components/Toast';
import { useRole } from '../hooks/useRole';
import { useStoragePermissions } from '../hooks/useStoragePermissions';
import {
  backupApi,
  storageApi,
  type ChatTypeStorageSettings,
  type GlobalStorageSettings,
  type StorageSettingsResponse,
  type BackupSettingsRow,
} from '../services/api';
import { ConfirmDialog } from '../components/workspace/ConfirmDialog';
import { WorkspacePageHeader } from '../components/workspace';
import { useSessionsQuery } from '../hooks/queries';
import { translateStorageWarning, translateRestorePreviewMessage } from '../lib/storage-i18n';
import {
  settingsPanelHref,
  settingsSectionHref,
} from '../components/settings/settings-nav-registry';
import './StorageBackup.css';

const CHAT_TYPES = ['direct_customer', 'group', 'broadcast', 'internal', 'system'] as const;
const SB = 'settings.storageBackup';

const AUTO_DOWNLOAD_KEYS = [
  'autoDownloadImages',
  'autoDownloadVideos',
  'autoDownloadDocuments',
  'autoDownloadAudio',
  'autoDownloadVoice',
  'autoDownloadStickers',
] as const;

const CLEANUP_OPTION_KEYS = [
  'groupMediaOnly',
  'failedDownloadsOnly',
  'videosOnly',
  'documentsOnly',
  'keepStarred',
  'keepQuoteLinked',
] as const;

const BACKUP_TYPES = [
  'messagesOnly',
  'crmOnly',
  'messagesAndCrm',
  'mediaOnly',
  'full',
] as const;

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function StorageBackup({ embedded = false }: { embedded?: boolean } = {}) {
  const { t } = useTranslation();
  useDocumentTitle(t(`${SB}.pageTitle`));
  const toast = useToast();
  const queryClient = useQueryClient();
  const { isAdmin } = useRole();
  const { isLoading: permsLoading, ...perms } = useStoragePermissions();
  const { data: sessions } = useSessionsQuery();

  const { data: usageData, isLoading: usageLoading } = useQuery({
    queryKey: ['storage', 'usage'],
    queryFn: () => storageApi.getUsage(),
    enabled: perms.canViewUsage,
  });

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['storage', 'settings'],
    queryFn: () => storageApi.getSettings(),
    enabled: perms.canViewUsage,
  });

  const { data: backupSettings } = useQuery({
    queryKey: ['backup', 'settings'],
    queryFn: () => backupApi.getSettings(),
    enabled: perms.canViewUsage,
  });

  const { data: backupHistory, refetch: refetchHistory } = useQuery({
    queryKey: ['backup', 'history'],
    queryFn: () => backupApi.history(),
    enabled: perms.canViewUsage,
  });

  const [formGlobal, setFormGlobal] = useState<GlobalStorageSettings | null>(null);
  const [formChatTypes, setFormChatTypes] = useState<StorageSettingsResponse['chatTypes'] | null>(null);
  const [activeChatType, setActiveChatType] = useState<(typeof CHAT_TYPES)[number]>('direct_customer');
  const [cleanupOptions, setCleanupOptions] = useState({
    olderThanDays: 30 as 30 | 60 | 90,
    groupMediaOnly: false,
    failedDownloadsOnly: false,
    videosOnly: false,
    documentsOnly: false,
    keepStarred: true,
    keepQuoteLinked: true,
  });
  const [cleanupPreview, setCleanupPreview] = useState<Awaited<
    ReturnType<typeof storageApi.previewCleanup>
  > | null>(null);
  const [confirmCleanupOpen, setConfirmCleanupOpen] = useState(false);
  const [restorePreview, setRestorePreview] = useState<Awaited<
    ReturnType<typeof backupApi.restorePreview>
  > | null>(null);
  const [restoreId, setRestoreId] = useState<string | null>(null);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'upsert'>('merge');
  const [confirmRestoreOpen, setConfirmRestoreOpen] = useState(false);
  const [sessionOverrides, setSessionOverrides] = useState<
    Record<string, { allowGroupAutoDownload: boolean }>
  >({});
  const [formBackupSettings, setFormBackupSettings] = useState<Partial<BackupSettingsRow> | null>(
    null,
  );
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
  const showAdvancedSections = !embedded || moreOptionsOpen;

  useEffect(() => {
    if (settings) {
      setFormGlobal(settings.global);
      setFormChatTypes(settings.chatTypes);
      const map: Record<string, { allowGroupAutoDownload: boolean }> = {};
      for (const row of settings.sessionOverrides) {
        map[row.sessionId] = {
          allowGroupAutoDownload: row.allowGroupAutoDownload ?? false,
        };
      }
      setSessionOverrides(map);
    }
  }, [settings]);

  useEffect(() => {
    if (backupSettings) {
      setFormBackupSettings(backupSettings);
    }
  }, [backupSettings]);

  const saveSettingsMutation = useMutation({
    mutationFn: () =>
      storageApi.saveSettings({
        global: formGlobal ?? undefined,
        chatTypes: formChatTypes ?? undefined,
        sessionOverrides: Object.entries(sessionOverrides).map(([sessionId, row]) => ({
          sessionId,
          allowGroupAutoDownload: row.allowGroupAutoDownload,
        })),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['storage', 'settings'] });
      toast.success(t(`${SB}.toasts.settingsSaved`));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const previewCleanupMutation = useMutation({
    mutationFn: () => storageApi.previewCleanup(cleanupOptions),
    onSuccess: data => {
      setCleanupPreview(data);
      toast.success(
        t(`${SB}.toasts.cleanupPreview`, {
          count: data.candidateCount,
          size: formatBytes(data.bytesToFree),
        }),
      );
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const runCleanupMutation = useMutation({
    mutationFn: () =>
      storageApi.runCleanup({
        ...cleanupOptions,
        confirmToken: cleanupPreview!.confirmToken,
      }),
    onSuccess: data => {
      setConfirmCleanupOpen(false);
      setCleanupPreview(null);
      void queryClient.invalidateQueries({ queryKey: ['storage', 'usage'] });
      toast.success(
        t(`${SB}.toasts.cleanupDone`, {
          count: data.deletedCount,
          size: formatBytes(data.bytesFreed),
        }),
      );
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createBackupMutation = useMutation({
    mutationFn: (backupType: string) =>
      backupApi.create({
        backupType,
        mediaScope: formBackupSettings?.mediaScope ?? backupSettings?.mediaScope ?? 'exclude',
        includeMedia: formBackupSettings?.includeMedia ?? backupSettings?.includeMedia ?? false,
      }),
    onSuccess: () => {
      void refetchHistory();
      toast.success(t(`${SB}.toasts.backupCreated`));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const restoreMutation = useMutation({
    mutationFn: (input: { id: string; mode: 'merge' | 'upsert' }) =>
      backupApi.restore(input.id, true, input.mode),
    onSuccess: data => {
      setConfirmRestoreOpen(false);
      setRestoreId(null);
      setRestorePreview(null);
      setRestoreMode('merge');
      toast.success(
        t(`${SB}.toasts.restoreCompleted`, {
          mode: t(`${SB}.restore.modeNames.${data.mode}`),
        }),
      );
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveBackupSettingsMutation = useMutation({
    mutationFn: () => backupApi.saveSettings(formBackupSettings ?? {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['backup', 'settings'] });
      toast.success(t(`${SB}.toasts.backupSettingsSaved`));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const usage = usageData?.usage;
  const warnings = usageData?.warnings ?? [];
  const canEdit = isAdmin || perms.canManageSettings;

  const overviewCards = useMemo(
    () => [
      { label: t(`${SB}.overview.total`), value: formatBytes(usage?.totalBytes ?? 0) },
      { label: t(`${SB}.overview.media`), value: formatBytes(usage?.mediaBytes ?? 0) },
      { label: t(`${SB}.overview.database`), value: formatBytes(usage?.messagesDbBytes ?? 0) },
      { label: t(`${SB}.overview.sessionData`), value: formatBytes(usage?.sessionDataBytes ?? 0) },
      { label: t(`${SB}.overview.backups`), value: formatBytes(usage?.backupBytes ?? 0) },
    ],
    [t, usage],
  );

  const updateChatType = (key: keyof ChatTypeStorageSettings, value: boolean) => {
    if (!formChatTypes) return;
    setFormChatTypes({
      ...formChatTypes,
      [activeChatType]: {
        ...formChatTypes[activeChatType],
        [key]: value,
      },
    });
  };

  const handleDownloadBackup = (id: string) => {
    const authHeaders = getAuthHeaders();
    const url = backupApi.downloadUrl(id);
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', '');
    if (Object.keys(authHeaders).length > 0) {
      void fetch(url, { headers: authHeaders })
        .then(r => r.blob())
        .then(blob => {
          a.href = URL.createObjectURL(blob);
          a.click();
        });
    } else {
      a.click();
    }
  };

  if (!perms.canViewUsage && !permsLoading) {
    return (
      <div className={embedded ? 'storage-backup-embedded' : 'followups-interakt storage-backup-interakt'}>
        {!embedded ? (
          <WorkspacePageHeader
            title={t(`${SB}.pageTitle`)}
            showSearch={false}
            showExport={false}
            showNewTask={false}
            extraActions={
              <Link to={settingsSectionHref('data')} className="fu-btn fu-btn--ghost">
                <ChevronLeft size={16} />
                {t(`${SB}.backToSettings`)}
              </Link>
            }
          />
        ) : null}
        <div className={embedded ? undefined : 'followups-interakt__scroll'}>
          <div className="settings-card">
            <div className="settings-card__body">
              <p className="settings-hint">{t(`${SB}.noPermission`)}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={embedded ? 'storage-backup-embedded' : 'followups-interakt storage-backup-interakt'}>
      {!embedded ? (
        <WorkspacePageHeader
          title={t(`${SB}.pageTitle`)}
          showSearch={false}
          showExport={false}
          showNewTask={false}
          extraActions={
            <Link to={settingsSectionHref('data')} className="fu-btn fu-btn--ghost">
              <ChevronLeft size={16} />
              {t(`${SB}.backToSettings`)}
            </Link>
          }
        />
      ) : null}

      <div className={embedded ? 'storage-backup-scroll' : 'followups-interakt__scroll storage-backup-scroll'}>
        {!embedded ? (
          <div className="settings-panel__intro storage-backup-intro">
            <p className="settings-hint">
              <Trans
                i18nKey={`${SB}.subtitle`}
                components={{
                  link: (
                    <Link key="storage-infra-link" to={settingsPanelHref('infrastructure')} />
                  ),
                }}
              />
            </p>
          </div>
        ) : null}

      {warnings.length > 0 && (
        <div className="storage-backup-warnings" role="status">
          <AlertTriangle size={16} />
          <ul>
            {warnings.map(w => (
              <li key={w.id}>{translateStorageWarning(w, t)}</li>
            ))}
          </ul>
        </div>
      )}

      {usageLoading ? (
        <div className="storage-backup-loading">
          <Loader2 className="animate-spin" size={24} />
        </div>
      ) : (
        <>
          <section className={`storage-overview${embedded ? '' : ' settings-panel storage-section'}`}>
            <h2 className={embedded ? 'storage-section-label' : undefined}>{t(`${SB}.overview.title`)}</h2>
            <div className="storage-metric-grid">
              {overviewCards.map(card => (
                <div key={card.label} className="storage-metric-card">
                  <span className="storage-metric-card__label">{card.label}</span>
                  <strong>{card.value}</strong>
                </div>
              ))}
            </div>
          </section>

          {embedded && !moreOptionsOpen ? (
            <button
              type="button"
              className="fu-btn fu-btn--ghost fu-btn--sm settings-inline-more-btn"
              onClick={() => setMoreOptionsOpen(true)}
            >
              <span>{t('settings.moreOptions')}</span>
            </button>
          ) : null}

          {embedded && moreOptionsOpen ? (
            <button
              type="button"
              className="fu-btn fu-btn--ghost fu-btn--sm settings-inline-more-btn"
              onClick={() => setMoreOptionsOpen(false)}
            >
              <span>{t('settings.showLess')}</span>
            </button>
          ) : null}

          {!embedded ? (
            <>
              <section className="settings-panel storage-section">
                <h2>{t(`${SB}.usageByType.title`)}</h2>
                <ul className="storage-breakdown-list">
                  <li>{t(`${SB}.usageByType.images`)}: {formatBytes(usage?.imagesBytes ?? 0)}</li>
                  <li>{t(`${SB}.usageByType.videos`)}: {formatBytes(usage?.videosBytes ?? 0)}</li>
                  <li>{t(`${SB}.usageByType.documents`)}: {formatBytes(usage?.documentsBytes ?? 0)}</li>
                  <li>{t(`${SB}.usageByType.audioVoice`)}: {formatBytes(usage?.audioVoiceBytes ?? 0)}</li>
                  <li>{t(`${SB}.usageByType.stickers`)}: {formatBytes(usage?.stickersBytes ?? 0)}</li>
                </ul>
              </section>

              <section className="settings-panel storage-section">
                <h2>{t(`${SB}.usageByAccount.title`)}</h2>
                <ul className="storage-breakdown-list">
                  {(usage?.bySession ?? []).map(row => (
                    <li key={row.sessionId}>
                      {row.sessionName}: {formatBytes(row.bytes)}
                    </li>
                  ))}
                  {(usage?.bySession ?? []).length === 0 && (
                    <li>{t(`${SB}.usageByAccount.empty`)}</li>
                  )}
                </ul>
              </section>
            </>
          ) : null}
        </>
      )}

      {showAdvancedSections ? (
      <>
      <section className="settings-panel storage-section storage-section--card">
        <h2 className="storage-section__title">{t(`${SB}.autoDownload.title`)}</h2>
        {settingsLoading || !formGlobal || !formChatTypes ? (
          <Loader2 className="animate-spin" size={20} />
        ) : (
          <>
            <div className="storage-form-grid storage-form-grid--pair">
              <label>
                {t(`${SB}.autoDownload.maxSizeMb`)}
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={formGlobal.maxAutoDownloadSizeMb}
                  disabled={!canEdit}
                  onChange={e =>
                    setFormGlobal({ ...formGlobal, maxAutoDownloadSizeMb: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                {t(`${SB}.autoDownload.keepMediaDays`)}
                <input
                  type="number"
                  min={1}
                  value={formGlobal.keepMediaDays}
                  disabled={!canEdit}
                  onChange={e =>
                    setFormGlobal({ ...formGlobal, keepMediaDays: Number(e.target.value) })
                  }
                />
              </label>
              <label className="storage-checkbox">
                <input
                  type="checkbox"
                  checked={formGlobal.excludeStarredMediaFromCleanup}
                  disabled={!canEdit}
                  onChange={e =>
                    setFormGlobal({
                      ...formGlobal,
                      excludeStarredMediaFromCleanup: e.target.checked,
                    })
                  }
                />
                {t(`${SB}.autoDownload.excludeStarred`)}
              </label>
            </div>

            <div className="storage-chat-type-tabs" role="tablist" aria-label={t(`${SB}.autoDownload.title`)}>
              {CHAT_TYPES.map(type => (
                <button
                  key={type}
                  type="button"
                  role="tab"
                  aria-selected={activeChatType === type}
                  className={activeChatType === type ? 'active' : ''}
                  onClick={() => setActiveChatType(type)}
                >
                  {t(`${SB}.chatTypes.${type}`)}
                </button>
              ))}
            </div>

            <div className="storage-media-pills">
              {AUTO_DOWNLOAD_KEYS.map(key => {
                const checked = formChatTypes[activeChatType]?.[key] ?? false;
                return (
                  <label
                    key={key}
                    className={`storage-media-pill${checked ? ' is-active' : ''}${!canEdit ? ' is-disabled' : ''}`}
                  >
                    <input
                      type="checkbox"
                      className="storage-media-pill__input"
                      checked={checked}
                      disabled={!canEdit}
                      onChange={e => updateChatType(key, e.target.checked)}
                    />
                    <span>{t(`${SB}.autoDownload.mediaTypes.${key}`)}</span>
                  </label>
                );
              })}
            </div>

            {canEdit && (
              <button
                type="button"
                className="storage-btn storage-btn--primary storage-btn--block"
                disabled={saveSettingsMutation.isPending}
                onClick={() => saveSettingsMutation.mutate()}
              >
                {saveSettingsMutation.isPending ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Save size={16} />
                )}
                {t(`${SB}.autoDownload.save`)}
              </button>
            )}
          </>
        )}
      </section>

      <section className="settings-panel storage-section storage-section--card">
        <h2 className="storage-section__title">{t(`${SB}.groupRules.title`)}</h2>
        <p className="storage-section__hint">{t(`${SB}.groupRules.hint`)}</p>
        {canEdit && formGlobal && (
          <label className="storage-checkbox storage-group-global">
            <input
              type="checkbox"
              checked={formGlobal.allowGroupAutoDownload}
              onChange={e =>
                setFormGlobal({ ...formGlobal, allowGroupAutoDownload: e.target.checked })
              }
            />
            {t(`${SB}.groupRules.allowGlobal`)}
          </label>
        )}
        <ul className="storage-breakdown-list storage-session-overrides">
          {(sessions ?? []).map(s => (
            <li key={s.id}>
              <span>{s.name}</span>
              {canEdit ? (
                <label className="storage-checkbox">
                  <input
                    type="checkbox"
                    checked={sessionOverrides[s.id]?.allowGroupAutoDownload ?? false}
                    onChange={e =>
                      setSessionOverrides(prev => ({
                        ...prev,
                        [s.id]: { allowGroupAutoDownload: e.target.checked },
                      }))
                    }
                  />
                  {t(`${SB}.groupRules.allowSession`)}
                </label>
              ) : (
                <span>
                  {sessionOverrides[s.id]?.allowGroupAutoDownload
                    ? t(`${SB}.groupRules.sessionOn`)
                    : t(`${SB}.groupRules.sessionManual`)}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {(isAdmin || perms.canRunCleanup) && (
        <section className="settings-panel storage-section storage-section--card">
          <div className="storage-section__head">
            <h2 className="storage-section__title">{t(`${SB}.cleanup.title`)}</h2>
            <MaterialSymbol name="delete_sweep" size={22} className="storage-section__head-icon" />
          </div>
          <p className="storage-section__hint">{t(`${SB}.cleanup.hint`)}</p>
          <div className="storage-form-grid">
            <label>
              {t(`${SB}.cleanup.olderThan`)}
              <select
                value={cleanupOptions.olderThanDays}
                onChange={e =>
                  setCleanupOptions({
                    ...cleanupOptions,
                    olderThanDays: Number(e.target.value) as 30 | 60 | 90,
                  })
                }
              >
                <option value={30}>{t(`${SB}.cleanup.days30`)}</option>
                <option value={60}>{t(`${SB}.cleanup.days60`)}</option>
                <option value={90}>{t(`${SB}.cleanup.days90`)}</option>
              </select>
            </label>
            {CLEANUP_OPTION_KEYS.map(key => (
              <label key={key} className="storage-checkbox">
                <input
                  type="checkbox"
                  checked={cleanupOptions[key]}
                  onChange={e =>
                    setCleanupOptions({ ...cleanupOptions, [key]: e.target.checked })
                  }
                />
                {t(`${SB}.cleanup.options.${key}`)}
              </label>
            ))}
          </div>
          <div className="storage-actions storage-actions--split">
            <button
              type="button"
              className="storage-btn storage-btn--secondary"
              disabled={previewCleanupMutation.isPending}
              onClick={() => previewCleanupMutation.mutate()}
            >
              {t(`${SB}.cleanup.preview`)}
            </button>
            <button
              type="button"
              className="storage-btn storage-btn--danger-fill"
              disabled={!cleanupPreview}
              onClick={() => setConfirmCleanupOpen(true)}
            >
              <Trash2 size={16} /> {t(`${SB}.cleanup.run`)}
            </button>
          </div>
          {cleanupPreview && (
            <p className="settings-hint">
              {t(`${SB}.cleanup.previewResult`, {
                count: cleanupPreview.candidateCount,
                size: formatBytes(cleanupPreview.bytesToFree),
              })}
            </p>
          )}
        </section>
      )}
      </>
      ) : null}

      <section className="settings-panel storage-section storage-section--card">
        <h2 className="storage-section__title">{t(`${SB}.backup.title`)}</h2>
        {showAdvancedSections && formBackupSettings ? (
          <div className="storage-form-grid">
            <label>
              {t(`${SB}.backup.schedule`)}
              <select
                value={formBackupSettings.schedule ?? 'manual'}
                disabled={!canEdit}
                onChange={e =>
                  setFormBackupSettings({
                    ...formBackupSettings,
                    schedule: e.target.value as BackupSettingsRow['schedule'],
                  })
                }
              >
                <option value="manual">{t(`${SB}.backup.schedules.manual`)}</option>
                <option value="daily">{t(`${SB}.backup.schedules.daily`)}</option>
                <option value="weekly">{t(`${SB}.backup.schedules.weekly`)}</option>
                <option value="monthly">{t(`${SB}.backup.schedules.monthly`)}</option>
              </select>
            </label>
            <label>
              {t(`${SB}.backup.backupTime`)}
              <input
                type="time"
                value={formBackupSettings.backupTime ?? '02:00'}
                disabled={!canEdit}
                onChange={e =>
                  setFormBackupSettings({ ...formBackupSettings, backupTime: e.target.value })
                }
              />
            </label>
            <label>
              {t(`${SB}.backup.mediaScope`)}
              <select
                value={formBackupSettings.mediaScope ?? 'exclude'}
                disabled={!canEdit}
                onChange={e =>
                  setFormBackupSettings({
                    ...formBackupSettings,
                    mediaScope: e.target.value as BackupSettingsRow['mediaScope'],
                  })
                }
              >
                <option value="exclude">{t(`${SB}.backup.mediaScopes.exclude`)}</option>
                <option value="imagesOnly">{t(`${SB}.backup.mediaScopes.imagesOnly`)}</option>
                <option value="documentsOnly">{t(`${SB}.backup.mediaScopes.documentsOnly`)}</option>
                <option value="all">{t(`${SB}.backup.mediaScopes.all`)}</option>
              </select>
            </label>
            <label className="storage-checkbox">
              <input
                type="checkbox"
                checked={formBackupSettings.includeMedia ?? false}
                disabled={!canEdit}
                onChange={e =>
                  setFormBackupSettings({
                    ...formBackupSettings,
                    includeMedia: e.target.checked,
                  })
                }
              />
              {t(`${SB}.backup.includeMedia`)}
            </label>
            <label>
              {t(`${SB}.backup.destination`)}
              <select
                value={formBackupSettings.destination ?? 'local'}
                disabled={!canEdit}
                onChange={e =>
                  setFormBackupSettings({
                    ...formBackupSettings,
                    destination: e.target.value as BackupSettingsRow['destination'],
                  })
                }
              >
                <option value="local">{t(`${SB}.backup.destinations.local`)}</option>
                <option value="s3">{t(`${SB}.backup.destinations.s3`)}</option>
                <option value="r2">{t(`${SB}.backup.destinations.r2`)}</option>
              </select>
            </label>
            {(formBackupSettings.destination === 's3' || formBackupSettings.destination === 'r2') && (
              <>
                <label>
                  {t(`${SB}.backup.s3Bucket`)}
                  <input
                    type="text"
                    value={formBackupSettings.s3Bucket ?? ''}
                    disabled={!canEdit}
                    placeholder={t(`${SB}.backup.s3BucketPlaceholder`)}
                    onChange={e =>
                      setFormBackupSettings({
                        ...formBackupSettings,
                        s3Bucket: e.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  {t(`${SB}.backup.s3Region`)}
                  <input
                    type="text"
                    value={formBackupSettings.s3Region ?? ''}
                    disabled={!canEdit}
                    placeholder={
                      formBackupSettings.destination === 'r2'
                        ? t(`${SB}.backup.s3RegionR2Placeholder`)
                        : t(`${SB}.backup.s3RegionPlaceholder`)
                    }
                    onChange={e =>
                      setFormBackupSettings({
                        ...formBackupSettings,
                        s3Region: e.target.value,
                      })
                    }
                  />
                </label>
                <p className="settings-hint">{t(`${SB}.backup.remoteHint`)}</p>
                <p className="settings-hint settings-hint--muted">
                  {t(`${SB}.backup.remoteCredentialsHint`)}
                </p>
              </>
            )}
            {canEdit && (
              <button
                type="button"
                className="storage-btn storage-btn--primary storage-btn--block"
                disabled={saveBackupSettingsMutation.isPending}
                onClick={() => saveBackupSettingsMutation.mutate()}
              >
                {saveBackupSettingsMutation.isPending ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <CloudUpload size={16} />
                )}
                {t(`${SB}.backup.save`)}
              </button>
            )}
          </div>
        ) : showAdvancedSections ? (
          <Loader2 className="animate-spin" size={20} />
        ) : embedded ? (
          <p className="settings-hint storage-section__hint">{t(`${SB}.backup.embeddedHint`)}</p>
        ) : null}
        {(isAdmin || perms.canCreateBackup) && (
          <div className="storage-backup-type-grid">
            {BACKUP_TYPES.map(type => (
              <button
                key={type}
                type="button"
                className={`storage-backup-type-btn${type === 'full' ? ' storage-backup-type-btn--accent' : ''}`}
                disabled={createBackupMutation.isPending}
                onClick={() => createBackupMutation.mutate(type)}
              >
                {t(`${SB}.backup.types.${type}`)}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="settings-panel storage-section storage-section--card">
        <h2 className="storage-section__title">{t(`${SB}.history.title`)}</h2>
        {(backupHistory ?? []).length === 0 ? (
          <div className="storage-history-empty">
            <span className="storage-history-empty__icon" aria-hidden>
              <History size={28} strokeWidth={1.5} />
            </span>
            <p className="storage-history-empty__title">{t(`${SB}.history.empty`)}</p>
            <p className="storage-history-empty__hint">{t(`${SB}.history.emptyHint`)}</p>
          </div>
        ) : (
        <ul className="storage-backup-history">
          {(backupHistory ?? []).map(row => (
            <li key={row.id}>
              <div>
                <strong>{t(`${SB}.backup.types.${row.backupType}`, { defaultValue: row.backupType })}</strong> ·{' '}
                {formatBytes(Number(row.fileSizeBytes))} · {row.status} ·{' '}
                {new Date(row.createdAt).toLocaleString()}
              </div>
              <div className="storage-actions">
                <button type="button" className="storage-btn" onClick={() => handleDownloadBackup(row.id)}>
                  <Download size={14} /> {t(`${SB}.history.download`)}
                </button>
                {(isAdmin || perms.canRestoreBackup) && (
                  <button
                    type="button"
                    className="storage-btn"
                    onClick={async () => {
                      const preview = await backupApi.restorePreview(row.id);
                      setRestorePreview(preview);
                      setRestoreId(row.id);
                      setRestoreMode('merge');
                      setConfirmRestoreOpen(true);
                    }}
                  >
                    {t(`${SB}.history.restorePreview`)}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
        )}
      </section>

      <ConfirmDialog
        open={confirmCleanupOpen}
        title={t(`${SB}.cleanup.confirmTitle`)}
        message={t(`${SB}.cleanup.confirmMessage`, {
          count: cleanupPreview?.candidateCount ?? 0,
          size: formatBytes(cleanupPreview?.bytesToFree ?? 0),
        })}
        confirmLabel={t(`${SB}.cleanup.confirmLabel`)}
        danger
        onConfirm={() => runCleanupMutation.mutate()}
        onCancel={() => setConfirmCleanupOpen(false)}
      />

      <ConfirmDialog
        open={confirmRestoreOpen}
        title={t(`${SB}.history.confirmTitle`)}
        message={
          restorePreview ? (
            <div className="storage-restore-preview">
              {Object.keys(restorePreview.recordCounts).length > 0 && (
                <div className="storage-restore-preview__section">
                  <strong>{t(`${SB}.restore.recordCounts`)}</strong>
                  <ul>
                    {Object.entries(restorePreview.recordCounts).map(([table, count]) => (
                      <li key={table}>
                        {table}: {count}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {restorePreview.conflicts.length > 0 && (
                <div className="storage-restore-preview__section">
                  <strong>{t(`${SB}.restore.conflicts`)}</strong>
                  <ul>
                    {restorePreview.conflicts.map(item => (
                      <li key={item.id}>{translateRestorePreviewMessage(item, t)}</li>
                    ))}
                  </ul>
                </div>
              )}
              {restorePreview.warnings.length > 0 && (
                <div className="storage-restore-preview__section">
                  <strong>{t(`${SB}.restore.warnings`)}</strong>
                  <ul>
                    {restorePreview.warnings.map(item => (
                      <li key={item.id}>{translateRestorePreviewMessage(item, t)}</li>
                    ))}
                  </ul>
                </div>
              )}
              <fieldset className="storage-restore-preview__modes">
                <legend>{t(`${SB}.restore.modeLabel`)}</legend>
                {(['merge', 'upsert'] as const).map(mode => (
                  <label key={mode} className="storage-checkbox">
                    <input
                      type="radio"
                      name="restore-mode"
                      value={mode}
                      checked={restoreMode === mode}
                      onChange={() => setRestoreMode(mode)}
                    />
                    {t(`${SB}.restore.modes.${mode}`)}
                  </label>
                ))}
              </fieldset>
            </div>
          ) : (
            t(`${SB}.history.confirmFallback`)
          )
        }
        confirmLabel={t(`${SB}.history.confirmLabel`)}
        danger
        onConfirm={() => restoreId && restoreMutation.mutate({ id: restoreId, mode: restoreMode })}
        onCancel={() => {
          setConfirmRestoreOpen(false);
          setRestoreId(null);
          setRestoreMode('merge');
        }}
      />
    </div>
    </div>
  );
}
