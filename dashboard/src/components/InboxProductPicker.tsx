import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Package, Send, RefreshCw, X, LayoutGrid, List } from 'lucide-react';
import { productsApi, type CrmProductListItem, type CrmProductVariant, type InboxMessage } from '../services/api';
import { loadUserPreferences, saveUserPreferences } from '../lib/user-preferences';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import {
  createOptimisticOutgoingImageMessage,
  createOptimisticOutgoingMessage,
  getProductSendEligibility,
} from '../pages/inbox-helpers';
import { queryKeys } from '../hooks/queries';
import { MaterialSymbol } from './MaterialSymbol';
import { ProductCatalogView } from './ProductCatalogView';
import { formatProductPrice, productThumbUrl } from '../lib/product-catalog-utils';
import './InboxProductPicker.css';

interface InboxProductPickerProps {
  sessionId: string;
  chatId: string;
  sessionStatus?: string;
  canWrite: boolean;
  onSent?: () => void;
  onStartSession?: (sessionId: string) => void;
  addOptimisticMessage?: (message: InboxMessage) => void;
  removeOptimisticMessage?: (id: string) => void;
  /** Ask before sending (tactical inbox). */
  confirmBeforeSend?: boolean;
  /** Icon-only trigger for Interakt composer toolbar. */
  iconTrigger?: { className: string; symbol?: string };
  /** Show visible label under icon in Interakt composer toolbar. */
  showToolbarLabel?: boolean;
  /** Text link trigger (e.g. CRM “browse catalog”). */
  linkTrigger?: { label: string; className?: string };
  /** Increment to open the picker panel programmatically. */
  openSignal?: number;
  /** Interakt catalog modal only — opened via openSignal (no trigger button). */
  headless?: boolean;
  /** Stitch CRM — catalog popup chrome and title. */
  stitchLayout?: boolean;
}

function inauzwaReadyForRefresh(
  status: { configured?: boolean; database?: boolean; branchId?: string | null; vendorId?: string | null } | undefined,
): boolean {
  if (!status?.configured) return false;
  if (!status.branchId?.trim()) return false;
  if (status.database && !status.vendorId?.trim()) return false;
  return true;
}

function mapProductSendError(message: string, t: (key: string) => string): string {
  const lower = message.toLowerCase();
  if (lower.includes('not authorized') || lower.includes('api key not authorized')) {
    return t('products.inbox.unauthorizedSession');
  }
  if (lower.includes('qr_ready') || lower.includes('scan the qr')) {
    return t('products.inbox.sessionQrNeeded');
  }
  if (lower.includes('no active whatsapp engine')) {
    return t('products.inbox.noEngine');
  }
  if (lower.includes('cannot send to this chat type')) {
    return t('products.inbox.chatTypeBlocked');
  }
  if (lower.includes('not connected') || lower.includes('not active') || lower.includes('start the session')) {
    return t('products.inbox.sessionNotReady');
  }
  if (lower.includes('no product image')) {
    return t('products.inbox.noImage');
  }
  if (lower.includes('variant has no stock') || lower.includes('selected variant has no stock')) {
    return t('products.inbox.variantNoStock');
  }
  if (lower.includes('no active variants')) {
    return t('products.inbox.noActiveVariants');
  }
  if (lower.includes('nothing to send')) {
    return t('products.inbox.nothingToSend');
  }
  if (lower.includes('vendorid is required') || lower.includes('branchid is required')) {
    return t('products.inbox.inauzwaSyncIncomplete');
  }
  return message;
}

function variantAvailableStock(
  variant: CrmProductVariant,
  allVariants: CrmProductVariant[],
): number {
  if (!variant.isActive) return 0;
  if (variant.trackInventoryItems) {
    return Math.max(0, variant.quantity ?? 0);
  }
  if (variant.isParent || variant.variantType === 'parent') {
    const childStock = allVariants.filter(
      (c) =>
        c.parentVariantId === variant.id &&
        c.variantType === 'imei_child' &&
        c.isActive &&
        (c.quantity ?? 0) > 0,
    ).length;
    if (childStock > 0) return childStock;
  }
  return Math.max(0, variant.quantity ?? 0);
}

function topLevelVariants(variants: CrmProductVariant[]): CrmProductVariant[] {
  return variants.filter((v) => !v.parentVariantId && v.variantType !== 'imei_child');
}

type PendingSend = {
  productId: string;
  productName: string;
  variantId?: string;
  variantLabel?: string;
  inventoryItemId?: string;
  inventoryLabel?: string;
  imageUrl?: string | null;
};

type InventoryPickerState = {
  productId: string;
  productName: string;
  variant: CrmProductVariant;
  imageUrl?: string | null;
};

export function InboxProductPicker({
  sessionId,
  chatId,
  sessionStatus,
  canWrite,
  onSent,
  onStartSession,
  addOptimisticMessage,
  removeOptimisticMessage,
  confirmBeforeSend = false,
  iconTrigger,
  showToolbarLabel = false,
  linkTrigger,
  openSignal,
  headless = false,
  stitchLayout = false,
}: InboxProductPickerProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const initialPrefs = loadUserPreferences();
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    if (openSignal != null && openSignal > 0) setPanelOpen(true);
  }, [openSignal]);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const [includeDevices, setIncludeDevices] = useState(initialPrefs.productIncludeDevices);
  const [includeImage, setIncludeImage] = useState(initialPrefs.productIncludeImage);
  const [inStockOnly, setInStockOnly] = useState(initialPrefs.productInStockOnly);
  const [refreshBeforeSend, setRefreshBeforeSend] = useState<boolean | null>(
    initialPrefs.productRefreshBeforeSend,
  );
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendSuccessUntil, setSendSuccessUntil] = useState<number | null>(null);
  const [variantPickerProduct, setVariantPickerProduct] = useState<CrmProductListItem | null>(null);
  const [inventoryPicker, setInventoryPicker] = useState<InventoryPickerState | null>(null);
  const [pendingSend, setPendingSend] = useState<PendingSend | null>(null);
  const interaktPickerChrome = !!(iconTrigger || linkTrigger || headless || stitchLayout);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() =>
    iconTrigger || linkTrigger ? 'grid' : 'list',
  );
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  useEffect(() => {
    if (!panelOpen) {
      setSelectedProductId(null);
      setCategoryFilter('all');
      setSearch('');
    }
  }, [panelOpen]);

  useEffect(() => {
    setSelectedProductId(null);
  }, [categoryFilter]);

  const { data: inauzwaStatus } = useQuery({
    queryKey: ['products', 'inauzwa-status'],
    queryFn: () => productsApi.inauzwaSyncStatus(),
  });

  const effectiveRefresh =
    refreshBeforeSend ?? inauzwaStatus?.preferences.refreshBeforeSend ?? true;
  const inauzwaConfigured = !!inauzwaStatus?.configured;
  const inauzwaCanRefresh = inauzwaReadyForRefresh(inauzwaStatus);
  const sessionReady = sessionStatus === 'ready';
  const sendEligibility = getProductSendEligibility(chatId);
  const chatTypeBlocked = sendEligibility === 'blocked';
  const sendActionLabel =
    sendEligibility === 'group' ? t('products.inbox.productPost') : t('products.inbox.sendProduct');
  const canSendProduct = canWrite && sessionReady && !chatTypeBlocked;

  useEffect(() => {
    if (sendSuccessUntil == null) return;
    const remaining = sendSuccessUntil - Date.now();
    if (remaining <= 0) {
      setSendSuccessUntil(null);
      return;
    }
    const timer = setTimeout(() => setSendSuccessUntil(null), remaining);
    return () => clearTimeout(timer);
  }, [sendSuccessUntil]);

  const { data: products = [], isLoading, refetch: refetchProducts } = useQuery({
    queryKey: ['products', 'picker', debouncedSearch, inStockOnly],
    queryFn: () =>
      productsApi.list({
        q: debouncedSearch || undefined,
        inStockOnly,
        activeOnly: true,
      }),
  });

  const selectedProduct = products.find((p) => p.id === selectedProductId) ?? null;

  const { data: variantPickerDetail, isLoading: variantPickerLoading } = useQuery({
    queryKey: ['products', variantPickerProduct?.id],
    queryFn: () => productsApi.get(variantPickerProduct!.id),
    enabled: !!variantPickerProduct,
  });

  const { data: inventoryItems = [], isLoading: inventoryItemsLoading } = useQuery({
    queryKey: ['products', inventoryPicker?.productId, 'inventory', inventoryPicker?.variant.id],
    queryFn: () =>
      productsApi.listInventoryItems(inventoryPicker!.productId, {
        variantId: inventoryPicker!.variant.id,
        status: 'available',
      }),
    enabled: !!inventoryPicker,
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

  const sendBusy = sending || refreshStock.isPending;

  const showSendSuccess = () => {
    setStatus(t('products.inbox.sent'));
    setSendSuccessUntil(Date.now() + 2500);
    setTimeout(() => setStatus(null), 2500);
  };

  const executeSend = async (payload: PendingSend) => {
    if (!sessionReady) {
      setStatus(t('products.inbox.sessionNotReady'));
      return;
    }
    if (chatTypeBlocked) {
      setStatus(t('products.inbox.chatTypeBlocked'));
      return;
    }

    setPendingSend(null);
    setVariantPickerProduct(null);
    setInventoryPicker(null);
    setSending(true);

    let optimisticId: string | null = null;
    try {
      const preview = await productsApi.previewMessage(payload.productId, {
        variantId: payload.variantId,
        inventoryItemId: payload.inventoryItemId,
        includeAllVariants: !payload.variantId,
        includeAvailableDevices: includeDevices,
        inStockOnly,
      });

      const imageUrl = includeImage ? payload.imageUrl?.trim() || null : null;
      const optimistic = imageUrl
        ? createOptimisticOutgoingImageMessage(sessionId, chatId, preview.text, imageUrl)
        : createOptimisticOutgoingMessage(sessionId, chatId, preview.text);

      optimisticId = optimistic.id;
      addOptimisticMessage?.(optimistic);

      await productsApi.send(payload.productId, {
        sessionId,
        chatId,
        variantId: payload.variantId,
        inventoryItemId: payload.inventoryItemId,
        includeAllVariants: !payload.variantId,
        includeAvailableDevices: includeDevices,
        inStockOnly,
        includeImage,
        refreshStock: effectiveRefresh && inauzwaCanRefresh,
      });

      if (optimisticId) removeOptimisticMessage?.(optimisticId);
      void queryClient.invalidateQueries({ queryKey: queryKeys.inboxMessages(sessionId, chatId) });
      void queryClient.invalidateQueries({ queryKey: ['inbox', 'crm', sessionId, chatId] });
      void queryClient.invalidateQueries({ queryKey: ['products', 'picker'] });
      showSendSuccess();
      if (interaktPickerChrome) setPanelOpen(false);
      onSent?.();
    } catch (err) {
      if (optimisticId) removeOptimisticMessage?.(optimisticId);
      setStatus(mapProductSendError(err instanceof Error ? err.message : String(err), t));
    } finally {
      setSending(false);
    }
  };

  const queueSend = (payload: PendingSend) => {
    if (!sessionReady) {
      setStatus(t('products.inbox.sessionNotReady'));
      return;
    }
    if (chatTypeBlocked) {
      setStatus(t('products.inbox.chatTypeBlocked'));
      return;
    }
    if (confirmBeforeSend) {
      setPendingSend(payload);
      return;
    }
    void executeSend(payload);
  };

  const handleProductClick = (p: CrmProductListItem) => {
    if (p.variantCount > 0) {
      setVariantPickerProduct(p);
      return;
    }
    queueSend({ productId: p.id, productName: p.name, imageUrl: productThumbUrl(p) });
  };

  const handleSendSelected = () => {
    if (!selectedProduct) return;
    handleProductClick(selectedProduct);
  };

  const handleVariantPick = (variant: CrmProductVariant, productName: string) => {
    const tracked =
      variant.trackInventoryItems || variant.isParent || variant.variantType === 'parent';
    if (tracked) {
      setInventoryPicker({
        productId: variant.productId,
        productName,
        variant,
        imageUrl: variantPickerProduct ? productThumbUrl(variantPickerProduct) : null,
      });
      setVariantPickerProduct(null);
      return;
    }
    queueSend({
      productId: variant.productId,
      productName,
      variantId: variant.id,
      variantLabel: variant.name,
      imageUrl: variantPickerProduct ? productThumbUrl(variantPickerProduct) : null,
    });
    setVariantPickerProduct(null);
  };

  const handleInventoryPick = (item: { id: string; imei?: string | null; serialNumber?: string | null }) => {
    if (!inventoryPicker) return;
    const label = item.imei || item.serialNumber || inventoryPicker.variant.name;
    queueSend({
      productId: inventoryPicker.productId,
      productName: inventoryPicker.productName,
      variantId: inventoryPicker.variant.id,
      variantLabel: inventoryPicker.variant.name,
      inventoryItemId: item.id,
      inventoryLabel: label,
      imageUrl: inventoryPicker.imageUrl,
    });
    setInventoryPicker(null);
  };

  const confirmLabel = pendingSend
    ? pendingSend.inventoryLabel
      ? t('products.inbox.sendDeviceConfirm', {
          defaultValue: 'Send {{name}} ({{variant}} — {{device}})?',
          name: pendingSend.productName,
          variant: pendingSend.variantLabel ?? '',
          device: pendingSend.inventoryLabel,
        })
      : pendingSend.variantLabel
      ? t('products.inbox.sendVariantConfirm', {
          name: pendingSend.productName,
          variant: pendingSend.variantLabel,
        })
      : t('inbox.tactical.sendProductConfirm', { name: pendingSend.productName })
    : '';

  const variantOverlay =
    variantPickerProduct &&
    createPortal(
      <div className="inbox-products-picker__variant-overlay" onClick={() => setVariantPickerProduct(null)}>
        <div
          className="inbox-products-picker__variant-panel"
          data-testid="inbox-product-variant-picker"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-labelledby="inbox-variant-picker-title"
        >
          <header className="inbox-products-picker__variant-header">
            <h4 id="inbox-variant-picker-title">{variantPickerProduct.name}</h4>
            <button
              type="button"
              className="inbox-products-picker__close-btn"
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
                onClick={() => {
                  queueSend({
                    productId: variantPickerProduct.id,
                    productName: variantPickerProduct.name,
                    imageUrl: productThumbUrl(variantPickerProduct),
                  });
                  setVariantPickerProduct(null);
                }}
              >
                {t('products.inbox.sendAllVariants')}
              </button>
              {variantPickerDetail &&
                topLevelVariants(variantPickerDetail.variants).map((v) => {
                  const stock = variantAvailableStock(v, variantPickerDetail.variants);
                  const outOfStock = inStockOnly && stock <= 0;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      className="inbox-products-picker__variant-item"
                      disabled={outOfStock || sendBusy}
                      onClick={() => handleVariantPick(v, variantPickerProduct.name)}
                    >
                      {v.name}
                      {stock > 0 && (
                        <span className="inbox-crm-muted">
                          {' '}
                          · {t('products.stock', { count: stock })}
                        </span>
                      )}
                      {outOfStock && (
                        <span className="inbox-crm-muted"> · {t('products.inbox.outOfStock')}</span>
                      )}
                    </button>
                  );
                })}
            </div>
          )}
        </div>
      </div>,
      document.body,
    );

  const inventoryOverlay =
    inventoryPicker &&
    createPortal(
      <div className="inbox-products-picker__variant-overlay" onClick={() => setInventoryPicker(null)}>
        <div
          className="inbox-products-picker__variant-panel"
          data-testid="inbox-product-inventory-picker"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-labelledby="inbox-inventory-picker-title"
        >
          <header className="inbox-products-picker__variant-header">
            <h4 id="inbox-inventory-picker-title">
              {inventoryPicker.productName} — {inventoryPicker.variant.name}
            </h4>
            <button
              type="button"
              className="inbox-products-picker__close-btn"
              onClick={() => setInventoryPicker(null)}
              aria-label={t('common.close')}
            >
              <X size={16} />
            </button>
          </header>
          <p className="inbox-crm-muted">
            {t('products.inbox.pickDevice', { defaultValue: 'Pick a device (IMEI/serial) or send without one.' })}
          </p>
          {inventoryItemsLoading ? (
            <Loader2 className="animate-spin" size={18} />
          ) : (
            <div className="inbox-products-picker__variant-list">
              <button
                type="button"
                className="inbox-products-picker__variant-item"
                disabled={sendBusy}
                onClick={() => {
                  queueSend({
                    productId: inventoryPicker.productId,
                    productName: inventoryPicker.productName,
                    variantId: inventoryPicker.variant.id,
                    variantLabel: inventoryPicker.variant.name,
                    imageUrl: inventoryPicker.imageUrl,
                  });
                  setInventoryPicker(null);
                }}
              >
                {t('products.inbox.sendWithoutDevice', { defaultValue: 'Send variant (no specific device)' })}
              </button>
              {inventoryItems.map((item) => {
                const label = item.imei || item.serialNumber || item.id.slice(0, 8);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="inbox-products-picker__variant-item"
                    disabled={sendBusy}
                    onClick={() => handleInventoryPick(item)}
                  >
                    {label}
                    {item.serialNumber && item.imei ? (
                      <span className="inbox-crm-muted"> · {item.serialNumber}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>,
      document.body,
    );

  const confirmOverlay =
    pendingSend &&
    createPortal(
      <div className="inbox-products-picker__confirm-overlay" onClick={() => setPendingSend(null)}>
        <div
          className="inbox-products-picker__confirm-dialog"
          onClick={(e) => e.stopPropagation()}
          role="alertdialog"
        >
          <h3>{t('products.inbox.sendConfirmTitle')}</h3>
          <p>{confirmLabel}</p>
          <div className="inbox-products-picker__confirm-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setPendingSend(null)}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void executeSend(pendingSend)}
            >
              {t('products.inbox.sendConfirmAction')}
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );

  const pickerBody = (
    <div
      className={[
        'inbox-products-picker',
        iconTrigger || linkTrigger ? 'inbox-products-picker--modal' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {chatTypeBlocked && (
        <div className="inbox-products-picker__offline" role="status">
          <p>{t('products.inbox.chatTypeBlocked')}</p>
        </div>
      )}

      {!sessionReady && !chatTypeBlocked && (
        <div className="inbox-products-picker__offline" role="status">
          <p>{t('products.inbox.sessionNotReady')}</p>
          {canWrite && onStartSession && (
            <button
              type="button"
              className="inbox-products-picker__start-session"
              onClick={() => onStartSession(sessionId)}
            >
              {t('inbox.startSession')}
            </button>
          )}
        </div>
      )}

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
            className="inbox-products-picker__refresh-btn"
            title={t('products.inbox.refreshStock')}
            aria-label={t('products.inbox.refreshStock')}
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
        {interaktPickerChrome && (
          <div className="inbox-products-picker__view-toggle" role="group" aria-label={t('products.inbox.viewMode')}>
            <button
              type="button"
              className={`inbox-products-picker__view-btn${viewMode === 'grid' ? ' is-active' : ''}`}
              title={t('products.inbox.viewGrid')}
              aria-label={t('products.inbox.viewGrid')}
              aria-pressed={viewMode === 'grid'}
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid size={16} strokeWidth={1.75} aria-hidden />
            </button>
            <button
              type="button"
              className={`inbox-products-picker__view-btn${viewMode === 'list' ? ' is-active' : ''}`}
              title={t('products.inbox.viewList')}
              aria-label={t('products.inbox.viewList')}
              aria-pressed={viewMode === 'list'}
              onClick={() => setViewMode('list')}
            >
              <List size={16} strokeWidth={1.75} aria-hidden />
            </button>
          </div>
        )}
      </div>

      <div
        className={`inbox-products-picker__options${interaktPickerChrome ? ' inbox-products-picker__options--interakt' : ''}`}
      >
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
        <div
          className={`inbox-products-picker__list${viewMode === 'grid' ? ' inbox-products-picker__list--grid' : ''}`}
        >
          {products.map((p) => {
            const thumbUrl = productThumbUrl(p);
            const meta = [
              t('products.stock', { count: p.totalStock }),
              p.variantCount > 0 ? t('products.variantCount', { count: p.variantCount }) : null,
              formatProductPrice(p) || null,
            ]
              .filter(Boolean)
              .join(' · ');

            if (viewMode === 'grid') {
              return (
                <button
                  key={p.id}
                  type="button"
                  className="inbox-products-picker__item inbox-products-picker__item--grid"
                  disabled={!canSendProduct || sendBusy}
                  onClick={() => handleProductClick(p)}
                >
                  {thumbUrl ? (
                    <img src={thumbUrl} alt="" className="inbox-products-picker__grid-thumb" />
                  ) : (
                    <span className="inbox-products-picker__grid-thumb inbox-products-picker__grid-thumb--empty" aria-hidden>
                      <Package size={20} />
                    </span>
                  )}
                  <span className="inbox-products-picker__grid-body">
                    <strong className="inbox-products-picker__grid-name">{p.name}</strong>
                    {p.category && <span className="inbox-products-picker__grid-cat">{p.category}</span>}
                    {meta && <span className="inbox-products-picker__grid-meta">{meta}</span>}
                  </span>
                  <span className="inbox-products-picker__grid-send" aria-hidden>
                    <Send size={14} />
                  </span>
                </button>
              );
            }

            return (
              <button
                key={p.id}
                type="button"
                className="inbox-products-picker__item"
                disabled={!canSendProduct || sendBusy}
                onClick={() => handleProductClick(p)}
              >
                <span className="inbox-products-picker__item-main">
                  {thumbUrl ? (
                    <img src={thumbUrl} alt="" className="inbox-products-picker__thumb" />
                  ) : (
                    <span className="inbox-products-picker__thumb inbox-products-picker__thumb--empty" aria-hidden>
                      <Package size={16} />
                    </span>
                  )}
                  <span className="inbox-products-picker__item-body">
                    <strong>{p.name}</strong>
                    {p.category && <span className="inbox-crm-muted"> · {p.category}</span>}
                    <br />
                    <span className="inbox-crm-muted">{meta}</span>
                  </span>
                </span>
                <span className="inbox-products-picker__send-icon" aria-hidden>
                  <Send size={16} />
                </span>
              </button>
            );
          })}
        </div>
      )}

      {!canWrite && <p className="inbox-crm-muted">{t('products.inbox.readOnly')}</p>}

      {status && (
        <p
          className={`inbox-crm-save-msg${
            status !== t('products.inbox.sent') && status !== t('products.inbox.stockRefreshed')
              ? ' inbox-crm-save-msg--error'
              : ''
          }`}
        >
          {status}
        </p>
      )}

      <a href="/products" className="inbox-crm-link">
        <Package size={14} aria-hidden /> {t('products.inbox.manageLink')}
      </a>

      {variantOverlay}
      {inventoryOverlay}
      {confirmOverlay}
    </div>
  );

  const catalogStatusIsError =
    !!status && status !== t('products.inbox.sent') && status !== t('products.inbox.stockRefreshed');

  const interaktCatalogModal =
    panelOpen &&
    (iconTrigger || linkTrigger || headless) &&
    createPortal(
      <div
        className={[
          'inbox-interakt-picker-overlay',
          'inbox-interakt-picker-overlay--catalog',
          stitchLayout ? 'inbox-interakt-picker-overlay--stitch' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={() => setPanelOpen(false)}
        role="presentation"
      >
        <div onClick={(e) => e.stopPropagation()}>
          <ProductCatalogView
            variant="modal"
            title={
              stitchLayout
                ? t('inbox.stitch.catalogModalTitle')
                : t('products.inbox.selectProduct')
            }
            titleId="inbox-interakt-catalog-title"
            search={search}
            onSearchChange={setSearch}
            products={products}
            isLoading={isLoading}
            categoryFilter={categoryFilter}
            onCategoryFilterChange={setCategoryFilter}
            selectedProductId={selectedProductId}
            onSelectProduct={setSelectedProductId}
            onClose={() => setPanelOpen(false)}
            cardDisabled={!canSendProduct || sendBusy}
            status={status}
            statusIsError={catalogStatusIsError}
            offlineBanner={
              <>
                {chatTypeBlocked && (
                  <div className="inbox-interakt-catalog-modal__offline" role="status">
                    <p>{t('products.inbox.chatTypeBlocked')}</p>
                  </div>
                )}
                {!sessionReady && !chatTypeBlocked && (
                  <div className="inbox-interakt-catalog-modal__offline" role="status">
                    <p>{t('products.inbox.sessionNotReady')}</p>
                    {canWrite && onStartSession && (
                      <button
                        type="button"
                        className="inbox-products-picker__start-session"
                        onClick={() => onStartSession(sessionId)}
                      >
                        {t('inbox.startSession')}
                      </button>
                    )}
                  </div>
                )}
              </>
            }
            footer={
              <>
                <span className="inbox-interakt-catalog-modal__selected-count">
                  {t('products.inbox.itemsSelected', { count: selectedProductId ? 1 : 0 })}
                </span>
                <div className="inbox-interakt-catalog-modal__footer-actions">
                  <button
                    type="button"
                    className="inbox-interakt-catalog-modal__btn inbox-interakt-catalog-modal__btn--ghost"
                    onClick={() => setPanelOpen(false)}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="button"
                    className="inbox-interakt-catalog-modal__btn inbox-interakt-catalog-modal__btn--primary"
                    disabled={!selectedProduct || !canSendProduct || sendBusy}
                    onClick={handleSendSelected}
                  >
                    <span>{sendActionLabel}</span>
                    <MaterialSymbol name="send" size={18} />
                  </button>
                </div>
              </>
            }
          />
          {variantOverlay}
          {inventoryOverlay}
          {confirmOverlay}
        </div>
      </div>,
      document.body,
    );

  if (headless) {
    return <>{interaktCatalogModal}</>;
  }

  if (linkTrigger) {
    return (
      <>
        <button
          type="button"
          className={linkTrigger.className ?? 'inbox-interakt-crm-recent-products__link'}
          disabled={!canWrite}
          onClick={() => setPanelOpen(true)}
        >
          {linkTrigger.label}
        </button>
        {interaktCatalogModal}
      </>
    );
  }

  if (iconTrigger) {
    const showToolbarSuccess = sendSuccessUntil != null && sendSuccessUntil > Date.now();
    return (
      <>
        <button
          type="button"
          className={iconTrigger.className}
          data-testid="inbox-product-picker-trigger"
          disabled={!canWrite || chatTypeBlocked}
          title={showToolbarSuccess ? t('products.inbox.sent') : t('products.inbox.selectProduct')}
          aria-label={showToolbarSuccess ? t('products.inbox.sent') : t('products.inbox.selectProduct')}
          onClick={() => setPanelOpen(true)}
        >
          <MaterialSymbol name={iconTrigger.symbol ?? 'storefront'} size={18} />
          {showToolbarLabel && (
            <span className="inbox-interakt-tool-btn__label" aria-live="polite">
              {showToolbarSuccess ? t('products.inbox.sent') : t('products.inbox.selectProduct')}
            </span>
          )}
        </button>
        {interaktCatalogModal}
      </>
    );
  }

  return pickerBody;
}
