import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, Copy, Palette, Plus, Trash2, X, ArrowLeft, Sun, Moon } from 'lucide-react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useThemeContext } from '../context/ThemeProvider';
import { WorkspacePageHeader } from '../components/workspace';
import type { CustomThemeInput, DashboardTheme, ThemePalette } from '../lib/theme-types';
import { PALETTE_FIELDS, defaultCustomPalette } from '../lib/themes';
import { ThemePreview } from '../components/ThemePreview';
import { ModalOverlay } from '../components/ModalOverlay';
import { settingsSectionHref } from '../components/settings/settings-nav-registry';
import './Themes.css';

function PaletteEditor({
  label,
  palette,
  onChange,
}: {
  label: string;
  palette: ThemePalette;
  onChange: (next: ThemePalette) => void;
}) {
  const { t } = useTranslation();

  return (
    <fieldset className="theme-palette-editor">
      <legend>{label}</legend>
      <div className="theme-palette-grid">
        {PALETTE_FIELDS.map(({ key, labelKey }) => (
          <label key={key} className="theme-color-field">
            <span>{t(`themesPage.fields.${labelKey}`)}</span>
            <div className="theme-color-input-wrap">
              <input
                type="color"
                value={palette[key]}
                onChange={e => onChange({ ...palette, [key]: e.target.value })}
              />
              <input
                type="text"
                value={palette[key]}
                onChange={e => onChange({ ...palette, [key]: e.target.value })}
                spellCheck={false}
              />
            </div>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

type EditorState = {
  mode: 'create' | 'edit';
  themeId?: string;
  name: string;
  description: string;
  light: ThemePalette;
  dark: ThemePalette;
};

function emptyEditor(): EditorState {
  const base = defaultCustomPalette();
  return {
    mode: 'create',
    name: '',
    description: '',
    light: { ...base },
    dark: { ...base, bgLight: '#0f172a', bgWhite: '#1e293b', bgCard: '#1e293b', textPrimary: '#f1f5f9', textSecondary: '#cbd5e1', border: '#334155' },
  };
}

export function Themes() {
  const { t } = useTranslation();
  useDocumentTitle(t('themesPage.documentTitle'));

  const {
    activeThemeId,
    setActiveThemeId,
    themes,
    addCustomTheme,
    updateCustomTheme,
    deleteCustomTheme,
    duplicateCustomTheme,
  } = useThemeContext();

  const [editor, setEditor] = useState<EditorState | null>(null);
  const [editorTab, setEditorTab] = useState<'light' | 'dark'>('light');

  const openCreate = () => setEditor(emptyEditor());
  const openEdit = (theme: DashboardTheme) => {
    setEditor({
      mode: 'edit',
      themeId: theme.id,
      name: theme.name,
      description: theme.description ?? '',
      light: { ...theme.light },
      dark: { ...theme.dark },
    });
    setEditorTab('light');
  };

  const closeEditor = () => setEditor(null);

  const saveEditor = () => {
    if (!editor || !editor.name.trim()) return;
    const input: CustomThemeInput = {
      name: editor.name,
      description: editor.description || undefined,
      light: editor.light,
      dark: editor.dark,
    };
    if (editor.mode === 'edit' && editor.themeId) {
      updateCustomTheme(editor.themeId, input);
    } else {
      const created = addCustomTheme(input);
      setActiveThemeId(created.id);
    }
    closeEditor();
  };

  const handleDuplicate = (theme: DashboardTheme) => {
    const copy = duplicateCustomTheme(theme.id);
    if (copy) setActiveThemeId(copy.id);
  };

  const handleDelete = (theme: DashboardTheme) => {
    if (theme.builtin) return;
    if (!window.confirm(t('themesPage.deleteConfirm', { name: theme.name }))) return;
    deleteCustomTheme(theme.id);
  };

  return (
    <div className="followups-interakt themes-interakt">
      <WorkspacePageHeader
        title={t('themesPage.title')}
        showSearch={false}
        showExport={false}
        showNewTask={false}
        extraActions={
          <>
            <Link to={settingsSectionHref('appearance')} className="fu-btn fu-btn--ghost">
              <ArrowLeft size={16} />
              {t('settings.backToSettings')}
            </Link>
            <button type="button" className="fu-btn fu-btn--primary" onClick={openCreate}>
              <Plus size={18} />
              {t('themesPage.createTheme')}
            </button>
          </>
        }
      />

      <div className="followups-interakt__scroll">
        <div className="themes-page">
      <p className="themes-settings-notice">
        {t('themesPage.settingsHint')}{' '}
        <Link to={settingsSectionHref('appearance')}>{t('settings.appearanceShortcut')}</Link>
      </p>

      <section className="themes-section">
        <h2>{t('themesPage.galleryTitle')}</h2>
        <p className="themes-section-desc">{t('themesPage.galleryDesc')}</p>
        <div className="themes-grid">
          {themes.map(theme => {
            const isActive = theme.id === activeThemeId;
            return (
              <article key={theme.id} className={`theme-card ${isActive ? 'is-active' : ''}`}>
                <ThemePreview theme={theme} mode="light" />
                <div className="theme-card__body">
                  <div className="theme-card__head">
                    <h3>{theme.name}</h3>
                    {isActive && (
                      <span className="theme-card__active-badge">
                        <Check size={14} />
                        {t('themesPage.active')}
                      </span>
                    )}
                  </div>
                  {theme.effects === 'tactical' && (
                    <span className="theme-card__effects-badge">HUD</span>
                  )}
                  {theme.effects === 'interakt' && (
                    <span className="theme-card__effects-badge theme-card__effects-badge--interakt">
                      Inbox
                    </span>
                  )}
                  {theme.description && <p className="theme-card__desc">{theme.description}</p>}
                  <div className="theme-card__swatches">
                    <span style={{ background: theme.light.primary }} title={t('theme.light')} />
                    <span style={{ background: theme.dark.primary }} title={t('theme.dark')} />
                    <span style={{ background: theme.light.bgLight }} title={t('themesPage.fields.bgLight')} />
                  </div>
                  <div className="theme-card__actions">
                    <button
                      type="button"
                      className="themes-btn themes-btn--primary"
                      onClick={() => setActiveThemeId(theme.id)}
                      disabled={isActive}
                    >
                      {isActive ? t('themesPage.applied') : t('themesPage.apply')}
                    </button>
                    {!theme.builtin && (
                      <button type="button" className="themes-btn" onClick={() => openEdit(theme)}>
                        {t('common.edit')}
                      </button>
                    )}
                    <button
                      type="button"
                      className="themes-btn themes-btn--icon"
                      onClick={() => handleDuplicate(theme)}
                      title={t('themesPage.duplicate')}
                    >
                      <Copy size={16} />
                    </button>
                    {!theme.builtin && (
                      <button
                        type="button"
                        className="themes-btn themes-btn--icon themes-btn--danger"
                        onClick={() => handleDelete(theme)}
                        title={t('common.delete')}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

        </div>
      </div>

      {editor && (
        <ModalOverlay onClose={closeEditor} className="themes-modal-overlay">
          <div className="themes-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <header className="themes-modal__header">
              <h2>
                <Palette size={20} />
                {editor.mode === 'edit' ? t('themesPage.editTheme') : t('themesPage.createTheme')}
              </h2>
              <button type="button" className="themes-btn themes-btn--icon" onClick={closeEditor} aria-label={t('common.close')}>
                <X size={20} />
              </button>
            </header>

            <div className="themes-modal__form">
              <label className="theme-form-field">
                <span>{t('common.name')}</span>
                <input
                  type="text"
                  value={editor.name}
                  onChange={e => setEditor({ ...editor, name: e.target.value })}
                  placeholder={t('themesPage.namePlaceholder')}
                  autoFocus
                />
              </label>
              <label className="theme-form-field">
                <span>{t('themesPage.description')}</span>
                <input
                  type="text"
                  value={editor.description}
                  onChange={e => setEditor({ ...editor, description: e.target.value })}
                  placeholder={t('themesPage.descriptionPlaceholder')}
                />
              </label>

              <div className="themes-editor-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  className={editorTab === 'light' ? 'active' : ''}
                  onClick={() => setEditorTab('light')}
                >
                  <Sun size={16} />
                  {t('theme.light')}
                </button>
                <button
                  type="button"
                  role="tab"
                  className={editorTab === 'dark' ? 'active' : ''}
                  onClick={() => setEditorTab('dark')}
                >
                  <Moon size={16} />
                  {t('theme.dark')}
                </button>
              </div>

              {editorTab === 'light' ? (
                <PaletteEditor
                  label={t('themesPage.lightPalette')}
                  palette={editor.light}
                  onChange={light => setEditor({ ...editor, light })}
                />
              ) : (
                <PaletteEditor
                  label={t('themesPage.darkPalette')}
                  palette={editor.dark}
                  onChange={dark => setEditor({ ...editor, dark })}
                />
              )}
            </div>

            <footer className="themes-modal__footer">
              <button type="button" className="themes-btn" onClick={closeEditor}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="themes-btn themes-btn--primary"
                onClick={saveEditor}
                disabled={!editor.name.trim()}
              >
                {t('common.save')}
              </button>
            </footer>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
