import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Package, Send, RefreshCw, X } from 'lucide-react';
import { productsApi, type CrmProductListItem, type CrmProductVariant } from '../services/api';
import { loadUserPreferences, saveUserPreferences } from '../lib/user-preferences';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

interface InboxProductPickerProps {
  sessionId: string;
  chatId: string;
  canWrite: boolean;
  onSent?: () => void;
  /** Ask before sending (tactical inbox). */
  confirmBeforeSend?: boolean;
}

function topLevelVariants(variants: CrmProductVariant[]): CrmProductVariant[] {
  return variants.filter((v) => !v.parentVariantId && v.variantType !== 'imei_child');
}

type PendingSend = {
  productId: string;
  productName: string;
  variantId?: string;
  variantLabel?: string;
};

export function InboxProductPicker({
  sessionId,
  chatId,
  canWrite,
  onSent,
  confirmBeforeSend = false,
}: InboxProductPickerProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const initialPrefs = loadUserPreferences();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const [includeDevices, setIncludeDevices] = useState(initialPrefs.productIncludeDevices);
  const [includeImage, setIncludeImage] = useState(initialPrefs.productIncludeImage);
  const [inStockOnly, setInStockOnly] = useState(initialPrefs.productInStockOnly);
  const [refreshBeforeSend, setRefreshBeforeSend] = useState<boolean | null>(
    initialPrefs.productRefreshBeforeSend,
  );
  const [status, setStatus] = useState<string | null>(null);
  const [variantPickerProduct, setVariantPickerProduct] = useState<CrmProductListItem | null>(null);
  const [pendingSend, setPendingSend] = useState<PendingSend | null>(null);

  const { data: inauzwaStatus } = useQuery({
    queryKey: ['products', 'inauzwa-status'],
    queryFn: () => productsApi.inauzwaSyncStatus(),
  });

  const effectiveRefresh =
    refreshBeforeSend ?? inauzwaStatus?.preferences.refreshBeforeSend ?? true;
  const inauzwaConfigured = !!inauzwaStatus?.configured;

  const { data: products = [], isLoading, refetch: refetchProducts } = useQuery({
    queryKey: ['products', 'picker', debouncedSearch, inStockOnly],
    queryFn: () =>
      productsApi.list({
        q: debouncedSearch || undefined,
        inStockOnly,
        activeOnly: true,
      }),
  });

  const { data: variantPickerDetail, isLoading: variantPickerLoading } = useQuery({
    queryKey: ['products', variantPickerProduct?.id],
    queryFn: () => productsApi.get(variantPickerProduct!.id),
    enabled: !!variantPickerProduct,
  });

  const refreshStock = useMutation({
    mutationFn: () => productsApi.quickSyncInauzwa(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void refetchProducts();
      setStatus(t('products.inbox.stockRefreshed'));
      setTimeout(() => setStatus(null), 2500);
    },
    onError: (err: Error) => setStatus(err.message),
  });

  const sendProduct = useMutation({
    mutationFn: (payload: PendingSend) =>
      productsApi.send(payload.productId, {
        sessionId,
        chatId,
        variantId: payload.variantId,
        includeAllVariants: !payload.variantId,
        includeAvailableDevices: includeDevices,
        inStockOnly,
        includeImage,
        refreshStock: effectiveRefresh && inauzwaConfigured ? true : false,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['products', 'picker'] });
      setStatus(t('products.inbox.sent'));
      setPendingSend(null);
      setVariantPickerProduct(null);
      onSent?.();
      setTimeout(() => setStatus(null), 3000);
    },
    onError: (err: Error) => setStatus(err.message),
  });

  const formatPrice = (p: CrmProductListItem) => {
    if (p.sellingPrice == null) return '';
    const cur = p.currency?.trim();
    return cur ? `${cur} ${p.sellingPrice.toLocaleString()}` : p.sellingPrice.toLocaleString();
  };

  const queueSend = (payload: PendingSend) => {
    if (confirmBeforeSend) {
      setPendingSend(payload);
      return;
    }
    sendProduct.mutate(payload);
  };

  const handleProductClick = (p: CrmProductListItem) => {
    if (p.variantCount > 0) {
      setVariantPickerProduct(p);
      return;
    }
    queueSend({ productId: p.id, productName: p.name });
  };

  const handleVariantPick = (variant: CrmProductVariant, productName: string) => {
    queueSend({
      productId: variant.productId,
      productName,
      variantId: variant.id,
      variantLabel: variant.name,
    });
    setVariantPickerProduct(null);
  };

  const confirmLabel = pendingSend
    ? pendingSend.variantLabel
      ? t('products.inbox.sendVariantConfirm', {
          name: pendingSend.productName,
          variant: pendingSend.variantLabel,
        })
      : t('inbox.tactical.sendProductConfirm', { name: pendingSend.productName })
    : '';

  return (
    <div className="inbox-products-picker">
      <div className="inbox-products-picker__toolbar">
        <input
          type="search"
          className="inbox-products-picker__search"
          placeholder={t('products.inbox.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {inauzwaConfigured && canWrite && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            title={t('products.inbox.refreshStock')}
            disabled={refreshStock.isPending}
            onClick={() => refreshStock.mutate()}
          >
            {refreshStock.isPending ? (
              <Loader2 className="animate-spin" size={14} />
            ) : (
              <RefreshCw size={14} />
            )}
          </button>
        )}
      </div>

      <div className="inbox-products-picker__options">
        <label>
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => {
              const v = e.target.checked;
              setInStockOnly(v);
              saveUserPreferences({ productInStockOnly: v });
            }}
          />
          {t('products.inbox.inStockOnly')}
        </label>
        <label>
          <input
            type="checkbox"
            checked={includeDevices}
            onChange={(e) => {
              const v = e.target.checked;
              setIncludeDevices(v);
              saveUserPreferences({ productIncludeDevices: v });
            }}
          />
          {t('products.inbox.includeDevices')}
        </label>
        <label>
          <input
            type="checkbox"
            checked={includeImage}
            onChange={(e) => {
              const v = e.target.checked;
              setIncludeImage(v);
              saveUserPreferences({ productIncludeImage: v });
            }}
          />
          {t('products.inbox.includeImage')}
        </label>
        {inauzwaConfigured && (
          <label>
            <input
              type="checkbox"
              checked={effectiveRefresh}
              onChange={(e) => {
                const v = e.target.checked;
                setRefreshBeforeSend(v);
                saveUserPreferences({ productRefreshBeforeSend: v });
              }}
            />
            {t('products.inbox.refreshBeforeSend')}
          </label>
        )}
      </div>

      {isLoading ? (
        <div className="inbox-crm-empty">
          <Loader2 className="animate-spin" size={20} />
        </div>
      ) : products.length === 0 ? (
        <p className="inbox-crm-muted">{t('products.inbox.empty')}</p>
      ) : (
        <div className="inbox-products-picker__list">
          {products.map((p) => (
            <button
              key={p.id}
              type="button"
              className="inbox-products-picker__item"
              disabled={!canWrite || sendProduct.isPending || refreshStock.isPending}
              onClick={() => handleProductClick(p)}
            >
              <span>
                <strong>{p.name}</strong>
                {p.category && <span className="inbox-crm-muted"> · {p.category}</span>}
                <br />
                <span className="inbox-crm-muted">
                  {t('products.stock', { count: p.totalStock })}
                  {p.variantCount > 0 && ` · ${t('products.variantCount', { count: p.variantCount })}`}
                  {formatPrice(p) ? ` · ${formatPrice(p)}` : ''}
                </span>
              </span>
              <Send size={16} aria-hidden />
            </button>
          ))}
        </div>
      )}

      {!canWrite && <p className="inbox-crm-muted">{t('products.inbox.readOnly')}</p>}

      {status && <p className="inbox-crm-save-msg">{status}</p>}

      <a href="/products" className="inbox-crm-link">
        <Package size={14} aria-hidden /> {t('products.inbox.manageLink')}
      </a>

      {variantPickerProduct && (
        <div className="inbox-products-picker__variant-overlay" onClick={() => setVariantPickerProduct(null)}>
          <div
            className="inbox-products-picker__variant-panel"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="inbox-variant-picker-title"
          >
            <header className="inbox-products-picker__variant-header">
              <h4 id="inbox-variant-picker-title">{variantPickerProduct.name}</h4>
              <button
                type="button"
                className="product-editor__icon-btn"
                onClick={() => setVariantPickerProduct(null)}
                aria-label={t('common.close')}
              >
                <X size={16} />
              </button>
            </header>
            <p className="inbox-crm-muted">{t('products.inbox.pickVariant')}</p>
            {variantPickerLoading ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <div className="inbox-products-picker__variant-list">
                <button
                  type="button"
                  className="inbox-products-picker__variant-item"
                  disabled={sendProduct.isPending}
                  onClick={() => {
                    queueSend({
                      productId: variantPickerProduct.id,
                      productName: variantPickerProduct.name,
                    });
                    setVariantPickerProduct(null);
                  }}
                >
                  {t('products.inbox.sendAllVariants')}
                </button>
                {variantPickerDetail &&
                  topLevelVariants(variantPickerDetail.variants).map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      className="inbox-products-picker__variant-item"
                      disabled={sendProduct.isPending}
                      onClick={() => handleVariantPick(v, variantPickerProduct.name)}
                    >
                      {v.name}
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {pendingSend && (
        <div className="products-delete-overlay" onClick={() => setPendingSend(null)}>
          <div
            className="products-delete-dialog"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
          >
            <h3>{t('products.inbox.sendConfirmTitle')}</h3>
            <p>{confirmLabel}</p>
            <div className="products-delete-dialog__actions">
              <button type="button" className="btn btn-secondary" onClick={() => setPendingSend(null)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={sendProduct.isPending}
                onClick={() => sendProduct.mutate(pendingSend)}
              >
                {sendProduct.isPending ? <Loader2 className="animate-spin" size={14} /> : null}
                {t('products.inbox.sendConfirmAction')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
