import { useTranslation } from 'react-i18next';
import type { CatalogStats, ProductHealthSummary } from '../../services/api';
import './products-management.css';

type Props = {
  catalogStats?: CatalogStats;
  healthSummary?: ProductHealthSummary;
};

export function ProductSummaryCards({ catalogStats, healthSummary }: Props) {
  const { t } = useTranslation();

  const cards = [
    {
      label: t('products.summary.total', { defaultValue: 'Total products' }),
      value: healthSummary?.totalProducts ?? catalogStats?.total ?? 0,
    },
    {
      label: t('products.summary.active', { defaultValue: 'Active products' }),
      value: healthSummary?.activeProducts ?? 0,
    },
    {
      label: t('products.summary.lowStock', { defaultValue: 'Low stock' }),
      value: healthSummary?.lowStock ?? catalogStats?.lowStock ?? 0,
    },
    {
      label: t('products.summary.outOfStock', { defaultValue: 'Out of stock' }),
      value: healthSummary?.outOfStock ?? catalogStats?.outOfStock ?? 0,
    },
    {
      label: t('products.summary.missingImages', { defaultValue: 'Missing images' }),
      value: healthSummary?.missingImages ?? 0,
    },
    {
      label: t('products.summary.importIssues', { defaultValue: 'Import issues' }),
      value: healthSummary?.importIssues ?? 0,
    },
  ];

  return (
    <div className="products-summary-cards">
      {cards.map((card) => (
        <article key={card.label} className="products-summary-card">
          <span className="products-summary-card__value">{card.value}</span>
          <span className="products-summary-card__label">{card.label}</span>
        </article>
      ))}
    </div>
  );
}
