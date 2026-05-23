import { Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, FileText, ChevronRight, Loader2 } from 'lucide-react';
import type { SettingsApiToolId } from './settings-api-tools';
import { SettingsIntegrationBack } from './SettingsIntegrationBack';

const MessageTester = lazy(() =>
  import('../../pages/MessageTester').then(m => ({ default: m.MessageTester })),
);
const Logs = lazy(() => import('../../pages/Logs').then(m => ({ default: m.Logs })));

type HubItem = {
  id: SettingsApiToolId;
  icon: typeof Send;
  titleKey: string;
  descKey: string;
};

interface Props {
  activeId: SettingsApiToolId | null;
  onSelect: (id: SettingsApiToolId) => void;
  onBack: () => void;
}

export function SettingsApiToolsSection({ activeId, onSelect, onBack }: Props) {
  const { t } = useTranslation();

  const hubItems: HubItem[] = [
    {
      id: 'message-tester',
      icon: Send,
      titleKey: 'nav.messageTester',
      descKey: 'settings.api.toolsMessageTesterDesc',
    },
    {
      id: 'logs',
      icon: FileText,
      titleKey: 'nav.logs',
      descKey: 'settings.api.toolsLogsDesc',
    },
  ];

  if (activeId) {
    const embedFallback = (
      <div className="settings-integration-loading">
        <Loader2 className="animate-spin" size={24} />
      </div>
    );

    return (
      <div className="settings-integration-detail">
        <SettingsIntegrationBack label={t('settings.api.toolsBack')} onClick={onBack} />
        <Suspense fallback={embedFallback}>
          {activeId === 'message-tester' && <MessageTester embedded />}
          {activeId === 'logs' && <Logs embedded />}
        </Suspense>
      </div>
    );
  }

  return (
    <div className="settings-integrations-hub">
      {hubItems.map(({ id, icon: Icon, titleKey, descKey }) => (
        <button
          key={id}
          type="button"
          className="settings-link-row"
          onClick={() => onSelect(id)}
        >
          <Icon size={20} className="settings-link-row__icon" aria-hidden />
          <div className="settings-link-row__text">
            <div className="settings-link-row__title">{t(titleKey)}</div>
            <div className="settings-link-row__meta">{t(descKey)}</div>
          </div>
          <ChevronRight size={18} className="settings-link-row__chevron" aria-hidden />
        </button>
      ))}
    </div>
  );
}
