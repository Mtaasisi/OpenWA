import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

const MOVED_KEYS: Record<string, string> = {
  'message-tester': 'settings.moved.messageTester',
  logs: 'settings.moved.logs',
  webhooks: 'settings.moved.webhooks',
  infrastructure: 'settings.moved.infrastructure',
  'api-keys': 'settings.moved.apiKeys',
  plugins: 'settings.moved.plugins',
};

export function SettingsMovedBanner() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const moved = searchParams.get('moved');
  const messageKey = moved ? MOVED_KEYS[moved] : undefined;

  if (!messageKey) return null;

  const dismiss = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('moved');
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="settings-moved-banner" role="status">
      <p>{t(messageKey)}</p>
      <button type="button" className="settings-moved-banner__close" onClick={dismiss} aria-label={t('common.close')}>
        <X size={16} />
      </button>
    </div>
  );
}
