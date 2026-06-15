import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { MaterialSymbol } from './MaterialSymbol';
import {
  followupApi,
  productsApi,
  type Conversation,
  type FollowupTemplate,
} from '../services/api';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import {
  buildQuickReplyVariables,
  followupTemplateVariablesRecord,
} from '../lib/quick-reply-variables';
import {
  formatMessagePreviewTime,
  messageHasVariables,
  renderMessageBubbleContent,
  truncateMessageSnippet,
} from '../lib/inbox-interakt-message-preview';
import { useFollowupPermissions } from '../hooks/useFollowupPermissions';
import { settingsPanelHref } from './settings/settings-nav-registry';

interface Props {
  sessionId: string;
  chatId: string;
  conversation?: Conversation;
  canWrite: boolean;
  onInsert: (text: string) => void;
  onFocusComposer?: () => void;
  buttonClassName?: string;
  /** Show visible label under icon in Interakt composer toolbar. */
  showToolbarLabel?: boolean;
}

export function InboxFollowupTemplatesPicker({
  sessionId,
  chatId,
  conversation,
  canWrite,
  onInsert,
  onFocusComposer,
  buttonClassName = 'inbox-interakt-tool-btn',
  showToolbarLabel = false,
}: Props) {
  const { t } = useTranslation();
  const { canManageMessageTemplates } = useFollowupPermissions();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<FollowupTemplate | null>(null);
  const [previewText, setPreviewText] = useState('');
  const [customizeMode, setCustomizeMode] = useState(false);
  const debouncedSearch = useDebouncedValue(search.trim(), 250);

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

  const branchId = followupConv?.branchId ?? inauzwaStatus?.branchId ?? undefined;

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['followups', 'templates', branchId ?? ''],
    queryFn: () => followupApi.listTemplates(branchId),
    enabled: open,
  });

  const variables = useMemo(
    () =>
      buildQuickReplyVariables({
        conversation,
        followupConv,
        branchName: inauzwaStatus?.preferences.businessName ?? null,
        paymentNumber: inauzwaStatus?.preferences.defaultPaymentInstructions ?? null,
        pickupLocation: inauzwaStatus?.preferences.defaultBranchPickupInfo ?? null,
      }),
    [conversation, followupConv, inauzwaStatus?.preferences],
  );

  const variableRecord = useMemo(
    () => followupTemplateVariablesRecord(variables),
    [variables],
  );

  const displayed = useMemo(() => {
    let list = templates.filter((tpl) => tpl.isActive !== false);
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(
        (tpl) =>
          tpl.name.toLowerCase().includes(q) ||
          tpl.body.toLowerCase().includes(q) ||
          tpl.category.toLowerCase().includes(q),
      );
    }
    return list.sort((a, b) => {
      const cat = a.category.localeCompare(b.category);
      if (cat !== 0) return cat;
      return a.name.localeCompare(b.name);
    });
  }, [templates, debouncedSearch]);

  const groupedTemplates = useMemo(() => {
    const groups = new Map<string, FollowupTemplate[]>();
    for (const tpl of displayed) {
      const cat = tpl.category?.trim() || t('inbox.interakt.templateUncategorized');
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(tpl);
    }
    return [...groups.entries()];
  }, [displayed, t]);

  useEffect(() => {
    if (!open) return;
    if (displayed.length === 0) {
      setSelected(null);
      return;
    }
    if (!selected || !displayed.some((tpl) => tpl.id === selected.id)) {
      setSelected(displayed[0]);
    }
  }, [open, displayed, selected]);

  useEffect(() => {
    if (!selected || !open) {
      setPreviewText('');
      return;
    }
    let cancelled = false;
    void followupApi
      .previewTemplate(selected.id, variableRecord)
      .then((data) => {
        if (!cancelled) {
          setPreviewText(data.body);
          setCustomizeMode(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreviewText(selected.body);
          setCustomizeMode(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selected?.id, selected?.body, open, variableRecord]);

  const handleClose = () => {
    setOpen(false);
    setSelected(null);
    setSearch('');
    setCustomizeMode(false);
    setPreviewText('');
  };

  const handleOpen = () => {
    setOpen(true);
    setSearch('');
    setCustomizeMode(false);
  };

  const handleSelect = (tpl: FollowupTemplate) => {
    setSelected(tpl);
    setCustomizeMode(false);
  };

  const handleInsert = () => {
    const text = previewText.trim() || selected?.body.trim();
    if (!text) return;
    onInsert(text);
    handleClose();
    onFocusComposer?.();
  };

  const showVariableBadge = selected ? messageHasVariables(selected.body) : false;

  const manageTemplatesLink = canManageMessageTemplates ? (
    <Link
      to={settingsPanelHref('followup-templates')}
      className="qr-picker__manage"
      onClick={handleClose}
    >
      <MaterialSymbol name="settings" size={16} />
      {t('followups.templates.manageLink')}
    </Link>
  ) : null;

  return (
    <>
      <button
        type="button"
        className={buttonClassName}
        disabled={!canWrite}
        title={t('inbox.interakt.toolTemplates')}
        aria-label={t('inbox.interakt.toolTemplates')}
        onClick={handleOpen}
      >
        <MaterialSymbol name="article" size={20} />
        {showToolbarLabel && (
          <span className="inbox-interakt-tool-btn__label">{t('inbox.interakt.toolTemplates')}</span>
        )}
      </button>

      {open &&
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
              aria-labelledby="inbox-interakt-tpl-modal-title"
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
                      <p className="inbox-interakt-tpl-modal__empty">
                        {t('followups.templates.empty')}
                      </p>
                      {manageTemplatesLink}
                    </div>
                  ) : (
                    groupedTemplates.map(([category, items]) => (
                      <div key={category} className="inbox-interakt-tpl-modal__group">
                        <div className="inbox-interakt-tpl-modal__group-label">{category}</div>
                        <div className="inbox-interakt-tpl-modal__group-items">
                          {items.map((tpl) => {
                            const isActive = selected?.id === tpl.id;
                            return (
                              <button
                                key={tpl.id}
                                type="button"
                                role="option"
                                aria-selected={isActive}
                                className={`inbox-interakt-tpl-modal__item${isActive ? ' is-active' : ''}`}
                                onClick={() => handleSelect(tpl)}
                              >
                                <span className="inbox-interakt-tpl-modal__item-name">{tpl.name}</span>
                                <span className="inbox-interakt-tpl-modal__item-snippet">
                                  {truncateMessageSnippet(tpl.body)}
                                </span>
                              </button>
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
                  <h2 id="inbox-interakt-tpl-modal-title" className="inbox-interakt-tpl-modal__preview-title">
                    {t('inbox.interakt.templatePreview')}
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
                  {selected ? (
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
                    <p className="inbox-interakt-tpl-modal__pick-hint">
                      {t('followups.templates.pickOne', { defaultValue: 'Select a template to preview.' })}
                    </p>
                  )}
                </div>

                <footer className="inbox-interakt-tpl-modal__footer">
                  <button
                    type="button"
                    className="inbox-interakt-tpl-modal__customize-btn"
                    disabled={!selected}
                    onClick={() => setCustomizeMode((v) => !v)}
                  >
                    <MaterialSymbol name="edit" size={18} />
                    <span>{t('inbox.interakt.customizeOneTime')}</span>
                  </button>
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
                      disabled={!selected || (!previewText.trim() && !selected.body.trim())}
                      onClick={handleInsert}
                    >
                      <MaterialSymbol name="send" size={18} filled />
                      <span>{t('inbox.interakt.useTemplate')}</span>
                    </button>
                  </div>
                </footer>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
