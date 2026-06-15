import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Loader2,
  FileText,
  CircleDollarSign,
  Plus,
  Send,
  Check,
  X,
  Package,
  Truck,
  Wrench,
  ShoppingCart,
  Search,
} from 'lucide-react';
import {
  quoteApi,
  productsApi,
  type CrmProductListItem,
  type CrmProductVariant,
} from '../services/api';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useQuotePermissions } from '../hooks/useQuotePermissions';
import { formatMessagePreviewTime } from '../lib/inbox-interakt-message-preview';
import { LeadSourceBadge } from './LeadSourceBadge';
import { MaterialSymbol } from './MaterialSymbol';
import './InboxQuoteBuilder.css';

interface Props {
  sessionId: string;
  chatId: string;
  customerName?: string | null;
  customerPhone?: string | null;
  conversationId?: string | null;
  canWrite: boolean;
  onSent?: () => void;
  buttonClassName?: string;
  /** Render full builder inline (CRM panel tab) instead of modal trigger. */
  embedded?: boolean;
  triggerIcon?: 'file' | 'dollar';
  variant?: 'classic' | 'interakt' | 'tactical';
  /** When embedded, parent handles closing the shell (header quote modal). */
  onRequestClose?: () => void;
  /** Show visible label under icon in Interakt composer toolbar. */
  showToolbarLabel?: boolean;
  /** Pre-select a quote when opening embedded (e.g. Quotes page create flow). */
  initialQuoteId?: string | null;
}

const PAGE_SIZE = 24;

function formatMoney(amount: number, currency?: string | null): string {
  const cur = currency?.trim() || 'TZS';
  return `${cur} ${Math.round(amount).toLocaleString('en-US')}`;
}

function topLevelVariants(variants: CrmProductVariant[]): CrmProductVariant[] {
  return variants.filter((v) => !v.parentVariantId && v.variantType !== 'imei_child');
}

function stockLabel(status: string | null, t: (k: string) => string): string | null {
  if (status === 'out_of_stock') return t('quotes.stockOut');
  if (status === 'low_stock') return t('quotes.stockLow');
  if (status === 'in_stock') return t('quotes.stockIn');
  return null;
}

export function InboxQuoteBuilder({
  sessionId,
  chatId,
  customerName,
  customerPhone,
  conversationId,
  canWrite,
  onSent,
  buttonClassName,
  embedded = false,
  triggerIcon = 'file',
  variant = 'classic',
  onRequestClose,
  showToolbarLabel = false,
  initialQuoteId,
}: Props) {
  const interaktLayout = variant === 'interakt';
  const interaktChrome = interaktLayout;
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const perms = useQuotePermissions();
  const [open, setOpen] = useState(embedded);
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const debouncedSearch = useDebouncedValue(productSearch.trim(), 300);
  const [productOffset, setProductOffset] = useState(0);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [customItemOpen, setCustomItemOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customQty, setCustomQty] = useState('1');
  const [deliveryInput, setDeliveryInput] = useState('');
  const [previewText, setPreviewText] = useState('');
  const [customizeMode, setCustomizeMode] = useState(false);

  const listKey = ['quotes', sessionId, chatId] as const;

  const { data: quotes = [], isLoading: loadingList } = useQuery({
    queryKey: listKey,
    queryFn: () => quoteApi.list({ sessionId, chatId }),
    enabled: (open || embedded) && perms.canView,
  });

  const { data: activeQuote, isLoading: loadingQuote } = useQuery({
    queryKey: ['quotes', activeQuoteId],
    queryFn: () => quoteApi.get(activeQuoteId!),
    enabled: !!activeQuoteId,
  });

  const { data: productPage, isLoading: loadingProducts } = useQuery({
    queryKey: ['products', 'quote-picker', debouncedSearch, productOffset],
    queryFn: () =>
      productsApi.listPaginated({
        q: debouncedSearch || undefined,
        inStockOnly: false,
        limit: PAGE_SIZE,
        offset: productOffset,
      }),
    enabled: productPickerOpen,
  });

  const productItems = productPage?.items ?? [];
  const productHasMore = productPage?.hasMore ?? false;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: listKey });
    if (activeQuoteId) void queryClient.invalidateQueries({ queryKey: ['quotes', activeQuoteId] });
  };

  const createQuote = useMutation({
    mutationFn: () =>
      quoteApi.createFromChat({
        sessionId,
        chatId,
        customerName,
        customerPhone,
        conversationId,
      }),
    onSuccess: (q) => {
      setActiveQuoteId(q.id);
      invalidate();
    },
  });

  const addProductItem = useMutation({
    mutationFn: (payload: {
      productId: string;
      variantId?: string;
      itemName: string;
      quantity: number;
      unitPrice: number;
    }) => quoteApi.addItem(activeQuoteId!, payload),
    onSuccess: () => {
      invalidate();
      setProductPickerOpen(false);
    },
  });

  const addCustomItem = useMutation({
    mutationFn: () =>
      quoteApi.addItem(activeQuoteId!, {
        itemName: customName.trim(),
        quantity: Number(customQty) || 1,
        unitPrice: Number(customPrice) || 0,
      }),
    onSuccess: () => {
      invalidate();
      setCustomItemOpen(false);
      setCustomName('');
      setCustomPrice('');
      setCustomQty('1');
    },
  });

  const setDelivery = useMutation({
    mutationFn: (fee: number) => quoteApi.setDeliveryFee(activeQuoteId!, fee),
    onSuccess: () => invalidate(),
  });

  const sendQuote = useMutation({
    mutationFn: () => quoteApi.send(activeQuoteId!, previewText.trim() ? { messageBody: previewText } : undefined),
    onSuccess: () => {
      invalidate();
      setStatusMsg(t('quotes.sent'));
      onSent?.();
    },
    onError: (e: Error) => setStatusMsg(e.message),
  });

  const acceptQuote = useMutation({
    mutationFn: () => quoteApi.accept(activeQuoteId!),
    onSuccess: invalidate,
  });

  const rejectQuote = useMutation({
    mutationFn: () => quoteApi.reject(activeQuoteId!),
    onSuccess: invalidate,
  });

  const convertQuote = useMutation({
    mutationFn: () => quoteApi.convert(activeQuoteId!, { paymentPending: true }),
    onSuccess: (q) => {
      invalidate();
      setStatusMsg(t('quotes.converted', { saleId: q.linkedSaleId ?? '' }));
    },
    onError: (e: Error) => setStatusMsg(e.message),
  });

  const removeItem = useMutation({
    mutationFn: (itemId: string) => quoteApi.removeItem(activeQuoteId!, itemId),
    onSuccess: invalidate,
  });

  const loadPreview = useMutation({
    mutationFn: () => quoteApi.previewMessage(activeQuoteId!),
    onSuccess: (res) => setPreviewText(res.body),
  });

  useEffect(() => {
    if (embedded) setOpen(true);
  }, [embedded]);

  useEffect(() => {
    if (initialQuoteId) setActiveQuoteId(initialQuoteId);
  }, [initialQuoteId, sessionId, chatId]);

  useEffect(() => {
    if (initialQuoteId || activeQuoteId) return;
    if ((open || embedded) && quotes.length > 0) {
      setActiveQuoteId(quotes[0].id);
    }
  }, [open, embedded, quotes, activeQuoteId, initialQuoteId]);

  useEffect(() => {
    if (!activeQuoteId || !(open || embedded)) return;
    let cancelled = false;
    void quoteApi
      .previewMessage(activeQuoteId)
      .then((res) => {
        if (!cancelled) {
          setPreviewText(res.body);
          setCustomizeMode(false);
        }
      })
      .catch(() => {
        if (!cancelled) setPreviewText('');
      });
    return () => {
      cancelled = true;
    };
  }, [
    activeQuoteId,
    open,
    embedded,
    activeQuote?.items.length,
    activeQuote?.deliveryFee,
    activeQuote?.totalAmount,
  ]);

  const handleSend = async () => {
    if (!activeQuoteId) return;
    try {
      let body = previewText.trim();
      if (!body) {
        const res = await quoteApi.previewMessage(activeQuoteId);
        body = res.body;
        setPreviewText(body);
      }
      await quoteApi.send(activeQuoteId, { messageBody: body });
      invalidate();
      setStatusMsg(t('quotes.sent'));
      if (interaktLayout && !embedded) {
        setOpen(false);
        setCustomizeMode(false);
      }
      onSent?.();
    } catch (e) {
      setStatusMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const handleClose = () => {
    if (embedded && onRequestClose) {
      onRequestClose();
    } else {
      setOpen(false);
    }
    setStatusMsg(null);
    setCustomizeMode(false);
    setPreviewText('');
  };

  const editable =
    activeQuote && activeQuote.status !== 'converted_to_sale' && activeQuote.status !== 'rejected';

  const openBuilder = () => {
    setOpen(true);
    setStatusMsg(null);
    setCustomizeMode(false);
    if (quotes.length > 0 && !activeQuoteId) {
      setActiveQuoteId(quotes[0].id);
    }
  };

  const busy =
    createQuote.isPending ||
    sendQuote.isPending ||
    convertQuote.isPending ||
    addProductItem.isPending;

  const renderInteraktSidebar = () => {
    if (loadingList || loadingQuote) {
      return (
        <div className="inbox-interakt-quote-modal__loading">
          <Loader2 className="animate-spin" size={24} />
        </div>
      );
    }

    if (!activeQuote) {
      return (
        <div className="inbox-interakt-quote-modal__empty-wrap">
          <p className="inbox-interakt-quote-modal__empty">{t('quotes.empty')}</p>
          {perms.canCreate && (
            <button
              type="button"
              className="inbox-interakt-quote-modal__create-btn"
              disabled={busy}
              onClick={() => createQuote.mutate()}
            >
              <Plus size={16} /> {t('quotes.create')}
            </button>
          )}
        </div>
      );
    }

    return (
      <>
        <div className="inbox-interakt-quote-modal__meta">
          <span className="inbox-interakt-quote-modal__status">{t(`quotes.status.${activeQuote.status}`)}</span>
          {activeQuote.leadSource && (
            <LeadSourceBadge source={activeQuote.leadSource} className="lead-source-badge--sm" />
          )}
          <span className="inbox-interakt-quote-modal__total">
            {formatMoney(activeQuote.totalAmount, activeQuote.currency)}
          </span>
        </div>

        <ul className="inbox-interakt-quote-modal__items">
          {activeQuote.items.map((item) => (
            <li key={item.id} className="inbox-interakt-quote-modal__item">
              <div className="inbox-interakt-quote-modal__item-main">
                <strong>{item.itemName}</strong>
                <span>
                  {item.quantity} × {formatMoney(item.unitPrice, activeQuote.currency)}
                </span>
                {stockLabel(item.stockStatus, t) && (
                  <span
                    className={`inbox-interakt-quote-modal__stock inbox-interakt-quote-modal__stock--${item.stockStatus ?? 'unknown'}`}
                  >
                    {stockLabel(item.stockStatus, t)}
                  </span>
                )}
              </div>
              <div className="inbox-interakt-quote-modal__item-right">
                <span>{formatMoney(item.totalPrice, activeQuote.currency)}</span>
                {editable && (
                  <button
                    type="button"
                    className="inbox-interakt-quote-modal__remove"
                    onClick={() => removeItem.mutate(item.id)}
                  >
                    <MaterialSymbol name="close" size={16} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>

        {editable && perms.canCreate && (
          <div className="inbox-interakt-quote-modal__actions">
            <button type="button" onClick={() => setProductPickerOpen(true)}>
              <MaterialSymbol name="storefront" size={16} />
              <span>{t('quotes.addProduct')}</span>
            </button>
            <button type="button" onClick={() => setCustomItemOpen(true)}>
              <MaterialSymbol name="build" size={16} />
              <span>{t('quotes.addCustom')}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const fee = Number(deliveryInput) || 0;
                setDelivery.mutate(fee);
              }}
            >
              <MaterialSymbol name="local_shipping" size={16} />
              <span>{t('quotes.addDelivery')}</span>
            </button>
          </div>
        )}

        {editable && (
          <label className="inbox-interakt-quote-modal__delivery">
            {t('quotes.deliveryFee')}
            <input
              type="number"
              min={0}
              value={deliveryInput || String(activeQuote.deliveryFee || '')}
              onChange={(e) => setDeliveryInput(e.target.value)}
            />
          </label>
        )}

        {(activeQuote.status === 'sent' || activeQuote.status === 'accepted') && (
          <div className="inbox-interakt-quote-modal__secondary">
            {activeQuote.status === 'sent' && perms.canCreate && (
              <>
                <button type="button" onClick={() => acceptQuote.mutate()}>
                  <Check size={14} /> {t('quotes.accept')}
                </button>
                <button type="button" onClick={() => rejectQuote.mutate()}>
                  <X size={14} /> {t('quotes.reject')}
                </button>
              </>
            )}
            {(activeQuote.status === 'accepted' || activeQuote.status === 'sent') && perms.canConvert && (
              <button type="button" onClick={() => convertQuote.mutate()}>
                <ShoppingCart size={14} /> {t('quotes.convert')}
              </button>
            )}
          </div>
        )}
      </>
    );
  };

  const renderQuoteContent = () => {
    if (loadingList || loadingQuote) {
      return (
        <div className="quote-builder__loading">
          <Loader2 className="animate-spin" size={28} />
        </div>
      );
    }
    if (!activeQuote) {
      return <p className="quote-builder__empty">{t('quotes.empty')}</p>;
    }

    return (
      <>
        <div className="quote-builder__meta">
          <span className="quote-builder__badge">{t(`quotes.status.${activeQuote.status}`)}</span>
          {activeQuote.leadSource && (
            <LeadSourceBadge source={activeQuote.leadSource} className="lead-source-badge--sm" />
          )}
          <span>{formatMoney(activeQuote.totalAmount, activeQuote.currency)}</span>
        </div>

        <ul className="quote-builder__items">
          {activeQuote.items.map((item) => (
            <li key={item.id} className="quote-builder__item">
              <div className="quote-builder__item-main">
                <strong>{item.itemName}</strong>
                <span>
                  {item.quantity} × {formatMoney(item.unitPrice, activeQuote.currency)}
                </span>
                {stockLabel(item.stockStatus, t) && (
                  <span className="quote-builder__stock">{stockLabel(item.stockStatus, t)}</span>
                )}
              </div>
              <div className="quote-builder__item-right">
                <span>{formatMoney(item.totalPrice, activeQuote.currency)}</span>
                {editable && (
                  <button type="button" onClick={() => removeItem.mutate(item.id)}>
                    <X size={14} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>

        {editable && perms.canCreate && (
          <div className="quote-builder__actions-row">
            <button type="button" onClick={() => setProductPickerOpen(true)}>
              <Package size={16} /> {t('quotes.addProduct')}
            </button>
            <button type="button" onClick={() => setCustomItemOpen(true)}>
              <Wrench size={16} /> {t('quotes.addCustom')}
            </button>
            <button
              type="button"
              onClick={() => {
                const fee = Number(deliveryInput) || 0;
                setDelivery.mutate(fee);
              }}
            >
              <Truck size={16} /> {t('quotes.addDelivery')}
            </button>
          </div>
        )}

        {editable && (
          <label className="quote-builder__field">
            {t('quotes.deliveryFee')}
            <input
              type="number"
              min={0}
              value={deliveryInput || String(activeQuote.deliveryFee || '')}
              onChange={(e) => setDeliveryInput(e.target.value)}
            />
          </label>
        )}

        <div className="quote-builder__preview">
          <div className="quote-builder__preview-head">
            <h4>{t('quotes.preview')}</h4>
            <button type="button" onClick={() => loadPreview.mutate()} disabled={loadPreview.isPending}>
              {t('quotes.refreshPreview')}
            </button>
          </div>
          <textarea
            value={previewText}
            onChange={(e) => setPreviewText(e.target.value)}
            placeholder={t('quotes.previewPlaceholder')}
            rows={8}
            readOnly={!editable}
          />
        </div>

        <footer className="quote-builder__footer">
          {statusMsg && <p className="quote-builder__status">{statusMsg}</p>}
          {editable && perms.canSend && activeQuote.items.length > 0 && (
            <button
              type="button"
              className="quote-builder__primary"
              disabled={busy}
              onClick={() => void handleSend()}
            >
              <Send size={16} /> {t('quotes.send')}
            </button>
          )}
          {activeQuote.status === 'sent' && perms.canCreate && (
            <>
              <button type="button" onClick={() => acceptQuote.mutate()}>
                <Check size={16} /> {t('quotes.accept')}
              </button>
              <button type="button" onClick={() => rejectQuote.mutate()}>
                <X size={16} /> {t('quotes.reject')}
              </button>
            </>
          )}
          {(activeQuote.status === 'accepted' || activeQuote.status === 'sent') && perms.canConvert && (
            <button
              type="button"
              className="quote-builder__primary"
              disabled={busy}
              onClick={() => convertQuote.mutate()}
            >
              <ShoppingCart size={16} /> {t('quotes.convert')}
            </button>
          )}
        </footer>
      </>
    );
  };

  if (!perms.canView) return null;

  return (
    <>
      {!embedded && (
        <button
          type="button"
          className={buttonClassName ?? 'inbox-quote-btn'}
          disabled={!canWrite || !perms.canCreate}
          title={t('quotes.create')}
          onClick={openBuilder}
        >
          {interaktLayout && triggerIcon === 'dollar' ? (
            <MaterialSymbol name="attach_money" size={18} />
          ) : triggerIcon === 'dollar' ? (
            <CircleDollarSign size={18} strokeWidth={1.75} aria-hidden />
          ) : (
            <FileText size={18} aria-hidden />
          )}
          {showToolbarLabel && (
            <span className="inbox-interakt-tool-btn__label">{t('quotes.create')}</span>
          )}
        </button>
      )}

      {(open || embedded) &&
        createPortal(
          interaktLayout ? (
            <div
              className="inbox-interakt-picker-overlay inbox-interakt-picker-overlay--template"
              onClick={handleClose}
              role="presentation"
            >
              <div
                className="inbox-interakt-quote-modal"
                role="dialog"
                aria-labelledby="inbox-interakt-quote-modal-title"
                onClick={(e) => e.stopPropagation()}
              >
                <aside className="inbox-interakt-quote-modal__sidebar">
                  <div className="inbox-interakt-quote-modal__sidebar-head">
                    <h2 className="inbox-interakt-quote-modal__sidebar-title">{t('inbox.interakt.sendQuote')}</h2>
                    <div className="inbox-interakt-quote-modal__toolbar">
                      {perms.canCreate && (
                        <button
                          type="button"
                          className="inbox-interakt-quote-modal__toolbar-btn"
                          disabled={busy}
                          onClick={() => createQuote.mutate()}
                        >
                          <Plus size={16} /> {t('quotes.create')}
                        </button>
                      )}
                      {quotes.length > 0 && (
                        <select
                          className="inbox-interakt-quote-modal__select"
                          value={activeQuoteId ?? ''}
                          onChange={(e) => {
                            setActiveQuoteId(e.target.value || null);
                            setPreviewText('');
                            setCustomizeMode(false);
                          }}
                        >
                          {quotes.map((q) => (
                            <option key={q.id} value={q.id}>
                              {q.quoteNumber} — {t(`quotes.status.${q.status}`)}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                  <div className="inbox-interakt-quote-modal__sidebar-body">{renderInteraktSidebar()}</div>
                </aside>

                <div className="inbox-interakt-quote-modal__preview-pane">
                  <header className="inbox-interakt-tpl-modal__preview-head">
                    <h2 id="inbox-interakt-quote-modal-title" className="inbox-interakt-tpl-modal__preview-title">
                      {t('inbox.interakt.quotePreview')}
                    </h2>
                    <button
                      type="button"
                      className="inbox-interakt-tpl-modal__preview-close"
                      onClick={handleClose}
                      aria-label={t('common.close')}
                    >
                      <MaterialSymbol name="close" size={20} />
                    </button>
                  </header>

                  <div className="inbox-interakt-tpl-modal__canvas">
                    {!activeQuote || loadingList || loadingQuote ? (
                      <p className="inbox-interakt-tpl-modal__pick-hint">{t('quotes.previewPlaceholder')}</p>
                    ) : (
                      <div className="inbox-interakt-tpl-modal__bubble-wrap">
                        {customizeMode ? (
                          <textarea
                            className="inbox-interakt-tpl-modal__customize"
                            rows={14}
                            value={previewText}
                            onChange={(e) => setPreviewText(e.target.value)}
                            placeholder={t('quotes.previewPlaceholder')}
                            aria-label={t('inbox.interakt.customizeOneTime')}
                            readOnly={!editable}
                          />
                        ) : (
                          <div className="inbox-interakt-tpl-modal__bubble inbox-interakt-tpl-modal__bubble--quote">
                            <p className="inbox-interakt-tpl-modal__bubble-text">
                              {previewText || t('quotes.previewPlaceholder')}
                            </p>
                            <span className="inbox-interakt-tpl-modal__bubble-meta">
                              {formatMessagePreviewTime()} • {t('inbox.interakt.previewRead')}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    {statusMsg && <p className="inbox-interakt-quote-modal__status-msg">{statusMsg}</p>}
                  </div>

                  <footer className="inbox-interakt-tpl-modal__footer">
                    <div className="inbox-interakt-tpl-modal__footer-start">
                      <button
                        type="button"
                        className="inbox-interakt-tpl-modal__customize-btn"
                        disabled={!activeQuote || !editable}
                        onClick={() => setCustomizeMode((v) => !v)}
                      >
                        <MaterialSymbol name="edit" size={18} />
                        <span>{t('inbox.interakt.customizeOneTime')}</span>
                      </button>
                      <button
                        type="button"
                        className="inbox-interakt-tpl-modal__customize-btn"
                        disabled={!activeQuoteId || loadPreview.isPending}
                        onClick={() => loadPreview.mutate()}
                      >
                        <MaterialSymbol name="refresh" size={18} />
                        <span>{t('quotes.refreshPreview')}</span>
                      </button>
                    </div>
                    <div className="inbox-interakt-tpl-modal__footer-actions">
                      <button
                        type="button"
                        className="inbox-interakt-tpl-modal__btn inbox-interakt-tpl-modal__btn--ghost"
                        onClick={handleClose}
                      >
                        {t('common.cancel')}
                      </button>
                      <button
                        type="button"
                        className="inbox-interakt-tpl-modal__btn inbox-interakt-tpl-modal__btn--primary"
                        disabled={!editable || !perms.canSend || !activeQuote || activeQuote.items.length === 0 || busy}
                        onClick={() => void handleSend()}
                      >
                        <MaterialSymbol name="send" size={18} filled />
                        <span>{t('inbox.interakt.sendQuoteAction')}</span>
                      </button>
                    </div>
                  </footer>
                </div>
              </div>
            </div>
          ) : (
            <div
              className={embedded ? 'quote-builder-overlay quote-builder-overlay--embedded' : 'quote-builder-overlay'}
              onClick={embedded ? undefined : handleClose}
              role={embedded ? undefined : 'presentation'}
            >
              <div
                className={embedded ? 'quote-builder quote-builder--embedded' : 'quote-builder'}
                role="dialog"
                aria-label={t('quotes.title')}
                onClick={(e) => e.stopPropagation()}
              >
                <header className="quote-builder__header">
                  <h3>{t('quotes.title')}</h3>
                  {!embedded && (
                    <button type="button" className="quote-builder__close" onClick={handleClose}>
                      <X size={20} />
                    </button>
                  )}
                </header>

                <div className="quote-builder__toolbar">
                  {perms.canCreate && (
                    <button
                      type="button"
                      className="quote-builder__action"
                      disabled={busy}
                      onClick={() => createQuote.mutate()}
                    >
                      <Plus size={16} /> {t('quotes.create')}
                    </button>
                  )}
                  {quotes.length > 0 && (
                    <select
                      className="quote-builder__select"
                      value={activeQuoteId ?? ''}
                      onChange={(e) => {
                        setActiveQuoteId(e.target.value || null);
                        setPreviewText('');
                      }}
                    >
                      {quotes.map((q) => (
                        <option key={q.id} value={q.id}>
                          {q.quoteNumber} — {t(`quotes.status.${q.status}`)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {renderQuoteContent()}
              </div>
            </div>
          ),
          document.body,
        )}

      {productPickerOpen &&
        createPortal(
          <div
            className={
              interaktChrome
                ? 'inbox-interakt-picker-overlay inbox-interakt-picker-overlay--template inbox-interakt-picker-overlay--nested'
                : 'quote-builder-overlay quote-builder-overlay--nested'
            }
            onClick={() => setProductPickerOpen(false)}
            role="presentation"
          >
            <div
              className={interaktChrome ? 'inbox-interakt-quote-product-modal' : 'quote-product-picker'}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-label={t('quotes.pickProduct')}
            >
              <header className={interaktChrome ? 'inbox-interakt-quote-product-modal__head' : undefined}>
                <h4>{t('quotes.pickProduct')}</h4>
                <button type="button" onClick={() => setProductPickerOpen(false)} aria-label={t('common.close')}>
                  {interaktChrome ? <MaterialSymbol name="close" size={20} /> : <X size={18} />}
                </button>
              </header>
              <div className={interaktChrome ? 'inbox-interakt-quote-product-modal__search' : 'quote-product-picker__search'}>
                {interaktChrome ? (
                  <MaterialSymbol name="search" size={18} className="inbox-interakt-quote-product-modal__search-icon" />
                ) : (
                  <Search size={16} />
                )}
                <input
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    setProductOffset(0);
                  }}
                  placeholder={t('quotes.searchProducts')}
                />
              </div>
              {loadingProducts ? (
                <div className="quote-builder__loading">
                  <Loader2 className="animate-spin" size={24} />
                </div>
              ) : (
                <ul className={interaktChrome ? 'inbox-interakt-quote-product-modal__list' : 'quote-product-picker__list'}>
                  {productItems.map((product) => (
                    <QuoteProductRow
                      key={product.id}
                      product={product}
                      currency={activeQuote?.currency}
                      onPick={(variantId, name, price) =>
                        addProductItem.mutate({
                          productId: product.id,
                          variantId,
                          itemName: name,
                          quantity: 1,
                          unitPrice: price,
                        })
                      }
                    />
                  ))}
                </ul>
              )}
              <div className={interaktChrome ? 'inbox-interakt-quote-product-modal__pager' : 'quote-product-picker__pager'}>
                <button
                  type="button"
                  disabled={productOffset <= 0}
                  onClick={() => setProductOffset((o) => Math.max(0, o - PAGE_SIZE))}
                >
                  {t('quotes.prev')}
                </button>
                <button
                  type="button"
                  disabled={!productHasMore}
                  onClick={() => setProductOffset((o) => o + PAGE_SIZE)}
                >
                  {t('quotes.next')}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {customItemOpen &&
        createPortal(
          <div
            className={
              interaktChrome
                ? 'inbox-interakt-picker-overlay inbox-interakt-picker-overlay--template inbox-interakt-picker-overlay--nested'
                : 'quote-builder-overlay quote-builder-overlay--nested'
            }
            onClick={() => setCustomItemOpen(false)}
            role="presentation"
          >
            <div
              className={interaktChrome ? 'inbox-interakt-quote-custom-modal' : 'quote-custom-form'}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
            >
              <h4>{t('quotes.addCustom')}</h4>
              <label>
                {t('quotes.itemName')}
                <input value={customName} onChange={(e) => setCustomName(e.target.value)} />
              </label>
              <label>
                {t('quotes.quantity')}
                <input type="number" min={1} value={customQty} onChange={(e) => setCustomQty(e.target.value)} />
              </label>
              <label>
                {t('quotes.unitPrice')}
                <input type="number" min={0} value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} />
              </label>
              <button
                type="button"
                className={interaktChrome ? 'inbox-interakt-tpl-modal__btn inbox-interakt-tpl-modal__btn--primary' : 'quote-builder__primary'}
                disabled={!customName.trim() || addCustomItem.isPending}
                onClick={() => addCustomItem.mutate()}
              >
                {t('quotes.add')}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function QuoteProductRow({
  product,
  currency,
  onPick,
}: {
  product: CrmProductListItem;
  currency?: string | null;
  onPick: (variantId: string | undefined, name: string, price: number) => void;
}) {
  const { t } = useTranslation();
  const variants = topLevelVariants(product.variants ?? []);
  const basePrice = product.sellingPrice ?? 0;

  if (variants.length === 0) {
    return (
      <li>
        <button
          type="button"
          onClick={() => onPick(undefined, product.name, basePrice)}
        >
          <span>{product.name}</span>
          <span>{formatMoney(basePrice, currency ?? product.currency)}</span>
          <span className="quote-product-picker__stock">
            {product.totalStock > 0 ? t('quotes.stockIn') : t('quotes.stockOut')}
          </span>
        </button>
      </li>
    );
  }

  return (
    <>
      {variants.map((v) => (
        <li key={v.id}>
          <button
            type="button"
            onClick={() => onPick(v.id, `${product.name} — ${v.name}`, v.sellingPrice ?? basePrice)}
          >
            <span>{product.name} — {v.name}</span>
            <span>{formatMoney(v.sellingPrice ?? basePrice, currency ?? product.currency)}</span>
            <span className="quote-product-picker__stock">
              {v.quantity > 0 ? `${v.quantity} ${t('quotes.inStock')}` : t('quotes.stockOut')}
            </span>
          </button>
        </li>
      ))}
    </>
  );
}
