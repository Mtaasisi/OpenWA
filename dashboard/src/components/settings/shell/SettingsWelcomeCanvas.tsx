import { useTranslation } from 'react-i18next';
import { MaterialSymbol } from '../../MaterialSymbol';

export function SettingsWelcomeCanvas() {
  const { t } = useTranslation();

  return (
    <div className="settings-wa__welcome">
      <div className="settings-wa__welcome-icon">
        <MaterialSymbol name="tune" size={32} />
      </div>
      <h2>{t('settings.welcome.title')}</h2>
      <p>{t('settings.welcome.hint')}</p>
    </div>
  );
}
