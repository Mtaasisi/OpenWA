import { Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Package,
  Webhook,
  Puzzle,
  Server,
  KeyRound,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import type { SettingsIntegrationId } from './settings-integrations';
import { SettingsIntegrationBack } from './SettingsIntegrationBack';
import { InauzwaIntegrationPanel } from './InauzwaIntegrationPanel';

const Webhooks = lazy(() => import('../../pages/Webhooks').then(m => ({ default: m.Webhooks })));
const Plugins = lazy(() => import('../../pages/Plugins').then(m => ({ default: m.Plugins })));
const Infrastructure = lazy(() =>
  import('../../pages/Infrastructure').then(m => ({ default: m.Infrastructure })),
);
const ApiKeys = lazy(() => import('../../pages/ApiKeys').then(m => ({ default: m.ApiKeys })));

type HubItem = {
  id: SettingsIntegrationId;
  icon: typeof Package;
  titleKey: string;
  meta: string;
  adminOnly?: boolean;
};

interface Props {
  activeId: SettingsIntegrationId | null;
  onSelect: (id: SettingsIntegrationId) => void;
  onBack: () => void;
  isAdmin: boolean;
  inauzwaConfigured: boolean;
  webhookCount: number;
  enabledPlugins: number;
  infraConnected: boolean | undefined;
}

export function SettingsIntegrationsSection({
  activeId,
  onSelect,
  onBack,
  isAdmin,
  inauzwaConfigured,
  webhookCount,
  enabledPlugins,
  infraConnected,
}: Props) {
  const { t } = useTranslation();

  const hubItems: HubItem[] = [
    {
      id: 'products',
      icon: Package,
      titleKey: 'settings.integrations.productsTitle',
      meta: inauzwaConfigured
        ? t('settings.integrations.inauzwaOn')
        : t('settings.integrations.inauzwaOff'),
    },
    {
      id: 'webhooks',
      icon: Webhook,
      titleKey: 'nav.webhooks',
      meta: t('settings.integrations.webhookCount', { count: webhookCount }),
    },
    {
      id: 'plugins',
      icon: Puzzle,
      titleKey: 'nav.plugins',
      meta: t('settings.integrations.pluginsEnabled', { count: enabledPlugins }),
      adminOnly: true,
    },
    {
      id: 'infrastructure',
      icon: Server,
      titleKey: 'nav.infrastructure',
      meta: infraConnected
        ? t('settings.integrations.infraOk')
        : t('settings.integrations.infraUnknown'),
    },
    {
      id: 'api-keys',
      icon: KeyRound,
      titleKey: 'nav.apiKeys',
      meta: t('settings.integrations.apiKeysHint'),
      adminOnly: true,
    },
  ].filter((item): item is HubItem => !item.adminOnly || isAdmin);

  if (activeId) {
    const embedFallback = (
      <div className="settings-integration-loading">
        <Loader2 className="animate-spin" size={24} />
      </div>
    );

    return (
      <div className="settings-integration-detail">
        <SettingsIntegrationBack onClick={onBack} />
        <Suspense fallback={embedFallback}>
          {activeId === 'products' && (
            <InauzwaIntegrationPanel showCatalogLink />
          )}
          {activeId === 'webhooks' && <Webhooks embedded />}
          {activeId === 'plugins' && isAdmin && <Plugins embedded />}
          {activeId === 'infrastructure' && <Infrastructure embedded />}
          {activeId === 'api-keys' && isAdmin && <ApiKeys embedded />}
        </Suspense>
      </div>
    );
  }

  return (
    <div className="settings-integrations-hub">
      {hubItems.map(({ id, icon: Icon, titleKey, meta }) => (
        <button
          key={id}
          type="button"
          className="settings-link-row settings-link-row--button"
          onClick={() => onSelect(id)}
        >
          <div>
            <div className="settings-link-row__title">
              <Icon size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              {t(titleKey)}
            </div>
            <div className="settings-link-row__meta">{meta}</div>
          </div>
          <ChevronRight size={18} />
        </button>
      ))}
    </div>
  );
}
