import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { findCategory, visibleCategoryItems } from '../settings-categories-registry';
import { hubItemSortIndex, isHubVisibleItem } from '../settings-minimal-hubs';
import type { SettingsCategoryId, SettingsItem, SettingsNavAccess } from '../settings-types';
import { SettingsHubRow } from './SettingsHubPrimitives';
import { SettingsHubPage } from './SettingsHubPage';
import { CategoryHubSummary } from './CategoryHubSummaries';

type Props = {
  categoryId: SettingsCategoryId;
  access: SettingsNavAccess;
  onSelectItem: (item: SettingsItem) => void;
};

function hubItems(
  category: NonNullable<ReturnType<typeof findCategory>>,
  access: SettingsNavAccess,
) {
  return visibleCategoryItems(category, access)
    .filter(
      item =>
        !item.isDanger &&
        !item.hiddenFromHub &&
        isHubVisibleItem(category.id, item.id),
    )
    .sort(
      (a, b) =>
        hubItemSortIndex(category.id, a.id) - hubItemSortIndex(category.id, b.id),
    );
}

export function GenericCategoryHub({ categoryId, access, onSelectItem }: Props) {
  const { t } = useTranslation();
  const category = findCategory(categoryId);
  if (!category) return null;

  const items = hubItems(category, access);
  const description =
    t(`settings.categories.${categoryId}.hubMinimalDesc`, {
      defaultValue: '',
    }) || t(category.descriptionKey);

  return (
    <SettingsHubPage
      icon={category.icon}
      title={t(category.titleKey)}
      description={description}
    >
      <CategoryHubSummary categoryId={categoryId} />

      {categoryId === 'chats' ? (
        <div className="settings-hub__cta-row settings-hub__cta-row--standalone">
          <Link to="/inbox" className="settings-wa__btn-primary settings-hub__cta-btn">
            {t('settings.hub.openInbox')}
          </Link>
        </div>
      ) : null}

      {categoryId === 'safety' ? (
        <div className="settings-hub__cta-row settings-hub__cta-row--standalone">
          <Link
            to="/settings?category=safety&panel=whatsapp-safety"
            className="settings-wa__btn-primary settings-hub__cta-btn"
          >
            {t('settings.hub.openWhatsappSafety')}
          </Link>
        </div>
      ) : null}

      {items.map(item => (
        <SettingsHubRow
          key={item.id}
          icon={item.icon}
          title={t(item.titleKey)}
          description={item.descriptionKey ? t(item.descriptionKey) : undefined}
          onClick={() => onSelectItem(item)}
        />
      ))}
    </SettingsHubPage>
  );
}
