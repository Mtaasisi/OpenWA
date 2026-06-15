import { useState, useMemo, useEffect, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, MessageSquareText, Zap, List, Search, Star, X, Pencil, Save } from 'lucide-react';
import {
  followupApi,
  productsApi,
  quickReplyApi,
  type Conversation,
  type QuickReplyCategory,
  type QuickReplyTemplate,
  QUICK_REPLY_CATEGORIES,
} from '../services/api';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useQuickReplyPermissions } from '../hooks/useQuickReplyPermissions';
import {
  buildQuickReplyVariables,
  renderQuickReplyTemplate,
} from '../lib/quick-reply-variables';
import {
  formatMessagePreviewTime,
  messageHasVariables,
  renderMessageBubbleContent,
  truncateMessageSnippet,
} from '../lib/inbox-interakt-message-preview';
import {
  loadQuickReplyFavorites,
  toggleQuickReplyFavorite,
} from '../lib/quick-reply-favorites';
import { useToast } from './Toast';
import { MaterialSymbol } from './MaterialSymbol';
import { settingsPanelHref } from './settings/settings-nav-registry';
import { OPENWA_OPEN_QUICK_REPLIES_EVENT } from '../lib/inbox-events';
import './InboxQuickRepliesPicker.css';

interface Props {
  sessionId: string;
  chatId: string;
  conversation?: Conversation;
  canWrite: boolean;
  onInsert: (text: string) => void;
  onFocusComposer?: () => void;
  buttonClassName?: string;
  variant?: 'classic' | 'tactical' | 'interakt';
  triggerIcon?: 'message' | 'zap' | 'list';
  /** Interakt panel title override (e.g. Lists vs Quick replies). */
  panelTitle?: string;
  /** Show visible label under icon in Interakt composer toolbar. */
  showToolbarLabel?: boolean;
}

type PanelMode = 'preview' | 'edit';

function shouldShowCategoryPill(name: string, categoryLabel: string): boolean {
  const normalizedName = name.trim().toLowerCase();
  const normalizedCategory = categoryLabel.trim().toLowerCase();
  if (normalizedName === normalizedCategory) return false;
  if (normalizedName.includes(normalizedCategory)) return false;
  const words = normalizedCategory.split(/\s+/).filter(Boolean);
  if (words.length > 0 && words.every(word => normalizedName.includes(word))) return false;
  return true;
}

export function InboxQuickRepliesPicker({
  sessionId,
  chatId,
  conversation,
  canWrite,
  onInsert,
  onFocusComposer,
  buttonClassName = 'inbox-quick-reply-btn',
  variant = 'classic',
  triggerIcon = 'message',
  panelTitle,
  showToolbarLabel = false,
}: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { canSend, canView, canManage } = useQuickReplyPermissions();
  const isTactical = variant === 'tactical';
  const isInterakt = variant === 'interakt';
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<QuickReplyCategory | ''>('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() => loadQuickReplyFavorites());
  const [selected, setSelected] = useState<QuickReplyTemplate | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>('preview');
  const [previewText, setPreviewText] = useState('');
  const [editDraft, setEditDraft] = useState<Partial<QuickReplyTemplate>>({});
  const [customizeMode, setCustomizeMode] = useState(false);
  const debouncedSearch = useDebouncedValue(search.trim(), 250);
  const apiCategory = isInterakt ? undefined : category || undefined;

  useEffect(() => {
    const onOpenRequest = () => {
      if (canWrite) setOpen(true);
    };
    window.addEventListener(OPENWA_OPEN_QUICK_REPLIES_EVENT, onOpenRequest);
    return () => window.removeEventListener(OPENWA_OPEN_QUICK_REPLIES_EVENT, onOpenRequest);
  }, [canWrite]);

  const { data: followupConv } = useQuery({
    queryKey: ['followups', 'conv', sessionId, chatId],
    queryFn: () => followupApi.getConversation(sessionId, chatId),
    enabled: open,
  });

  const { data: inauzwaStatus } = useQuery({
    queryKey: ['products', 'inauzwa-status'],
    queryFn: () => productsApi.inauzwaSyncStatus(),
    enabled: open,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['products', 'inauzwa-branches'],
    queryFn: () => productsApi.listInauzwaBranches(),
    enabled: open && !!inauzwaStatus?.configured,
  });

  const branchId = followupConv?.branchId ?? inauzwaStatus?.branchId ?? undefined;
  const branchLabel =
    branches.find(b => b.id === branchId)?.name ??
    inauzwaStatus?.preferences.businessName ??
    undefined;

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['quick-reply', 'templates', branchId ?? '', apiCategory ?? '', debouncedSearch],
    queryFn: () =>
      quickReplyApi.listTemplates({
        branchId,
        category: apiCategory,
        search: debouncedSearch || undefined,
      }),
    enabled: open && canView,
  });

  const displayedTemplates = useMemo(() => {
    let list = [...templates];
    if (favoritesOnly) {
      list = list.filter(tpl => favorites.includes(tpl.id));
    }
    list.sort((a, b) => {
      const af = favorites.includes(a.id) ? 0 : 1;
      const bf = favorites.includes(b.id) ? 0 : 1;
      if (af !== bf) return af - bf;
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [templates, favorites, favoritesOnly]);

  const groupedTemplates = useMemo(() => {
    if (!isInterakt) return [];
    const groups = new Map<string, QuickReplyTemplate[]>();
    for (const tpl of displayedTemplates) {
      const cat = t(`quickReplies.categories.${tpl.category}`);
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(tpl);
    }
    const order = QUICK_REPLY_CATEGORIES.map((c) => t(`quickReplies.categories.${c}`));
    return [...groups.entries()].sort((a, b) => {
      const ai = order.indexOf(a[0]);
      const bi = order.indexOf(b[0]);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a[0].localeCompare(b[0]);
    });
  }, [displayedTemplates, isInterakt, t]);

  const variables = useMemo(
    () =>
      buildQuickReplyVariables({
        conversation,
        followupConv,
        branchName: branchLabel ?? null,
        paymentNumber: inauzwaStatus?.preferences.defaultPaymentInstructions ?? null,
        pickupLocation: inauzwaStatus?.preferences.defaultBranchPickupInfo ?? null,
      }),
    [
      conversation,
      followupConv,
      branchLabel,
      inauzwaStatus?.preferences.defaultPaymentInstructions,
      inauzwaStatus?.preferences.defaultBranchPickupInfo,
    ],
  );

  const renderedPreview = useMemo(() => {
    if (!selected) return '';
    return renderQuickReplyTemplate(selected.body, variables);
  }, [selected, variables]);

  useEffect(() => {
    if (selected && panelMode === 'preview') {
      setPreviewText(renderedPreview);
    }
  }, [selected, renderedPreview, panelMode]);

  useEffect(() => {
    if (!open || !isInterakt) return;
    if (displayedTemplates.length === 0) {
      setSelected(null);
      return;
    }
    if (!selected || !displayedTemplates.some((tpl) => tpl.id === selected.id)) {
      setSelected(displayedTemplates[0]);
    }
  }, [open, isInterakt, displayedTemplates, selected]);

  useEffect(() => {
    if (selected && panelMode === 'edit') {
      setEditDraft({
        name: selected.name,
        category: selected.category,
        body: selected.body,
      });
    }
  }, [selected, panelMode]);

  const saveTemplateMutation = useMutation({
    mutationFn: () =>
      quickReplyApi.updateTemplate(selected!.id, {
        name: editDraft.name,
        category: editDraft.category,
        body: editDraft.body,
      }),
    onSuccess: updated => {
      toast.success(t('quickReplies.saved'));
      setSelected(updated);
      setPanelMode('preview');
      void queryClient.invalidateQueries({ queryKey: ['quick-reply'] });
    },
    onError: (err: Error) => toast.error(t('common.errorGeneric'), err.message),
  });

  const handleOpen = () => {
    if (!canSend || !canWrite) return;
    setOpen(true);
    setSelected(null);
    setSearch('');
    setCategory('');
    setFavoritesOnly(false);
    setPanelMode('preview');
    setCustomizeMode(false);
    setPreviewText('');
    setFavorites(loadQuickReplyFavorites());
  };

  const handleClose = () => {
    setOpen(false);
    setSelected(null);
    setSearch('');
    setCategory('');
    setFavoritesOnly(false);
    setPanelMode('preview');
    setCustomizeMode(false);
    setPreviewText('');
  };

  const handleToggleFavorite = (id: string, e: MouseEvent) => {
    e.stopPropagation();
    setFavorites(toggleQuickReplyFavorite(id));
  };

  const handleSelect = (tpl: QuickReplyTemplate) => {
    setSelected(tpl);
    setPanelMode('preview');
    setCustomizeMode(false);
  };

  const handleInsert = () => {
    const text = previewText.trim();
    if (!text) return;
    onInsert(text);
    handleClose();
    onFocusComposer?.();
  };

  const showVariableBadge = selected ? messageHasVariables(selected.body) : false;

  const manageTemplatesLink = canManage ? (
    <Link
      to={settingsPanelHref('quick-replies')}
      className="qr-picker__manage"
      onClick={handleClose}
    >
      <MaterialSymbol name="settings" size={16} />
      {t('quickReplies.manageLink')}
    </Link>
  ) : null;

  if (!canView) return null;

  return (
    <>
      <button
        type="button"
        className={buttonClassName}
        disabled={!canSend || !canWrite}
        title={panelTitle ?? t('quickReplies.openPicker')}
        aria-label={panelTitle ?? t('quickReplies.openPicker')}
        onClick={handleOpen}
      >
        {isInterakt && triggerIcon === 'zap' ? (
          <MaterialSymbol name="bolt" size={18} />
        ) : triggerIcon === 'zap' ? (
          <Zap size={18} strokeWidth={1.75} aria-hidden />
        ) : triggerIcon === 'list' ? (
          <List size={18} strokeWidth={1.75} aria-hidden />
        ) : (
          <MessageSquareText size={isTactical ? 16 : 18} aria-hidden />
        )}
        {isTactical && (
          <span className="tac-quick-reply-btn__label">{t('quickReplies.shortLabel')}</span>
        )}
        {showToolbarLabel && (
          <span className="inbox-interakt-tool-btn__label">
            {panelTitle ?? t('quickReplies.title')}
          </span>
        )}
      </button>

      {open &&
        isInterakt &&
        createPortal(
          <div
            className="inbox-interakt-picker-overlay inbox-interakt-picker-overlay--template"
            onClick={handleClose}
            role="presentation"
          >
            <div
              className="inbox-interakt-tpl-modal"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="inbox-interakt-qr-modal-title"
            >
              <aside className="inbox-interakt-tpl-modal__sidebar">
                <div className="inbox-interakt-tpl-modal__search-wrap">
                  <MaterialSymbol name="search" size={18} className="inbox-interakt-tpl-modal__search-icon" />
                  <input
                    type="search"
                    className="inbox-interakt-tpl-modal__search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t('inbox.interakt.searchTemplates')}
                    aria-label={t('inbox.interakt.searchTemplates')}
                  />
                </div>

                <div className="inbox-interakt-tpl-modal__list" role="listbox">
                  {isLoading ? (
                    <div className="inbox-interakt-tpl-modal__loading">
                      <Loader2 className="animate-spin" size={22} />
                    </div>
                  ) : groupedTemplates.length === 0 ? (
                    <div className="inbox-interakt-tpl-modal__empty-wrap">
                      <p className="inbox-interakt-tpl-modal__empty">{t('quickReplies.empty')}</p>
                      {manageTemplatesLink}
                    </div>
                  ) : (
                    groupedTemplates.map(([categoryLabel, items]) => (
                      <div key={categoryLabel} className="inbox-interakt-tpl-modal__group">
                        <div className="inbox-interakt-tpl-modal__group-label">{categoryLabel}</div>
                        <div className="inbox-interakt-tpl-modal__group-items">
                          {items.map((tpl) => {
                            const isActive = selected?.id === tpl.id;
                            const isFav = favorites.includes(tpl.id);
                            return (
                              <div
                                key={tpl.id}
                                className={`inbox-interakt-tpl-modal__item-row${isActive ? ' is-active' : ''}`}
                              >
                                <button
                                  type="button"
                                  role="option"
                                  aria-selected={isActive}
                                  className={`inbox-interakt-tpl-modal__item${isActive ? ' is-active' : ''}`}
                                  onClick={() => handleSelect(tpl)}
                                >
                                  <span className="inbox-interakt-tpl-modal__item-name">{tpl.name}</span>
                                  <span className="inbox-interakt-tpl-modal__item-snippet">
                                    {truncateMessageSnippet(renderQuickReplyTemplate(tpl.body, variables))}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  className={`inbox-interakt-tpl-modal__fav${isFav ? ' is-on' : ''}`}
                                  aria-label={isFav ? t('quickReplies.unfavorite') : t('quickReplies.favorite')}
                                  aria-pressed={isFav}
                                  onClick={(e) => handleToggleFavorite(tpl.id, e)}
                                >
                                  <Star size={16} strokeWidth={2} fill={isFav ? 'currentColor' : 'none'} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {manageTemplatesLink ? (
                  <div className="inbox-interakt-tpl-modal__sidebar-foot">{manageTemplatesLink}</div>
                ) : null}
              </aside>

              <div className="inbox-interakt-tpl-modal__preview-pane">
                <header className="inbox-interakt-tpl-modal__preview-head">
                  <h2 id="inbox-interakt-qr-modal-title" className="inbox-interakt-tpl-modal__preview-title">
                    {t('inbox.interakt.quickReplyPreview')}
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
                  {selected && panelMode === 'edit' ? (
                    <form
                      className="inbox-interakt-tpl-modal__edit-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        saveTemplateMutation.mutate();
                      }}
                    >
                      <label>
                        {t('common.name')}
                        <input
                          value={editDraft.name ?? ''}
                          onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                          required
                        />
                      </label>
                      <label>
                        {t('quickReplies.filterCategory')}
                        <select
                          value={editDraft.category ?? ''}
                          onChange={(e) =>
                            setEditDraft({
                              ...editDraft,
                              category: e.target.value as QuickReplyCategory,
                            })
                          }
                          required
                        >
                          {QUICK_REPLY_CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {t(`quickReplies.categories.${c}`)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {t('quickReplies.body')}
                        <textarea
                          rows={8}
                          value={editDraft.body ?? ''}
                          onChange={(e) => setEditDraft({ ...editDraft, body: e.target.value })}
                          required
                        />
                      </label>
                      <button
                        type="submit"
                        className="inbox-interakt-tpl-modal__btn inbox-interakt-tpl-modal__btn--primary"
                        disabled={saveTemplateMutation.isPending}
                      >
                        <Save size={14} /> {t('common.save')}
                      </button>
                    </form>
                  ) : selected ? (
                    <>
                      {showVariableBadge && (
                        <div className="inbox-interakt-tpl-modal__var-notice">
                          <span className="inbox-interakt-tpl-modal__var-badge">
                            {t('inbox.interakt.variableDetected')}
                          </span>
                          <span className="inbox-interakt-tpl-modal__var-hint">
                            {t('inbox.interakt.variablesAutoFillHint')}
                          </span>
                        </div>
                      )}

                      <div className="inbox-interakt-tpl-modal__bubble-wrap">
                        {customizeMode ? (
                          <textarea
                            className="inbox-interakt-tpl-modal__customize"
                            rows={10}
                            value={previewText}
                            onChange={(e) => setPreviewText(e.target.value)}
                            aria-label={t('inbox.interakt.customizeOneTime')}
                          />
                        ) : (
                          <div className="inbox-interakt-tpl-modal__bubble">
                            <p className="inbox-interakt-tpl-modal__bubble-text">
                              {renderMessageBubbleContent(selected.body, variables)}
                            </p>
                            <span className="inbox-interakt-tpl-modal__bubble-meta">
                              {formatMessagePreviewTime()} • {t('inbox.interakt.previewRead')}
                            </span>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="inbox-interakt-tpl-modal__pick-hint">{t('quickReplies.selectToPreview')}</p>
                  )}
                </div>

                <footer className="inbox-interakt-tpl-modal__footer">
                  <div className="inbox-interakt-tpl-modal__footer-start">
                    <button
                      type="button"
                      className="inbox-interakt-tpl-modal__customize-btn"
                      disabled={!selected || panelMode === 'edit'}
                      onClick={() => setCustomizeMode((v) => !v)}
                    >
                      <MaterialSymbol name="edit" size={18} />
                      <span>{t('inbox.interakt.customizeOneTime')}</span>
                    </button>
                    {canManage && selected && (
                      <button
                        type="button"
                        className="inbox-interakt-tpl-modal__customize-btn"
                        onClick={() => setPanelMode((m) => (m === 'edit' ? 'preview' : 'edit'))}
                      >
                        <Pencil size={16} />
                        <span>{panelMode === 'edit' ? t('quickReplies.backToPreview') : t('common.edit')}</span>
                      </button>
                    )}
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
                      disabled={!selected || panelMode === 'edit' || !previewText.trim()}
                      onClick={handleInsert}
                    >
                      <MaterialSymbol name="send" size={18} filled />
                      <span>{t('inbox.interakt.useQuickReply')}</span>
                    </button>
                  </div>
                </footer>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {open &&
        !isInterakt &&
        createPortal(
          <div
            className={`qr-picker-overlay${isTactical ? ' qr-picker-overlay--tactical' : ''}`}
            onClick={handleClose}
            role="presentation"
          >
            <div
              className={`qr-picker${isTactical ? ' qr-picker--tactical' : ''}`}
              onClick={e => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label={panelTitle ?? t('quickReplies.title')}
            >
              <header className="qr-picker__header">
                <h3>{t('quickReplies.title')}</h3>
                <button
                  type="button"
                  className="qr-picker__close"
                  onClick={handleClose}
                  aria-label={t('common.close')}
                >
                  <X size={18} />
                </button>
              </header>

              {manageTemplatesLink ? (
                <div className="qr-picker__manage-row">{manageTemplatesLink}</div>
              ) : null}

              <div className="qr-picker__filters">
                <div className="qr-picker__search">
                  <Search size={16} aria-hidden />
                  <input
                    type="search"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder={t('quickReplies.searchPlaceholder')}
                    aria-label={t('quickReplies.searchPlaceholder')}
                  />
                </div>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value as QuickReplyCategory | '')}
                  aria-label={t('quickReplies.filterCategory')}
                >
                  <option value="">{t('quickReplies.allCategories')}</option>
                  {QUICK_REPLY_CATEGORIES.map(c => (
                    <option key={c} value={c}>
                      {t(`quickReplies.categories.${c}`)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={`qr-picker__fav-filter${favoritesOnly ? ' qr-picker__fav-filter--active' : ''}`}
                  onClick={() => setFavoritesOnly(v => !v)}
                  title={t('quickReplies.favoritesOnly')}
                  aria-label={t('quickReplies.favoritesOnly')}
                  aria-pressed={favoritesOnly}
                >
                  <Star size={16} strokeWidth={2} fill={favoritesOnly ? 'currentColor' : 'none'} />
                  <span className="qr-picker__fav-filter__label">{t('quickReplies.favorites')}</span>
                </button>
              </div>

              <div className="qr-picker__body">
                <div className="qr-picker__list" role="listbox" aria-label={t('quickReplies.title')}>
                  {isLoading ? (
                    <div className="qr-picker__loading">
                      <Loader2 className="animate-spin" size={22} />
                    </div>
                  ) : displayedTemplates.length === 0 ? (
                    <div className="qr-picker__empty-wrap">
                      <p className="qr-picker__empty">
                        {favoritesOnly ? t('quickReplies.favoritesEmpty') : t('quickReplies.empty')}
                      </p>
                      {manageTemplatesLink}
                    </div>
                  ) : (
                    displayedTemplates.map(tpl => {
                      const isFav = favorites.includes(tpl.id);
                      const categoryLabel = t(`quickReplies.categories.${tpl.category}`);
                      const isSelected = selected?.id === tpl.id;
                      const snippet = truncateMessageSnippet(
                        renderQuickReplyTemplate(tpl.body, variables),
                      );
                      return (
                        <div
                          key={tpl.id}
                          className={`qr-picker__item-row${isSelected ? ' qr-picker__item-row--active' : ''}`}
                        >
                          <button
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            className="qr-picker__item"
                            onClick={() => handleSelect(tpl)}
                          >
                            <span className="qr-picker__item-top">
                              <span className="qr-picker__item-name">{tpl.name}</span>
                              {shouldShowCategoryPill(tpl.name, categoryLabel) && (
                                <span className="qr-picker__item-pill">{categoryLabel}</span>
                              )}
                            </span>
                            <span className="qr-picker__item-snippet">{snippet}</span>
                          </button>
                          <button
                            type="button"
                            className={`qr-picker__fav${isFav ? ' qr-picker__fav--on' : ''}`}
                            aria-label={isFav ? t('quickReplies.unfavorite') : t('quickReplies.favorite')}
                            aria-pressed={isFav}
                            onClick={e => handleToggleFavorite(tpl.id, e)}
                          >
                            <Star size={18} strokeWidth={2} fill={isFav ? 'currentColor' : 'none'} />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="qr-picker__preview">
                  <div className="qr-picker__preview-tabs">
                    <h4>{panelMode === 'edit' ? t('quickReplies.editTemplate') : t('quickReplies.preview')}</h4>
                    {canManage && selected && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setPanelMode(m => (m === 'edit' ? 'preview' : 'edit'))}
                      >
                        {panelMode === 'edit' ? (
                          t('quickReplies.backToPreview')
                        ) : (
                          <>
                            <Pencil size={14} /> {t('common.edit')}
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {!selected ? (
                    <p className="qr-picker__preview-hint">{t('quickReplies.selectToPreview')}</p>
                  ) : panelMode === 'edit' ? (
                    <form
                      className="qr-picker__edit-form"
                      onSubmit={e => {
                        e.preventDefault();
                        saveTemplateMutation.mutate();
                      }}
                    >
                      <label>
                        {t('common.name')}
                        <input
                          value={editDraft.name ?? ''}
                          onChange={e => setEditDraft({ ...editDraft, name: e.target.value })}
                          required
                        />
                      </label>
                      <label>
                        {t('quickReplies.filterCategory')}
                        <select
                          value={editDraft.category ?? ''}
                          onChange={e =>
                            setEditDraft({
                              ...editDraft,
                              category: e.target.value as QuickReplyCategory,
                            })
                          }
                          required
                        >
                          {QUICK_REPLY_CATEGORIES.map(c => (
                            <option key={c} value={c}>
                              {t(`quickReplies.categories.${c}`)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {t('quickReplies.body')}
                        <textarea
                          rows={5}
                          value={editDraft.body ?? ''}
                          onChange={e => setEditDraft({ ...editDraft, body: e.target.value })}
                          required
                        />
                      </label>
                      <button
                        type="submit"
                        className="btn btn-primary btn-sm"
                        disabled={saveTemplateMutation.isPending}
                      >
                        <Save size={14} /> {t('common.save')}
                      </button>
                    </form>
                  ) : (
                    <textarea
                      rows={6}
                      value={previewText}
                      onChange={e => setPreviewText(e.target.value)}
                      aria-label={t('quickReplies.preview')}
                    />
                  )}
                  {panelMode === 'preview' && selected && (
                    <p className="qr-picker__preview-note">{t('quickReplies.editBeforeSend')}</p>
                  )}
                </div>
              </div>

              <footer className="qr-picker__footer">
                <button type="button" className="btn btn-secondary" onClick={handleClose}>
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!selected || panelMode !== 'preview' || !previewText.trim()}
                  onClick={handleInsert}
                >
                  {t('quickReplies.insert')}
                </button>
              </footer>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
