import { useTranslation } from 'react-i18next';
import { useSettingsPage } from '../settings-page-context';
import { useAppStatus } from '../../../hooks/useAppStatus';
import { useToast } from '../../Toast';
import {
  SettingsHubProfileCard,
  SettingsHubSection,
  SettingsHubStatRow,
  SettingsHubRow,
} from './SettingsHubPrimitives';
import type { SettingsItem } from '../settings-types';
import { findCategoryItem } from '../settings-categories-registry';
import { SettingsHubPage } from './SettingsHubPage';

type Props = {
  onSelectItem: (item: SettingsItem) => void;
};

export function ProfileCategoryHub({ onSelectItem }: Props) {
  const { t } = useTranslation();
  const ctx = useSettingsPage();
  const { data: appStatus } = useAppStatus();
  const toast = useToast();

  const displayName = ctx.storedUser?.name ?? '—';
  const email = ctx.storedUser?.email ?? '—';
  const initials = displayName
    .split(/\s+/)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const connectionLabel =
    ctx.apiOnline === null
      ? '…'
      : ctx.apiOnline
        ? t('settings.account.online')
        : t('settings.account.offline');

  const branchName = appStatus?.branch?.name ?? t('settings.hub.branchUnknown');
  const branchSubtitle = t('settings.hub.primaryBranch', { name: branchName });

  const editProfileItem = findCategoryItem('profile', 'edit-profile');
  const accountPreferencesItem = findCategoryItem('profile', 'account-preferences');

  const handleShare = async () => {
    const text = `${displayName} · ${email} · ${ctx.roleLabel}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t('settings.hub.profileCopied'));
    } catch {
      toast.error(t('common.error'));
    }
  };

  return (
    <SettingsHubPage
      icon="person"
      title={t('settings.categories.profile.title')}
      description={t('settings.categories.profile.hubMinimalDesc')}
    >
      <SettingsHubProfileCard
        avatarFallback={initials}
        name={displayName}
        email={email}
        admin={ctx.isAdmin}
        adminLabel={t('settings.adminBadge')}
        editLabel={t('settings.items.editProfile.title')}
        shareLabel={t('settings.hub.shareProfile')}
        onEdit={() => editProfileItem && onSelectItem(editProfileItem)}
        onShare={() => void handleShare()}
      />

      <SettingsHubSection
        title={t('settings.hub.apiConnectivity')}
        badge={<span className="settings-hub__stable-badge">{t('settings.hub.stable')}</span>}
      >
        <SettingsHubStatRow
          icon="bolt"
          title={t('settings.account.connection')}
          subtitle="OpenWA Enterprise Node"
          statusLabel={connectionLabel}
          statusTone={ctx.apiOnline === false ? 'neutral' : 'success'}
        />
        <SettingsHubStatRow
          icon="hub"
          title={t('settings.hub.branchManagement')}
          subtitle={branchSubtitle}
          statusLabel={t('settings.hub.primary')}
          statusTone="neutral"
        />
      </SettingsHubSection>

      {accountPreferencesItem ? (
        <SettingsHubRow
          icon={accountPreferencesItem.icon}
          title={t(accountPreferencesItem.titleKey)}
          description={
            accountPreferencesItem.descriptionKey
              ? t(accountPreferencesItem.descriptionKey)
              : undefined
          }
          onClick={() => onSelectItem(accountPreferencesItem)}
        />
      ) : null}
    </SettingsHubPage>
  );
}
