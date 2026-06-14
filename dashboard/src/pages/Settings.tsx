import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useRole } from '../hooks/useRole';
import { useQuickReplyPermissions } from '../hooks/useQuickReplyPermissions';
import { useFollowupPermissions } from '../hooks/useFollowupPermissions';
import { useAiCostPermissions } from '../hooks/useAiCostPermissions';
import {
  useSettingsQuery,
  useUpdateSettingsMutation,
  useSessionsQuery,
  queryKeys,
} from '../hooks/queries';
import { productsApi, aiApi, followupApi, type Settings } from '../services/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { performLogout } from '../lib/logout';
import {
  loadUserPreferences,
  saveUserPreferences,
  type InboxConversationFilterPref,
} from '../lib/user-preferences';
import type { SupportedLanguage } from '../i18n';
import {
  getSettingsReturnTo,
  isSettingsPath,
  rememberSettingsReturnTo,
} from '../lib/settings-return';
import {
  type SettingsPanelId,
  PANEL_REGISTRY,
  panelAllowsAccess,
  resolveSettingsParams,
  needsSettingsUrlCanonicalization,
  canonicalizeSettingsSearchParams,
} from '../components/settings/settings-nav-registry';
import { buildSettingsCategoryParams } from '../components/settings/settings-routing';
import {
  automationsHrefForSettingsPanel,
  isAutomationsSettingsPanel,
} from '../lib/automations-routes';
import { SettingsShell } from '../components/settings/SettingsShell';
import { SettingsPanelsRouter } from '../components/settings/SettingsPanelsRouter';
import { SettingsMovedBanner } from '../components/settings/SettingsMovedBanner';
import { SettingsPageProvider } from '../components/settings/settings-page-context';
import { SettingsInlinePanel } from '../components/settings/inline/SettingsInlinePanel';
import { SettingsCategoryHub } from '../components/settings/shell/SettingsCategoryHub';
import { useSettingsSearch } from '../components/settings/settings-search-context';
import { MaterialSymbol } from '../components/MaterialSymbol';
import {
  findCategoryItem,
  itemAllowsAccess,
  itemResolvesToPanel,
} from '../components/settings/settings-categories-registry';
import type { SettingsCategoryId, SettingsItem } from '../components/settings/settings-types';
import { whatsappSafetyTabHref } from '../components/settings/settings-routing';
import './Settings.css';
import '../components/settings/settings-whatsapp.css';

const INBOX_FILTER_OPTIONS: InboxConversationFilterPref[] = [
  'all',
  'unread',
  'overdue',
  'ai_active',
  'assigned_to_me',
  'needs_reply',
  'needs_human',
  'ai_opt_out',
  'private',
  'groups',
  'resolved',
];

export function Settings() {
  const { t, i18n } = useTranslation();
  useDocumentTitle(t('settings.title'));
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { role, isAdmin } = useRole();
  const { canManage: canManageQuickReplies } = useQuickReplyPermissions();
  const { canManageMessageTemplates } = useFollowupPermissions();
  const { canView: canViewAiCost, canManage: canManageAiCost, isLoading: aiCostPermsLoading } =
    useAiCostPermissions();
  const queryClient = useQueryClient();

  const resolved = useMemo(() => resolveSettingsParams(searchParams), [searchParams]);
  const activeCategory = resolved.category;
  const activePanel = resolved.panel;
  const activeItemId = resolved.item;

  useEffect(() => {
    const from = (location.state as { from?: string } | null)?.from;
    if (from && !isSettingsPath(from)) {
      rememberSettingsReturnTo(from);
    }
  }, [location.state]);

  useEffect(() => {
    if (!needsSettingsUrlCanonicalization(searchParams)) return;
    setSearchParams(canonicalizeSettingsSearchParams(searchParams), { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (activeCategory) return;
    if (searchParams.get('section') || searchParams.get('panel') || searchParams.get('integration')) return;
    setSearchParams(buildSettingsCategoryParams('profile', null, null), { replace: true });
  }, [activeCategory, searchParams, setSearchParams]);

  const navAccess = useMemo(
    () => ({
      isAdmin,
      canManageQuickReplies,
      canManageMessageTemplates,
      canViewAiCost,
      canManageAiCost,
    }),
    [
      isAdmin,
      canManageQuickReplies,
      canManageMessageTemplates,
      canViewAiCost,
      canManageAiCost,
    ],
  );

  useEffect(() => {
    if (!activePanel) return;
    if (isAutomationsSettingsPanel(activePanel)) {
      navigate(automationsHrefForSettingsPanel(activePanel), { replace: true });
      return;
    }
    if (
      aiCostPermsLoading &&
      (activePanel === 'ai-usage' || PANEL_REGISTRY[activePanel]?.aiCostView)
    ) {
      return;
    }
    if (!panelAllowsAccess(activePanel, navAccess)) {
      setSearchParams(
        buildSettingsCategoryParams(activeCategory ?? 'profile', null, null),
        { replace: true },
      );
    }
  }, [activePanel, navAccess, navigate, activeCategory, setSearchParams, aiCostPermsLoading]);

  const settingsSearch = useSettingsSearch();
  const [localNavSearch] = useState('');
  const navSearch = settingsSearch?.navSearch ?? localNavSearch;

  const storedUser = (() => {
    try {
      const raw = sessionStorage.getItem('openwa_user');
      return raw ? (JSON.parse(raw) as { name: string; email: string }) : null;
    } catch {
      return null;
    }
  })();
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [userPrefs, setUserPrefs] = useState(() => loadUserPreferences());
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const { data: serverSettings, isLoading: loadingSettings } = useSettingsQuery();
  const updateSettings = useUpdateSettingsMutation();
  const { data: allSessions = [] } = useSessionsQuery();
  const { data: inauzwaStatus } = useQuery({
    queryKey: ['products', 'inauzwa-status'],
    queryFn: () => productsApi.inauzwaSyncStatus(),
  });
  const { data: aiConfig } = useQuery({
    queryKey: ['ai-config'],
    queryFn: () => aiApi.getConfig(),
  });
  const { data: aiStatus } = useQuery({
    queryKey: ['ai-status'],
    queryFn: () => aiApi.getStatus(),
    enabled: Boolean(aiConfig?.apiKeySet),
    staleTime: 60_000,
  });
  const { data: followupStaff = [] } = useQuery({
    queryKey: ['followups', 'staff'],
    queryFn: () => followupApi.listStaff(),
    staleTime: 60_000,
  });

  const aiMeta = useMemo(() => {
    if (!aiConfig?.apiKeySet) return t('ai.settings.configuredOff');
    if (!aiConfig.enabled) return t('ai.settings.configuredDisabled');
    if (aiConfig.testStatus === 'error') return t('ai.settings.configuredError');
    const base = t('ai.settings.configuredOn');
    if (!aiStatus) return base;
    return `${base} · ${t('ai.settings.configuredIndexHint', {
      memoryChunks: aiStatus.memory.chunks,
      knowledgeChunks: aiStatus.knowledge.chunks,
      vector: aiStatus.memory.vectorSearch ? t('ai.settings.vectorOn') : '',
    })}`;
  }, [aiConfig, aiStatus, t]);

  const [serverDraft, setServerDraft] = useState<Settings | null>(null);

  useEffect(() => {
    if (serverSettings && 'general' in serverSettings && 'notifications' in serverSettings) {
      setServerDraft(serverSettings);
    }
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

  const roleLabel =
    role === 'admin'
      ? t('settings.roleAdmin')
      : role === 'operator'
        ? t('settings.roleOperator')
        : role === 'viewer'
          ? t('settings.roleViewer')
          : '—';

  const currentLang = (i18n.resolvedLanguage || i18n.language || 'en').split('-')[0] as SupportedLanguage;

  const patchServer = (patch: {
    general?: Partial<Settings['general']>;
    api?: Partial<Settings['api']>;
    notifications?: Partial<Settings['notifications']>;
  }) => {
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

  const connectedSessions = allSessions.filter(s => s.status === 'ready').length;
  const sessionAlert =
    allSessions.length > 0 && connectedSessions === 0 ? t('settings.shell.noSessionAlert') : null;

  const selectCategory = (categoryId: SettingsCategoryId) => {
    setSearchParams(buildSettingsCategoryParams(categoryId, null, null), { replace: true });
  };

  const backToCategoryHub = () => {
    if (activeCategory) {
      setSearchParams(buildSettingsCategoryParams(activeCategory, null, null), { replace: true });
    }
  };

  const navigateToItem = (categoryId: SettingsCategoryId, item: SettingsItem) => {
    if (item.id === 'logout') {
      performLogout();
      return;
    }
    if (item.kind.kind === 'route') {
      navigate(item.kind.path);
      return;
    }
    if (item.kind.kind === 'safetyTab') {
      navigate(whatsappSafetyTabHref(item.kind.tab));
      return;
    }
    const panelId = itemResolvesToPanel(item);
    if (panelId) {
      setSearchParams(
        buildSettingsCategoryParams(categoryId, item.id, panelId),
        { replace: false },
      );
      return;
    }
    setSearchParams(buildSettingsCategoryParams(categoryId, item.id, null), { replace: false });
  };

  const selectPanel = (id: SettingsPanelId) => {
    const section = PANEL_REGISTRY[id].section;
    void section;
    const category = resolved.category ?? 'profile';
    setSearchParams(buildSettingsCategoryParams(category, activeItemId, id));
  };

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(getSettingsReturnTo('/inbox'));
  };

  const activeItem =
    activeCategory && activeItemId
      ? findCategoryItem(activeCategory, activeItemId)
      : undefined;

  const inlineId =
    activeItem?.kind.kind === 'inline' ? activeItem.kind.inlineId : null;

  const showSaveBar =
    !activePanel &&
    Boolean(
      inlineId &&
        ['inbox-preferences', 'product-send-rules', 'notifications', 'business-profile', 'appearance'].includes(
          inlineId,
        ),
    );

  const handleSave = () => {
    if (inlineId === 'notifications' && isAdmin && serverDraft) {
      saveInboxPrefs();
      void saveServerSettings();
      return;
    }
    if (inlineId === 'business-profile') {
      void saveServerSettings();
      return;
    }
    saveInboxPrefs();
  };

  const pageContextValue = {
    role,
    isAdmin,
    roleLabel,
    storedUser,
    apiOnline,
    userPrefs,
    setUserPrefs,
    serverDraft,
    serverReadOnly: !isAdmin,
    loadingSettings,
    patchServer,
    allSessions,
    followupStaff,
    inauzwaStatus,
    aiMeta,
    currentLang,
    onLanguageChange: (lang: SupportedLanguage) => {
      void i18n.changeLanguage(lang);
    },
    saveMsg,
    setSaveMsg,
    onLogout: performLogout,
    onSelectPanel: selectPanel,
    onNavigateAutoReply: () => selectPanel('ai-auto-reply'),
    inboxFilterOptions: INBOX_FILTER_OPTIONS,
  };

  const pluginsRefreshButton =
    activePanel === 'plugins' ? (
      <button
        type="button"
        className="settings-wa__btn-secondary"
        onClick={() => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.plugins });
          void queryClient.invalidateQueries({ queryKey: queryKeys.engines });
          void queryClient.invalidateQueries({ queryKey: queryKeys.currentEngine });
        }}
      >
        <MaterialSymbol name="refresh" size={18} />
        {t('plugins.refresh')}
      </button>
    ) : null;

  const renderContent = () => {
    if (!activeCategory) {
      return null;
    }
    if (activePanel) {
      return (
        <>
          {pluginsRefreshButton}
          <SettingsPanelsRouter
            panelId={activePanel}
            onBack={backToCategoryHub}
            isAdmin={isAdmin}
            pluginSearch={navSearch}
          />
        </>
      );
    }
    if (inlineId) {
      return (
        <SettingsPageProvider value={pageContextValue}>
          <SettingsInlinePanel
            inlineId={inlineId}
            pageTitle={activeItem ? t(activeItem.titleKey) : ''}
            pageIcon={activeItem?.icon}
            onSelectPanel={selectPanel}
          />
        </SettingsPageProvider>
      );
    }
    return (
      <SettingsPageProvider value={pageContextValue}>
        <SettingsCategoryHub
          categoryId={activeCategory}
          access={navAccess}
          onSelectItem={item => {
            if (!itemAllowsAccess(item, navAccess)) return;
            navigateToItem(activeCategory, item);
          }}
        />
      </SettingsPageProvider>
    );
  };

  return (
    <SettingsPageProvider value={pageContextValue}>
      <SettingsShell
        activeCategory={activeCategory}
        activeItemId={activeItemId}
        activePanel={activePanel}
        navSearch={navSearch}
        onSelectCategory={selectCategory}
        onSelectItem={(categoryId, item) => {
          if (!itemAllowsAccess(item, navAccess)) return;
          navigateToItem(categoryId, item);
        }}
        onBackCategory={() => {
          if (activeCategory) {
            setSearchParams(buildSettingsCategoryParams(activeCategory, null, null), { replace: true });
          }
        }}
        onBack={goBack}
        onLogout={performLogout}
        backAriaLabel={t('settings.shell.backToWorkspace')}
        access={navAccess}
        alertMessage={sessionAlert}
        showSaveBar={showSaveBar}
        onSave={handleSave}
        onCancel={() => {
          if (serverSettings) setServerDraft(serverSettings);
          setUserPrefs(loadUserPreferences());
        }}
        saving={updateSettings.isPending}
        saveDisabled={!isAdmin && inlineId === 'business-profile'}
      >
        <SettingsMovedBanner />
        {renderContent()}
      </SettingsShell>
    </SettingsPageProvider>
  );
}
