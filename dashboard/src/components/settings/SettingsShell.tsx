import { useMemo, useState, type ReactNode } from 'react';

const SETTINGS_NAV_COMPACT_KEY = 'openwa-settings-nav-compact';

function loadNavCompactPreference(): boolean {
  try {
    return localStorage.getItem(SETTINGS_NAV_COMPACT_KEY) === '1';
  } catch {
    return false;
  }
}
import { useTranslation } from 'react-i18next';
import { MaterialSymbol } from '../MaterialSymbol';
import {
  SettingsShellActionsProvider,
  useSettingsShellActionRegistration,
  type SettingsShellPanelChrome,
} from './settings-shell-actions';
import type { SettingsPanelId } from './settings-nav-registry';
import type { SettingsCategoryId, SettingsItem, SettingsNavAccess } from './settings-types';
import {
  SETTINGS_CATEGORIES,
  categoryAllowsAccess,
  searchSettingsIndex,
  visibleCategoryItems,
} from './settings-categories-registry';
import { SettingsNavCard } from './shell/SettingsNavCard';
import './settings-whatsapp.css';
import './shell/settings-form.css';

type Props = {
  children: ReactNode;
  activeCategory: SettingsCategoryId | null;
  activeItemId: string | null;
  activePanel: SettingsPanelId | null;
  navSearch: string;
  onSelectCategory: (categoryId: SettingsCategoryId) => void;
  onSelectItem: (categoryId: SettingsCategoryId, item: SettingsItem) => void;
  onBackCategory: () => void;
  onBack: () => void;
  onLogout?: () => void;
  backAriaLabel?: string;
  access: SettingsNavAccess;
  alertMessage?: string | null;
  showSaveBar?: boolean;
  onSave?: () => void;
  onCancel?: () => void;
  saving?: boolean;
  saveDisabled?: boolean;
};

function categoryNavDescriptionKey(categoryId: SettingsCategoryId): string {
  return `settings.categories.${categoryId}.navDescription`;
}

export function SettingsShell({
  children,
  activeCategory,
  activeItemId,
  activePanel,
  navSearch,
  onSelectCategory,
  onSelectItem,
  onBackCategory,
  onBack,
  onLogout,
  backAriaLabel,
  access,
  alertMessage,
  showSaveBar = false,
  onSave,
  onCancel,
  saving = false,
  saveDisabled = false,
}: Props) {
  const { t } = useTranslation();
  const [navCompact, setNavCompact] = useState(loadNavCompactPreference);
  const effectiveNavCompact = navCompact && !navSearch.trim();

  const toggleNavCompact = () => {
    setNavCompact(prev => {
      const next = !prev;
      try {
        localStorage.setItem(SETTINGS_NAV_COMPACT_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };
  const [panelChrome, setPanelChrome] = useState<SettingsShellPanelChrome>(null);
  const { onRegister, invokePanelSave, invokePanelCancel } =
    useSettingsShellActionRegistration(setPanelChrome);

  const resolvedShowSaveBar = panelChrome?.showSaveBar ?? showSaveBar;
  const resolvedSaving = panelChrome?.saving ?? saving;
  const resolvedSaveDisabled = panelChrome?.saveDisabled ?? saveDisabled;
  const resolvedSaveLabel = panelChrome?.saveLabel ?? t('settings.shell.saveChanges');
  const resolvedOnSave = panelChrome ? invokePanelSave : onSave;
  const resolvedOnCancel = panelChrome ? invokePanelCancel : onCancel;

  const searchResults = useMemo(
    () => searchSettingsIndex(navSearch, access, t),
    [access, navSearch, t],
  );

  const visibleCategories = useMemo(
    () => SETTINGS_CATEGORIES.filter(c => categoryAllowsAccess(c, access)),
    [access],
  );

  const inDetailView = Boolean(activeItemId || activePanel);
  const onCategoryHub = Boolean(activeCategory) && !activeItemId && !activePanel;
  const wideDetailCanvas = Boolean(activePanel) || onCategoryHub;
  const mobileHideNav = inDetailView;
  const mobileHideDetail = false;

  return (
    <SettingsShellActionsProvider onRegister={onRegister}>
      <div
        className={[
          'settings-wa',
          inDetailView ? 'settings-wa--in-detail' : '',
          effectiveNavCompact ? 'settings-wa--nav-compact' : '',
          mobileHideNav ? 'settings-wa--mobile-hide-nav' : '',
          mobileHideDetail ? 'settings-wa--mobile-hide-detail' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className="settings-wa__workspace">
          <div className="settings-wa__topbar">
            {!inDetailView ? (
              <button
                type="button"
                className="settings-wa__mobile-back"
                onClick={onBack}
                aria-label={backAriaLabel ?? t('settings.shell.backToWorkspace')}
              >
                <MaterialSymbol name="arrow_back" size={18} />
                {t('common.back')}
              </button>
            ) : null}
            {alertMessage ? (
              <span className="settings-wa__status settings-wa__status--warning">{alertMessage}</span>
            ) : null}
          </div>

          <div className="settings-wa__workspace-body">
            <aside className="settings-wa__secondary-nav">
              <div className="settings-wa__secondary-nav-header">
                {effectiveNavCompact ? (
                  <span className="settings-wa__secondary-nav-logo" aria-hidden>
                    <MaterialSymbol name="settings" size={26} />
                  </span>
                ) : (
                  <>
                    <h1>{t('settings.title')}</h1>
                    <p>{t('settings.home.subtitle')}</p>
                  </>
                )}
              </div>

              <div className="settings-wa__secondary-nav-scroll sidebar-scroll">
                {navSearch.trim() ? (
                  <div className="settings-wa__search-results">
                    <p className="settings-wa__nav-label">{t('settings.searchResults')}</p>
                    {searchResults.length ? (
                      searchResults.map(({ category, item }) => (
                        <SettingsNavCard
                          key={`${category.id}-${item.id}`}
                          icon={item.icon}
                          title={t(item.titleKey)}
                          description={t(category.titleKey)}
                          admin={item.permission === 'admin'}
                          adminLabel={t('settings.adminBadge')}
                          onClick={() => onSelectItem(category.id, item)}
                        />
                      ))
                    ) : (
                      <div className="settings-wa__empty-search">
                        <p>{t('settings.navNoResults')}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <nav className="settings-wa__nav-list" aria-label={t('settings.title')}>
                    {visibleCategories.map(category => (
                      <SettingsNavCard
                        key={category.id}
                        icon={category.icon}
                        title={t(category.titleKey)}
                        description={t(categoryNavDescriptionKey(category.id))}
                        active={category.id === activeCategory}
                        onClick={() => onSelectCategory(category.id)}
                      />
                    ))}
                  </nav>
                )}
              </div>

              <div className="settings-wa__secondary-nav-footer">
                <button
                  type="button"
                  className="settings-wa__nav-toggle"
                  onClick={toggleNavCompact}
                  aria-label={
                    effectiveNavCompact
                      ? t('settings.shell.expandNav')
                      : t('settings.shell.compactNav')
                  }
                  title={
                    effectiveNavCompact
                      ? t('settings.shell.expandNav')
                      : t('settings.shell.compactNav')
                  }
                >
                  <MaterialSymbol
                    name={effectiveNavCompact ? 'chevron_right' : 'chevron_left'}
                    size={20}
                  />
                </button>
                {onLogout ? (
                  <button
                    type="button"
                    className="settings-wa__logout-btn"
                    onClick={onLogout}
                    aria-label={t('common.logout')}
                    title={t('common.logout')}
                  >
                    <MaterialSymbol name="logout" size={20} />
                    <span className="settings-wa__logout-btn-label">{t('common.logout')}</span>
                  </button>
                ) : null}
              </div>
            </aside>

            <div className="settings-wa__detail-canvas">
              <div
                className={[
                  'settings-wa__detail-inner',
                  wideDetailCanvas ? 'settings-wa__detail-inner--wide' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {inDetailView ? (
                  <button
                    type="button"
                    className="settings-wa__detail-back"
                    onClick={onBackCategory}
                    aria-label={t('settings.hub.backToCategory')}
                  >
                    <MaterialSymbol name="arrow_back" size={18} />
                    <span>{t('settings.hub.backToCategory')}</span>
                  </button>
                ) : null}
                {children}
                {resolvedShowSaveBar ? (
                  <div className="settings-wa__save-bar">
                    <button type="button" className="settings-wa__btn-secondary" onClick={resolvedOnCancel}>
                      {t('common.cancel')}
                    </button>
                    <button
                      type="button"
                      className="settings-wa__btn-primary"
                      onClick={resolvedOnSave}
                      disabled={resolvedSaveDisabled || resolvedSaving}
                    >
                      {resolvedSaving ? t('common.loading') : resolvedSaveLabel}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </SettingsShellActionsProvider>
  );
}

export { visibleCategoryItems };
