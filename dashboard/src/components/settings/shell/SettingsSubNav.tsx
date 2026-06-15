import { useTranslation } from 'react-i18next';
import type { SettingsCategory } from '../settings-types';
import type { SettingsItem, SettingsNavAccess } from '../settings-types';
import { visibleCategoryItems } from '../settings-categories-registry';
import { SettingsNavCard } from './SettingsNavCard';

type Props = {
  category: SettingsCategory;
  activeItemId: string;
  access: SettingsNavAccess;
  onSelectItem: (item: SettingsItem) => void;
};

export function SettingsSubNav({ category, activeItemId, access, onSelectItem }: Props) {
  const { t } = useTranslation();
  const regular = visibleCategoryItems(category, access).filter(i => !i.isDanger);

  return (
    <div className="settings-wa__nav-list" aria-label={t(category.titleKey)}>
      {regular.map(item => (
        <SettingsNavCard
          key={item.id}
          icon={item.icon}
          title={t(item.titleKey)}
          description={item.descriptionKey ? t(item.descriptionKey) : undefined}
          admin={item.permission === 'admin'}
          adminLabel={t('settings.adminBadge')}
          active={item.id === activeItemId}
          onClick={() => onSelectItem(item)}
        />
      ))}
    </div>
  );
}

export function SettingsDangerZone({ children }: { children: React.ReactNode }) {
  return <div className="settings-wa__danger-list">{children}</div>;
}
