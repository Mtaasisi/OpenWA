import { useTranslation } from 'react-i18next';
import { Package, Send, FileText, Megaphone } from 'lucide-react';
import { MaterialSymbol } from '../MaterialSymbol';
import { DashboardSection } from './DashboardSection';
import { EmptyState, QuickActionButton } from './index';
import type { ProductDemandRow } from '../../lib/dashboard-metrics';
import { settingsPanelHref } from '../../components/settings/settings-nav-registry';

interface DashboardProductDemandProps {
  products: ProductDemandRow[];
  draftCampaignsCount?: number;
  lostDemandWaiting?: number;
}

export function DashboardProductDemand({
  products,
  draftCampaignsCount = 0,
  lostDemandWaiting = 0,
}: DashboardProductDemandProps) {
  const { t } = useTranslation();
  const visible = products.slice(0, 12);

  return (
    <DashboardSection
      title={t('dashboard.controlRoom.productDemand')}
      icon={<MaterialSymbol name="inventory_2" size={20} className="dash-section__title-icon" />}
      linkTo={settingsPanelHref('ai-learning')}
      linkLabel={t('dashboard.controlRoom.viewProductDemand', { defaultValue: 'Product demand' })}
    >
      {products.length === 0 ? (
        <EmptyState
          title={t('dashboard.controlRoom.productDemandEmpty')}
          description={t('dashboard.controlRoom.productDemandEmptyDesc')}
        />
      ) : (
        <>
          {draftCampaignsCount > 0 && (
            <div className="dash-product-demand-campaigns-hint">
              <p>
                {t('dashboard.controlRoom.demandCampaignsHint', {
                  count: draftCampaignsCount,
                })}
              </p>
              <QuickActionButton
                label={t('dashboard.controlRoom.actions.openCampaigns')}
                to="/campaigns"
                icon={Megaphone}
              />
            </div>
          )}
          {lostDemandWaiting > 0 && (
            <div className="dash-product-demand-campaigns-hint">
              <p>
                {t('dashboard.controlRoom.lostDemandHint', {
                  count: lostDemandWaiting,
                  defaultValue: '{{count}} customers waiting to be notified when stock arrives',
                })}
              </p>
              <QuickActionButton
                label={t('dashboard.controlRoom.actions.viewFollowups')}
                to="/followups"
                icon={Send}
              />
            </div>
          )}
        <div className="dash-product-grid">
          {visible.map(row => (
            <article key={row.name} className="dash-product-card">
              <div className="dash-product-card__header">
                <div className="dash-product-card__icon-well" aria-hidden>
                  <MaterialSymbol name="inventory_2" size={18} />
                </div>
                <div className="dash-product-card__body">
                  <h4 className="dash-product-card__name">{row.name}</h4>
                  <p className="dash-product-card__stats">
                    {t('dashboard.controlRoom.productCard.requests', { count: row.requests })}
                    {' · '}
                    {t('dashboard.controlRoom.productCard.quotes', { count: row.quotesCreated })}
                    {row.wonCount > 0 && (
                      <>
                        {' · '}
                        {t('dashboard.controlRoom.productCard.won', { count: row.wonCount })}
                      </>
                    )}
                  </p>
                </div>
                {row.stockStatus && (
                  <span className="dash-product-card__stock">{row.stockStatus}</span>
                )}
              </div>
              <div className="dash-product-card__actions">
                <QuickActionButton
                  label={t('dashboard.controlRoom.actions.viewProduct')}
                  to="/products"
                  icon={Package}
                />
                <QuickActionButton
                  label={t('dashboard.controlRoom.actions.sendProduct')}
                  to="/inbox"
                  icon={Send}
                />
                <QuickActionButton
                  label={t('dashboard.controlRoom.actions.createQuote')}
                  to="/quotes?create=1"
                  icon={FileText}
                />
              </div>
            </article>
          ))}
        </div>
        </>
      )}
    </DashboardSection>
  );
}
