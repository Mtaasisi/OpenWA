import { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import {
  UserPlus,
  MessageCircle,
  Bell,
  CreditCard,
  Flame,
  XCircle,
  Trophy,
  Plus,
  Loader2,
  BarChart3,
  ExternalLink,
} from 'lucide-react';
import {
  followupApi,
  type PipelineBucket,
  type PipelineCard,
  type ConversationSource,
  type ConversationPriority,
} from '../services/api';
import { useRole } from '../hooks/useRole';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { PipelineLeadDetail } from './PipelineLeadDetail';
import { ModalOverlay } from './ModalOverlay';
import { LEAD_SOURCES, leadSourceLabel } from '../lib/lead-sources';
import { MaterialSymbol } from './MaterialSymbol';
import { LeadSourceBadge } from './LeadSourceBadge';
import { StatusBadge } from './workspace';
import {
  customerSubtitle,
  displayName,
  followupConversationToPipelineCard,
  inboxLink,
  isAiEscalationPipelineCard,
} from './customers/customer-utils';
import { CustomerRowAvatar } from './customers/CustomerRowAvatar';
import {
  useSessionsQuery,
  useAiSignalsQuery,
  useDashboardInboxSnapshotQuery,
} from '../hooks/queries';
import {
  buildThreadAssigneeMap,
  buildThreadDisplayLookup,
  mergeHotLeadsWithAiEscalations,
  scopeAiEscalationsForPipeline,
} from '../lib/dashboard-metrics';
import { getDashboardStaffId } from '../lib/dashboard-scope';
import '../pages/Pipeline.css';

const PIPELINE_PAGE_SIZE = 24;

const BUCKETS: { id: PipelineBucket; icon: typeof UserPlus }[] = [
  { id: 'new_leads', icon: UserPlus },
  { id: 'waiting_reply', icon: MessageCircle },
  { id: 'followup_needed', icon: Bell },
  { id: 'payment_pending', icon: CreditCard },
  { id: 'hot_leads', icon: Flame },
  { id: 'lost_leads', icon: XCircle },
  { id: 'won_leads', icon: Trophy },
];

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function stageVariant(stage: string): 'success' | 'warning' | 'error' | 'neutral' {
  if (stage === 'won') return 'success';
  if (stage === 'lost' || stage === 'dead_no_response' || stage === 'ai_escalation') return 'error';
  if (stage === 'group_lead') return 'warning';
  if (stage === 'payment_pending' || stage === 'followup_needed') return 'warning';
  return 'neutral';
}

function PipelineCardItem({
  card,
  onOpen,
  sessionStatus,
}: {
  card: PipelineCard;
  onOpen: () => void;
  sessionStatus?: string;
}) {
  const { t } = useTranslation();
  const chatLink = inboxLink(card);
  const name = displayName(card, t('pipeline.unnamed'), t);
  const subtitle = customerSubtitle(card, t);
  const stageText = t(`followups.stageLabels.${card.stage}`, {
    defaultValue: card.stage.replace(/_/g, ' '),
  });

  return (
    <article
      className={`pipeline-card fu-glass-card pipeline-card--interakt priority-${card.priority}`}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onOpen()}
    >
      <header className="pipeline-card__header">
        <CustomerRowAvatar card={card} sessionStatus={sessionStatus} variant="card" />
        <div className="pipeline-card__title">
          <p className="pipeline-card__name">{name}</p>
          {subtitle && <p className="pipeline-card__subtitle">{subtitle}</p>}
        </div>
        <StatusBadge variant={stageVariant(card.stage)} className="pipeline-card__stage">
          {stageText}
        </StatusBadge>
      </header>
      <div className="pipeline-card__meta">
        <LeadSourceBadge source={card.source} className="lead-source-badge--sm" />
        {card.productInterest && <span>{card.productInterest}</span>}
        {card.assignedStaffName && <span>{card.assignedStaffName}</span>}
      </div>
      <p className="pipeline-card__time">
        {t('pipeline.lastMsg')}: {fmtTime(card.lastCustomerMessageAt || card.lastStaffMessageAt)}
      </p>
      {card.nextFollowupAt && (
        <p className="pipeline-card__due">
          {t('pipeline.followupDue')}: {fmtTime(card.nextFollowupAt)}
        </p>
      )}
      {card.nextAction && <p className="pipeline-card__action">{card.nextAction}</p>}
      <footer className="pipeline-card__footer" onClick={e => e.stopPropagation()}>
        {chatLink && (
          <Link to={chatLink} className="fu-btn fu-btn--ghost fu-btn--sm">
            <ExternalLink size={14} /> {t('followups.openInbox')}
          </Link>
        )}
        {!isAiEscalationPipelineCard(card) && (
          <Link to={`/followups?conversation=${card.id}`} className="fu-btn fu-btn--ghost fu-btn--sm">
            {t('pipeline.viewFollowups')}
          </Link>
        )}
      </footer>
    </article>
  );
}

export function CustomersPipelinePanel({
  interakt = false,
  standalone = false,
}: {
  interakt?: boolean;
  /** When true (dedicated /pipeline page), toolbar omits dashboard link — header provides it */
  standalone?: boolean;
}) {
  const { t } = useTranslation();
  const { canWrite, isAdmin } = useRole();
  const viewerStaffId = getDashboardStaffId();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkHandledRef = useRef<string | null>(null);
  const { data: sessions = [] } = useSessionsQuery();
  const sessionStatusById = useMemo(
    () => new Map(sessions.map(s => [s.id, s.status])),
    [sessions],
  );
  const [bucket, setBucket] = useState<PipelineBucket>('new_leads');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCard, setSelectedCard] = useState<PipelineCard | null>(null);
  const [staffFilter, setStaffFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const [form, setForm] = useState({
    customerName: '',
    source: 'instagram' as ConversationSource,
    customerPhone: '',
    customerHandle: '',
    productInterest: '',
    priority: 'normal' as ConversationPriority,
    notes: '',
  });

  const staffQueryId = staffFilter || undefined;
  const sourceQueryId = sourceFilter || undefined;

  const { data: counts = {} as Record<PipelineBucket, number> } = useQuery({
    queryKey: ['pipeline', 'counts', staffQueryId, sourceQueryId],
    queryFn: () => followupApi.getPipelineCounts(undefined, staffQueryId, sourceQueryId),
    refetchInterval: 60_000,
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['followups', 'staff'],
    queryFn: () => followupApi.listStaff(),
  });

  const deepLinkSession = searchParams.get('session')?.trim() ?? '';
  const deepLinkChat = searchParams.get('chat')?.trim() ?? '';

  useEffect(() => {
    if (!deepLinkSession || !deepLinkChat) return;
    const key = `${deepLinkSession}:${deepLinkChat}`;
    if (deepLinkHandledRef.current === key) return;

    let cancelled = false;
    deepLinkHandledRef.current = key;

    void followupApi
      .getConversation(deepLinkSession, deepLinkChat)
      .then(conv => {
        if (cancelled) return;
        setSelectedCard(followupConversationToPipelineCard(conv));
        const next = new URLSearchParams(searchParams);
        next.delete('session');
        next.delete('chat');
        setSearchParams(next, { replace: true });
      })
      .catch(() => {
        deepLinkHandledRef.current = null;
      });

    return () => {
      cancelled = true;
    };
  }, [deepLinkSession, deepLinkChat, searchParams, setSearchParams]);

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ['pipeline', bucket, staffQueryId, sourceQueryId],
    queryFn: () => followupApi.getPipeline(bucket, undefined, staffQueryId, sourceQueryId),
    refetchInterval: 60_000,
    enabled: !debouncedSearch,
  });

  const needsAiEscalations =
    bucket === 'hot_leads' || !isAdmin || !!staffQueryId || !!viewerStaffId;
  const needsAssigneeMap = needsAiEscalations && (!!staffQueryId || !isAdmin);

  const aiSignals = useAiSignalsQuery(needsAiEscalations);
  const inboxSnapshot = useDashboardInboxSnapshotQuery(undefined, {
    enabled: needsAssigneeMap,
  });
  const assigneeByThread = useMemo(
    () => buildThreadAssigneeMap(inboxSnapshot.data?.conversations ?? []),
    [inboxSnapshot.data?.conversations],
  );
  const conversations = inboxSnapshot.data?.conversations ?? [];
  const threadDisplay = useMemo(
    () => buildThreadDisplayLookup(conversations, sessions, t),
    [conversations, sessions, t],
  );

  const scopedEscalations = useMemo(
    () =>
      scopeAiEscalationsForPipeline(aiSignals.data?.recentEscalations, {
        staffFilterId: staffQueryId,
        viewerStaffId,
        isAdmin,
        assigneeByThread,
      }),
    [aiSignals.data?.recentEscalations, staffQueryId, viewerStaffId, isAdmin, assigneeByThread],
  );

  const hotLeadAiBoost = useMemo(() => {
    if (debouncedSearch.length >= 2) return 0;
    return mergeHotLeadsWithAiEscalations([], scopedEscalations).aiOnlyCount;
  }, [scopedEscalations, debouncedSearch]);

  const bucketCounts = useMemo(() => {
    if (!hotLeadAiBoost) return counts;
    return { ...counts, hot_leads: (counts.hot_leads ?? 0) + hotLeadAiBoost };
  }, [counts, hotLeadAiBoost]);

  const hotLeadsMerged = useMemo(() => {
    if (bucket !== 'hot_leads' || debouncedSearch.length >= 2) return null;
    return mergeHotLeadsWithAiEscalations(cards, scopedEscalations, { threadDisplay }).leads;
  }, [bucket, cards, scopedEscalations, debouncedSearch, threadDisplay]);

  const { data: searchResults = [], isLoading: searchLoading } = useQuery({
    queryKey: ['pipeline', 'search', debouncedSearch, staffQueryId, sourceQueryId],
    queryFn: () => followupApi.searchPipeline(debouncedSearch, undefined, staffQueryId, sourceQueryId),
    enabled: debouncedSearch.length >= 2,
  });

  const displayCards =
    debouncedSearch.length >= 2 ? searchResults : (hotLeadsMerged ?? cards);
  const listLoading = debouncedSearch.length >= 2 ? searchLoading : isLoading;

  useEffect(() => {
    setPage(1);
  }, [bucket, staffFilter, sourceFilter, debouncedSearch]);

  const total = displayCards.length;
  const pageCount = Math.max(1, Math.ceil(total / PIPELINE_PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageStart = (safePage - 1) * PIPELINE_PAGE_SIZE;
  const pagedCards = displayCards.slice(pageStart, pageStart + PIPELINE_PAGE_SIZE);

  const pageButtons = useMemo(() => {
    const max = 5;
    let start = Math.max(1, safePage - Math.floor(max / 2));
    const end = Math.min(pageCount, start + max - 1);
    start = Math.max(1, end - max + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [pageCount, safePage]);

  const createLead = useMutation({
    mutationFn: () => followupApi.createManualLead(form),
    onSuccess: () => {
      setShowCreate(false);
      setForm({
        customerName: '',
        source: 'instagram',
        customerPhone: '',
        customerHandle: '',
        productInterest: '',
        priority: 'normal',
        notes: '',
      });
      void queryClient.invalidateQueries({ queryKey: ['pipeline'] });
    },
  });

  return (
    <div className={interakt ? 'customers-pipeline-panel customers-pipeline-panel--interakt' : 'customers-pipeline-panel'}>
      <div className={interakt ? 'fu-filters pipeline-toolbar pipeline-toolbar--interakt' : 'pipeline-toolbar'}>
        <label className="pipeline-staff-filter">
          {t('pipeline.filterStaff')}
          <select value={staffFilter} onChange={e => setStaffFilter(e.target.value)}>
            <option value="">{t('pipeline.allStaff')}</option>
            {staff.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <label className="pipeline-staff-filter">
          {t('pipeline.filterSource')}
          <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
            <option value="">{t('pipeline.allSources')}</option>
            {LEAD_SOURCES.map(s => (
              <option key={s} value={s}>{leadSourceLabel(s, t)}</option>
            ))}
          </select>
        </label>
        <label className="pipeline-staff-filter pipeline-search">
          {t('pipeline.search')}
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('pipeline.searchPlaceholder')}
          />
        </label>
        {!standalone && (
          <Link to="/reports?section=pipeline" className="fu-btn fu-btn--ghost fu-btn--sm">
            <BarChart3 size={16} /> {t('pipeline.reportsLink')}
          </Link>
        )}
        {canWrite && (
          <button type="button" className="fu-btn fu-btn--primary fu-btn--sm" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> {t('pipeline.createLead')}
          </button>
        )}
      </div>

      <div className={interakt ? 'fu-chips pipeline-buckets pipeline-buckets--interakt' : 'pipeline-buckets'}>
        {BUCKETS.map(({ id, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={
              interakt
                ? `fu-chip pipeline-bucket-chip ${bucket === id ? 'fu-chip--active' : ''}`
                : `pipeline-bucket ${bucket === id ? 'active' : ''}`
            }
            onClick={() => setBucket(id)}
          >
            {!interakt && <Icon size={16} />}
            <span>{t(`pipeline.buckets.${id}`)}</span>
            {bucketCounts[id] != null && bucketCounts[id] > 0 && (
              <span className={interakt ? 'pipeline-bucket-chip__count' : 'pipeline-bucket__count'}>
                {bucketCounts[id]}
              </span>
            )}
          </button>
        ))}
      </div>

      {listLoading ? (
        <div className="pipeline-loading"><Loader2 className="animate-spin" size={32} /></div>
      ) : displayCards.length === 0 ? (
        <div className="pipeline-empty">
          {debouncedSearch ? t('pipeline.searchEmpty') : t('pipeline.empty')}
        </div>
      ) : (
        <>
        <div className={interakt ? 'pipeline-list pipeline-list--interakt' : 'pipeline-list'}>
          {pagedCards.map(card => (
            <PipelineCardItem
              key={card.id}
              card={card}
              sessionStatus={sessionStatusById.get(card.sessionId)}
              onOpen={() => setSelectedCard(card)}
            />
          ))}
        </div>
        {total > PIPELINE_PAGE_SIZE && (
          <div className="fu-table-footer pipeline-list-footer">
            <span>
              {t('followups.pagination.showing', {
                from: total === 0 ? 0 : pageStart + 1,
                to: Math.min(pageStart + PIPELINE_PAGE_SIZE, total),
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
                disabled={safePage >= pageCount}
                onClick={() => setPage(safePage + 1)}
              >
                <MaterialSymbol name="chevron_right" size={16} />
              </button>
            </div>
          </div>
        )}
        </>
      )}

      {selectedCard && (
        <PipelineLeadDetail
          card={selectedCard}
          canWrite={canWrite}
          onClose={() => setSelectedCard(null)}
        />
      )}

      {showCreate && (
        <ModalOverlay onClose={() => setShowCreate(false)} className="pipeline-modal-overlay">
          <form
            className="pipeline-modal"
            onClick={e => e.stopPropagation()}
            onSubmit={e => { e.preventDefault(); createLead.mutate(); }}
          >
            <h3>{t('pipeline.createLead')}</h3>
            <label>{t('common.name')}<input required value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} /></label>
            <label>{t('pipeline.source')}
              <select value={form.source} onChange={e => setForm({ ...form, source: e.target.value as ConversationSource })}>
                {LEAD_SOURCES.map(s => <option key={s} value={s}>{leadSourceLabel(s, t)}</option>)}
              </select>
            </label>
            <label>{t('pipeline.phone')}<input value={form.customerPhone} onChange={e => setForm({ ...form, customerPhone: e.target.value })} /></label>
            <label>{t('pipeline.handle')}<input value={form.customerHandle} onChange={e => setForm({ ...form, customerHandle: e.target.value })} placeholder="@username" /></label>
            <label>{t('pipeline.productInterest')}<input value={form.productInterest} onChange={e => setForm({ ...form, productInterest: e.target.value })} /></label>
            <label>{t('pipeline.priority')}
              <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as ConversationPriority })}>
                {(['low', 'normal', 'high', 'hot'] as ConversationPriority[]).map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label>{t('pipeline.notes')}<textarea rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></label>
            <div className="pipeline-modal__actions">
              <button type="button" className="fu-btn fu-btn--ghost" onClick={() => setShowCreate(false)}>{t('common.cancel')}</button>
              <button type="submit" className="fu-btn fu-btn--primary" disabled={createLead.isPending}>{t('common.create')}</button>
            </div>
          </form>
        </ModalOverlay>
      )}
    </div>
  );
}
