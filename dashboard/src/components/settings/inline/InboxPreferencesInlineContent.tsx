import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { SettingsSectionBlock } from '../shell/SettingsPanelHeader';
import { SettingsMainField, SettingsMainToggle } from '../SettingsMainPrimitives';
import { InboxChatAppearanceSettings } from '../InboxChatAppearanceSettings';
import { InboxNotificationSettingsPanel } from './InboxNotificationSettingsPanel';
import { saveUserPreferences } from '../../../lib/user-preferences';
import type { SettingsPageContextValue } from '../settings-page-context';

type Props = {
  ctx: SettingsPageContextValue;
};

export function InboxPreferencesInlineContent({ ctx }: Props) {
  const { t } = useTranslation();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      <SettingsSectionBlock icon="inbox" title={t('settings.inbox.layoutTitle')}>
        <SettingsMainField label={t('settings.inbox.defaultView')} hint={t('settings.inbox.defaultViewHint')}>
          <select
            value={ctx.userPrefs.inboxDefaultView}
            onChange={e =>
              ctx.setUserPrefs(p => ({
                ...p,
                inboxDefaultView: e.target.value as typeof p.inboxDefaultView,
              }))
            }
          >
            <option value="all">{t('inbox.allAccounts')}</option>
            <option value="one">{t('inbox.oneAccount')}</option>
          </select>
        </SettingsMainField>
        <SettingsMainField label={t('settings.inbox.defaultFilter')} hint={t('settings.inbox.defaultFilterHint')}>
          <select
            value={ctx.userPrefs.inboxConversationFilter}
            onChange={e =>
              ctx.setUserPrefs(p => ({
                ...p,
                inboxConversationFilter: e.target.value as typeof p.inboxConversationFilter,
              }))
            }
          >
            {ctx.inboxFilterOptions.map(key => (
              <option key={key} value={key}>
                {t(`inbox.filter.${key}`)}
              </option>
            ))}
          </select>
        </SettingsMainField>
        <SettingsMainToggle
          label={t('settings.inbox.hideGroupsDefault')}
          hint={t('settings.inbox.hideGroupsDefaultHint')}
          checked={ctx.userPrefs.inboxHideGroups}
          onChange={checked => ctx.setUserPrefs(p => ({ ...p, inboxHideGroups: checked }))}
        />
        {!moreOpen ? (
          <button
            type="button"
            className="fu-btn fu-btn--ghost fu-btn--sm settings-inline-more-btn"
            onClick={() => setMoreOpen(true)}
          >
            <span>{t('settings.moreOptions')}</span>
            <ChevronDown size={18} aria-hidden />
          </button>
        ) : null}
      </SettingsSectionBlock>

      <InboxNotificationSettingsPanel
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

      {moreOpen ? (
        <>
          <button
            type="button"
            className="fu-btn fu-btn--ghost fu-btn--sm settings-inline-show-less"
            onClick={() => setMoreOpen(false)}
          >
            {t('settings.showLess')}
          </button>
          <SettingsSectionBlock icon="tune" title={t('settings.inbox.moreSectionTitle')}>
            {ctx.allSessions.length > 0 ? (
              <SettingsMainField
                label={t('settings.inbox.defaultSession')}
                hint={t('settings.inbox.defaultSessionHint')}
              >
                <select
                  value={ctx.userPrefs.inboxDefaultSessionId ?? ''}
                  onChange={e =>
                    ctx.setUserPrefs(p => ({
                      ...p,
                      inboxDefaultSessionId: e.target.value || null,
                    }))
                  }
                >
                  <option value="">{t('settings.inbox.defaultSessionAuto')}</option>
                  {ctx.allSessions.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.status})
                    </option>
                  ))}
                </select>
              </SettingsMainField>
            ) : null}
            <SettingsMainToggle
              label={t('settings.inbox.showCustomerPanel')}
              hint={t('settings.inbox.showCustomerPanelHint')}
              checked={ctx.userPrefs.inboxShowCustomerPanel}
              onChange={checked => ctx.setUserPrefs(p => ({ ...p, inboxShowCustomerPanel: checked }))}
            />
          </SettingsSectionBlock>
          <SettingsSectionBlock icon="chat" title={t('settings.inbox.appearance.title')}>
            <InboxChatAppearanceSettings
              prefs={ctx.userPrefs}
              onChange={patch => ctx.setUserPrefs(p => ({ ...p, ...patch }))}
            />
          </SettingsSectionBlock>
        </>
      ) : null}
    </>
  );
}
