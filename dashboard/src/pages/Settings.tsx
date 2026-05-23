import { useEffect, useMemo, useState, Suspense, lazy } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  User,
  Palette,
  Inbox,
  Bell,
  Server,
  Puzzle,
  Database,
  Info,
  ExternalLink,
  Monitor,
  Moon,
  Smartphone,
  Sun,
  Loader2,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { PageHeader } from '../components/PageHeader';
import { useThemeContext } from '../context/ThemeProvider';
import { useRole } from '../hooks/useRole';
import {
  useSettingsQuery,
  useUpdateSettingsMutation,
  useWebhooksQuery,
  usePluginsQuery,
  useInfraStatusQuery,
  useSessionsQuery,
} from '../hooks/queries';
import { productsApi, type Settings } from '../services/api';
import { useQuery } from '@tanstack/react-query';
import type { AppearanceMode } from '../lib/theme-types';
import { performLogout } from '../lib/logout';
import {
  clearUserPreferences,
  loadUserPreferences,
  saveUserPreferences,
  type InboxDefaultView,
  type InboxConversationFilterPref,
} from '../lib/user-preferences';
import type { SupportedLanguage } from '../i18n';
import {
  parseSettingsIntegrationId,
  integrationTitleKey,
  integrationRequiresAdmin,
  type SettingsIntegrationId,
} from '../components/settings/settings-integrations';
import { SettingsIntegrationsSection } from '../components/settings/SettingsIntegrationsSection';
import { SettingsApiToolsSection } from '../components/settings/SettingsApiToolsSection';
import { SettingsThemePicker } from '../components/settings/SettingsThemePicker';
import { SettingsMovedBanner } from '../components/settings/SettingsMovedBanner';
import {
  parseSettingsApiToolId,
  apiToolTitleKey,
  type SettingsApiToolId,
} from '../components/settings/settings-api-tools';
import './Settings.css';

const INBOX_FILTER_OPTIONS: InboxConversationFilterPref[] = [
  'all',
  'unread',
  'needs_reply',
  'private',
  'groups',
  'resolved',
];

const SessionsPage = lazy(() => import('./Sessions').then(m => ({ default: m.Sessions })));

type SettingsSection =
  | 'account'
  | 'appearance'
  | 'inbox'
  | 'sessions'
  | 'notifications'
  | 'api'
  | 'integrations'
  | 'data'
  | 'about';

const SECTION_IDS: SettingsSection[] = [
  'account',
  'appearance',
  'inbox',
  'sessions',
  'notifications',
  'api',
  'integrations',
  'data',
  'about',
];

const appearanceOptions: { id: AppearanceMode; icon: typeof Sun }[] = [
  { id: 'light', icon: Sun },
  { id: 'dark', icon: Moon },
  { id: 'system', icon: Monitor },
];

function maskApiKey(key: string | null): string {
  if (!key) return '—';
  if (key.length <= 8) return '••••••••';
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

type SettingsPatch = {
  general?: Partial<Settings['general']>;
  api?: Partial<Settings['api']>;
  notifications?: Partial<Settings['notifications']>;
};

export function Settings() {
  const { t, i18n } = useTranslation();
  useDocumentTitle(t('settings.title'));
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { role, isAdmin } = useRole();
  const { appearance, setAppearance, resolvedAppearance } =
    useThemeContext();

  const sectionParam = searchParams.get('section') as SettingsSection | null;
  const activeSection: SettingsSection = useMemo(() => {
    if (!sectionParam || !SECTION_IDS.includes(sectionParam)) return 'account';
    return sectionParam;
  }, [sectionParam]);

  const setSection = (id: SettingsSection) => {
    const next = new URLSearchParams();
    next.set('section', id);
    setSearchParams(next, { replace: true });
  };

  const integrationId = parseSettingsIntegrationId(searchParams.get('integration'));
  const apiToolId = parseSettingsApiToolId(searchParams.get('tool'));

  const selectIntegration = (id: SettingsIntegrationId) => {
    setSearchParams({ section: 'integrations', integration: id }, { replace: true });
    if (mobileLayout) setMobilePanelOpen(true);
  };

  const backToIntegrationsHub = () => {
    setSearchParams({ section: 'integrations' }, { replace: true });
  };

  const selectApiTool = (id: SettingsApiToolId) => {
    setSearchParams({ section: 'api', tool: id }, { replace: true });
    if (mobileLayout) setMobilePanelOpen(true);
  };

  const backToApiToolsHub = () => {
    setSearchParams({ section: 'api' }, { replace: true });
  };

  useEffect(() => {
    if (!integrationId) return;
    if (integrationRequiresAdmin(integrationId) && !isAdmin) {
      backToIntegrationsHub();
    }
  }, [integrationId, isAdmin]);

  const [mobileLayout, setMobileLayout] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 768px)').matches : false,
  );
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const onChange = () => {
      setMobileLayout(mq.matches);
      if (!mq.matches) setMobilePanelOpen(false);
    };
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const openSection = (id: SettingsSection) => {
    setSection(id);
    if (mobileLayout) setMobilePanelOpen(true);
  };

  useEffect(() => {
    if (
      mobileLayout &&
      (searchParams.get('section') || searchParams.get('integration') || searchParams.get('tool'))
    ) {
      setMobilePanelOpen(true);
    }
  }, [mobileLayout, searchParams]);

  const serverReadOnly = !isAdmin;

  const apiKey = sessionStorage.getItem('openwa_api_key');
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [userPrefs, setUserPrefs] = useState(() => loadUserPreferences());
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const { data: serverSettings, isLoading: loadingSettings } = useSettingsQuery();
  const updateSettings = useUpdateSettingsMutation();
  const { data: webhooks = [] } = useWebhooksQuery();
  const { data: plugins = [] } = usePluginsQuery();
  const { data: infraStatus } = useInfraStatusQuery();
  const { data: allSessions = [] } = useSessionsQuery();
  const { data: inauzwaStatus } = useQuery({
    queryKey: ['products', 'inauzwa-status'],
    queryFn: () => productsApi.inauzwaSyncStatus(),
  });

  const [serverDraft, setServerDraft] = useState<Settings | null>(null);

  useEffect(() => {
    if (serverSettings) setServerDraft(serverSettings);
  }, [serverSettings]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/health')
      .then(res => {
        if (!cancelled) setApiOnline(res.ok);
      })
      .catch(() => {
        if (!cancelled) setApiOnline(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const navItems = useMemo(() => {
    const items: { id: SettingsSection; icon: typeof User; adminOnly?: boolean }[] = [
      { id: 'account', icon: User },
      { id: 'appearance', icon: Palette },
      { id: 'inbox', icon: Inbox },
      { id: 'sessions', icon: Smartphone },
      { id: 'notifications', icon: Bell, adminOnly: true },
      { id: 'api', icon: Server, adminOnly: true },
      { id: 'integrations', icon: Puzzle },
      { id: 'data', icon: Database },
      { id: 'about', icon: Info },
    ];
    return items.filter(item => !item.adminOnly || isAdmin);
  }, [isAdmin]);

  const showMobileNav = mobileLayout && !mobilePanelOpen;
  const showMobilePanel = !mobileLayout || mobilePanelOpen;

  const roleLabel =
    role === 'admin'
      ? t('settings.roleAdmin')
      : role === 'operator'
        ? t('settings.roleOperator')
        : role === 'viewer'
          ? t('settings.roleViewer')
          : '—';

  const currentLang = (i18n.resolvedLanguage || i18n.language || 'en').split('-')[0] as SupportedLanguage;

  const patchServer = (patch: SettingsPatch) => {
    if (!serverDraft) return;
    setServerDraft({
      ...serverDraft,
      ...patch,
      general: patch.general ? { ...serverDraft.general, ...patch.general } : serverDraft.general,
      api: patch.api ? { ...serverDraft.api, ...patch.api } : serverDraft.api,
      notifications: patch.notifications
        ? { ...serverDraft.notifications, ...patch.notifications }
        : serverDraft.notifications,
    });
  };

  const saveServerSettings = async () => {
    if (!serverDraft || !isAdmin) return;
    try {
      await updateSettings.mutateAsync(serverDraft);
      setSaveMsg(t('inbox.crmSaved'));
      setTimeout(() => setSaveMsg(null), 2500);
    } catch {
      setSaveMsg(t('inbox.crmSaveError'));
      setTimeout(() => setSaveMsg(null), 4000);
    }
  };

  const saveInboxPrefs = () => {
    saveUserPreferences(userPrefs);
    setSaveMsg(t('settings.prefsSaved'));
    setTimeout(() => setSaveMsg(null), 2500);
  };

  const enabledPlugins = plugins.filter(p => p.status === 'enabled').length;

  return (
    <div className="settings-page">
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />

      <div
        className={`settings-layout ${mobileLayout ? 'settings-layout--mobile' : ''} ${mobilePanelOpen ? 'settings-layout--panel-open' : ''}`}
      >
        {showMobileNav && (
          <nav className="settings-nav settings-nav--mobile-menu" aria-label={t('settings.mobileSections')}>
            {navItems.map(({ id, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={`settings-nav__btn ${activeSection === id ? 'active' : ''}`}
                onClick={() => openSection(id)}
              >
                <Icon size={16} />
                {t(`settings.sections.${id}`)}
                <ChevronRight size={16} className="settings-nav__chevron" aria-hidden />
              </button>
            ))}
          </nav>
        )}

        {!mobileLayout && (
          <nav className="settings-nav" aria-label={t('settings.title')}>
            {navItems.map(({ id, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={`settings-nav__btn ${activeSection === id ? 'active' : ''}`}
                onClick={() => setSection(id)}
              >
                <Icon size={16} />
                {t(`settings.sections.${id}`)}
              </button>
            ))}
          </nav>
        )}

        {showMobilePanel && (
        <div className="settings-panel">
          <SettingsMovedBanner />
          {mobileLayout && (
            <button
              type="button"
              className="settings-mobile-back"
              onClick={() => setMobilePanelOpen(false)}
            >
              <ChevronLeft size={18} />
              {t('settings.mobileSections')}
            </button>
          )}
          {activeSection === 'account' && (
            <div className="settings-card">
              <div className="settings-card__head">
                <h2>{t('settings.account.title')}</h2>
                <p>{t('settings.account.desc')}</p>
              </div>
              <div className="settings-card__body">
                <div className="settings-row">
                  <div>
                    <div className="settings-row__label">{t('settings.account.role')}</div>
                  </div>
                  <div className="settings-row__control">
                    <span className={`settings-badge ${isAdmin ? 'settings-badge--admin' : ''}`}>
                      {roleLabel}
                    </span>
                  </div>
                </div>
                <div className="settings-row">
                  <div>
                    <div className="settings-row__label">{t('settings.account.apiKey')}</div>
                    <p className="settings-row__hint">{t('settings.account.apiKeyHint')}</p>
                  </div>
                  <div className="settings-row__control">
                    <span className="settings-row__value">{maskApiKey(apiKey)}</span>
                  </div>
                </div>
                <div className="settings-row">
                  <div>
                    <div className="settings-row__label">{t('settings.account.connection')}</div>
                  </div>
                  <div className="settings-row__control">
                    <span
                      className={`settings-badge ${apiOnline ? 'settings-badge--ok' : ''}`}
                    >
                      {apiOnline === null
                        ? '…'
                        : apiOnline
                          ? t('settings.account.online')
                          : t('settings.account.offline')}
                    </span>
                  </div>
                </div>
                <div className="settings-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => performLogout()}>
                    {t('settings.account.changeKey')}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => performLogout()}>
                    {t('common.logout')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'appearance' && (
            <>
              <div className="settings-card">
                <div className="settings-card__head">
                  <h2>{t('settings.appearance.modeTitle')}</h2>
                  <p>{t('settings.appearance.modeDesc')}</p>
                </div>
                <div className="settings-card__body">
                  <div className="settings-appearance-row">
                    {appearanceOptions.map(({ id, icon: Icon }) => (
                      <button
                        key={id}
                        type="button"
                        className={`settings-pill ${appearance === id ? 'active' : ''}`}
                        onClick={() => setAppearance(id)}
                      >
                        <Icon size={16} />
                        {t(`theme.${id}`)}
                      </button>
                    ))}
                  </div>
                  <p className="settings-row__hint" style={{ marginTop: '0.75rem' }}>
                    {t('settings.appearance.resolved', {
                      mode: t(`theme.${resolvedAppearance}`),
                    })}
                  </p>
                </div>
              </div>

              <div className="settings-card">
                <div className="settings-card__head">
                  <h2>{t('settings.appearance.themeTitle')}</h2>
                  <p>{t('settings.appearance.themeDesc')}</p>
                </div>
                <div className="settings-card__body">
                  <SettingsThemePicker />
                  <div className="settings-actions">
                    <Link to="/themes" className="btn btn-secondary">
                      <Palette size={16} />
                      {t('settings.appearance.manageThemes')}
                    </Link>
                  </div>
                </div>
              </div>

              <div className="settings-card">
                <div className="settings-card__head">
                  <h2>{t('settings.appearance.languageTitle')}</h2>
                </div>
                <div className="settings-card__body">
                  <select
                    className="settings-select"
                    value={currentLang}
                    onChange={e => void i18n.changeLanguage(e.target.value)}
                  >
                    <option value="en">English</option>
                    <option value="he">עברית</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {activeSection === 'inbox' && (
            <div className="settings-card">
              <div className="settings-card__head">
                <h2>{t('settings.inbox.title')}</h2>
                <p>{t('settings.inbox.desc')}</p>
              </div>
              <div className="settings-card__body">
                <div className="settings-row">
                  <div>
                    <div className="settings-row__label">{t('settings.inbox.defaultView')}</div>
                    <p className="settings-row__hint">{t('settings.inbox.defaultViewHint')}</p>
                  </div>
                  <div className="settings-row__control">
                    <select
                      className="settings-select"
                      value={userPrefs.inboxDefaultView}
                      onChange={e =>
                        setUserPrefs(p => ({
                          ...p,
                          inboxDefaultView: e.target.value as InboxDefaultView,
                        }))
                      }
                    >
                      <option value="all">{t('inbox.allAccounts')}</option>
                      <option value="one">{t('inbox.oneAccount')}</option>
                    </select>
                  </div>
                </div>
                {allSessions.length > 0 && (
                  <div className="settings-row">
                    <div>
                      <div className="settings-row__label">{t('settings.inbox.defaultSession')}</div>
                      <p className="settings-row__hint">{t('settings.inbox.defaultSessionHint')}</p>
                    </div>
                    <div className="settings-row__control">
                      <select
                        className="settings-select"
                        value={userPrefs.inboxDefaultSessionId ?? ''}
                        onChange={e =>
                          setUserPrefs(p => ({
                            ...p,
                            inboxDefaultSessionId: e.target.value || null,
                          }))
                        }
                      >
                        <option value="">{t('settings.inbox.defaultSessionAuto')}</option>
                        {allSessions.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.status})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
                <div className="settings-row">
                  <div>
                    <div className="settings-row__label">{t('settings.inbox.defaultFilter')}</div>
                    <p className="settings-row__hint">{t('settings.inbox.defaultFilterHint')}</p>
                  </div>
                  <div className="settings-row__control">
                    <select
                      className="settings-select"
                      value={userPrefs.inboxConversationFilter}
                      onChange={e =>
                        setUserPrefs(p => ({
                          ...p,
                          inboxConversationFilter: e.target.value as InboxConversationFilterPref,
                        }))
                      }
                    >
                      {INBOX_FILTER_OPTIONS.map(key => (
                        <option key={key} value={key}>
                          {t(`inbox.filter.${key}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <label className="settings-row" style={{ cursor: 'pointer' }}>
                  <div>
                    <div className="settings-row__label">{t('settings.inbox.showCustomerPanel')}</div>
                    <p className="settings-row__hint">{t('settings.inbox.showCustomerPanelHint')}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={userPrefs.inboxShowCustomerPanel}
                    onChange={e =>
                      setUserPrefs(p => ({
                        ...p,
                        inboxShowCustomerPanel: e.target.checked,
                      }))
                    }
                  />
                </label>
                <label className="settings-row" style={{ cursor: 'pointer' }}>
                  <div>
                    <div className="settings-row__label">{t('settings.inbox.showChatList')}</div>
                    <p className="settings-row__hint">{t('settings.inbox.showChatListHint')}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={userPrefs.inboxShowChatList}
                    onChange={e =>
                      setUserPrefs(p => ({
                        ...p,
                        inboxShowChatList: e.target.checked,
                      }))
                    }
                  />
                </label>
                <div className="settings-row">
                  <div>
                    <div className="settings-row__label">{t('settings.inbox.productDefaults')}</div>
                    <p className="settings-row__hint">{t('settings.inbox.productDefaultsHint')}</p>
                  </div>
                </div>
                <label className="settings-row" style={{ cursor: 'pointer' }}>
                  <span className="settings-row__label">{t('products.inbox.inStockOnly')}</span>
                  <input
                    type="checkbox"
                    checked={userPrefs.productInStockOnly}
                    onChange={e =>
                      setUserPrefs(p => ({ ...p, productInStockOnly: e.target.checked }))
                    }
                  />
                </label>
                <label className="settings-row" style={{ cursor: 'pointer' }}>
                  <span className="settings-row__label">{t('products.inbox.includeImage')}</span>
                  <input
                    type="checkbox"
                    checked={userPrefs.productIncludeImage}
                    onChange={e =>
                      setUserPrefs(p => ({ ...p, productIncludeImage: e.target.checked }))
                    }
                  />
                </label>
                <label className="settings-row" style={{ cursor: 'pointer' }}>
                  <span className="settings-row__label">{t('products.inbox.includeDevices')}</span>
                  <input
                    type="checkbox"
                    checked={userPrefs.productIncludeDevices}
                    onChange={e =>
                      setUserPrefs(p => ({ ...p, productIncludeDevices: e.target.checked }))
                    }
                  />
                </label>
                {inauzwaStatus?.configured && (
                  <label className="settings-row" style={{ cursor: 'pointer' }}>
                    <span className="settings-row__label">{t('products.inbox.refreshBeforeSend')}</span>
                    <input
                      type="checkbox"
                      checked={
                        userPrefs.productRefreshBeforeSend ??
                        inauzwaStatus.preferences.refreshBeforeSend ??
                        true
                      }
                      onChange={e =>
                        setUserPrefs(p => ({
                          ...p,
                          productRefreshBeforeSend: e.target.checked,
                        }))
                      }
                    />
                  </label>
                )}
                <div className="settings-footer-bar">
                  {saveMsg && <span className="settings-save-msg">{saveMsg}</span>}
                  <button type="button" className="btn btn-primary" onClick={saveInboxPrefs}>
                    {t('settings.savePrefs')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'sessions' && (
            <div className="settings-card">
              <div className="settings-card__head">
                <h2>{t('settings.sessions.title')}</h2>
                <p>{t('settings.sessions.desc')}</p>
              </div>
              <div className="settings-card__body settings-card__body--integrations">
                <Suspense
                  fallback={
                    <div className="settings-integration-loading">
                      <Loader2 className="animate-spin" size={24} />
                    </div>
                  }
                >
                  <SessionsPage embedded />
                </Suspense>
              </div>
            </div>
          )}

          {activeSection === 'notifications' && serverDraft && (
            <div className="settings-card">
              <div className="settings-card__head">
                <h2>{t('settings.notifications.title')}</h2>
                <p>{t('settings.notifications.desc')}</p>
              </div>
              <div className="settings-card__body">
                {serverReadOnly && (
                  <p className="settings-readonly-banner">{t('settings.readOnlyHint')}</p>
                )}
                {loadingSettings ? (
                  <Loader2 className="animate-spin" size={24} />
                ) : (
                  <>
                    <label className="settings-row" style={{ cursor: serverReadOnly ? 'default' : 'pointer' }}>
                      <div>
                        <div className="settings-row__label">
                          {t('settings.notifications.webhookAlerts')}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={serverDraft.notifications.webhookAlerts}
                        disabled={serverReadOnly}
                        onChange={e =>
                          patchServer({
                            notifications: { webhookAlerts: e.target.checked },
                          })
                        }
                      />
                    </label>
                    <label className="settings-row" style={{ cursor: serverReadOnly ? 'default' : 'pointer' }}>
                      <div>
                        <div className="settings-row__label">
                          {t('settings.notifications.emailEnabled')}
                        </div>
                        <p className="settings-row__hint">
                          {t('settings.notifications.emailHint')}
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={serverDraft.notifications.emailEnabled}
                        disabled={serverReadOnly}
                        onChange={e =>
                          patchServer({
                            notifications: { emailEnabled: e.target.checked },
                          })
                        }
                      />
                    </label>
                    <div className="settings-row">
                      <div>
                        <div className="settings-row__label">
                          {t('settings.notifications.email')}
                        </div>
                      </div>
                      <div className="settings-row__control">
                        <input
                          type="email"
                          className="settings-input"
                          value={serverDraft.notifications.notificationEmail}
                          disabled={serverReadOnly || !serverDraft.notifications.emailEnabled}
                          readOnly={serverReadOnly}
                          onChange={e =>
                            patchServer({
                              notifications: { notificationEmail: e.target.value },
                            })
                          }
                        />
                      </div>
                    </div>
                    <p className="settings-row__hint">{t('settings.serverPersistHint')}</p>
                    {!serverReadOnly && (
                    <div className="settings-footer-bar">
                      {saveMsg && <span className="settings-save-msg">{saveMsg}</span>}
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={updateSettings.isPending}
                        onClick={() => void saveServerSettings()}
                      >
                        {updateSettings.isPending ? (
                          <Loader2 className="animate-spin" size={16} />
                        ) : null}
                        {t('settings.saveServer')}
                      </button>
                    </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {activeSection === 'api' && serverDraft && (
            <>
              <div className="settings-card">
                <div className="settings-card__head">
                  <h2>{t('settings.api.title')}</h2>
                  <p>{t('settings.api.desc')}</p>
                </div>
                <div className="settings-card__body">
                  {serverReadOnly && (
                    <p className="settings-readonly-banner">{t('settings.readOnlyHint')}</p>
                  )}
                  <label className="settings-row" style={{ cursor: serverReadOnly ? 'default' : 'pointer' }}>
                    <div>
                      <div className="settings-row__label">{t('settings.api.autoReconnect')}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={serverDraft.general.autoReconnect}
                      disabled={serverReadOnly}
                      onChange={e =>
                        patchServer({ general: { autoReconnect: e.target.checked } })
                      }
                    />
                  </label>
                  <label className="settings-row" style={{ cursor: serverReadOnly ? 'default' : 'pointer' }}>
                    <div>
                      <div className="settings-row__label">{t('settings.api.debugMode')}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={serverDraft.general.debugMode}
                      disabled={serverReadOnly}
                      onChange={e => patchServer({ general: { debugMode: e.target.checked } })}
                    />
                  </label>
                  <div className="settings-row">
                    <div>
                      <div className="settings-row__label">{t('settings.api.rateLimit')}</div>
                    </div>
                    <div className="settings-row__control settings-row__value">
                      {serverDraft.api.rateLimit} / {serverDraft.api.rateLimitWindow}ms
                    </div>
                  </div>
                  <div className="settings-actions">
                    <a
                      href="/api/docs"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary"
                    >
                      <ExternalLink size={16} />
                      {t('settings.api.openDocs')}
                    </a>
                  </div>
                  <p className="settings-row__hint">{t('settings.serverPersistHint')}</p>
                  {!serverReadOnly && (
                    <div className="settings-footer-bar">
                      {saveMsg && <span className="settings-save-msg">{saveMsg}</span>}
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={updateSettings.isPending}
                        onClick={() => void saveServerSettings()}
                      >
                        {updateSettings.isPending ? (
                          <Loader2 className="animate-spin" size={16} />
                        ) : null}
                        {t('settings.saveServer')}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="settings-card">
                <div className="settings-card__head">
                  <h2>
                    {apiToolId ? t(apiToolTitleKey(apiToolId)) : t('settings.api.toolsTitle')}
                  </h2>
                  <p>
                    {apiToolId ? t('settings.api.toolsDetailDesc') : t('settings.api.toolsDesc')}
                  </p>
                </div>
                <div className="settings-card__body settings-card__body--integrations">
                  <SettingsApiToolsSection
                    activeId={apiToolId}
                    onSelect={selectApiTool}
                    onBack={backToApiToolsHub}
                  />
                </div>
              </div>
            </>
          )}

          {activeSection === 'integrations' && (
            <div className="settings-card">
              <div className="settings-card__head">
                <h2>
                  {integrationId
                    ? t(integrationTitleKey(integrationId))
                    : t('settings.integrations.title')}
                </h2>
                <p>
                  {integrationId
                    ? t('settings.integrations.detailDesc')
                    : t('settings.integrations.desc')}
                </p>
              </div>
              <div className="settings-card__body settings-card__body--integrations">
                <SettingsIntegrationsSection
                  activeId={integrationId}
                  onSelect={selectIntegration}
                  onBack={backToIntegrationsHub}
                  isAdmin={isAdmin}
                  inauzwaConfigured={!!inauzwaStatus?.configured}
                  webhookCount={webhooks.length}
                  enabledPlugins={enabledPlugins}
                  infraConnected={infraStatus?.database?.connected}
                />
              </div>
            </div>
          )}

          {activeSection === 'data' && (
            <div className="settings-card settings-danger">
              <div className="settings-card__head">
                <h2>{t('settings.data.title')}</h2>
                <p>{t('settings.data.desc')}</p>
              </div>
              <div className="settings-card__body">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    clearUserPreferences();
                    setUserPrefs(loadUserPreferences());
                    setSaveMsg(t('settings.data.cleared'));
                    setTimeout(() => setSaveMsg(null), 2500);
                  }}
                >
                  {t('settings.data.clearPrefs')}
                </button>
                {saveMsg && <p className="settings-save-msg">{saveMsg}</p>}
              </div>
            </div>
          )}

          {activeSection === 'about' && (
            <div className="settings-card">
              <div className="settings-card__head">
                <h2>{t('settings.about.title')}</h2>
              </div>
              <div className="settings-card__body">
                <div className="settings-row">
                  <div className="settings-row__label">{t('common.appName')}</div>
                  <div className="settings-row__value">OpenWA Dashboard</div>
                </div>
                <div className="settings-row">
                  <div className="settings-row__label">{t('settings.about.apiUrl')}</div>
                  <div className="settings-row__value">/api</div>
                </div>
                <div className="settings-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => navigate('/inbox')}
                  >
                    {t('nav.inbox')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
