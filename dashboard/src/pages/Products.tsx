import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Package,
  Trash2,
  Loader2,
  AlertTriangle,
  Ban,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { productsApi, type CrmProductListItem } from '../services/api';
import { ProductEditorModal } from '../components/ProductEditorModal';
import { InauzwaIntegrationPanel } from '../components/settings/InauzwaIntegrationPanel';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useRole } from '../hooks/useRole';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { PageHeader } from '../components/PageHeader';
import './Products.css';

const LOW_STOCK_THRESHOLD = 10;

function stockLevel(totalStock: number): 'out' | 'low' | 'ok' {
  if (totalStock === 0) return 'out';
  if (totalStock < LOW_STOCK_THRESHOLD) return 'low';
  return 'ok';
}

function stockBarWidth(totalStock: number, scaleMax: number): number {
  if (totalStock <= 0) return 0;
  return Math.min(100, (totalStock / scaleMax) * 100);
}

export function Products() {
  const { t } = useTranslation();
  useDocumentTitle(t('products.title'));
  const { canWrite } = useRole();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [activeOnly, setActiveOnly] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorProductId, setEditorProductId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: stats } = useQuery({
    queryKey: ['products', 'catalog-stats', activeOnly],
    queryFn: () => productsApi.catalogStats({ activeOnly }),
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', 'list', debouncedSearch, inStockOnly, activeOnly],
    queryFn: () =>
      productsApi.list({
        q: debouncedSearch || undefined,
        inStockOnly,
        activeOnly,
      }),
  });

  const { data: editorProduct, isLoading: editorProductLoading } = useQuery({
    queryKey: ['products', editorProductId],
    queryFn: () => productsApi.get(editorProductId!),
    enabled: editorOpen && !!editorProductId,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['products'] });

  const closeEditor = () => {
    setEditorOpen(false);
    setEditorProductId(null);
  };

  const deleteProduct = useMutation({
    mutationFn: (id: string) => productsApi.remove(id),
    onSuccess: (_data, deletedId) => {
      invalidate();
      setDeleteId(null);
      if (editorProductId === deletedId) {
        closeEditor();
      }
    },
  });

  const openCreate = () => {
    setEditorProductId(null);
    setEditorOpen(true);
  };

  const openEdit = (p: CrmProductListItem) => {
    setEditorProductId(p.id);
    setEditorOpen(true);
  };

  const scaleMax = stats?.scaleMax ?? LOW_STOCK_THRESHOLD;
  const inventoryValueLabel = stats
    ? stats.currencyHint
      ? `${stats.currencyHint} ${stats.inventoryValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
      : stats.inventoryValue.toLocaleString(undefined, { maximumFractionDigits: 0 })
    : '—';

  return (
    <div className="products-page">
      <PageHeader
        title={t('products.title')}
        subtitle={t('products.subtitle')}
        actions={
          canWrite ? (
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              <Plus size={16} /> {t('products.addProduct')}
            </button>
          ) : undefined
        }
      />

      <InauzwaIntegrationPanel defaultOpen />

      <div className="products-stats">
        <article className="products-stat-card">
          <div className="products-stat-card__top">
            <span className="products-stat-card__label">{t('products.stats.totalSkus')}</span>
            <Layers size={18} className="products-stat-card__icon products-stat-card__icon--primary" />
          </div>
          <p className="products-stat-card__value">{stats?.total ?? '—'}</p>
          <p className="products-stat-card__hint">{t('products.stats.totalSkusHint')}</p>
        </article>
        <article className="products-stat-card">
          <div className="products-stat-card__top">
            <span className="products-stat-card__label">{t('products.stats.lowStock')}</span>
            <AlertTriangle size={18} className="products-stat-card__icon products-stat-card__icon--warn" />
          </div>
          <p className="products-stat-card__value">{stats?.lowStock ?? '—'}</p>
          <p className="products-stat-card__hint">{t('products.stats.lowStockHint')}</p>
        </article>
        <article className="products-stat-card">
          <div className="products-stat-card__top">
            <span className="products-stat-card__label">{t('products.stats.outOfStock')}</span>
            <Ban size={18} className="products-stat-card__icon products-stat-card__icon--error" />
          </div>
          <p className="products-stat-card__value">{stats?.outOfStock ?? '—'}</p>
          <p className="products-stat-card__hint">{t('products.stats.outOfStockHint')}</p>
        </article>
        <article className="products-stat-card">
          <div className="products-stat-card__top">
            <span className="products-stat-card__label">{t('products.stats.inventoryValue')}</span>
            <Package size={18} className="products-stat-card__icon products-stat-card__icon--muted" />
          </div>
          <p className="products-stat-card__value products-stat-card__value--price">{inventoryValueLabel}</p>
          <p className="products-stat-card__hint">{t('products.stats.inventoryValueHint')}</p>
        </article>
      </div>

      <section className="products-table-shell">
        <div className="products-table-toolbar">
          <div className="products-table-toolbar__left">
            <div className="products-search">
              <Search size={18} aria-hidden />
              <input
                type="search"
                placeholder={t('products.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <label className="products-filter-chip">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
              />
              {t('products.inStockOnlyFilter')}
            </label>
            <label className="products-filter-chip">
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(e) => setActiveOnly(e.target.checked)}
              />
              {t('products.activeOnlyFilter')}
            </label>
          </div>
          <span className="products-table-toolbar__meta">
            {t('products.table.showing', { count: products.length })}
          </span>
        </div>

        {isLoading ? (
          <div className="products-table-loading">
            <Loader2 className="animate-spin" />
          </div>
        ) : products.length === 0 ? (
          <div className="products-empty products-empty--in-table">
            <Package size={48} strokeWidth={1.25} aria-hidden />
            <p>{t('products.empty')}</p>
            {canWrite && (
              <button type="button" className="btn btn-primary" onClick={openCreate}>
                <Plus size={16} /> {t('products.addProduct')}
              </button>
            )}
          </div>
        ) : (
          <div className="products-table-wrap">
            <table className="products-table">
              <thead>
                <tr>
                  <th>{t('products.table.product')}</th>
                  <th>{t('products.fields.sku')}</th>
                  <th>{t('products.fields.category')}</th>
                  <th>{t('products.table.stock')}</th>
                  <th className="products-table__col-price">{t('products.fields.price')}</th>
                  <th className="products-table__col-action" aria-hidden />
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const level = stockLevel(p.totalStock);
                  const barW = stockBarWidth(p.totalStock, scaleMax);
                  const priceLabel =
                    p.sellingPrice != null
                      ? `${p.currency ?? ''} ${p.sellingPrice.toLocaleString()}`.trim()
                      : '—';
                  return (
                    <tr
                      key={p.id}
                      className={`products-table__row ${p.isActive ? '' : 'inactive'}`}
                      onClick={() => openEdit(p)}
                    >
                      <td>
                        <div className="products-table__product">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt="" className="products-table__thumb" />
                          ) : (
                            <div className="products-table__thumb products-table__thumb--empty">
                              <Package size={20} />
                            </div>
                          )}
                          <div className="products-table__product-text">
                            <span className="products-table__name">{p.name}</span>
                            <span className="products-table__sub">
                              {p.variantCount > 0
                                ? t('products.variantCount', { count: p.variantCount })
                                : t('products.table.noVariants')}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="products-table__sku">{p.sku?.trim() || '—'}</td>
                      <td>
                        {p.category ? (
                          <span className="products-table__category">{p.category}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <div className="products-table__stock">
                          <div className="products-table__stock-bar" aria-hidden>
                            <div
                              className={`products-table__stock-fill products-table__stock-fill--${level}`}
                              style={{ width: `${barW}%` }}
                            />
                          </div>
                          <span
                            className={`products-table__stock-badge products-table__stock-badge--${level}`}
                          >
                            {level === 'out'
                              ? t('products.table.stockOut')
                              : level === 'low'
                                ? t('products.table.stockLow', { count: p.totalStock })
                                : t('products.table.stockIn', { count: p.totalStock })}
                          </span>
                        </div>
                      </td>
                      <td className="products-table__col-price">{priceLabel}</td>
                      <td className="products-table__col-action">
                        {canWrite && (
                          <button
                            type="button"
                            className="products-table__row-delete"
                            aria-label={t('common.delete')}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteId(p.id);
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                        <ChevronRight size={18} className="products-table__row-chevron" aria-hidden />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && products.length > 0 && (
          <footer className="products-table-footer">
            <span>{t('products.table.showing', { count: products.length })}</span>
          </footer>
        )}
      </section>

      <ProductEditorModal
        isOpen={editorOpen}
        product={editorProductId ? editorProduct ?? null : null}
        loadingProductId={
          editorOpen && editorProductId && editorProductLoading && !editorProduct
            ? editorProductId
            : null
        }
        canWrite={canWrite}
        onClose={closeEditor}
        onDelete={(id) => setDeleteId(id)}
        onSaved={() => invalidate()}
      />

      {deleteId && (
        <div className="products-delete-overlay" onClick={() => setDeleteId(null)}>
          <div className="products-delete-dialog" onClick={(e) => e.stopPropagation()} role="alertdialog">
            <h3>{t('common.delete')}</h3>
            <p>{t('products.deleteConfirm')}</p>
            <div className="products-delete-dialog__actions">
              <button type="button" className="btn btn-secondary" onClick={() => setDeleteId(null)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={deleteProduct.isPending}
                onClick={() => deleteProduct.mutate(deleteId)}
              >
                {deleteProduct.isPending ? <Loader2 className="animate-spin" size={14} /> : null}
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
