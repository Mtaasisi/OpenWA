import { useTranslation } from 'react-i18next';

export type ProductDemandFilters = {
  matched?: '' | 'matched' | 'unmatched';
  installmentOnly?: boolean;
  discountOnly?: boolean;
  paymentReadyOnly?: boolean;
  trendingOnly?: boolean;
  category?: string;
  brand?: string;
  from?: string;
  to?: string;
};

type Props = {
  filters: ProductDemandFilters;
  onChange: (next: ProductDemandFilters) => void;
};

export function ProductDemandFilterBar({ filters, onChange }: Props) {
  const { t } = useTranslation();
  const set = (patch: Partial<ProductDemandFilters>) => onChange({ ...filters, ...patch });

  return (
    <div className="ail-filters">
      <select
        className="ail-filter-select"
        value={filters.matched ?? ''}
        onChange={e => set({ matched: (e.target.value || '') as ProductDemandFilters['matched'] })}
      >
        <option value="">{t('ai.learning.filters.allProducts')}</option>
        <option value="matched">{t('ai.learning.filters.matched')}</option>
        <option value="unmatched">{t('ai.learning.filters.unmatched')}</option>
      </select>
      <input
        className="ail-filter-input"
        placeholder={t('ai.learning.filters.category')}
        value={filters.category ?? ''}
        onChange={e => set({ category: e.target.value || undefined })}
      />
      <input
        className="ail-filter-input"
        placeholder={t('ai.learning.filters.brand')}
        value={filters.brand ?? ''}
        onChange={e => set({ brand: e.target.value || undefined })}
      />
      <label className="ail-filter-check">
        <input
          type="checkbox"
          checked={!!filters.installmentOnly}
          onChange={e => set({ installmentOnly: e.target.checked || undefined })}
        />
        {t('ai.learning.filters.installment')}
      </label>
      <label className="ail-filter-check">
        <input
          type="checkbox"
          checked={!!filters.discountOnly}
          onChange={e => set({ discountOnly: e.target.checked || undefined })}
        />
        {t('ai.learning.filters.discount')}
      </label>
      <label className="ail-filter-check">
        <input
          type="checkbox"
          checked={!!filters.paymentReadyOnly}
          onChange={e => set({ paymentReadyOnly: e.target.checked || undefined })}
        />
        {t('ai.learning.filters.paymentReady')}
      </label>
      <label className="ail-filter-check">
        <input
          type="checkbox"
          checked={!!filters.trendingOnly}
          onChange={e => set({ trendingOnly: e.target.checked || undefined })}
        />
        {t('ai.learning.filters.trending')}
      </label>
      <input
        className="ail-filter-input"
        type="date"
        title={t('ai.learning.filters.fromDate')}
        value={filters.from ?? ''}
        onChange={e => set({ from: e.target.value || undefined })}
      />
      <input
        className="ail-filter-input"
        type="date"
        title={t('ai.learning.filters.toDate')}
        value={filters.to ?? ''}
        onChange={e => set({ to: e.target.value || undefined })}
      />
    </div>
  );
}

export { filtersToQueryParams } from './product-demand-filters';
