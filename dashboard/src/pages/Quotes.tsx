import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, ExternalLink } from 'lucide-react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import {
  WorkspacePageHeader,
  SlideOverPanel,
  StatusBadge,
  ChannelBadge,
  AccountBadge,
} from '../components/workspace';
import { quoteApi, type QuoteStatus } from '../services/api';
import { useSessionsQuery } from '../hooks/queries';
import { useLinkedChannels } from '../hooks/useLinkedChannels';
import { useRole } from '../hooks/useRole';
import { AskAiLink } from '../components/AskAiLink';
import { MaterialSymbol } from '../components/MaterialSymbol';
import { InboxQuoteBuilder } from '../components/InboxQuoteBuilder';
import { QuoteNewModal } from '../components/quotes/QuoteNewModal';
import { useQuotePermissions } from '../hooks/useQuotePermissions';
import { ConfirmDialog } from '../components/workspace/ConfirmDialog';
import { useToast } from '../components/Toast';
import { buildQuoteSmsNotification } from '../lib/quote-sms-message';
import { calculateSmsSegmentsClient } from '../lib/sms-segments-client';
import './Quotes.css';

const QUOTES_PAGE_SIZE = 25;

type QuoteView = QuoteStatus | 'all' | 'paid';

const VIEW_CHIPS: { id: QuoteView; status?: QuoteStatus }[] = [
  { id: 'all' },
  { id: 'draft', status: 'draft' },
  { id: 'sent', status: 'sent' },
  { id: 'accepted', status: 'accepted' },
  { id: 'rejected', status: 'rejected' },
  { id: 'expired', status: 'expired' },
  { id: 'paid', status: 'converted_to_sale' },
];

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusVariant(status: QuoteStatus): 'success' | 'warning' | 'error' | 'neutral' {
  if (status === 'accepted' || status === 'converted_to_sale') return 'success';
  if (status === 'rejected' || status === 'expired') return 'error';
  if (status === 'sent') return 'warning';
  return 'neutral';
}

function quoteStatusToView(status: QuoteStatus): QuoteView {
  if (status === 'converted_to_sale') return 'paid';
  return status;
}

export function Quotes() {
  const { t } = useTranslation();
  const { canWrite } = useRole();
  const quotePerms = useQuotePermissions();
  const canCreateQuote = canWrite && quotePerms.canCreate;
  const { showChannelBadge, isSmsReady } = useLinkedChannels();
  const queryClient = useQueryClient();
  const toast = useToast();
  useDocumentTitle(t('quotes.pageTitle'));

  const [searchParams, setSearchParams] = useSearchParams();
  const quoteIdParam = searchParams.get('id');

  const [view, setView] = useState<QuoteView>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(quoteIdParam);
  const [createOpen, setCreateOpen] = useState(false);
  const [builderCtx, setBuilderCtx] = useState<{
    sessionId: string;
    chatId: string;
    customerName?: string | null;
    customerPhone?: string | null;
    quoteId: string;
  } | null>(null);
  const [smsNotifyQuoteId, setSmsNotifyQuoteId] = useState<string | null>(null);
  const deepLinkPending = useRef(!!quoteIdParam);

  useEffect(() => {
    setSelectedId(quoteIdParam);
    if (quoteIdParam) deepLinkPending.current = true;
  }, [quoteIdParam]);

  useEffect(() => {
    if (searchParams.get('create') !== '1' || !canCreateQuote) return;
    setCreateOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete('create');
    setSearchParams(next, { replace: true });
  }, [searchParams, canCreateQuote, setSearchParams]);

  const openQuote = (id: string) => {
    setSelectedId(id);
    const next = new URLSearchParams(searchParams);
    next.set('id', id);
    setSearchParams(next, { replace: true });
  };

  const closeQuote = () => {
    setSelectedId(null);
    const next = new URLSearchParams(searchParams);
    next.delete('id');
    setSearchParams(next, { replace: true });
  };

  const statusFilter = VIEW_CHIPS.find(c => c.id === view)?.status;

  const { data: allQuotes = [] } = useQuery({
    queryKey: ['quotes', 'list', 'all'],
    queryFn: () => quoteApi.list(),
    refetchInterval: 60_000,
  });

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ['quotes', 'list', statusFilter],
    queryFn: () => quoteApi.list(statusFilter ? { status: statusFilter } : undefined),
    refetchInterval: 60_000,
  });

  const { data: sessions = [] } = useSessionsQuery();

  const {
    data: selectedQuote,
    isLoading: loadingSelectedQuote,
    isError: selectedQuoteError,
  } = useQuery({
    queryKey: ['quotes', selectedId],
    queryFn: () => quoteApi.get(selectedId!),
    enabled: !!selectedId,
  });

  useEffect(() => {
    if (!selectedQuote || !deepLinkPending.current) return;
    setView(quoteStatusToView(selectedQuote.status));
    deepLinkPending.current = false;
  }, [selectedQuote]);

  const sendMutation = useMutation({
    mutationFn: (id: string) => quoteApi.send(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['quotes'] }),
  });

  const notifySmsMutation = useMutation({
    mutationFn: (id: string) => quoteApi.notifyBySms(id),
    onSuccess: (result) => {
      setSmsNotifyQuoteId(null);
      toast.success(
        t('sms.sendSuccess', { count: result.smsCount ?? 1 }),
      );
      void queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
    onError: (err: Error) => toast.error(t('common.errorGeneric'), err.message),
  });

  const smsNotifyQuote = useMemo(
    () =>
      smsNotifyQuoteId
        ? (quotes.find(q => q.id === smsNotifyQuoteId) ??
          (selectedQuote?.id === smsNotifyQuoteId ? selectedQuote : null))
        : null,
    [quotes, smsNotifyQuoteId, selectedQuote],
  );

  const smsNotifyPreview = useMemo(() => {
    if (!smsNotifyQuote) return null;
    const message = buildQuoteSmsNotification(smsNotifyQuote);
    const segments = calculateSmsSegmentsClient(message);
    return { message, segments };
  }, [smsNotifyQuote]);

  const acceptMutation = useMutation({
    mutationFn: (id: string) => quoteApi.accept(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['quotes'] }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => quoteApi.reject(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['quotes'] }),
  });

  const sessionName = (sessionId: string) =>
    sessions.find(s => s.id === sessionId)?.name ?? sessionId.slice(0, 8);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return quotes;
    return quotes.filter(
      row =>
        row.quoteNumber.toLowerCase().includes(q) ||
        (row.customerName?.toLowerCase().includes(q) ?? false) ||
        (row.customerPhone?.toLowerCase().includes(q) ?? false),
    );
  }, [quotes, search]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / QUOTES_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * QUOTES_PAGE_SIZE;
  const pageRows = filtered.slice(pageStart, pageStart + QUOTES_PAGE_SIZE);
  const pageButtons: number[] = [];
  for (let i = 1; i <= Math.min(totalPages, 5); i++) pageButtons.push(i);

  useEffect(() => {
    setPage(1);
  }, [view, search]);

  useEffect(() => {
    if (!selectedId || isLoading) return;
    const row = document.getElementById(`quote-row-${selectedId}`);
    row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedId, isLoading, filtered]);

  const metrics = useMemo(() => {
    const sent = allQuotes.filter(q => q.status === 'sent').length;
    const accepted = allQuotes.filter(q => q.status === 'accepted' || q.status === 'converted_to_sale').length;
    const draft = allQuotes.filter(q => q.status === 'draft').length;
    return { total: allQuotes.length, sent, accepted, draft };
  }, [allQuotes]);

  return (
    <div className="followups-interakt quotes-interakt">
      <WorkspacePageHeader
        title={t('quotes.pageTitle')}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('quotes.searchPlaceholder')}
        showExport={false}
        showNewTask={canCreateQuote}
        newTaskLabel={t('quotes.create')}
        onNewTask={() => setCreateOpen(true)}
        extraActions={<AskAiLink prompt={t('ai.prompts.quotes', { defaultValue: 'Summarize quote pipeline' })} />}
      />

      <div className="followups-interakt__scroll">
        <div className="fu-bento quotes-bento">
          <div className="fu-glass-card">
            <span className="fu-glass-card__label">{t('quotes.metrics.total')}</span>
            <span className="fu-glass-card__value">{metrics.total}</span>
          </div>
          <div className="fu-glass-card">
            <span className="fu-glass-card__label">{t('quotes.metrics.draft')}</span>
            <span className="fu-glass-card__value">{metrics.draft}</span>
          </div>
          <div className="fu-glass-card">
            <span className="fu-glass-card__label">{t('quotes.metrics.sent')}</span>
            <span className="fu-glass-card__value">{metrics.sent}</span>
          </div>
          <div className="fu-glass-card">
            <span className="fu-glass-card__label">{t('quotes.metrics.won')}</span>
            <span className="fu-glass-card__value">{metrics.accepted}</span>
          </div>
        </div>

        <div className="fu-view-row">
          <div className="fu-chips" role="tablist">
            {VIEW_CHIPS.map(chip => (
              <button
                key={chip.id}
                type="button"
                role="tab"
                aria-selected={view === chip.id}
                className={['fu-chip', view === chip.id ? 'fu-chip--active' : ''].join(' ')}
                onClick={() => {
                  setView(chip.id);
                  setPage(1);
                }}
              >
                {t(`quotes.views.${chip.id}`)}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="followups-loading">
            <Loader2 className="spin" size={32} />
          </div>
        ) : total === 0 ? (
          <div className="followups-empty">
            <p>{t('quotes.emptyList')}</p>
            <p className="quotes-empty__hint">{t('quotes.emptyListHint')}</p>
            {canCreateQuote && (
              <button type="button" className="fu-btn fu-btn--primary" onClick={() => setCreateOpen(true)}>
                {t('quotes.create')}
              </button>
            )}
          </div>
        ) : (
          <div className="fu-table-wrap">
            <table className="fu-table quotes-table">
              <thead>
                <tr>
                  <th style={{ width: '14%' }}>{t('quotes.list.number')}</th>
                  <th style={{ width: showChannelBadge ? '22%' : '26%' }}>{t('quotes.list.customer')}</th>
                  {showChannelBadge && <th style={{ width: '10%' }}>{t('quotes.list.channel')}</th>}
                  <th style={{ width: '14%' }}>{t('quotes.list.account')}</th>
                  <th style={{ width: '14%' }}>{t('quotes.list.amount')}</th>
                  <th style={{ width: '14%' }}>{t('quotes.list.status')}</th>
                  <th style={{ width: '16%' }}>{t('quotes.list.created')}</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(row => {
                  const isActive = selectedId === row.id;
                  return (
                    <tr
                      key={row.id}
                      id={`quote-row-${row.id}`}
                      className={isActive ? 'quotes-table__row--active' : undefined}
                      onClick={() => openQuote(row.id)}
                    >
                      <td>
                        <strong>{row.quoteNumber}</strong>
                      </td>
                      <td>{row.customerName || row.customerPhone || '—'}</td>
                      {showChannelBadge && (
                        <td>
                          <ChannelBadge channelId="whatsapp" />
                        </td>
                      )}
                      <td>
                        <AccountBadge name={sessionName(row.sessionId)} />
                      </td>
                      <td>{`${row.currency ?? ''} ${row.totalAmount.toLocaleString()}`.trim()}</td>
                      <td>
                        <StatusBadge variant={statusVariant(row.status)}>
                          {t(`quotes.status.${row.status}`)}
                        </StatusBadge>
                      </td>
                      <td>{fmtDate(row.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="fu-table-footer">
              <span>
                {t('followups.pagination.showing', {
                  from: total === 0 ? 0 : pageStart + 1,
                  to: Math.min(pageStart + QUOTES_PAGE_SIZE, total),
                  total,
                })}
              </span>
              <div className="fu-pagination">
                <button
                  type="button"
                  className="fu-pagination__btn"
                  disabled={safePage <= 1}
                  onClick={() => setPage(safePage - 1)}
                >
                  <MaterialSymbol name="chevron_left" size={16} />
                </button>
                {pageButtons.map(p => (
                  <button
                    key={p}
                    type="button"
                    className={['fu-pagination__btn', p === safePage ? 'fu-pagination__btn--active' : ''].join(' ')}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                ))}
                <button
                  type="button"
                  className="fu-pagination__btn"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage(safePage + 1)}
                >
                  <MaterialSymbol name="chevron_right" size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <QuoteNewModal
        open={createOpen}
        sessions={sessions}
        onClose={() => setCreateOpen(false)}
        onCreated={quote => {
          void queryClient.invalidateQueries({ queryKey: ['quotes'] });
          setBuilderCtx({
            sessionId: quote.sessionId,
            chatId: quote.chatId,
            customerName: quote.customerName,
            customerPhone: quote.customerPhone,
            quoteId: quote.id,
          });
          setView('draft');
          openQuote(quote.id);
        }}
      />

      <SlideOverPanel
        open={!!builderCtx}
        onClose={() => setBuilderCtx(null)}
        title={t('quotes.title')}
      >
        {builderCtx && (
          <div className="quotes-builder-panel">
            <InboxQuoteBuilder
              embedded
              variant="interakt"
              sessionId={builderCtx.sessionId}
              chatId={builderCtx.chatId}
              customerName={builderCtx.customerName}
              customerPhone={builderCtx.customerPhone}
              initialQuoteId={builderCtx.quoteId}
              canWrite={canWrite}
              onSent={() => {
                void queryClient.invalidateQueries({ queryKey: ['quotes'] });
                setBuilderCtx(null);
              }}
            />
          </div>
        )}
      </SlideOverPanel>

      <SlideOverPanel
        open={!!selectedId && !builderCtx}
        onClose={closeQuote}
        title={
          selectedQuote
            ? `${t('quotes.detailTitle')} ${selectedQuote.quoteNumber}`
            : t('quotes.detailTitle')
        }
      >
        {loadingSelectedQuote && (
          <div className="quotes-loading">
            <Loader2 className="animate-spin" size={24} />
          </div>
        )}
        {selectedQuoteError && !loadingSelectedQuote && (
          <p className="quote-detail__meta">{t('quotes.notFound')}</p>
        )}
        {selectedQuote && (
          <div className="quote-detail">
            <p>
              <strong>{selectedQuote.customerName || selectedQuote.customerPhone || '—'}</strong>
            </p>
            <div className="quote-detail__badges">
              <ChannelBadge channelId="whatsapp" />
              <AccountBadge name={sessionName(selectedQuote.sessionId)} />
              <StatusBadge variant={statusVariant(selectedQuote.status)}>
                {t(`quotes.status.${selectedQuote.status}`)}
              </StatusBadge>
            </div>
            <p className="quote-detail__total">
              {selectedQuote.currency ?? ''} {selectedQuote.totalAmount.toLocaleString()}
            </p>
            {selectedQuote.items.length > 0 && (
              <ul className="quote-detail__items">
                {selectedQuote.items.map(item => (
                  <li key={item.id}>
                    {item.itemName} × {item.quantity} — {item.totalPrice.toLocaleString()}
                  </li>
                ))}
              </ul>
            )}
            <p className="quote-detail__meta">
              {t('quotes.list.created')}: {fmtDate(selectedQuote.createdAt)}
            </p>
            <div className="quote-detail__actions">
              <Link
                to={`/inbox?${new URLSearchParams({ session: selectedQuote.sessionId, chat: selectedQuote.chatId }).toString()}`}
                className="fu-btn fu-btn--ghost"
              >
                <ExternalLink size={14} /> {t('followups.openInbox')}
              </Link>
              {canWrite && isSmsReady && selectedQuote.items.length > 0 && (
                <button
                  type="button"
                  className="fu-btn fu-btn--secondary"
                  disabled={notifySmsMutation.isPending}
                  onClick={() => setSmsNotifyQuoteId(selectedQuote.id)}
                >
                  {t('sms.notifyBySms')}
                </button>
              )}
              {canWrite && selectedQuote.status === 'draft' && (
                <button
                  type="button"
                  className="fu-btn fu-btn--primary"
                  disabled={sendMutation.isPending}
                  onClick={() => sendMutation.mutate(selectedQuote.id)}
                >
                  {t('quotes.send')}
                </button>
              )}
              {canWrite && selectedQuote.status === 'sent' && (
                <>
                  <button
                    type="button"
                    className="fu-btn fu-btn--ghost"
                    disabled={acceptMutation.isPending}
                    onClick={() => acceptMutation.mutate(selectedQuote.id)}
                  >
                    {t('quotes.accept')}
                  </button>
                  <button
                    type="button"
                    className="fu-btn fu-btn--ghost"
                    disabled={rejectMutation.isPending}
                    onClick={() => rejectMutation.mutate(selectedQuote.id)}
                  >
                    {t('quotes.reject')}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </SlideOverPanel>

      <ConfirmDialog
        open={!!smsNotifyQuoteId && !!smsNotifyPreview}
        title={t('sms.notifyBySms')}
        message={[
          t('sms.notifyBySmsConfirm'),
          smsNotifyPreview?.message ?? '',
          smsNotifyPreview
            ? t('sms.segmentCount', { count: smsNotifyPreview.segments.smsCount })
            : '',
          smsNotifyPreview?.segments.warning ?? '',
        ]
          .filter(Boolean)
          .join('\n\n')}
        confirmLabel={t('sms.send')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => {
          if (smsNotifyQuoteId) notifySmsMutation.mutate(smsNotifyQuoteId);
        }}
        onCancel={() => setSmsNotifyQuoteId(null)}
      />
    </div>
  );
}
