import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useThemeContext } from '../../context/ThemeProvider';
import { ThemePreview } from '../ThemePreview';
import '../../pages/Themes.css';

export function SettingsThemePicker() {
  const { t } = useTranslation();
  const { activeThemeId, setActiveThemeId, themes, resolvedAppearance } = useThemeContext();

  return (
    <div className="settings-theme-picker">
      <p className="settings-row__hint settings-theme-picker__hint">{t('settings.appearance.themeGalleryHint')}</p>
      <div className="themes-grid settings-theme-picker__grid" role="list">
        {themes.map(theme => {
          const isActive = theme.id === activeThemeId;
          return (
            <button
              key={theme.id}
              type="button"
              role="listitem"
              className={`theme-card settings-theme-picker__card ${isActive ? 'is-active' : ''}`}
              onClick={() => setActiveThemeId(theme.id)}
              aria-pressed={isActive}
              aria-label={t('settings.appearance.applyTheme', { name: theme.name })}
            >
              <ThemePreview theme={theme} mode={resolvedAppearance} />
              <div className="theme-card__body">
                <div className="theme-card__head">
                  <h3>{theme.name}</h3>
                  {isActive && (
                    <span className="theme-card__active-badge">
                      <Check size={14} aria-hidden />
                      {t('themesPage.active')}
                    </span>
                  )}
                </div>
                {theme.effects === 'tactical' && (
                  <span className="theme-card__effects-badge">HUD</span>
                )}
                {theme.description && <p className="theme-card__desc">{theme.description}</p>}
                <div className="theme-card__swatches">
                  <span style={{ background: theme.light.primary }} title={t('theme.light')} />
                  <span style={{ background: theme.dark.primary }} title={t('theme.dark')} />
                  <span style={{ background: theme.light.bgLight }} title={t('themesPage.fields.bgLight')} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
