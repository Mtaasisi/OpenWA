import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Loader2, RefreshCw, FolderOpen, Download } from 'lucide-react';
import { getAuthHeaders } from '../../lib/auth-storage';
import {
  SettingsIntegrationCard,
  SettingsIntegrationShell,
} from './SettingsIntegrationShell';
import { MaterialSymbol } from '../MaterialSymbol';
import { settingsSectionHref } from './settings-routing';
import type { SettingsSection } from './settings-nav-registry';
import './DesktopAppSettingsPanel.css';

interface DesktopHealth {
  appVersion?: string;
  mode?: string;
  uptime?: number;
  database?: { connected?: boolean; maskedUrl?: string; type?: string; pgvectorInstalled?: boolean };
  whatsapp?: { sessionCount?: number; connectedCount?: number };
  safetyGuardEnabled?: boolean;
  deviceId?: string;
  paths?: Record<string, { path?: string; ok?: boolean }>;
}

interface Props {
  onBack: () => void;
  backSection: SettingsSection;
}

export function DesktopAppSettingsPanel({ onBack, backSection }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [isDesktop, setIsDesktop] = useState(false);
  const [health, setHealth] = useState<DesktopHealth | null>(null);
  const [serverStatus, setServerStatus] = useState('');
  const [maskedConfig, setMaskedConfig] = useState<Record<string, unknown>>({});
  const [databaseMode, setDatabaseMode] = useState<'embedded' | 'external'>('embedded');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!window.desktop?.isDesktopApp) {
      setIsDesktop(false);
      setLoading(false);
      return;
    }
    setIsDesktop(true);
    try {
      const [cfg, h, fullCfg] = await Promise.all([
        window.desktop.getMaskedConfig?.() ?? Promise.resolve({}),
        window.desktop.getHealth?.() ??
          Promise.resolve({
            serverStatus: '',
            databaseConnected: false,
            whatsappConnected: 0,
            whatsappSessionCount: 0,
            raw: undefined,
          }),
        window.desktop.getConfig?.() ?? Promise.resolve({}),
      ]);
      setMaskedConfig(cfg);
      setDatabaseMode(
        (fullCfg as { databaseMode?: string }).databaseMode === 'external' ? 'external' : 'embedded',
      );
      setServerStatus(h.serverStatus);
      setHealth((h.raw as DesktopHealth | undefined) ?? null);
    } catch {
      try {
        const res = await fetch('/api/health/desktop', { headers: getAuthHeaders() });
        if (!res.ok) throw new Error('health');
        const data = (await res.json()) as DesktopHealth;
        setHealth(data);
        setIsDesktop(data.mode === 'desktop');
      } catch {
        setIsDesktop(false);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const title = t('settings.desktopApp.title');

  if (loading) {
    return (
      <SettingsIntegrationShell chromeless backSection={backSection} onBack={onBack} title={title}>
        <div className="settings-integration-loading">
          <Loader2 className="animate-spin" size={24} />
        </div>
      </SettingsIntegrationShell>
    );
  }

  if (!isDesktop) {
    return (
      <SettingsIntegrationShell chromeless backSection={backSection} onBack={onBack} title={title}>
        <SettingsIntegrationCard icon="computer" title={title}>
          <p className="settings-int-hint settings-int-hint--muted">{t('settings.desktopApp.webOnly')}</p>
        </SettingsIntegrationCard>
      </SettingsIntegrationShell>
    );
  }

  const appVersion = health?.appVersion ?? String(maskedConfig.appVersion ?? '—');
  const dbConnected = health?.database?.connected;
  const waConnected = health?.whatsapp?.connectedCount ?? 0;
  const waTotal = health?.whatsapp?.sessionCount ?? 0;

  const dbType = health?.database?.type ?? 'sqlite';
  const localDbPath = health?.database?.maskedUrl ?? '—';

  return (
    <SettingsIntegrationShell chromeless backSection={backSection} onBack={onBack} title={title}>
      <div className="desktop-app-settings">
        <div className="desktop-app-kpi-grid">
          <div className="desktop-app-kpi">
            <p className="desktop-app-kpi__label">{t('settings.desktopApp.kpi.version')}</p>
            <p className="desktop-app-kpi__value">{appVersion}</p>
          </div>
          <div className="desktop-app-kpi">
            <p className="desktop-app-kpi__label">{t('settings.desktopApp.kpi.server')}</p>
            <p className="desktop-app-kpi__value">{serverStatus || '—'}</p>
          </div>
          <div className="desktop-app-kpi">
            <p className="desktop-app-kpi__label">{t('settings.desktopApp.kpi.database')}</p>
            <p className="desktop-app-kpi__value">
              {dbConnected ? t('settings.desktopApp.connected') : t('settings.desktopApp.disconnected')}
            </p>
          </div>
          <div className="desktop-app-kpi">
            <p className="desktop-app-kpi__label">{t('settings.desktopApp.kpi.sessions')}</p>
            <p className="desktop-app-kpi__value">
              {t('settings.desktopApp.sessionsCount', { connected: waConnected, total: waTotal })}
            </p>
          </div>
        </div>

        <SettingsIntegrationCard title={t('settings.desktopApp.actionsSection')} icon="build">
          <div className="desktop-app-settings__actions">
            <button
              type="button"
              className="desktop-app-btn desktop-app-btn--primary"
              onClick={() => void window.desktop?.restartBackend?.().then(() => refresh())}
            >
              <RefreshCw size={16} />
              {t('settings.desktopApp.restartBackend')}
            </button>
            <button
              type="button"
              className="desktop-app-btn"
              onClick={() => void window.desktop?.openDashboard?.()}
            >
              <MaterialSymbol name="open_in_new" size={16} />
              {t('settings.desktopApp.openDashboard')}
            </button>
            <button
              type="button"
              className="desktop-app-btn"
              onClick={() =>
                void window.desktop?.checkForUpdates?.().then(res => setActionMessage(res.message))
              }
            >
              <MaterialSymbol name="system_update" size={16} />
              {t('settings.desktopApp.checkForUpdates')}
            </button>
          </div>
          {actionMessage ? <p className="desktop-app-settings__test">{actionMessage}</p> : null}
        </SettingsIntegrationCard>

        {!moreOpen ? (
          <button
            type="button"
            className="fu-btn fu-btn--ghost fu-btn--sm settings-inline-more-btn"
            onClick={() => setMoreOpen(true)}
          >
            <span>{t('settings.moreOptions')}</span>
            <ChevronDown size={18} aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            className="fu-btn fu-btn--ghost fu-btn--sm settings-inline-show-less"
            onClick={() => setMoreOpen(false)}
          >
            {t('settings.showLess')}
          </button>
        )}

        {moreOpen ? (
        <>
        <SettingsIntegrationCard
          title={t('settings.desktopApp.statusSection')}
          icon="monitor_heart"
        >
          <dl className="desktop-app-settings__grid">
            <dt>{t('settings.desktopApp.fields.appVersion')}</dt>
            <dd>{appVersion}</dd>
            <dt>{t('settings.desktopApp.fields.server')}</dt>
            <dd>{serverStatus || '—'}</dd>
            <dt>{t('settings.desktopApp.fields.database')}</dt>
            <dd>
              {dbConnected ? t('settings.desktopApp.connected') : t('settings.desktopApp.disconnected')}
            </dd>
            <dt>{t('settings.desktopApp.fields.databasePath')}</dt>
            <dd className="mono">{localDbPath}</dd>
            <dt>{t('settings.desktopApp.fields.databaseType')}</dt>
            <dd>{dbType}</dd>
            {health?.database?.pgvectorInstalled !== undefined ? (
              <>
                <dt>{t('settings.desktopApp.pgvectorEnabled')}</dt>
                <dd>
                  {health.database.pgvectorInstalled
                    ? t('settings.desktopApp.pgvectorOn')
                    : t('settings.desktopApp.pgvectorOff')}
                </dd>
              </>
            ) : null}
            <dt>{t('settings.desktopApp.fields.deviceId')}</dt>
            <dd className="mono">{health?.deviceId ?? String(maskedConfig.deviceId ?? '—')}</dd>
            <dt>{t('settings.desktopApp.fields.deviceName')}</dt>
            <dd>{String(maskedConfig.deviceName ?? '—')}</dd>
            <dt>{t('settings.desktopApp.fields.localFolder')}</dt>
            <dd className="mono">{String(maskedConfig.storagePath ?? '—')}</dd>
            <dt>{t('settings.desktopApp.fields.backendPort')}</dt>
            <dd>{String(maskedConfig.appPort ?? '2886')}</dd>
            <dt>{t('settings.desktopApp.fields.whatsappSessions')}</dt>
            <dd>{t('settings.desktopApp.sessionsCount', { connected: waConnected, total: waTotal })}</dd>
            <dt>{t('settings.desktopApp.fields.safetyGuard')}</dt>
            <dd>
              {health?.safetyGuardEnabled !== false
                ? t('settings.desktopApp.enabled')
                : t('settings.desktopApp.disabled')}
            </dd>
          </dl>
        </SettingsIntegrationCard>

        <SettingsIntegrationCard
          title={t('settings.desktopApp.notificationsLink')}
          icon="notifications"
        >
          <p className="settings-int-hint settings-int-hint--muted">
            {t('settings.desktopApp.notificationsLinkHint')}
          </p>
          <Link
            to={settingsSectionHref('notifications')}
            className="settings-wa__btn-primary settings-hub__cta-btn"
            style={{ textDecoration: 'none', display: 'inline-flex' }}
          >
            {t('settings.desktopApp.notificationsLink')}
          </Link>
        </SettingsIntegrationCard>

        <SettingsIntegrationCard title={t('settings.desktopApp.databaseSection')} icon="database">
          <p className="settings-int-hint settings-int-hint--muted">
            {databaseMode === 'embedded'
              ? t('settings.desktopApp.databaseHintEmbedded')
              : t('settings.desktopApp.databaseHintExternal')}
          </p>
          <dl className="desktop-app-settings__grid">
            <dt>{t('settings.desktopApp.fields.database')}</dt>
            <dd>
              {dbConnected ? t('settings.desktopApp.connected') : t('settings.desktopApp.disconnected')}
            </dd>
            <dt>{t('settings.desktopApp.fields.databasePath')}</dt>
            <dd className="mono">{localDbPath}</dd>
          </dl>
          {actionMessage ? <p className="desktop-app-settings__test">{actionMessage}</p> : null}
          {!dbConnected ? (
            <div className="desktop-app-settings__actions">
              <button
                type="button"
                className="desktop-app-btn desktop-app-btn--primary"
                disabled={busy}
                onClick={() => {
                  if (!window.desktop) return;
                  setBusy(true);
                  setActionMessage(null);
                  void window.desktop
                    .ensureDatabaseReady?.()
                    .then(res => setActionMessage(res.message))
                    .catch(e => setActionMessage(e instanceof Error ? e.message : 'Failed'))
                    .finally(() => {
                      setBusy(false);
                      void refresh();
                    });
                }}
              >
                {t('settings.desktopApp.reconnectDatabase')}
              </button>
            </div>
          ) : null}
        </SettingsIntegrationCard>

        <SettingsIntegrationCard title={t('settings.desktopApp.advancedActionsSection')} icon="folder_open">
          <div className="desktop-app-settings__actions">
            <button type="button" className="desktop-app-btn" onClick={() => void window.desktop?.openFolder?.('logs')}>
              <FolderOpen size={16} />
              {t('settings.desktopApp.openLogs')}
            </button>
            <button
              type="button"
              className="desktop-app-btn"
              onClick={() => void window.desktop?.openFolder?.('sessions')}
            >
              <FolderOpen size={16} />
              {t('settings.desktopApp.openSessions')}
            </button>
            <button type="button" className="desktop-app-btn" onClick={() => void window.desktop?.openFolder?.('media')}>
              <FolderOpen size={16} />
              {t('settings.desktopApp.openMedia')}
            </button>
            <button
              type="button"
              className="desktop-app-btn"
              onClick={async () => {
                const p = await window.desktop?.exportDiagnostics?.();
                if (p) alert(t('settings.desktopApp.diagnosticsSaved', { path: p }));
              }}
            >
              <Download size={16} />
              {t('settings.desktopApp.exportDiagnostics')}
            </button>
          </div>
        </SettingsIntegrationCard>

        <article className="interakt-danger-card desktop-app-settings__reset">
          <div className="interakt-danger-card__head">
            <MaterialSymbol name="restart_alt" size={22} />
            <div>
              <h3>{t('settings.desktopApp.resetSection')}</h3>
              <p>{t('settings.desktopApp.resetHint')}</p>
            </div>
          </div>
          <div className="interakt-danger-card__actions">
            <button
              type="button"
              className="interakt-btn interakt-btn--danger-ghost"
              onClick={async () => {
                if (!confirm(t('settings.desktopApp.resetConfirm'))) return;
                await window.desktop?.resetConfig?.();
                await window.desktop?.saveConfig?.({ setupCompleted: false });
                window.location.reload();
              }}
            >
              {t('settings.desktopApp.resetButton')}
            </button>
          </div>
        </article>
        </>
        ) : null}
      </div>
    </SettingsIntegrationShell>
  );
}
