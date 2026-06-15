import { ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  onClick: () => void;
  label?: string;
}

export function SettingsIntegrationBack({ onClick, label }: Props) {
  const { t } = useTranslation();
  return (
    <button type="button" className="fu-btn fu-btn--ghost settings-integration-back" onClick={onClick}>
      <ChevronLeft size={18} />
      {label ?? t('settings.integrations.back')}
    </button>
  );
}
