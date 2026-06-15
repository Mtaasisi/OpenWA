import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SettingsSectionBlock } from '../shell/SettingsPanelHeader';
import { SettingsMainToggle } from '../SettingsMainPrimitives';
import { isDesktopApp } from '../../../lib/desktop-shell';
import {
  NOTIFICATION_CATALOG,
  patchNotificationPrefs,
  type NotificationKindId,
  type NotificationPrefs,
} from '../../../lib/notification-catalog';
import { settingsSectionHref } from '../settings-nav-registry';

const INBOX_NOTIFICATION_KINDS: NotificationKindId[] = [
  'message.direct',
  'message.group',
  'ai.escalated',
  'ai.optOut',
  'followup.due',
  'followup.escalated',
  'crm.chatAssigned',
  'system.queueFailed',
];

type Props = {
  prefs: NotificationPrefs;
  isAdmin: boolean;
  onChange: (next: NotificationPrefs) => void;
};

export function InboxNotificationSettingsPanel({ prefs, isAdmin, onChange }: Props) {
  const { t } = useTranslation();
  const [permission, setPermission] = useState<'granted' | 'denied' | 'default'>('default');

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

  const visibleKinds = INBOX_NOTIFICATION_KINDS.flatMap(id => {
    const entry = NOTIFICATION_CATALOG.find(e => e.id === id);
    if (!entry) return [];
    if (entry.adminOnly && !isAdmin) return [];
    return [entry];
  });

  return (
    <SettingsSectionBlock icon="notification_important" title={t('settings.inbox.notifications.title')}>
      <p className="settings-wa__detail-prose settings-int-hint--muted">
        {t('settings.inbox.notifications.hint')}
      </p>
      <SettingsMainToggle
        label={t('settings.inbox.notifications.enabled')}
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
          {t('settings.inbox.notifications.permissionDenied')}
        </p>
      ) : null}
      {prefs.enabled ? (
        <>
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
          {visibleKinds.map(entry => (
            <SettingsMainToggle
              key={entry.id}
              label={t(entry.labelKey)}
              hint={t(entry.descriptionKey)}
              checked={prefs.kinds[entry.id] !== false}
              onChange={checked =>
                patch({ kinds: { ...prefs.kinds, [entry.id]: checked } })
              }
            />
          ))}
        </>
      ) : null}
      <p className="settings-int-hint settings-int-hint--muted">
        <Link to={settingsSectionHref('notifications')} className="fu-btn fu-btn--ghost fu-btn--sm">
          {t('settings.inbox.notifications.openFullSettings')}
        </Link>
      </p>
    </SettingsSectionBlock>
  );
}
