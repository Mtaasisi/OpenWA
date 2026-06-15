import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLinkedChannels } from '../hooks/useLinkedChannels';
import { useRole } from '../hooks/useRole';
import {
  WorkspacePageHeader,
  StatusBadge,
  ChannelBadge,
} from '../components/workspace';
import { getChannelDef, type ChannelId } from '../lib/channels';
import { MaterialSymbol } from '../components/MaterialSymbol';
import { SmsCampaignPanel } from '../components/SmsCampaignPanel';
import { ProductDemandCampaignPanel } from '../components/ProductDemandCampaignPanel';
import { productDemandApi } from '../services/api';
import { settingsPanelHref } from '../components/settings/settings-nav-registry';
import './Campaigns.css';

const SOCIAL_SAMPLES = [
  { id: 'summer', status: 'draft' as const, channels: ['instagram', 'facebook'] as ChannelId[] },
  { id: 'whatsapp', status: 'scheduled' as const, channels: ['whatsapp'] as ChannelId[] },
  { id: 'tiktok', status: 'active' as const, channels: ['tiktok'] as ChannelId[] },
] as const;

function campaignStatusVariant(status: string): 'neutral' | 'warning' | 'success' {
  if (status === 'sent' || status === 'active') return 'success';
  if (status === 'approved' || status === 'scheduled') return 'warning';
  return 'neutral';
}

export function Campaigns() {
  const { t } = useTranslation();
  const { hasSocialChannels, isSmsReady } = useLinkedChannels();
  const { isAdmin } = useRole();
  useDocumentTitle(t('campaigns.pageTitle'));

  const { data: metrics } = useQuery({
    queryKey: ['product-demand', 'campaigns', 'metrics'],
    queryFn: () => productDemandApi.getCampaignMetrics(),
    enabled: isAdmin,
  });

  const { data: demandCampaigns = [] } = useQuery({
    queryKey: ['product-demand', 'campaigns'],
    queryFn: () => productDemandApi.listCampaigns(),
    enabled: isAdmin,
  });

  const showSocialSamples = demandCampaigns.length === 0;

  return (
    <div className="followups-interakt campaigns-interakt">
      <WorkspacePageHeader
        title={t('campaigns.pageTitle')}
        showSearch={false}
        showExport={false}
        showNewTask={false}
      />

      <div className="followups-interakt__scroll">
        {isAdmin && (
          <div className="campaigns-sms-section">
            <ProductDemandCampaignPanel />
          </div>
        )}

        {isAdmin && isSmsReady && (
          <div className="campaigns-sms-section">
            <SmsCampaignPanel />
          </div>
        )}

        {isAdmin && (
          <div className="fu-bento campaigns-bento">
            <div className="fu-glass-card">
              <span className="fu-glass-card__label">{t('campaigns.metrics.draft')}</span>
              <span className="fu-glass-card__value">{metrics?.draft ?? 0}</span>
            </div>
            <div className="fu-glass-card">
              <span className="fu-glass-card__label">{t('campaigns.metrics.approved')}</span>
              <span className="fu-glass-card__value">{metrics?.approved ?? 0}</span>
            </div>
            <div className="fu-glass-card">
              <span className="fu-glass-card__label">{t('campaigns.metrics.completed')}</span>
              <span className="fu-glass-card__value">{metrics?.sent ?? 0}</span>
            </div>
            <div className="fu-glass-card">
              <span className="fu-glass-card__label">{t('demandCampaign.channelSms')}</span>
              <span className="fu-glass-card__value">{metrics?.sms ?? 0}</span>
            </div>
            <div className="fu-glass-card">
              <span className="fu-glass-card__label">{t('demandCampaign.channelWhatsapp')}</span>
              <span className="fu-glass-card__value">{metrics?.whatsapp ?? 0}</span>
            </div>
          </div>
        )}

        {isAdmin && demandCampaigns.length > 0 && (
          <div className="campaigns-grid">
            {demandCampaigns.map(row => (
              <article key={row.id} className="campaign-card fu-glass-card">
                <header className="campaign-card__head">
                  <div>
                    <h3>{row.title}</h3>
                    <p className="campaign-card__desc">{row.message.slice(0, 120)}</p>
                  </div>
                  <StatusBadge variant={campaignStatusVariant(row.status)}>
                    {t(`demandCampaign.status.${row.status}`, { defaultValue: row.status })}
                  </StatusBadge>
                </header>
                <div className="campaign-card__channels">
                  <ChannelBadge
                    channelId={row.channel === 'whatsapp' ? 'whatsapp' : 'sms'}
                    forceShow
                    disabled
                  />
                </div>
                <dl className="campaign-card__stats">
                  <div>
                    <dt>{t('sms.campaignRecipients')}</dt>
                    <dd>{row.recipientCount}</dd>
                  </div>
                  <div>
                    <dt>{t('campaigns.samples.goal')}</dt>
                    <dd>{row.productNames?.join(', ') ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>{t('demandCampaign.channel')}</dt>
                    <dd>{row.channel.toUpperCase()}</dd>
                  </div>
                </dl>
                <footer className="campaign-card__foot">
                  <Link className="fu-btn fu-btn--ghost" to={settingsPanelHref('ai-learning')}>
                    <MaterialSymbol name="psychology" size={16} />
                    {t('campaigns.demandSource', { defaultValue: 'AI Learning' })}
                  </Link>
                </footer>
              </article>
            ))}
          </div>
        )}

        <div className="campaigns-coming-soon-strip">
          <StatusBadge variant="coming-soon">{t('nav.comingSoon')}</StatusBadge>
          <p>{t('campaigns.socialPublishingHint', { defaultValue: t('campaigns.comingSoonDescription') })}</p>
          {!hasSocialChannels && !isSmsReady && (
            <p className="campaigns-panel__connect-hint">
              {t('campaigns.connectSocialHint')}{' '}
              <Link to="/channels">{t('campaigns.connectSocialCta')}</Link>
            </p>
          )}
        </div>

        {showSocialSamples && (
          <div className="campaigns-grid">
            {SOCIAL_SAMPLES.map(sample => (
              <article key={sample.id} className="campaign-card fu-glass-card campaigns-card--sample">
                <header className="campaign-card__head">
                  <div>
                    <h3>{t(`campaigns.samples.${sample.id}.title`)}</h3>
                    <p className="campaign-card__desc">{t(`campaigns.samples.${sample.id}.description`)}</p>
                  </div>
                  <StatusBadge variant={campaignStatusVariant(sample.status)}>
                    {t(`campaigns.samples.status.${sample.status}`)}
                  </StatusBadge>
                </header>
                <div className="campaign-card__channels">
                  {sample.channels.map(channelId => {
                    const def = getChannelDef(channelId);
                    if (!def) return null;
                    return (
                      <ChannelBadge key={channelId} channelId={channelId} forceShow disabled />
                    );
                  })}
                </div>
                <dl className="campaign-card__stats">
                  <div>
                    <dt>{t('campaigns.samples.reach')}</dt>
                    <dd>—</dd>
                  </div>
                  <div>
                    <dt>{t('campaigns.samples.engagement')}</dt>
                    <dd>—</dd>
                  </div>
                  <div>
                    <dt>{t('campaigns.samples.goal')}</dt>
                    <dd>{t(`campaigns.samples.${sample.id}.goal`)}</dd>
                  </div>
                </dl>
                <footer className="campaign-card__foot">
                  <button type="button" className="fu-btn fu-btn--ghost" disabled>
                    <MaterialSymbol name="visibility" size={16} />
                    {t('campaigns.samples.view')}
                  </button>
                  <button type="button" className="fu-btn fu-btn--primary" disabled>
                    <MaterialSymbol name="edit" size={16} />
                    {t('campaigns.samples.edit')}
                  </button>
                </footer>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
