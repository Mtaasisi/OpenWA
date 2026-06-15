import { useMemo, useState, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, Package } from 'lucide-react';
import type { CrmProductListItem } from '../../services/api';
import { mergeHealthIssues } from '../../lib/product-health-utils';
import { ProductHealthBadge } from './ProductHealthBadge';
import './products-management.css';

type Props = {
  products: CrmProductListItem[];
  isLoading: boolean;
  onOpen: (product: CrmProductListItem) => void;
};

function formatPrice(currency: string | null, amount: number | null): string {
  if (amount == null) return '—';
  const cur = currency?.trim();
  return cur ? `${cur} ${amount.toLocaleString()}` : amount.toLocaleString();
}

export function ProductManagementTable({ products, isLoading, onOpen }: Props) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      products.map((p) => ({
        product: p,
        issues: mergeHealthIssues(p),
      })),
    [products],
  );

  if (isLoading) {
    return <p className="products-table__meta">{t('common.loading', { defaultValue: 'Loading…' })}</p>;
  }

  if (!rows.length) {
    return <p className="products-table__meta">{t('products.empty')}</p>;
  }

  return (
    <div className="products-table-wrap">
      <table className="products-table">
        <thead>
          <tr>
            <th>{t('products.table.product', { defaultValue: 'Product' })}</th>
            <th>{t('products.table.category', { defaultValue: 'Category / Brand' })}</th>
            <th>{t('products.table.variants', { defaultValue: 'Variants' })}</th>
            <th>{t('products.table.stock', { defaultValue: 'Stock' })}</th>
            <th>{t('products.table.price', { defaultValue: 'Price' })}</th>
            <th>{t('products.table.health', { defaultValue: 'Health' })}</th>
            <th>{t('products.table.updated', { defaultValue: 'Updated' })}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map(({ product: p, issues }) => {
            const isOpen = expanded === p.id;
            return (
              <Fragment key={p.id}>
                <tr>
                  <td>
                    <div className="products-table__product">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt="" className="products-table__thumb" />
                      ) : (
                        <span className="products-table__thumb" aria-hidden>
                          <Package size={18} />
                        </span>
                      )}
                      <div>
                        <div className="products-table__name">{p.name}</div>
                        {p.sku ? <div className="products-table__meta">SKU {p.sku}</div> : null}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div>{p.category ?? '—'}</div>
                    <div className="products-table__meta">{p.brand ?? ''}</div>
                  </td>
                  <td>{p.variantCount ?? 0}</td>
                  <td>{p.totalStock ?? 0}</td>
                  <td>{formatPrice(p.currency, p.sellingPrice)}</td>
                  <td>
                    <ProductHealthBadge issues={issues} compact />
                  </td>
                  <td className="products-table__meta">
                    {new Date(p.updatedAt).toLocaleDateString()}
                  </td>
                  <td className="products-table__actions">
                    <button
                      type="button"
                      className="fu-btn fu-btn--ghost"
                      onClick={() => setExpanded(isOpen ? null : p.id)}
                      aria-expanded={isOpen}
                    >
                      {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    <button
                      type="button"
                      className="fu-btn fu-btn--primary"
                      data-testid={`products-open-${p.id}`}
                      onClick={() => onOpen(p)}
                    >
                      {t('common.open', { defaultValue: 'Open' })}
                    </button>
                  </td>
                </tr>
                {isOpen ? (
                  <tr className="products-table__expand">
                    <td colSpan={8}>
                      <div className="products-table__variants">
                        {p.inventorySummary ? (
                          <p>
                            Available: {p.inventorySummary.available} · Reserved:{' '}
                            {p.inventorySummary.reserved} · Sold: {p.inventorySummary.sold} · IMEI
                            variants: {p.inventorySummary.imeiTrackedVariants}
                          </p>
                        ) : null}
                        {issues.length ? (
                          <p>Warnings: {issues.join(', ')}</p>
                        ) : (
                          <p>{t('products.table.noWarnings', { defaultValue: 'No warnings' })}</p>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
