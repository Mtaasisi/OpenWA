import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { SettingsSectionBlock } from '../shell/SettingsPanelHeader';
import { SettingsMainToggle } from '../SettingsMainPrimitives';
import { saveUserPreferences } from '../../../lib/user-preferences';
import type { SettingsPageContextValue } from '../settings-page-context';
import { NotificationChooserPanel } from './NotificationChooserPanel';

type Props = {
  ctx: SettingsPageContextValue;
};

export function NotificationsInlineContent({ ctx }: Props) {
  const { t } = useTranslation();
  const [moreOpen, setMoreOpen] = useState(false);
  const showServerSection = ctx.isAdmin && ctx.serverDraft;

  return (
    <>
      <NotificationChooserPanel
        prefs={ctx.userPrefs.notifications}
        isAdmin={ctx.isAdmin}
        onChange={next => {
          ctx.setUserPrefs(p => ({
            ...p,
            notifications: next,
            inboxBrowserNotifications: next.enabled,
          }));
          saveUserPreferences({
            notifications: next,
            inboxBrowserNotifications: next.enabled,
          });
        }}
      />

      {showServerSection && !moreOpen ? (
        <button
          type="button"
          className="fu-btn fu-btn--ghost fu-btn--sm settings-inline-more-btn"
          onClick={() => setMoreOpen(true)}
        >
          <span>{t('settings.moreOptions')}</span>
          <ChevronDown size={18} aria-hidden />
        </button>
      ) : null}

      {showServerSection && moreOpen ? (
        <>
          <button
            type="button"
            className="fu-btn fu-btn--ghost fu-btn--sm settings-inline-show-less"
            onClick={() => setMoreOpen(false)}
          >
            {t('settings.showLess')}
          </button>
          <SettingsSectionBlock icon="dns" title={t('settings.notifications.serverSectionTitle')}>
            <SettingsMainToggle
              label={t('settings.notifications.webhookAlerts')}
              checked={ctx.serverDraft!.notifications.webhookAlerts}
              disabled={ctx.serverReadOnly}
              onChange={checked => ctx.patchServer({ notifications: { webhookAlerts: checked } })}
            />
            <SettingsMainToggle
              label={t('settings.notifications.emailEnabled')}
              checked={ctx.serverDraft!.notifications.emailEnabled}
              disabled={ctx.serverReadOnly}
              onChange={checked => ctx.patchServer({ notifications: { emailEnabled: checked } })}
            />
          </SettingsSectionBlock>
        </>
      ) : null}
    </>
  );
}
