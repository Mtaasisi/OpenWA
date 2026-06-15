import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { ModalOverlay } from '../components/ModalOverlay';
import {
  Puzzle,
  Power,
  PowerOff,
  Settings,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Cpu,
  Database,
  Server,
  Shield,
  Zap,
  X,
} from 'lucide-react';
import { pluginsApi, infraApi, sessionApi } from '../services/api';
import type { InfraStatus, Plugin, PluginConfigPropertySchema, PluginConfigSchema } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import {
  usePluginsQuery,
  useEnginesQuery,
  useCurrentEngineQuery,
  useInfraStatusQuery,
  useSessionsQuery,
  queryKeys,
} from '../hooks/queries';
import { PageHeader } from '../components/PageHeader';
import { MaterialSymbol } from '../components/MaterialSymbol';
import { useToast } from '../components/Toast';
import { settingsPanelHref } from '../components/settings/settings-nav-registry';
import './Plugins.css';

type PluginType = 'engine' | 'storage' | 'queue' | 'auth' | 'extension';

const pluginTypeIcons: Record<PluginType, typeof Puzzle> = {
  engine: Cpu,
  storage: Database,
  queue: Server,
  auth: Shield,
  extension: Zap,
};

interface EngineConfig {
  type: string;
  headless: boolean;
  sessionDataPath: string;
  browserArgs: string;
}

function buildPluginConfigValues(
  schema: PluginConfigSchema,
  existing: Record<string, unknown>,
): Record<string, unknown> {
  const values: Record<string, unknown> = { ...existing };
  for (const [key, prop] of Object.entries(schema.properties)) {
    if (values[key] === undefined && prop.default !== undefined) {
      values[key] = prop.default;
    }
  }
  return values;
}

function formatConfigFieldValue(value: unknown, prop: PluginConfigPropertySchema): string {
  if (prop.type === 'array' && Array.isArray(value)) {
    return value.map(String).join(', ');
  }
  if (value === undefined || value === null) {
    return '';
  }
  return String(value);
}

function parseConfigFieldValue(raw: string, prop: PluginConfigPropertySchema): unknown {
  if (prop.type === 'number') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : prop.default ?? 0;
  }
  if (prop.type === 'boolean') {
    return raw === 'true';
  }
  if (prop.type === 'array') {
    if (!raw.trim()) {
      return Array.isArray(prop.default) ? prop.default : [];
    }
    return raw
      .split(/[,;\s]+/)
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => Number(s))
      .filter(n => Number.isFinite(n));
  }
  return raw;
}

function hasPluginConfigForm(plugin: Plugin): boolean {
  return plugin.type === 'engine' || Boolean(plugin.configSchema?.properties);
}

function isPluginUiActive(plugin: Plugin, currentEngine: string): boolean {
  if (plugin.type === 'engine') return plugin.id === currentEngine;
  return plugin.status === 'enabled';
}

const FALLBACK_ENGINES = [
  { id: 'whatsapp-web.js', name: 'WhatsApp Web.js' },
  { id: 'baileys', name: 'Baileys' },
];

function getSuggestedApiBaseUrl(infraStatus?: InfraStatus): string {
  if (infraStatus?.api?.baseUrl) {
    return infraStatus.api.baseUrl.replace(/\/$/, '');
  }
  const env = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (env) {
    return env.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:2785`;
  }
  return 'http://localhost:2785';
}

function buildExtensionPluginConfig(
  plugin: Plugin,
  saved: Record<string, unknown>,
  hints: { apiBaseUrl: string; apiKey: string },
): Record<string, unknown> {
  if (!plugin.configSchema) {
    return saved;
  }
  const merged: Record<string, unknown> = { ...saved };
  if (!String(merged.apiBaseUrl ?? '').trim()) {
    merged.apiBaseUrl = hints.apiBaseUrl;
  }
  if (!String(merged.apiKey ?? '').trim() && hints.apiKey) {
    merged.apiKey = hints.apiKey;
  }
  return buildPluginConfigValues(plugin.configSchema, merged);
}

const pluginInteraktIcons: Record<PluginType, string> = {
  engine: 'developer_board',
  storage: 'database',
  queue: 'dns',
  auth: 'security',
  extension: 'extension',
};

const pluginInteraktHeaderTones: Record<PluginType, string> = {
  engine: 'primary',
  storage: 'secondary',
  queue: 'secondary',
  auth: 'outline',
  extension: 'outline',
};

export function Plugins({
  embedded = false,
  interakt = false,
  searchQuery = '',
}: {
  embedded?: boolean;
  interakt?: boolean;
  searchQuery?: string;
} = {}) {
  const { t } = useTranslation();
  const modalOverlayClass = embedded
    ? 'modal-overlay settings-embed-modal-overlay'
    : 'modal-overlay';
  useDocumentTitle(t('plugins.title'));
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: plugins = [], isLoading: loadingPlugins, error: queryError } = usePluginsQuery();
  const { data: engines = [] } = useEnginesQuery();
  const { data: currentEngineData } = useCurrentEngineQuery();
  const { data: infraStatus } = useInfraStatusQuery();
  const { data: sessions = [] } = useSessionsQuery();
  const linkedSessionCount = sessions.filter(s => s.phone).length;
  const sessionsNeedingRelink = sessions.filter(s => s.requiresRelink);
  const relinkSessionCount = sessionsNeedingRelink.length;
  const currentEngine = currentEngineData?.engineType ?? 'whatsapp-web.js';
  const currentEngineLabel = engines.find(e => e.id === currentEngine)?.name ?? currentEngine;
  const enginePlugins = plugins.filter(p => p.type === 'engine');
  const engineOptions =
    engines.length > 0
      ? engines
      : enginePlugins.length > 0
        ? enginePlugins.map(p => ({ id: p.id, name: p.name }))
        : FALLBACK_ENGINES;
  const relinkChannelsHref =
    relinkSessionCount === 1
      ? `/channels?channel=whatsapp&focus=${sessionsNeedingRelink[0].id}&reconnect=1`
      : '/channels?channel=whatsapp';
  const loading = loadingPlugins;
  const error = queryError instanceof Error ? queryError.message : null;
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configPlugin, setConfigPlugin] = useState<Plugin | null>(null);
  const [engineConfig, setEngineConfig] = useState<EngineConfig>({
    type: infraStatus?.engine?.type || 'whatsapp-web.js',
    headless: infraStatus?.engine?.headless ?? true,
    sessionDataPath: '/data/sessions',
    browserArgs: '--no-sandbox --disable-gpu',
  });
  const [savingConfig, setSavingConfig] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [extensionConfig, setExtensionConfig] = useState<Record<string, unknown>>({});
  const [_configAutofillHint, setConfigAutofillHint] = useState(false);
  const [showAllFeatures, setShowAllFeatures] = useState(false);

  const refetchAll = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.plugins });
    void queryClient.invalidateQueries({ queryKey: queryKeys.engines });
    void queryClient.invalidateQueries({ queryKey: queryKeys.currentEngine });
    void queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
    void queryClient.invalidateQueries({ queryKey: ['whatsapp-safety', 'link-preflight-summary'] });
  };

  const promptEngineRestart = async (nextEngineType?: string) => {
    let relinkCount = relinkSessionCount;
    try {
      const fresh = await queryClient.fetchQuery({
        queryKey: queryKeys.sessions,
        queryFn: sessionApi.list,
      });
      relinkCount = fresh.filter(s => s.requiresRelink).length;
    } catch {
      // use cached relink count
    }
    const engineLabel =
      engines.find(e => e.id === (nextEngineType ?? currentEngine))?.name ??
      nextEngineType ??
      currentEngine;
    const message =
      nextEngineType && linkedSessionCount > 0
        ? t('plugins.config.restartConfirmEngineSwitch', {
            count: linkedSessionCount,
            engine: engineLabel,
          })
        : relinkCount > 0
          ? t('plugins.config.restartConfirmWithRelink', { count: relinkCount })
          : linkedSessionCount > 0
            ? t('plugins.config.restartConfirmWithSessions', { count: linkedSessionCount })
            : t('plugins.config.restartConfirm');
    if (!window.confirm(message)) return;
    try {
      await infraApi.restart();
      toast.info(t('plugins.config.restartingTitle'), t('plugins.config.restartingDesc'));
    } catch {
      toast.warning(t('plugins.config.restartManual'));
    }
  };

  const handleSwitchEngine = async (engineId: string) => {
    if (engineId === currentEngine) return;
    const plugin = plugins.find(p => p.id === engineId && p.type === 'engine');
    if (!plugin) return;

    setActionLoading(plugin.id);
    try {
      const result = await pluginsApi.enable(plugin.id);
      if (!result.success) {
        throw new Error(result.message);
      }
      toast.success(t('plugins.toasts.engineSwitchedTitle'), result.message);
      refetchAll();
      void queryClient.invalidateQueries({ queryKey: queryKeys.infraStatus });
      await promptEngineRestart(engineId);
    } catch (err) {
      toast.error(
        t('plugins.toasts.errorTitle'),
        err instanceof Error ? err.message : t('plugins.toasts.errorDefault'),
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggle = async (plugin: Plugin) => {
    if (plugin.type === 'engine') {
      if (isPluginUiActive(plugin, currentEngine)) {
        toast.info(t('plugins.toasts.engineAlreadyActiveTitle'), t('plugins.toasts.engineAlreadyActiveDesc'));
        return;
      }
      await handleSwitchEngine(plugin.id);
      return;
    }

    setActionLoading(plugin.id);
    try {
      if (plugin.status === 'enabled') {
        await pluginsApi.disable(plugin.id);
      } else {
        const result = await pluginsApi.enable(plugin.id);
        if (!result.success) {
          throw new Error(result.message);
        }
      }
      refetchAll();
    } catch (err) {
      toast.error(t('plugins.toasts.errorTitle'), err instanceof Error ? err.message : t('plugins.toasts.errorDefault'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleHealthCheck = async (pluginId: string) => {
    setActionLoading(pluginId);
    try {
      const result = await pluginsApi.healthCheck(pluginId);
      if (result.healthy) {
        toast.success(t('plugins.toasts.healthOk'), result.message);
      } else {
        toast.warning(t('plugins.toasts.healthFail'), result.message);
      }
    } catch (err) {
      toast.error(t('plugins.toasts.healthError'), err instanceof Error ? err.message : t('common.unknownError'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenConfig = async (plugin: Plugin) => {
    setConfigPlugin(plugin);
    setConfigAutofillHint(false);
    setShowConfigModal(true);

    if (plugin.type === 'engine') {
      setEngineConfig({
        type: infraStatus?.engine?.type || 'whatsapp-web.js',
        headless: infraStatus?.engine?.headless ?? true,
        sessionDataPath: infraStatus?.engine?.sessionDataPath || './data/sessions',
        browserArgs: infraStatus?.engine?.browserArgs || '--no-sandbox --disable-gpu',
      });
      return;
    }

    if (!plugin.configSchema?.properties) {
      setExtensionConfig({});
      return;
    }

    const hints = {
      apiBaseUrl: getSuggestedApiBaseUrl(infraStatus),
      apiKey: sessionStorage.getItem('openwa_api_key') ?? '',
    };

    setConfigLoading(true);
    try {
      const fresh = await pluginsApi.get(plugin.id);
      setConfigPlugin(fresh);
      setExtensionConfig(buildExtensionPluginConfig(fresh, fresh.config ?? {}, hints));
      setConfigAutofillHint(
        !String(fresh.config?.apiKey ?? '').trim() && Boolean(hints.apiKey) && !String(fresh.config?.apiBaseUrl ?? '').trim(),
      );
    } catch {
      setExtensionConfig(buildExtensionPluginConfig(plugin, plugin.config ?? {}, hints));
      setConfigAutofillHint(
        !String(plugin.config?.apiKey ?? '').trim() && Boolean(hints.apiKey) && !String(plugin.config?.apiBaseUrl ?? '').trim(),
      );
    } finally {
      setConfigLoading(false);
    }
  };

  const updateExtensionField = (key: string, raw: string, prop: PluginConfigPropertySchema) => {
    setExtensionConfig(prev => ({
      ...prev,
      [key]: parseConfigFieldValue(raw, prop),
    }));
  };

  const handleSaveConfig = async () => {
    if (!configPlugin) return;
    setSavingConfig(true);
    try {
      if (configPlugin.type === 'engine') {
        const previousType = infraStatus?.engine?.type || 'whatsapp-web.js';
        await infraApi.saveConfig({
          engine: {
            type: engineConfig.type,
            headless: engineConfig.headless,
            sessionDataPath: engineConfig.sessionDataPath,
            browserArgs: engineConfig.browserArgs,
          },
        });
        toast.success(t('plugins.toasts.savedTitle'), t('plugins.toasts.savedDesc'));
        void queryClient.invalidateQueries({ queryKey: queryKeys.infraStatus });
        if (engineConfig.type !== previousType) {
          await promptEngineRestart(engineConfig.type);
        }
      } else {
        const result = await pluginsApi.updateConfig(configPlugin.id, extensionConfig);
        if (!result.success) {
          throw new Error(result.message);
        }
        toast.success(t('plugins.toasts.savedTitle'), t('plugins.toasts.pluginConfigSavedDesc'));
      }
      setShowConfigModal(false);
      refetchAll();
    } catch (err) {
      toast.error(t('plugins.toasts.saveFailed'), err instanceof Error ? err.message : t('common.unknownError'));
    } finally {
      setSavingConfig(false);
    }
  };

  const renderEnginePluginCard = (plugin: Plugin) => {
    const pluginType = plugin.type as PluginType;
    const tone = pluginInteraktHeaderTones[pluginType] ?? 'outline';
    const isLoading = actionLoading === plugin.id;
    const isActive = isPluginUiActive(plugin, currentEngine);
    const sourceLabel = plugin.builtIn ? t('plugins.builtIn') : 'Community';

    return (
      <div
        key={plugin.id}
        role="radio"
        aria-checked={isActive}
        tabIndex={isActive ? 0 : -1}
        className={`plugins-interakt-card plugins-interakt-card--engine${isActive ? ' plugins-interakt-card--selected' : ''}`}
        onClick={() => {
          if (!isActive && !isLoading) void handleSwitchEngine(plugin.id);
        }}
        onKeyDown={e => {
          if ((e.key === 'Enter' || e.key === ' ') && !isActive && !isLoading) {
            e.preventDefault();
            void handleSwitchEngine(plugin.id);
          }
        }}
      >
        <div className={`plugins-interakt-card__hero plugins-interakt-card__hero--${tone}`}>
          <MaterialSymbol name={pluginInteraktIcons[pluginType] ?? 'extension'} size={32} />
          {plugin.builtIn ? (
            <span className="plugins-interakt-card__badge">{t('plugins.builtIn')}</span>
          ) : null}
        </div>
        <div className="plugins-interakt-card__body">
          <div className="plugins-interakt-card__row">
            <h6>{plugin.name}</h6>
            {isActive ? (
              <span className="plugins-interakt-card__active-pill">{t('plugins.active')}</span>
            ) : (
              <button
                type="button"
                className="plugins-interakt-card__use-btn"
                disabled={isLoading}
                onClick={e => {
                  e.stopPropagation();
                  void handleSwitchEngine(plugin.id);
                }}
              >
                {isLoading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  t('plugins.useEngine')
                )}
              </button>
            )}
          </div>
          <p className="plugins-interakt-card__meta">
            v{plugin.version} · {sourceLabel}
          </p>
          <p className="plugins-interakt-card__desc">
            {plugin.description || t('plugins.noDescription')}
          </p>
          <div className="plugins-interakt-card__actions">
            <button
              type="button"
              className="plugins-interakt-card__icon-btn"
              title={t('plugins.healthCheck')}
              onClick={e => {
                e.stopPropagation();
                void handleHealthCheck(plugin.id);
              }}
              disabled={isLoading}
            >
              <MaterialSymbol name="list_alt" size={16} />
            </button>
            <button
              type="button"
              className="plugins-interakt-card__icon-btn"
              title={t('plugins.configure')}
              onClick={e => {
                e.stopPropagation();
                void handleOpenConfig(plugin);
              }}
              disabled={isLoading}
            >
              <MaterialSymbol name="settings" size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderOtherPluginCard = (plugin: Plugin) => {
    const pluginType = plugin.type as PluginType;
    const tone = pluginInteraktHeaderTones[pluginType] ?? 'outline';
    const isLoading = actionLoading === plugin.id;
    const sourceLabel = plugin.builtIn
      ? t('plugins.builtIn')
      : plugin.type === 'extension'
        ? 'External'
        : 'Community';

    return (
      <div key={plugin.id} className="plugins-interakt-card">
        <div className={`plugins-interakt-card__hero plugins-interakt-card__hero--${tone}`}>
          <MaterialSymbol name={pluginInteraktIcons[pluginType] ?? 'extension'} size={32} />
          {plugin.builtIn ? (
            <span className="plugins-interakt-card__badge">{t('plugins.builtIn')}</span>
          ) : null}
        </div>
        <div className="plugins-interakt-card__body">
          <div className="plugins-interakt-card__row">
            <h6>{plugin.name}</h6>
            <label className="plugins-interakt-toggle">
              <input
                type="checkbox"
                checked={plugin.status === 'enabled'}
                disabled={isLoading}
                onChange={() => void handleToggle(plugin)}
              />
              <span className="plugins-interakt-toggle__track" />
            </label>
          </div>
          <p className="plugins-interakt-card__meta">
            v{plugin.version} · {sourceLabel}
          </p>
          <p className="plugins-interakt-card__desc">
            {plugin.description || t('plugins.noDescription')}
          </p>
          <div className="plugins-interakt-card__actions">
            <button
              type="button"
              className="plugins-interakt-card__icon-btn"
              title={t('plugins.healthCheck')}
              onClick={() => void handleHealthCheck(plugin.id)}
              disabled={isLoading}
            >
              <MaterialSymbol name="list_alt" size={16} />
            </button>
            <button
              type="button"
              className="plugins-interakt-card__icon-btn"
              title={t('plugins.configure')}
              onClick={() => void handleOpenConfig(plugin)}
              disabled={isLoading}
            >
              <MaterialSymbol name="settings" size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div
        className="plugins-page"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}
      >
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  const activeEngine = engines.find(e => e.id === currentEngine);

  const relinkBanner =
    relinkSessionCount > 0 ? (
      <div className="plugins-relink-banner" role="status">
        <AlertCircle size={20} aria-hidden />
        <div className="plugins-relink-banner__content">
          <strong>
            {t('plugins.relinkBanner.title', { count: relinkSessionCount, engine: currentEngineLabel })}
          </strong>
          <p className="plugins-relink-banner__sessions">
            {sessionsNeedingRelink
              .slice(0, 3)
              .map(s => s.name)
              .join(', ')}
            {relinkSessionCount > 3
              ? t('plugins.relinkBanner.more', { count: relinkSessionCount - 3 })
              : null}
          </p>
        </div>
        <div className="plugins-relink-banner__actions">
          <Link
            className="plugins-relink-banner__action btn-sm"
            to={settingsPanelHref('whatsapp-safety', { waTab: 'overview' })}
          >
            {t('whatsappLinkSafety.bannerAction')}
          </Link>
          <Link className="plugins-relink-banner__action btn-sm" to={relinkChannelsHref}>
            {t('plugins.relinkBanner.action')}
          </Link>
        </div>
      </div>
    ) : null;

  const filteredPlugins = searchQuery.trim()
    ? plugins.filter(plugin => {
        const q = searchQuery.trim().toLowerCase();
        return (
          plugin.name.toLowerCase().includes(q) ||
          (plugin.description ?? '').toLowerCase().includes(q) ||
          plugin.type.toLowerCase().includes(q)
        );
      })
    : plugins;

  const enginePluginItems = filteredPlugins.filter(plugin => plugin.type === 'engine');
  const otherPluginItems = filteredPlugins.filter(plugin => plugin.type !== 'engine');

  if (interakt) {
    return (
      <div className="plugins-page plugins-page--interakt settings-embed">
        {error ? (
          <div className="error-banner">
            <AlertCircle size={20} />
            <span className="error-banner-text">{error}</span>
          </div>
        ) : null}

        <section className="plugins-interakt-engine">
          <div className="plugins-interakt-engine__glow" aria-hidden />
          <div className="plugins-interakt-engine__inner">
            <div className="plugins-interakt-engine__main">
              <div className="plugins-interakt-engine__icon">
                <MaterialSymbol name="token" size={32} />
              </div>
              <div>
                <div className="plugins-interakt-engine__title-row">
                  <h4>{t('plugins.engineCard')}</h4>
                  <span className="plugins-interakt-engine__status">
                    <span className="plugins-interakt-engine__status-dot" />
                    {t('plugins.running')}
                  </span>
                </div>
                <div className="plugins-interakt-engine__switch-row">
                  <label className="plugins-interakt-engine__switch-label" htmlFor="active-engine-select">
                    {t('plugins.switchEngine')}
                  </label>
                  <select
                    id="active-engine-select"
                    className="plugins-interakt-engine__select"
                    value={currentEngine}
                    disabled={Boolean(actionLoading)}
                    onChange={e => void handleSwitchEngine(e.target.value)}
                  >
                    {engineOptions.map(engine => (
                      <option key={engine.id} value={engine.id}>
                        {engine.name}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="plugins-interakt-engine__switch-hint">{t('plugins.switchEngineHint')}</p>
                <p className="plugins-interakt-engine__switch-note">{t('plugins.switchRelinkNote')}</p>
                {activeEngine && activeEngine.features.length > 0 ? (
                  <div className="plugins-interakt-engine__features">
                    <p className="plugins-interakt-engine__features-label">
                      {t('plugins.supportedFeatures')}
                    </p>
                    <div className="plugins-interakt-engine__feature-tags">
                      {(showAllFeatures ? activeEngine.features : activeEngine.features.slice(0, 6)).map(
                        feature => (
                          <span key={feature} className="plugins-interakt-feature-tag">
                            {feature}
                          </span>
                        ),
                      )}
                      {activeEngine.features.length > 6 ? (
                        <button
                          type="button"
                          className="plugins-interakt-feature-more"
                          onClick={() => setShowAllFeatures(v => !v)}
                        >
                          {showAllFeatures
                            ? t('plugins.showLess')
                            : t('plugins.more', { count: activeEngine.features.length - 6 })}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              className="plugins-interakt-engine__settings"
              title={t('plugins.configure')}
              onClick={() => {
                const enginePlugin = plugins.find(p => p.type === 'engine');
                if (enginePlugin) void handleOpenConfig(enginePlugin);
              }}
            >
              <MaterialSymbol name="settings" size={20} />
            </button>
          </div>
        </section>

        {relinkBanner}

        <section className="plugins-interakt-section">
          <div className="plugins-interakt-section__head">
            <h5>{t('plugins.installed')}</h5>
          </div>
          {enginePluginItems.length > 0 ? (
            <div
              className="plugins-interakt-engine-picker"
              role="radiogroup"
              aria-label={t('plugins.defaultEngineLabel')}
            >
              <p className="plugins-interakt-engine-picker__label">{t('plugins.defaultEngineLabel')}</p>
              <div className="plugins-interakt-grid plugins-interakt-grid--engines">
                {enginePluginItems.map(renderEnginePluginCard)}
              </div>
            </div>
          ) : null}
          {otherPluginItems.length > 0 ? (
            <div className="plugins-interakt-grid">
              {otherPluginItems.map(renderOtherPluginCard)}
            </div>
          ) : null}
        </section>

        {filteredPlugins.length === 0 && !loading ? (
          <div className="plugins-interakt-empty">
            <MaterialSymbol name="extension_off" size={40} />
            <p>
              {searchQuery.trim()
                ? t('plugins.searchNoResults')
                : t('plugins.empty.description')}
            </p>
          </div>
        ) : null}

        {showConfigModal && configPlugin ? renderConfigModal() : null}
      </div>
    );
  }

  function renderConfigModal() {
    if (!configPlugin) return null;
    return (
      <ModalOverlay onClose={() => setShowConfigModal(false)} className={modalOverlayClass}>
        <div className="modal config-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2>{t('plugins.config.title', { name: configPlugin.name })}</h2>
            <button className="btn-icon" type="button" onClick={() => setShowConfigModal(false)}>
              <X size={20} />
            </button>
          </div>
          <div className="modal-body">
            {configPlugin.type === 'engine' ? (
              <>
                <div className="config-info-banner">
                  <AlertCircle size={16} />
                  <span>{t('plugins.config.restartNotice')}</span>
                </div>
                <div className="config-form">
                  <div className="form-group">
                    <label>{t('plugins.config.engineType')}</label>
                    <select
                      value={engineConfig.type}
                      onChange={e => setEngineConfig({ ...engineConfig, type: e.target.value })}
                    >
                      {(engines.length > 0
                        ? engines
                        : [
                            { id: 'whatsapp-web.js', name: 'WhatsApp Web.js' },
                            { id: 'baileys', name: 'Baileys' },
                          ]
                      ).map(engine => (
                        <option key={engine.id} value={engine.id}>
                          {engine.name}
                        </option>
                      ))}
                    </select>
                    {engineConfig.type === 'baileys' && (
                      <small className="form-hint">{t('plugins.config.baileysHint')}</small>
                    )}
                  </div>
                  <div className="form-group">
                    <label>{t('plugins.config.sessionDataPath')}</label>
                    <input
                      type="text"
                      value={engineConfig.sessionDataPath}
                      onChange={e => setEngineConfig({ ...engineConfig, sessionDataPath: e.target.value })}
                    />
                  </div>
                  {engineConfig.type !== 'baileys' && (
                    <>
                      <div className="form-group toggle-group">
                        <div className="toggle-info">
                          <label>{t('plugins.config.headless')}</label>
                          <small>{t('plugins.config.headlessDesc')}</small>
                        </div>
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={engineConfig.headless}
                            onChange={e => setEngineConfig({ ...engineConfig, headless: e.target.checked })}
                          />
                          <span className="toggle-slider" />
                        </label>
                      </div>
                      <div className="form-group">
                        <label>{t('plugins.config.browserArgs')}</label>
                        <input
                          type="text"
                          value={engineConfig.browserArgs}
                          onChange={e => setEngineConfig({ ...engineConfig, browserArgs: e.target.value })}
                        />
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : configPlugin.configSchema?.properties ? (
              configLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                  <Loader2 className="animate-spin" size={28} />
                </div>
              ) : (
                <div className="config-form">
                  {Object.entries(configPlugin.configSchema.properties).map(([key, prop]) => (
                    <div key={key} className="form-group">
                      <label htmlFor={`plugin-cfg-${key}`}>{prop.title ?? key}</label>
                      {prop.description ? <small className="form-hint">{prop.description}</small> : null}
                      <input
                        id={`plugin-cfg-${key}`}
                        type={prop.secret ? 'password' : prop.type === 'number' ? 'number' : 'text'}
                        value={formatConfigFieldValue(extensionConfig[key], prop)}
                        onChange={e => updateExtensionField(key, e.target.value, prop)}
                      />
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="no-config">
                <Settings size={48} style={{ opacity: 0.3 }} />
                <p>{t('plugins.config.noOptions')}</p>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button className="btn-secondary" type="button" onClick={() => setShowConfigModal(false)}>
              {t('common.cancel')}
            </button>
            {hasPluginConfigForm(configPlugin) ? (
              <button className="btn-primary" type="button" onClick={() => void handleSaveConfig()} disabled={savingConfig}>
                {savingConfig ? <Loader2 size={16} className="animate-spin" /> : t('plugins.config.save')}
              </button>
            ) : null}
          </div>
        </div>
      </ModalOverlay>
    );
  }

  return (
    <div className={`plugins-page ${embedded ? 'settings-embed' : ''}`}>
      {embedded ? (
        <div className="settings-embed-toolbar">
          <button className="fu-btn fu-btn--ghost" type="button" onClick={refetchAll}>
            <RefreshCw size={16} />
            {t('plugins.refresh')}
          </button>
        </div>
      ) : (
        <PageHeader
          title={t('plugins.title')}
          subtitle={t('plugins.subtitle')}
          actions={
            <button className="btn-secondary" type="button" onClick={refetchAll}>
              <RefreshCw size={16} />
              {t('plugins.refresh')}
            </button>
          }
        />
      )}

      {error && (
        <div className="error-banner">
          <AlertCircle size={20} />
          <span className="error-banner-text">{error}</span>
        </div>
      )}

      <div className="engine-card">
        <div className="engine-header">
          <div className="engine-info">
            <div className="engine-icon-wrapper">
              <Cpu size={24} />
            </div>
            <div>
              <h3 className="engine-title">{t('plugins.engineCard')}</h3>
              <span className="engine-name">{currentEngineLabel}</span>
            </div>
          </div>
          <div className="engine-header-actions">
            <select
              className="engine-switch-select"
              value={currentEngine}
              disabled={Boolean(actionLoading)}
              onChange={e => void handleSwitchEngine(e.target.value)}
              aria-label={t('plugins.switchEngine')}
            >
              {engineOptions.map(engine => (
                <option key={engine.id} value={engine.id}>
                  {engine.name}
                </option>
              ))}
            </select>
            <span className="status-badge connected">{t('plugins.running')}</span>
          </div>
        </div>
        <p className="engine-switch-hint">{t('plugins.switchEngineHint')}</p>

        {relinkBanner}

        {activeEngine && activeEngine.features.length > 0 && (
          <div className="engine-features">
            <p className="features-label">{t('plugins.supportedFeatures')}</p>
            <div className="features-list">
              {(showAllFeatures ? activeEngine.features : activeEngine.features.slice(0, 8)).map(feature => (
                <span key={feature} className="feature-tag">
                  {feature}
                </span>
              ))}
              {activeEngine.features.length > 8 && (
                <button
                  type="button"
                  className="feature-more"
                  onClick={() => setShowAllFeatures(v => !v)}
                >
                  {showAllFeatures
                    ? t('plugins.showLess')
                    : t('plugins.more', { count: activeEngine.features.length - 8 })}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="plugins-grid">
        {plugins.map(plugin => {
          const TypeIcon = pluginTypeIcons[plugin.type as PluginType] || Puzzle;
          const isLoading = actionLoading === plugin.id;

          return (
            <div key={plugin.id} className="plugin-card">
              <div className={`plugin-card-header type-${plugin.type}`}>
                <div className="plugin-info">
                  <div className="plugin-icon-wrapper">
                    <TypeIcon size={20} />
                  </div>
                  <div>
                    <h3 className="plugin-name">{plugin.name}</h3>
                    <span className="plugin-version">v{plugin.version}</span>
                  </div>
                </div>
                {plugin.builtIn && <span className="plugin-builtin-badge">{t('plugins.builtIn')}</span>}
              </div>

              <div className="plugin-card-body">
                <p className="plugin-description">{plugin.description || t('plugins.noDescription')}</p>

                <div className="plugin-status-row">
                  <div className="plugin-status">
                    <span
                      className={`status-dot ${
                        plugin.type === 'engine'
                          ? isPluginUiActive(plugin, currentEngine)
                            ? 'enabled'
                            : 'disabled'
                          : plugin.status
                      }`}
                    />
                    <span className="status-text">
                      {plugin.type === 'engine'
                        ? isPluginUiActive(plugin, currentEngine)
                          ? t('plugins.active')
                          : t('plugins.engineAvailable')
                        : plugin.status}
                    </span>
                  </div>
                  <span className="plugin-type-label">{plugin.type}</span>
                </div>

                {plugin.error && (
                  <div className="plugin-error">
                    <p className="plugin-error-text">{plugin.error}</p>
                  </div>
                )}

                {plugin.provides && plugin.provides.length > 0 && (
                  <div className="plugin-provides">
                    {plugin.provides.map(item => (
                      <span key={item} className="provides-tag">
                        {item}
                      </span>
                    ))}
                  </div>
                )}

                <div className="plugin-actions">
                  {plugin.type === 'engine' ? (
                    (() => {
                      const isOnlyEngine = enginePlugins.length === 1;
                      const isActive = isPluginUiActive(plugin, currentEngine);

                      if (isOnlyEngine && isActive) {
                        return (
                          <span className="btn-required">
                            <CheckCircle size={16} />
                            {t('plugins.required')}
                          </span>
                        );
                      } else if (isActive) {
                        return (
                          <span className="btn-active">
                            <CheckCircle size={16} />
                            {t('plugins.active')}
                          </span>
                        );
                      } else {
                        return (
                          <button
                            onClick={() => handleToggle(plugin)}
                            disabled={isLoading}
                            className="btn-toggle enable"
                          >
                            {isLoading ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <>
                                <Power size={16} />
                                {t('plugins.activate')}
                              </>
                            )}
                          </button>
                        );
                      }
                    })()
                  ) : (
                    <button
                      onClick={() => handleToggle(plugin)}
                      disabled={isLoading}
                      className={`btn-toggle ${plugin.status === 'enabled' ? 'disable' : 'enable'}`}
                    >
                      {isLoading ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : plugin.status === 'enabled' ? (
                        <>
                          <PowerOff size={16} />
                          {t('plugins.disable')}
                        </>
                      ) : (
                        <>
                          <Power size={16} />
                          {t('plugins.enable')}
                        </>
                      )}
                    </button>
                  )}

                  <button
                    onClick={() => handleHealthCheck(plugin.id)}
                    disabled={isLoading}
                    className="btn-action"
                    title={t('plugins.healthCheck')}
                  >
                    <CheckCircle size={16} />
                  </button>

                  <button className="btn-action" title={t('plugins.configure')} onClick={() => handleOpenConfig(plugin)}>
                    <Settings size={16} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {plugins.length === 0 && !loading && (
        <div className="empty-state">
          <Puzzle size={64} />
          <h3>{t('plugins.empty.title')}</h3>
          <p>{t('plugins.empty.description')}</p>
        </div>
      )}

      {showConfigModal && configPlugin ? renderConfigModal() : null}
    </div>
  );
}

export default Plugins;
