import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, Palette, ExternalLink } from 'lucide-react';
import { useSettingsPage } from '../settings-page-context';
import { SettingsPanelHeader, SettingsSectionBlock } from '../shell/SettingsPanelHeader';
import { SettingsDetailPage } from '../shell/SettingsDetailPage';
import { SettingsRow } from '../shell/SettingsRow';
import { SettingsDetailRow } from '../shell/SettingsDetailPrimitives';
import { SettingsFormCard } from '../shell/SettingsFormPrimitives';
import { SettingsThemePicker } from '../SettingsThemePicker';
import { InboxPreferencesInlineContent } from './InboxPreferencesInlineContent';
import { NotificationsInlineContent } from './NotificationsInlineContent';
import { AiSetupChecklist } from '../AiSetupChecklist';
import { SettingsMainStat, SettingsMainToggle } from '../SettingsMainPrimitives';
import { WhatsAppChannelPanel } from '../../WhatsAppChannelPanel';
import { SmsChannelPanel } from '../../SmsChannelPanel';
import { Sessions } from '../../../pages/Sessions';
import { DesktopAppSettingsPanel } from '../DesktopAppSettingsPanel';
import { StatusBarSettingsPanel } from '../../status-bar/StatusBarSettingsPanel';
import { canAccessApiDocs } from '../../../lib/can-access-api-docs';
import type { SettingsPanelId } from '../settings-nav-registry';
type Props = {
  inlineId: string;
  pageTitle: string;
  pageIcon?: string;
  onSelectPanel: (id: SettingsPanelId) => void;
};

export function SettingsInlinePanel({ inlineId, pageTitle, pageIcon, onSelectPanel }: Props) {
  const { t } = useTranslation();
  const ctx = useSettingsPage();

  switch (inlineId) {
    case 'edit-profile': {
      const displayName = ctx.storedUser?.name ?? '—';
      const connectionStatus =
        ctx.apiOnline === null
          ? '…'
          : ctx.apiOnline
            ? t('settings.account.online')
            : t('settings.account.offline');

      return (
        <SettingsDetailPage
          title={pageTitle}
          icon={pageIcon}
          description={t('settings.items.editProfile.description')}
        >
          <SettingsFormCard>
            <SettingsDetailRow
              icon="person"
              label={t('settings.account.name')}
              value={displayName}
            />
            <SettingsDetailRow
              icon="badge"
              label={t('settings.account.role')}
              value={
                <span className="settings-wa__detail-row-value-inline">
                  {ctx.roleLabel}
                  {ctx.isAdmin ? (
                    <span className="settings-wa__nav-card-admin">{t('settings.adminBadge')}</span>
                  ) : null}
                </span>
              }
              subValue={ctx.storedUser?.email ?? '—'}
            />
            <SettingsDetailRow
              icon="api"
              label={t('settings.account.connection')}
              value="OpenWA Enterprise Node"
              subValue={
                <span
                  className={`settings-wa__status settings-wa__status--${ctx.apiOnline === false ? 'danger' : 'success'}`}
                >
                  {connectionStatus}
                </span>
              }
            />
          </SettingsFormCard>
        </SettingsDetailPage>
      );
    }

    case 'business-profile':
      return (
        <SettingsDetailPage
          title={pageTitle}
          icon={pageIcon}
          description={t('settings.items.businessProfile.description')}
        >
          {ctx.serverDraft ? (
            <SettingsSectionBlock icon="store" title={t('settings.items.businessProfile.title')}>
              {ctx.serverReadOnly ? (
                <p className="settings-readonly-banner">{t('settings.readOnlyHint')}</p>
              ) : null}
              <SettingsMainToggle
                label={t('settings.api.autoReconnect')}
                checked={ctx.serverDraft.general.autoReconnect}
                disabled={ctx.serverReadOnly}
                onChange={checked => ctx.patchServer({ general: { autoReconnect: checked } })}
              />
              <SettingsMainToggle
                label={t('settings.api.debugMode')}
                checked={ctx.serverDraft.general.debugMode}
                disabled={ctx.serverReadOnly}
                onChange={checked => ctx.patchServer({ general: { debugMode: checked } })}
              />
            </SettingsSectionBlock>
          ) : (
            <Loader2 className="animate-spin" size={24} />
          )}
        </SettingsDetailPage>
      );

    case 'account-preferences':
      return (
        <SettingsDetailPage
          title={pageTitle}
          icon={pageIcon}
          description={t('settings.items.accountPreferences.description')}
        >
          <SettingsSectionBlock icon="lock" title={t('settings.items.passwordSecurity.title')}>
            <p className="settings-wa__detail-prose">{t('settings.passwordSecurity.noSelfService')}</p>
            <SettingsRow
              icon="mail"
              title={t('settings.account.email')}
              description={ctx.storedUser?.email ?? '—'}
            />
          </SettingsSectionBlock>
          <SettingsSectionBlock icon="palette" title={t('settings.appearance.themeTitle')}>
            <SettingsThemePicker />
            <Link
              to="/themes"
              className="settings-wa__btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 12, textDecoration: 'none' }}
            >
              <Palette size={16} />
              {t('settings.appearance.manageThemes')}
            </Link>
          </SettingsSectionBlock>
          <SettingsSectionBlock icon="language" title={t('settings.appearance.languageTitle')}>
            <label className="settings-wa__field">
              <span>{t('settings.appearance.languageTitle')}</span>
              <select
                value={ctx.currentLang}
                onChange={e => ctx.onLanguageChange(e.target.value as typeof ctx.currentLang)}
              >
                <option value="en">{t('common.english')}</option>
                <option value="he">{t('common.hebrew')}</option>
                <option value="sw">{t('common.swahili')}</option>
              </select>
            </label>
          </SettingsSectionBlock>
        </SettingsDetailPage>
      );

    case 'password-security':
      return (
        <SettingsDetailPage
          title={pageTitle}
          icon={pageIcon}
          description={t('settings.items.passwordSecurity.description')}
        >
          <SettingsSectionBlock icon="lock" title={t('settings.items.passwordSecurity.title')}>
            <p className="settings-wa__detail-prose">{t('settings.passwordSecurity.noSelfService')}</p>
            <SettingsRow
              icon="mail"
              title={t('settings.account.email')}
              description={ctx.storedUser?.email ?? '—'}
            />
          </SettingsSectionBlock>
        </SettingsDetailPage>
      );

    case 'appearance':
      return (
        <SettingsDetailPage
          title={pageTitle}
          icon={pageIcon}
          description={t('settings.items.appearance.description')}
        >
          <SettingsSectionBlock icon="palette" title={t('settings.appearance.themeTitle')}>
            <SettingsThemePicker />
            <Link to="/themes" className="settings-wa__btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 12, textDecoration: 'none' }}>
              <Palette size={16} />
              {t('settings.appearance.manageThemes')}
            </Link>
          </SettingsSectionBlock>
          <SettingsSectionBlock icon="language" title={t('settings.appearance.languageTitle')}>
            <label className="settings-wa__field">
              <span>{t('settings.appearance.languageTitle')}</span>
              <select
                value={ctx.currentLang}
                onChange={e => ctx.onLanguageChange(e.target.value as typeof ctx.currentLang)}
              >
                <option value="en">{t('common.english')}</option>
                <option value="he">{t('common.hebrew')}</option>
                <option value="sw">{t('common.swahili')}</option>
              </select>
            </label>
          </SettingsSectionBlock>
        </SettingsDetailPage>
      );

    case 'sessions':
      return (
        <SettingsDetailPage
          wide
          title={pageTitle}
          icon={pageIcon}
          description={t('settings.items.sessions.description')}
        >
          <SettingsFormCard>
            <Sessions embedded embedContext="settings" />
          </SettingsFormCard>
        </SettingsDetailPage>
      );

    case 'about':
    case 'app-version':
      return (
        <SettingsDetailPage
          title={pageTitle}
          icon={pageIcon}
          description={t('settings.items.about.description')}
        >
          <SettingsSectionBlock icon="info" title={t('common.appName')}>
            <SettingsRow icon="info" title="OpenWA Dashboard" description="v2.4.8-enterprise" />
            <SettingsRow icon="link" title={t('settings.about.apiUrl')} description="/api" />
          </SettingsSectionBlock>
        </SettingsDetailPage>
      );

    case 'inbox-preferences':
      return (
        <SettingsDetailPage
          title={pageTitle}
          icon={pageIcon}
          description={t('settings.items.inboxPreferences.description')}
        >
          <InboxPreferencesInlineContent ctx={ctx} />
        </SettingsDetailPage>
      );

    case 'product-send-rules':
      return (
        <SettingsDetailPage
          title={pageTitle}
          icon={pageIcon}
          description={t('settings.items.productSendRules.description')}
        >
          <SettingsSectionBlock icon="send" title={t('settings.inbox.productDefaults')}>
            <SettingsMainToggle
              label={t('products.inbox.inStockOnly')}
              checked={ctx.userPrefs.productInStockOnly}
              onChange={checked => ctx.setUserPrefs(p => ({ ...p, productInStockOnly: checked }))}
            />
            <SettingsMainToggle
              label={t('products.inbox.includeImage')}
              checked={ctx.userPrefs.productIncludeImage}
              onChange={checked => ctx.setUserPrefs(p => ({ ...p, productIncludeImage: checked }))}
            />
            <SettingsMainToggle
              label={t('products.inbox.includeDevices')}
              checked={ctx.userPrefs.productIncludeDevices}
              onChange={checked => ctx.setUserPrefs(p => ({ ...p, productIncludeDevices: checked }))}
            />
          </SettingsSectionBlock>
        </SettingsDetailPage>
      );

    case 'whatsapp-accounts':
      return (
        <SettingsDetailPage
          wide
          title={pageTitle}
          icon={pageIcon}
          description={t('settings.items.whatsappAccounts.description')}
        >
          <SettingsFormCard>
            <WhatsAppChannelPanel />
          </SettingsFormCard>
        </SettingsDetailPage>
      );

    case 'sms-channel':
      return (
        <SettingsDetailPage
          wide
          title={pageTitle}
          icon={pageIcon}
          description={t('settings.items.smsChannel.description')}
        >
          <SettingsFormCard>
            <SmsChannelPanel />
          </SettingsFormCard>
        </SettingsDetailPage>
      );

    case 'ai-overview':
      return (
        <SettingsDetailPage
          title={pageTitle}
          icon={pageIcon}
          description={t('settings.items.aiOverview.description')}
        >
          {ctx.isAdmin ? (
            <AiSetupChecklist
              variant="hub"
              onNavigate={onSelectPanel}
              onNavigateAutoReply={ctx.onNavigateAutoReply}
            />
          ) : null}
          <SettingsSectionBlock icon="smart_toy" title={t('settings.ai.workspaceStripTitle')}>
            {ctx.isAdmin && ctx.aiMeta ? (
              <SettingsMainStat label={t('settings.ai.statusLabel')}>{ctx.aiMeta}</SettingsMainStat>
            ) : null}
            <div className="settings-int-actions">
              <Link to="/ai" className="settings-wa__btn-primary settings-hub__cta-btn" style={{ textDecoration: 'none' }}>
                {t('settings.ai.openAssistant')}
              </Link>
            </div>
          </SettingsSectionBlock>
        </SettingsDetailPage>
      );

    case 'notifications':
      return (
        <SettingsDetailPage
          title={pageTitle}
          icon={pageIcon}
          description={t('settings.items.notifications.description')}
        >
          <NotificationsInlineContent ctx={ctx} />
        </SettingsDetailPage>
      );

    case 'developer-tools':
      return (
        <SettingsDetailPage
          title={pageTitle}
          icon={pageIcon}
          description={t('settings.items.developerTools.description')}
        >
          <SettingsSectionBlock icon="terminal" title={t('settings.api.devToolsStripTitle')}>
            {ctx.isAdmin ? (
              <SettingsRow
                icon="history"
                title={t('nav.logs')}
                onClick={() => onSelectPanel('logs')}
              />
            ) : null}
            {canAccessApiDocs(ctx.isAdmin) ? (
              <SettingsRow
                icon="menu_book"
                title={t('settings.api.openDocs')}
                right={<ExternalLink size={16} />}
                onClick={() => window.open('/api/docs', '_blank', 'noopener,noreferrer')}
              />
            ) : null}
          </SettingsSectionBlock>
        </SettingsDetailPage>
      );

    case 'database':
    case 'diagnostics':
    case 'export-debug':
      return (
        <SettingsDetailPage
          wide
          title={pageTitle}
          icon={pageIcon}
          description={t('settings.items.database.description')}
        >
          <SettingsFormCard>
            {ctx.isAdmin ? (
              <DesktopAppSettingsPanel onBack={() => undefined} backSection="system" />
            ) : (
              <p className="settings-form-intro">{t('settings.readOnlyHint')}</p>
            )}
          </SettingsFormCard>
        </SettingsDetailPage>
      );

    case 'help-center':
    case 'contact-support':
      return (
        <SettingsDetailPage
          title={pageTitle}
          icon={pageIcon}
          description={t('settings.items.helpCenter.description')}
        >
          <SettingsSectionBlock icon="help" title={t('settings.about.supportTitle')}>
            <SettingsRow
              icon="support_agent"
              title={t('settings.items.contactSupport.title')}
              description={t('settings.items.contactSupport.description')}
            />
            {canAccessApiDocs(ctx.isAdmin) ? (
              <SettingsRow
                icon="menu_book"
                title={t('settings.api.openDocs')}
                onClick={() => window.open('/api/docs', '_blank', 'noopener,noreferrer')}
              />
            ) : null}
          </SettingsSectionBlock>
        </SettingsDetailPage>
      );

    case 'logout':
      return (
        <SettingsDetailPage title={pageTitle} icon={pageIcon ?? 'logout'}>
          <SettingsFormCard>
            <p className="settings-wa__detail-prose">{t('settings.shell.signOutHint')}</p>
            <div className="settings-form-toolbar">
              <button type="button" className="settings-wa__btn-danger" onClick={ctx.onLogout}>
                {t('common.logout')}
              </button>
            </div>
          </SettingsFormCard>
        </SettingsDetailPage>
      );

    case 'status-bar':
      return <StatusBarSettingsPanel title={pageTitle} icon={pageIcon} />;

    default:
      return (
        <SettingsPanelHeader
          icon="settings"
          title={inlineId}
          description={t('settings.items.editProfile.description')}
        />
      );
  }
}
