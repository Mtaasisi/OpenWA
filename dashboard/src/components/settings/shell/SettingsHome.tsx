import { useTranslation } from 'react-i18next';
import type { SettingsCategoryId } from '../settings-types';
import { SETTINGS_CATEGORIES, categoryAllowsAccess, itemAllowsAccess } from '../settings-categories-registry';
import type { SettingsNavAccess } from '../settings-types';
import { SettingsRow } from './SettingsRow';
import { MaterialSymbol } from '../../MaterialSymbol';

type Props = {
  access: SettingsNavAccess;
  onSelectCategory: (categoryId: SettingsCategoryId) => void;
};

export function SettingsHome({ access, onSelectCategory }: Props) {
  const { t } = useTranslation();

  return (
    <div className="settings-wa__content" style={{ maxWidth: '100%' }}>
      <header className="settings-wa__panel-header">
        <h2>{t('settings.title')}</h2>
        <p>{t('settings.home.subtitle')}</p>
      </header>
      <div className="settings-wa__section-body">
        {SETTINGS_CATEGORIES.filter(c => categoryAllowsAccess(c, access)).map(category => (
          <SettingsRow
            key={category.id}
            icon={category.icon}
            title={t(category.titleKey)}
            description={t(category.descriptionKey)}
            onClick={() => onSelectCategory(category.id)}
          />
        ))}
      </div>
    </div>
  );
}

export function SettingsCategoryOverview({
  categoryId,
  access,
  onSelectItem,
}: {
  categoryId: SettingsCategoryId;
  access: SettingsNavAccess;
  onSelectItem: (itemId: string) => void;
}) {
  const { t } = useTranslation();
  const category = SETTINGS_CATEGORIES.find(c => c.id === categoryId);
  if (!category) return null;

  const items = category.items.filter(
    i => !i.isDanger && itemAllowsAccess(i, access),
  );

  return (
    <div className="settings-wa__content" style={{ maxWidth: '100%' }}>
      <header className="settings-wa__panel-header">
        <span className="settings-wa__item-icon" style={{ marginBottom: 8, display: 'inline-flex' }}>
          <MaterialSymbol name={category.icon} size={24} />
        </span>
        <h2>{t(category.titleKey)}</h2>
        <p>{t(category.descriptionKey)}</p>
      </header>
      <div className="settings-wa__section-body">
        {items.map(item => (
          <SettingsRow
            key={item.id}
            icon={item.icon}
            title={t(item.titleKey)}
            description={item.descriptionKey ? t(item.descriptionKey) : undefined}
            onClick={() => onSelectItem(item.id)}
          />
        ))}
      </div>
    </div>
  );
}
