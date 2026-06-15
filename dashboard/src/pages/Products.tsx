import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, Loader2, Plus, RefreshCw, Settings2, Upload, X } from 'lucide-react';
import { productsApi, type CrmProductListItem } from '../services/api';
import { ProductEditorModal } from '../components/ProductEditorModal';
import { ProductCatalogView } from '../components/ProductCatalogView';
import { InauzwaIntegrationPanel } from '../components/settings/InauzwaIntegrationPanel';
import { ProductSummaryCards } from '../components/products/ProductSummaryCards';
import { ProductToolbar, type ProductViewMode, type StockFilter } from '../components/products/ProductToolbar';
import { ProductManagementTable } from '../components/products/ProductManagementTable';
import { ProductCategorySidebar } from '../components/products/ProductCategorySidebar';
import { ProductImportWizard } from '../components/products/ProductImportWizard';
import { ProductImportHistoryPanel } from '../components/products/ProductImportHistoryPanel';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useRole } from '../hooks/useRole';
import { useTheme } from '../hooks/useTheme';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { AskAiLink } from '../components/AskAiLink';
import { ModalOverlay } from '../components/ModalOverlay';
import '../components/products/products-management.css';
import './Products.css';

type ProductListTab = 'active' | 'all' | 'inactive';

export function Products() {
  const { t } = useTranslation();
  useDocumentTitle(t('products.title'));
  const { canWrite } = useRole();
  const { activeTheme } = useTheme();
  const stitchShell = activeTheme.effects === 'stitch';
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const [listTab, setListTab] = useState<ProductListTab>('active');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [viewMode, setViewMode] = useState<ProductViewMode>('table');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorProductId, setEditorProductId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [inauzwaOpen, setInauzwaOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importHistoryOpen, setImportHistoryOpen] = useState(false);

  useEffect(() => {
    setCategoryFilter('all');
    setBrandFilter('all');
  }, [listTab, debouncedSearch]);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', 'list', debouncedSearch, false, listTab !== 'active'],
    queryFn: () =>
      productsApi.list({
        q: debouncedSearch || undefined,
        inStockOnly: false,
        activeOnly: listTab === 'active',
      }),
  });

  const { data: catalogStats } = useQuery({
    queryKey: ['products', 'catalog-stats'],
    queryFn: () => productsApi.catalogStats(),
  });

  const { data: healthSummary } = useQuery({
    queryKey: ['products', 'health-summary'],
    queryFn: () => productsApi.healthSummary(),
  });

  const visibleProducts = useMemo(() => {
    let list = products;
    if (listTab === 'inactive') list = list.filter((p) => !p.isActive);
    if (listTab === 'active') list = list.filter((p) => p.isActive);
    if (categoryFilter !== 'all') list = list.filter((p) => p.category === categoryFilter);
    if (brandFilter !== 'all') list = list.filter((p) => p.brand === brandFilter);
    if (stockFilter === 'in_stock') list = list.filter((p) => p.totalStock > 0);
    if (stockFilter === 'low') list = list.filter((p) => p.totalStock > 0 && p.totalStock < 10);
    if (stockFilter === 'out') list = list.filter((p) => p.totalStock === 0);
    return list;
  }, [products, listTab, categoryFilter, brandFilter, stockFilter]);

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter(Boolean) as string[])].sort(),
    [products],
  );
  const brands = useMemo(
    () => [...new Set(products.map((p) => p.brand).filter(Boolean) as string[])].sort(),
    [products],
  );

  const { data: inauzwaStatus } = useQuery({
    queryKey: ['products', 'inauzwa-status'],
    queryFn: () => productsApi.inauzwaSyncStatus(),
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
      if (editorProductId === deletedId) closeEditor();
    },
  });

  const quickSync = useMutation({
    mutationFn: () => productsApi.quickSyncInauzwa(),
    onSuccess: () => {
      invalidate();
      setSyncStatus(t('products.inbox.stockRefreshed'));
      setTimeout(() => setSyncStatus(null), 2500);
    },
    onError: (err: Error) => setSyncStatus(err.message),
  });

  const exportProducts = async () => {
    const { csv } = await productsApi.importTemplate();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'PRODUCT_IMPORT_TEMPLATE.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const openCreate = () => {
    setEditorProductId(null);
    setEditorOpen(true);
  };

  const openEdit = (p: CrmProductListItem) => {
    setEditorProductId(p.id);
    setEditorOpen(true);
  };

  const inauzwaConfigured = !!inauzwaStatus?.configured;
  const syncStatusIsError =
    !!syncStatus && syncStatus !== t('products.inbox.stockRefreshed');

  const listTabs = useMemo(
    () => [
      { id: 'active' as const, label: t('products.catalog.tabActive') },
      { id: 'all' as const, label: t('products.catalog.tabAll') },
      { id: 'inactive' as const, label: t('products.catalog.tabInactive') },
    ],
    [t],
  );

  return (
    <div className="followups-interakt products-interakt products-page" data-theme-effects="interakt">
      <div className="followups-interakt__scroll products-page__scroll">
        <div className="products-page-header">
          <div className="products-page-header__text">
            <h1>{t('products.title')}</h1>
            <p>
              {t('products.subtitle', {
                defaultValue:
                  'Manage catalog, variants, stock, IMEI, and WhatsApp product sharing.',
              })}
            </p>
          </div>
          <div className="products-page-header__actions">
            <AskAiLink prompt={t('ai.prompts.products')} />
            {canWrite ? (
              <>
                <button type="button" className="fu-btn fu-btn--primary" onClick={openCreate}>
                  <Plus size={16} /> {t('products.addProduct')}
                </button>
                <button
                  type="button"
                  className="fu-btn fu-btn--ghost"
                  data-testid="products-import-btn"
                  onClick={() => setImportOpen(true)}
                >
                  <Upload size={16} /> {t('products.import', { defaultValue: 'Import' })}
                </button>
                <button type="button" className="fu-btn fu-btn--ghost" onClick={() => void exportProducts()}>
                  <Download size={16} /> {t('products.export', { defaultValue: 'Export' })}
                </button>
              </>
            ) : null}
            {inauzwaConfigured && canWrite ? (
              <button
                type="button"
                className="fu-btn fu-btn--ghost"
                disabled={quickSync.isPending}
                onClick={() => quickSync.mutate()}
              >
                {quickSync.isPending ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />}
                {t('products.sync', { defaultValue: 'Sync' })}
              </button>
            ) : null}
            {canWrite ? (
              <button
                type="button"
                className="fu-btn fu-btn--ghost"
                data-testid="products-import-history-btn"
                onClick={() => setImportHistoryOpen(true)}
              >
                {t('products.importHistory', { defaultValue: 'Import history' })}
              </button>
            ) : null}
            {canWrite ? (
              <button type="button" className="fu-btn fu-btn--ghost" onClick={() => setInauzwaOpen(true)}>
                <Settings2 size={16} /> {t('products.settings', { defaultValue: 'Settings' })}
              </button>
            ) : null}
          </div>
        </div>

        <ProductSummaryCards catalogStats={catalogStats} healthSummary={healthSummary} />

        <section className="products-page-controls" aria-label={t('common.filter')}>
          <div className="products-page-controls__row products-page-controls__row--primary">
            <input
              type="search"
              className="products-page-controls__search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('products.searchPlaceholder', { defaultValue: 'Search products…' })}
            />
            <div className="fu-chips products-page-controls__tabs" role="tablist">
              {listTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={listTab === tab.id}
                  className={['fu-chip', listTab === tab.id ? 'fu-chip--active' : ''].join(' ')}
                  onClick={() => setListTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <ProductToolbar
            categories={categories}
            brands={brands}
            categoryFilter={categoryFilter}
            brandFilter={brandFilter}
            stockFilter={stockFilter}
            viewMode={viewMode}
            onCategoryChange={setCategoryFilter}
            onBrandChange={setBrandFilter}
            onStockFilterChange={setStockFilter}
            onViewModeChange={setViewMode}
            hideCategoryFilter={stitchShell && viewMode === 'table'}
          />
        </section>

        {syncStatus ? (
          <p className={syncStatusIsError ? 'product-editor__variant-error' : 'products-catalog-count'}>
            {syncStatus}
          </p>
        ) : null}

        <div
          className={`products-page-body${
            stitchShell && viewMode === 'table' ? ' products-page-body--stitch-sidebar' : ''
          }`}
        >
          {stitchShell && viewMode === 'table' ? (
            <ProductCategorySidebar
              products={products}
              categoryFilter={categoryFilter}
              onCategoryFilterChange={setCategoryFilter}
            />
          ) : null}
          <div className="products-page-body__main">
          {viewMode === 'table' ? (
            <ProductManagementTable
              products={visibleProducts}
              isLoading={isLoading}
              onOpen={openEdit}
            />
          ) : (
            <ProductCatalogView
              variant="page"
              hideHeader
              hideFooter
              workspaceTabs
              title={t('products.title')}
              search={search}
              onSearchChange={setSearch}
              products={visibleProducts}
              isLoading={isLoading}
              categoryFilter={categoryFilter}
              onCategoryFilterChange={setCategoryFilter}
              selectedProductId={null}
              onSelectProduct={() => undefined}
              onProductClick={(p) => openEdit(p)}
              emptyLabel={
                listTab === 'inactive' ? t('products.catalog.emptyInactive') : t('products.empty')
              }
            />
          )}

          {visibleProducts.length > 0 ? (
            <p className="products-page-footer">
              {t('products.catalog.showing', { count: visibleProducts.length })}
            </p>
          ) : null}
          </div>
        </div>
      </div>

      <ProductEditorModal
        isOpen={editorOpen}
        product={editorProductId ? (editorProduct ?? null) : null}
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

      <ProductImportWizard
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onComplete={() => invalidate()}
        onOpenHistory={() => {
          setImportOpen(false);
          setImportHistoryOpen(true);
        }}
      />

      <ProductImportHistoryPanel
        isOpen={importHistoryOpen}
        onClose={() => setImportHistoryOpen(false)}
      />

      {inauzwaOpen && (
        <ModalOverlay onClose={() => setInauzwaOpen(false)} className="fu-modal-overlay">
          <div
            className="fu-modal products-inauzwa-dialog"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="products-inauzwa-title"
          >
            <header className="products-inauzwa-dialog__header">
              <h3 id="products-inauzwa-title">{t('products.catalog.inauzwaSettings')}</h3>
              <button
                type="button"
                className="products-inauzwa-dialog__close"
                onClick={() => setInauzwaOpen(false)}
                aria-label={t('common.close')}
              >
                <X size={18} />
              </button>
            </header>
            <div className="products-inauzwa-dialog__body">
              <InauzwaIntegrationPanel defaultOpen />
            </div>
          </div>
        </ModalOverlay>
      )}

      {deleteId && (
        <ModalOverlay onClose={() => setDeleteId(null)} className="fu-modal-overlay">
          <div
            className="fu-modal products-delete-dialog"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
          >
            <h3>{t('common.delete')}</h3>
            <p>{t('products.deleteConfirm')}</p>
            <div className="fu-modal__actions">
              <button type="button" className="fu-btn fu-btn--ghost" onClick={() => setDeleteId(null)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="fu-btn fu-btn--primary"
                disabled={deleteProduct.isPending}
                onClick={() => deleteProduct.mutate(deleteId)}
              >
                {deleteProduct.isPending ? <Loader2 className="spin" size={14} /> : null}
                {t('common.delete')}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
