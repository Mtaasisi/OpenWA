import { useTranslation } from 'react-i18next';
import type { SettingsCategoryId } from '../settings-types';

type Props = {
  categoryId: SettingsCategoryId | null;
  itemTitle?: string | null;
  onBackHome?: () => void;
  onBackCategory?: () => void;
};

export function SettingsBreadcrumb({
  categoryId,
  itemTitle,
  onBackHome,
  onBackCategory,
}: Props) {
  const { t } = useTranslation();
  if (!categoryId) return null;

  const categoryKey = `settings.categories.${categoryId}.title` as const;

  return (
    <nav className="settings-wa__breadcrumb" aria-label={t('settings.breadcrumb')}>
      {onBackHome ? (
        <>
          <button type="button" onClick={onBackHome}>
            {t('settings.title')}
          </button>
          <span>/</span>
        </>
      ) : null}
      {onBackCategory ? (
        <button type="button" onClick={onBackCategory}>
          {t(categoryKey)}
        </button>
      ) : (
        <span>{t(categoryKey)}</span>
      )}
      {itemTitle ? (
        <>
          <span>/</span>
          <span>{itemTitle}</span>
        </>
      ) : null}
    </nav>
  );
}
