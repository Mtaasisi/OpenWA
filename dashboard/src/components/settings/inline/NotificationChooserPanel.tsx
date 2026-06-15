import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { SettingsSectionBlock } from '../shell/SettingsPanelHeader';
import { SettingsMainToggle } from '../SettingsMainPrimitives';
import { isDesktopApp } from '../../../lib/desktop-shell';
import {
  catalogForSection,
  DEFAULT_NOTIFICATION_PREFS,
  NOTIFICATION_SECTIONS,
  patchNotificationPrefs,
  setSectionKindsEnabled,
  type NotificationPrefs,
  type NotificationSectionId,
} from '../../../lib/notification-catalog';

type Props = {
  prefs: NotificationPrefs;
  isAdmin: boolean;
  onChange: (next: NotificationPrefs) => void;
};

export function NotificationChooserPanel({ prefs, isAdmin, onChange }: Props) {
  const { t } = useTranslation();
  const [permission, setPermission] = useState<'granted' | 'denied' | 'default'>('default');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NOTIFICATION_SECTIONS.map(s => [s.id, true])),
  );

  const refreshPermission = useCallback(() => {
    if (isDesktopApp() && window.desktop?.getNotificationPermission) {
      void window.desktop.getNotificationPermission().then(setPermission);
      return;
    }
    if (typeof Notification !== 'undefined') {
      setPermission(Notification.permission as 'granted' | 'denied' | 'default');
    }
  }, []);

  useEffect(() => {
    refreshPermission();
  }, [refreshPermission]);

  const patch = (partial: Partial<NotificationPrefs>) => {
    onChange(patchNotificationPrefs(prefs, partial));
  };

  const requestPermission = () => {
    if (isDesktopApp() && window.desktop?.requestNotificationPermission) {
      void window.desktop.requestNotificationPermission().then(res => {
        setPermission(res);
        if (res === 'granted') patch({ enabled: true });
      });
      return;
    }
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      void Notification.requestPermission().then(res => {
        setPermission(res as 'granted' | 'denied' | 'default');
        if (res === 'granted') patch({ enabled: true });
      });
    }
  };

  const toggleSection = (id: NotificationSectionId) => {
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const visibleSections = NOTIFICATION_SECTIONS.filter(section => {
    if (section.id === 'learning' && !isAdmin) return false;
    const kinds = catalogForSection(section.id).filter(k => !k.adminOnly || isAdmin);
    return kinds.length > 0;
  });

  return (
    <>
      <SettingsSectionBlock icon="notifications" title={t('settings.notifications.chooserTitle')}>
        <p className="settings-wa__detail-prose settings-int-hint--muted">
          {t('settings.notifications.chooserHint')}
        </p>
        <SettingsMainToggle
          label={t('settings.notifications.masterEnabled')}
          checked={prefs.enabled}
          onChange={checked => {
            if (checked && permission !== 'granted') {
              requestPermission();
              return;
            }
            patch({ enabled: checked });
          }}
        />
        {permission === 'denied' ? (
          <p className="settings-int-hint settings-int-hint--muted">
            {t('settings.notifications.permissionDenied')}
          </p>
        ) : null}
      </SettingsSectionBlock>

      {prefs.enabled ? (
        <>
          <SettingsSectionBlock icon="tune" title={t('settings.notifications.globalOptions')}>
            <SettingsMainToggle
              label={t('settings.notifications.showPreview')}
              hint={t('settings.notifications.showPreviewHint')}
              checked={prefs.showPreview}
              onChange={checked => patch({ showPreview: checked })}
            />
            <SettingsMainToggle
              label={t('settings.notifications.onlyWhenBackground')}
              hint={t('settings.notifications.onlyWhenBackgroundHint')}
              checked={prefs.onlyWhenBackground}
              onChange={checked => patch({ onlyWhenBackground: checked })}
            />
          </SettingsSectionBlock>

          {visibleSections.map(section => {
            const kinds = catalogForSection(section.id).filter(k => !k.adminOnly || isAdmin);
            const sectionOpen = openSections[section.id] !== false;
            const allOn = kinds.every(k => prefs.kinds[k.id] !== false);

            return (
              <SettingsSectionBlock
                key={section.id}
                icon="notifications_active"
                title={t(section.titleKey)}
              >
                <button
                  type="button"
                  className="settings-notify-section-toggle"
                  onClick={() => toggleSection(section.id)}
                  aria-expanded={sectionOpen}
                >
                  {sectionOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <span className="settings-notify-section-toggle__label">
                    {t(section.descriptionKey)}
                  </span>
                  <span
                    className="settings-notify-section-toggle__action"
                    onClick={e => {
                      e.stopPropagation();
                      onChange(setSectionKindsEnabled(prefs, section.id, !allOn));
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        onChange(setSectionKindsEnabled(prefs, section.id, !allOn));
                      }
                    }}
                  >
                    {allOn
                      ? t('settings.notifications.disableSection')
                      : t('settings.notifications.enableSection')}
                  </span>
                </button>
                {sectionOpen
                  ? kinds.map(kind => (
                      <SettingsMainToggle
                        key={kind.id}
                        label={t(kind.labelKey)}
                        hint={t(kind.descriptionKey)}
                        checked={prefs.kinds[kind.id] !== false}
                        onChange={checked =>
                          patch({ kinds: { ...prefs.kinds, [kind.id]: checked } })
                        }
                      />
                    ))
                  : null}
              </SettingsSectionBlock>
            );
          })}

          <div className="settings-wa__actions">
            <button
              type="button"
              className="fu-btn fu-btn--ghost fu-btn--sm"
              onClick={() => onChange({ ...DEFAULT_NOTIFICATION_PREFS, kinds: { ...DEFAULT_NOTIFICATION_PREFS.kinds } })}
            >
              {t('settings.notifications.resetDefaults')}
            </button>
          </div>
        </>
      ) : null}
    </>
  );
}
