import { useTranslation } from 'react-i18next';
import type { CSSProperties } from 'react';
import { MaterialSymbol } from '../MaterialSymbol';
import {
  INBOX_CHAT_BG_PRESETS,
  INBOX_CHAT_OUTGOING_PRESETS,
  INBOX_CHAT_WALLPAPER_IDS,
  inboxChatAppearanceFromPrefs,
  resetInboxChatAppearanceDefaults,
  type InboxChatWallpaperId,
} from '../../lib/inbox-chat-appearance';
import type { UserPreferences } from '../../lib/user-preferences';
import { SettingsMainField } from './SettingsMainPrimitives';
import './InboxChatAppearanceSettings.css';

type Props = {
  prefs: UserPreferences;
  onChange: (patch: Partial<UserPreferences>) => void;
};

export function InboxChatAppearanceSettings({ prefs, onChange }: Props) {
  const { t } = useTranslation();
  const appearance = inboxChatAppearanceFromPrefs(prefs);

  const wallpaperPreviewStyle = (id: InboxChatWallpaperId): CSSProperties => {
    const preview = inboxChatAppearanceFromPrefs({
      ...prefs,
      inboxChatWallpaper: id,
    });
    const layers =
      id === 'default'
        ? {
            backgroundImage: "url('/interakt-chat-wallpaper.png')",
            backgroundSize: '120px auto',
          }
        : id === 'dots'
          ? {
              backgroundImage:
                'radial-gradient(circle at 1px 1px, rgba(17, 27, 33, 0.12) 1px, transparent 0)',
              backgroundSize: '10px 10px',
            }
          : id === 'diagonal'
            ? {
                backgroundImage:
                  'repeating-linear-gradient(135deg, rgba(17, 27, 33, 0.08) 0, rgba(17, 27, 33, 0.08) 1px, transparent 1px, transparent 8px)',
              }
            : {};

    return {
      backgroundColor: preview.backgroundColor,
      ...layers,
    };
  };

  return (
    <div className="inbox-appearance-settings">
      <SettingsMainField
        label={t('settings.inbox.appearance.wallpaper')}
        hint={t('settings.inbox.appearance.wallpaperHint')}
      >
        <div className="inbox-appearance-settings__wallpaper-grid" role="listbox" aria-label={t('settings.inbox.appearance.wallpaper')}>
          {INBOX_CHAT_WALLPAPER_IDS.map(id => (
            <button
              key={id}
              type="button"
              role="option"
              aria-selected={appearance.wallpaper === id}
              className={`inbox-appearance-settings__wallpaper-tile${appearance.wallpaper === id ? ' is-active' : ''}`}
              style={wallpaperPreviewStyle(id)}
              onClick={() => onChange({ inboxChatWallpaper: id })}
            >
              <span>{t(`settings.inbox.appearance.wallpaper_${id}`)}</span>
            </button>
          ))}
        </div>
      </SettingsMainField>

      <SettingsMainField
        label={t('settings.inbox.appearance.backgroundColor')}
        hint={t('settings.inbox.appearance.backgroundColorHint')}
      >
        <div className="inbox-appearance-settings__swatches">
          {INBOX_CHAT_BG_PRESETS.map(preset => (
            <button
              key={preset.id}
              type="button"
              className={`inbox-appearance-settings__swatch${appearance.backgroundColor === preset.color ? ' is-active' : ''}`}
              style={{ backgroundColor: preset.color }}
              title={t(preset.labelKey)}
              aria-label={t(preset.labelKey)}
              onClick={() => onChange({ inboxChatBackgroundColor: preset.color })}
            />
          ))}
          <label className="inbox-appearance-settings__color-input">
            <input
              type="color"
              value={appearance.backgroundColor}
              onChange={e => onChange({ inboxChatBackgroundColor: e.target.value.toUpperCase() })}
              aria-label={t('settings.inbox.appearance.customBackground')}
            />
            <span>{t('settings.inbox.appearance.custom')}</span>
          </label>
        </div>
      </SettingsMainField>

      <SettingsMainField
        label={t('settings.inbox.appearance.outgoingColor')}
        hint={t('settings.inbox.appearance.outgoingColorHint')}
      >
        <div className="inbox-appearance-settings__swatches">
          {INBOX_CHAT_OUTGOING_PRESETS.map(preset => (
            <button
              key={preset.id}
              type="button"
              className={`inbox-appearance-settings__swatch${appearance.outgoingColor === preset.color ? ' is-active' : ''}`}
              style={{ backgroundColor: preset.color }}
              title={t(preset.labelKey)}
              aria-label={t(preset.labelKey)}
              onClick={() => onChange({ inboxChatOutgoingColor: preset.color })}
            />
          ))}
          <label className="inbox-appearance-settings__color-input">
            <input
              type="color"
              value={appearance.outgoingColor}
              onChange={e => onChange({ inboxChatOutgoingColor: e.target.value.toUpperCase() })}
              aria-label={t('settings.inbox.appearance.customOutgoing')}
            />
            <span>{t('settings.inbox.appearance.custom')}</span>
          </label>
        </div>
      </SettingsMainField>

      <div
        className="inbox-appearance-settings__preview"
        style={{
          backgroundColor: appearance.backgroundColor,
          backgroundImage:
            appearance.wallpaper === 'default'
              ? "url('/interakt-chat-wallpaper.png')"
              : appearance.wallpaper === 'dots'
                ? 'radial-gradient(circle at 1px 1px, rgba(17, 27, 33, 0.07) 1px, transparent 0)'
                : appearance.wallpaper === 'diagonal'
                  ? 'repeating-linear-gradient(135deg, rgba(17, 27, 33, 0.04) 0, rgba(17, 27, 33, 0.04) 1px, transparent 1px, transparent 12px)'
                  : undefined,
          backgroundSize: appearance.wallpaper === 'default' ? '240px auto' : appearance.wallpaper === 'dots' ? '18px 18px' : undefined,
        }}
      >
        <div className="inbox-appearance-settings__preview-bubble inbox-appearance-settings__preview-bubble--in">
          {t('settings.inbox.appearance.previewIncoming')}
        </div>
        <div
          className="inbox-appearance-settings__preview-bubble inbox-appearance-settings__preview-bubble--out"
          style={{ backgroundColor: appearance.outgoingColor }}
        >
          {t('settings.inbox.appearance.previewOutgoing')}
        </div>
      </div>

      <button
        type="button"
        className="inbox-appearance-settings__reset"
        onClick={() => onChange(resetInboxChatAppearanceDefaults())}
      >
        <MaterialSymbol name="restart_alt" size={18} />
        {t('settings.inbox.appearance.reset')}
      </button>
    </div>
  );
}
