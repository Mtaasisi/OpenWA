import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Package,
  Loader2,
  Eye,
  ImageIcon,
  Layers,
  Pencil,
  Trash2,
  MessageCircle,
  LayoutGrid,
  type LucideIcon,
} from 'lucide-react';
import {
  productsApi,
  type CrmProduct,
  type CrmProductVariant,
} from '../services/api';
import { loadUserPreferences } from '../lib/user-preferences';
import { ProductVariantsPanel } from './ProductVariantsPanel';
import './ProductEditorModal.css';

export type ProductFormState = {
  name: string;
  description: string;
  sku: string;
  category: string;
  imageUrl: string;
  currency: string;
  sellingPrice: string;
  isActive: boolean;
};

const emptyProductForm = (): ProductFormState => ({
  name: '',
  description: '',
  sku: '',
  category: '',
  imageUrl: '',
  currency: 'TZS',
  sellingPrice: '',
  isActive: true,
});

function topLevelVariants(variants: CrmProductVariant[]): CrmProductVariant[] {
  return variants.filter((v) => !v.parentVariantId && v.variantType !== 'imei_child');
}

function formFromProduct(p: CrmProduct): ProductFormState {
  return {
    name: p.name,
    description: p.description ?? '',
    sku: p.sku ?? '',
    category: p.category ?? '',
    imageUrl: p.imageUrl ?? '',
    currency: p.currency ?? 'TZS',
    sellingPrice: p.sellingPrice != null ? String(p.sellingPrice) : '',
    isActive: p.isActive,
  };
}

function formatPrice(currency: string | null, amount: number | null): string | null {
  if (amount == null) return null;
  const cur = currency?.trim() || '';
  return cur ? `${cur} ${amount.toLocaleString()}` : amount.toLocaleString();
}

type DrawerTab = 'overview' | 'variants' | 'whatsapp';

interface Props {
  isOpen: boolean;
  product: CrmProduct | null;
  loadingProductId?: string | null;
  canWrite: boolean;
  onClose: () => void;
  onSaved: (product: CrmProduct) => void;
  onDelete?: (productId: string) => void;
}

export function ProductEditorModal({
  isOpen,
  product,
  loadingProductId = null,
  canWrite,
  onClose,
  onSaved,
  onDelete,
}: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const isCreate = !product && !loadingProductId;

  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<DrawerTab>('overview');
  const [productForm, setProductForm] = useState<ProductFormState>(emptyProductForm);
  const [preview, setPreview] = useState<string | null>(null);
  const [activeProduct, setActiveProduct] = useState<CrmProduct | null>(product);

  const resetFormFromActive = useCallback(() => {
    if (activeProduct) setProductForm(formFromProduct(activeProduct));
  }, [activeProduct]);

  useEffect(() => {
    if (!isOpen) return;
    const p = product;
    setActiveProduct(p);
    setPreview(null);
    setIsEditing(!p);
    setActiveTab('overview');
    setProductForm(p ? formFromProduct(p) : emptyProductForm());
  }, [isOpen, product]);

  useEffect(() => {
    if (!isOpen || !product || isEditing) return;
    setActiveProduct(product);
    setProductForm(formFromProduct(product));
  }, [isOpen, product, isEditing]);

  useEffect(() => {
    if (!isOpen || !isEditing) return;
    const tmr = window.setTimeout(() => nameInputRef.current?.focus(), 100);
    return () => window.clearTimeout(tmr);
  }, [isOpen, isEditing]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  const saveProduct = useMutation({
    mutationFn: async () => {
      const payload = {
        name: productForm.name.trim(),
        description: productForm.description.trim() || null,
        sku: productForm.sku.trim() || null,
        category: productForm.category.trim() || null,
        imageUrl: productForm.imageUrl.trim() || null,
        currency: productForm.currency.trim() || null,
        sellingPrice: productForm.sellingPrice ? Number(productForm.sellingPrice) : null,
        isActive: productForm.isActive,
      };
      if (activeProduct) {
        return productsApi.update(activeProduct.id, payload);
      }
      return productsApi.create(payload);
    },
    onSuccess: (saved) => {
      const wasCreate = !product;
      setActiveProduct(saved);
      setProductForm(formFromProduct(saved));
      queryClient.setQueryData(['products', saved.id], saved);
      onSaved(saved);
      setIsEditing(false);
      if (wasCreate) setActiveTab('variants');
    },
  });

  const isOverviewDirty = useMemo(() => {
    if (!isEditing || !activeProduct) return false;
    const baseline = formFromProduct(activeProduct);
    return (
      baseline.name !== productForm.name ||
      baseline.description !== productForm.description ||
      baseline.sku !== productForm.sku ||
      baseline.category !== productForm.category ||
      baseline.imageUrl !== productForm.imageUrl ||
      baseline.currency !== productForm.currency ||
      baseline.sellingPrice !== productForm.sellingPrice ||
      baseline.isActive !== productForm.isActive
    );
  }, [isEditing, activeProduct, productForm]);

  const switchTab = (tab: DrawerTab) => {
    if (isOverviewDirty && activeTab === 'overview' && tab !== 'overview') {
      if (!window.confirm(t('products.editor.discardOverviewChanges'))) return;
      resetFormFromActive();
      setIsEditing(false);
    }
    setActiveTab(tab);
  };

  const cancelEditing = () => {
    if (activeProduct) {
      resetFormFromActive();
      setPreview(null);
      setIsEditing(false);
      return;
    }
    onClose();
  };

  const startEditing = () => {
    resetFormFromActive();
    setIsEditing(true);
  };

  const loadPreview = useMutation({
    mutationFn: () => {
      if (!activeProduct) throw new Error('No product');
      const prefs = loadUserPreferences();
      return productsApi.previewMessage(activeProduct.id, {
        includeAvailableDevices: prefs.productIncludeDevices,
        inStockOnly: prefs.productInStockOnly,
        includeAllVariants: true,
      });
    },
    onSuccess: (res) => setPreview(res.text),
  });

  if (!isOpen) return null;

  if (loadingProductId && !product) {
    return (
      <div className="product-editor-overlay" onClick={onClose} role="presentation">
        <div className="product-editor product-editor-drawer" onClick={(e) => e.stopPropagation()}>
          <div className="product-editor__loading">
            <Loader2 className="animate-spin" size={28} />
          </div>
        </div>
      </div>
    );
  }

  const imagePreview = productForm.imageUrl.trim();
  const pricePreview =
    productForm.sellingPrice && productForm.currency
      ? `${productForm.currency} ${Number(productForm.sellingPrice).toLocaleString()}`
      : null;

  const showEditForm = isEditing || !activeProduct;
  const detailProduct = activeProduct;
  const detailPrice = detailProduct ? formatPrice(detailProduct.currency, detailProduct.sellingPrice) : null;

  const heroName =
    isCreate || isEditing
      ? productForm.name.trim() || t('products.editor.previewNameFallback')
      : detailProduct?.name ?? t('products.productDetails');

  const heroSku = isEditing ? productForm.sku : detailProduct?.sku;
  const heroCategory = isEditing ? productForm.category : detailProduct?.category;
  const heroImage = isEditing ? productForm.imageUrl : detailProduct?.imageUrl;
  const heroStock = detailProduct?.totalStock ?? 0;
  const heroPrice = isEditing
    ? formatPrice(productForm.currency, productForm.sellingPrice ? Number(productForm.sellingPrice) : null)
    : detailPrice;

  const variantTabCount = activeProduct ? topLevelVariants(activeProduct.variants).length : 0;
  const drawerTabs: { id: DrawerTab; label: string; icon: LucideIcon; badge?: number }[] = [
    { id: 'overview', label: t('products.tabs.overview'), icon: LayoutGrid },
    { id: 'variants', label: t('products.tabs.variants'), icon: Layers, badge: variantTabCount },
  ];
  if (activeProduct) {
    drawerTabs.push({ id: 'whatsapp', label: t('products.tabs.whatsapp'), icon: MessageCircle });
  }

  return (
    <div className="product-editor-overlay" onClick={onClose} role="presentation">
      <div
        className="product-editor product-editor-drawer"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-editor-title"
      >
        {isCreate ? (
          <header className="product-editor__header product-editor__header--compact">
            <div>
              <h2 id="product-editor-title">{t('products.newProduct')}</h2>
              <p className="product-editor__subtitle">{t('products.editor.createSubtitle')}</p>
            </div>
            <button
              type="button"
              className="product-editor__icon-btn product-editor__icon-btn--close"
              onClick={onClose}
              aria-label={t('common.close')}
            >
              <X aria-hidden />
            </button>
          </header>
        ) : (
          <header className="product-editor__product-header">
            <div className="product-editor__product-identity">
              <div className="product-editor__product-thumb">
                {heroImage?.trim() ? (
                  <img src={heroImage} alt="" />
                ) : (
                  <Package size={36} strokeWidth={1.25} aria-hidden />
                )}
              </div>
              <div className="product-editor__product-meta">
                <h2 id="product-editor-title">{heroName}</h2>
                <div className="product-editor__product-chips">
                  {heroSku?.trim() && (
                    <span className="product-editor__sku-chip">
                      {t('products.fields.sku')}: {heroSku}
                    </span>
                  )}
                  {heroCategory?.trim() && (
                    <span className="product-editor__category-chip">{heroCategory}</span>
                  )}
                </div>
                {!isEditing && detailProduct && (
                  <p className="product-editor__product-stockline">
                    {t('products.stock', { count: heroStock })}
                    {detailProduct.variantCount > 0 &&
                      ` · ${t('products.variantCount', { count: detailProduct.variantCount })}`}
                    {heroPrice && ` · ${heroPrice}`}
                  </p>
                )}
                {isEditing && (
                  <p className="product-editor__product-stockline">{t('products.editor.editSubtitle')}</p>
                )}
              </div>
            </div>
            <div className="product-editor__product-actions">
              {canWrite && detailProduct && !isEditing && (
                <>
                  {onDelete && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => onDelete(detailProduct.id)}
                    >
                      <Trash2 size={16} aria-hidden />
                      {t('common.delete')}
                    </button>
                  )}
                  <button type="button" className="btn btn-primary btn-sm" onClick={startEditing}>
                    <Pencil size={16} aria-hidden />
                    {t('common.edit')}
                  </button>
                </>
              )}
              <button
                type="button"
                className="product-editor__icon-btn product-editor__icon-btn--close"
                onClick={onClose}
                aria-label={t('common.close')}
              >
                <X aria-hidden />
              </button>
            </div>
          </header>
        )}

        <nav className="product-editor__tabs" role="tablist" aria-label={t('products.tabs.label')}>
          {drawerTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`product-tab-${tab.id}`}
                aria-selected={activeTab === tab.id}
                aria-controls={`product-panel-${tab.id}`}
                className={`product-editor__tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => switchTab(tab.id)}
              >
                <Icon size={15} aria-hidden />
                {tab.label}
                {tab.badge != null && tab.badge > 0 && (
                  <span className="product-editor__tab-badge">{tab.badge}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="product-editor__scroll">
        <div
          id="product-panel-overview"
          role="tabpanel"
          aria-labelledby="product-tab-overview"
          className="product-editor__tab-panel"
          hidden={activeTab !== 'overview'}
        >
        {showEditForm ? (
        <div className="product-editor__body">
          <div className="product-editor__main">
            <section className="product-editor__section">
              <h3 className="product-editor__section-title">{t('products.editor.sectionBasics')}</h3>
              <div className="product-editor__field product-editor__field--full">
                <label htmlFor="pe-name">{t('common.name')} *</label>
                <input
                  id="pe-name"
                  ref={nameInputRef}
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  disabled={!canWrite}
                  placeholder={t('products.editor.namePlaceholder')}
                />
              </div>
              <div className="product-editor__row">
                <div className="product-editor__field">
                  <label htmlFor="pe-category">{t('products.fields.category')}</label>
                  <input
                    id="pe-category"
                    value={productForm.category}
                    onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                    disabled={!canWrite}
                    placeholder={t('products.editor.categoryPlaceholder')}
                  />
                </div>
                <div className="product-editor__field">
                  <label htmlFor="pe-sku">{t('products.fields.sku')}</label>
                  <input
                    id="pe-sku"
                    value={productForm.sku}
                    onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                    disabled={!canWrite}
                    placeholder="SKU-001"
                  />
                </div>
              </div>
              <div className="product-editor__field product-editor__field--full">
                <label htmlFor="pe-desc">{t('products.fields.description')}</label>
                <textarea
                  id="pe-desc"
                  rows={3}
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  disabled={!canWrite}
                  placeholder={t('products.editor.descriptionPlaceholder')}
                />
              </div>
            </section>

            <section className="product-editor__section">
              <h3 className="product-editor__section-title">{t('products.editor.sectionPricing')}</h3>
              <div className="product-editor__row">
                <div className="product-editor__field">
                  <label htmlFor="pe-currency">{t('products.fields.currency')}</label>
                  <input
                    id="pe-currency"
                    value={productForm.currency}
                    onChange={(e) => setProductForm({ ...productForm, currency: e.target.value })}
                    disabled={!canWrite}
                    placeholder="TZS"
                  />
                </div>
                <div className="product-editor__field">
                  <label htmlFor="pe-price">{t('products.fields.price')}</label>
                  <input
                    id="pe-price"
                    type="number"
                    min={0}
                    step="any"
                    value={productForm.sellingPrice}
                    onChange={(e) => setProductForm({ ...productForm, sellingPrice: e.target.value })}
                    disabled={!canWrite}
                    placeholder="0"
                  />
                </div>
              </div>
            </section>

            <section className="product-editor__section">
              <h3 className="product-editor__section-title">{t('products.editor.sectionMedia')}</h3>
              <div className="product-editor__field product-editor__field--full">
                <label htmlFor="pe-image">{t('products.fields.imageUrl')}</label>
                <div className="product-editor__image-input">
                  <ImageIcon size={18} className="product-editor__image-input-icon" aria-hidden />
                  <input
                    id="pe-image"
                    value={productForm.imageUrl}
                    onChange={(e) => setProductForm({ ...productForm, imageUrl: e.target.value })}
                    disabled={!canWrite}
                    placeholder="https://example.com/photo.jpg"
                  />
                </div>
                <p className="product-editor__hint">{t('products.editor.imageHint')}</p>
              </div>
            </section>

            <label className="product-editor__toggle">
              <input
                type="checkbox"
                checked={productForm.isActive}
                onChange={(e) => setProductForm({ ...productForm, isActive: e.target.checked })}
                disabled={!canWrite}
              />
              <span>
                <strong>{t('common.active')}</strong>
                <small>{t('products.editor.activeHint')}</small>
              </span>
            </label>
          </div>

          <aside className="product-editor__aside">
            <div className="product-editor__preview-card">
              <p className="product-editor__preview-label">{t('products.editor.previewLabel')}</p>
              <div className="product-editor__preview-visual">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt=""
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.visibility = 'hidden';
                    }}
                  />
                ) : (
                  <Package size={40} strokeWidth={1.25} />
                )}
              </div>
              <p className="product-editor__preview-name">
                {productForm.name.trim() || t('products.editor.previewNameFallback')}
              </p>
              {productForm.category.trim() && (
                <p className="product-editor__preview-meta">{productForm.category}</p>
              )}
              {pricePreview && <p className="product-editor__preview-price">{pricePreview}</p>}
            </div>
          </aside>
        </div>
        ) : detailProduct ? (
          <div className="product-details product-details--general">
            <div className="product-details__status-row">
              <span
                className={`product-details__status ${detailProduct.isActive ? 'is-active' : 'is-inactive'}`}
              >
                {detailProduct.isActive ? t('common.active') : t('common.inactive')}
              </span>
            </div>
            {detailProduct.description?.trim() ? (
              <section className="product-details__section">
                <h3 className="product-editor__section-title">{t('products.fields.description')}</h3>
                <p className="product-details__description">{detailProduct.description}</p>
              </section>
            ) : (
              <p className="product-details__empty">{t('products.details.noDescription')}</p>
            )}
            <dl className="product-details__meta">
              <div>
                <dt>{t('products.fields.currency')}</dt>
                <dd>{detailProduct.currency?.trim() || t('products.details.notSet')}</dd>
              </div>
              <div>
                <dt>{t('products.fields.price')}</dt>
                <dd>{detailPrice ?? t('products.details.notSet')}</dd>
              </div>
              <div>
                <dt>{t('products.fields.sku')}</dt>
                <dd>{detailProduct.sku?.trim() || t('products.details.notSet')}</dd>
              </div>
              <div>
                <dt>{t('products.tabs.variants')}</dt>
                <dd>{t('products.variantCount', { count: detailProduct.variantCount })}</dd>
              </div>
              {detailProduct.externalId?.trim() && (
                <div>
                  <dt>{t('products.fields.externalId')}</dt>
                  <dd>{detailProduct.externalId}</dd>
                </div>
              )}
            </dl>
          </div>
        ) : null}
        </div>

        <div
          id="product-panel-variants"
          role="tabpanel"
          aria-labelledby="product-tab-variants"
          className="product-editor__tab-panel"
          hidden={activeTab !== 'variants'}
        >
        {activeProduct ? (
          <ProductVariantsPanel
            product={activeProduct}
            canWrite={canWrite}
            onUpdated={(updated) => {
              setActiveProduct(updated);
              queryClient.setQueryData(['products', updated.id], updated);
              onSaved(updated);
            }}
          />
        ) : (
          <div className="product-editor__save-first">
            <p>{t('products.editor.saveFirstVariants')}</p>
            <button
              type="button"
              className="btn btn-primary btn-sm product-editor__save-first-btn"
              onClick={() => setActiveTab('overview')}
            >
              {t('products.editor.goToOverview')}
            </button>
          </div>
        )}
        </div>

        {activeProduct && (
          <div
            id="product-panel-whatsapp"
            role="tabpanel"
            aria-labelledby="product-tab-whatsapp"
            className="product-editor__tab-panel product-editor__tab-panel--whatsapp"
            hidden={activeTab !== 'whatsapp'}
          >
            <section className="product-editor__whatsapp-panel">
              <p className="product-editor__whatsapp-hint">{t('products.editor.whatsappTabHint')}</p>
              <button
                type="button"
                className="btn btn-secondary product-editor__preview-wa"
                onClick={() => loadPreview.mutate()}
                disabled={loadPreview.isPending}
              >
                {loadPreview.isPending ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : (
                  <Eye size={14} />
                )}
                {t('products.previewWhatsApp')}
              </button>
              {preview ? (
                <pre className="product-editor__wa-preview">{preview}</pre>
              ) : (
                <p className="product-editor__whatsapp-empty">{t('products.editor.whatsappEmpty')}</p>
              )}
            </section>
          </div>
        )}
        </div>

        <footer className="product-editor__footer">
          {showEditForm ? (
            <>
              <button type="button" className="btn btn-secondary" onClick={cancelEditing}>
                {t('common.cancel')}
              </button>
              {canWrite && (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={saveProduct.isPending || !productForm.name.trim()}
                  onClick={() => void saveProduct.mutateAsync()}
                >
                  {saveProduct.isPending ? <Loader2 className="animate-spin" size={16} /> : null}
                  {activeProduct ? t('products.editor.saveChanges') : t('products.editor.createProduct')}
                </button>
              )}
            </>
          ) : (
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              {t('common.close')}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
