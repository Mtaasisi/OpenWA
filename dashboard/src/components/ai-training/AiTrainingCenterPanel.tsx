import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, RefreshCw, Scan, Plus, BookOpen } from 'lucide-react';
import {
  aiTrainingApi,
  type AiLearningItem,
  type AiTrainingItemDetail,
  type AiTrainingSuggestion,
  type AiTrainingApprovalPreview,
  type AiLearningSettings,
} from '../../services/api';
import { settingsPanelHref } from '../settings/settings-nav-registry';
import { AiTrainingSettingsModal } from './AiTrainingSettingsModal';
import { AiTrainingAuditTimeline } from './AiTrainingAuditTimeline';
import { useRole } from '../../hooks/useRole';
import { useToast } from '../Toast';
import { countBulkApprovable, itemRequiresAdminApproval } from '../../lib/ai-training-risk';
import type { BulkApproveOverride } from '../../lib/ai-training-bulk';
import {
  filterTrainingItemsByChatKind,
  isTrainingGroupItem,
  type TrainingChatKindFilter,
} from '../../lib/ai-training-chat-kind';
import { AiTrainingBulkApproveModal } from './AiTrainingBulkApproveModal';
import './AiTrainingCenter.css';

const HIGH_RISK_ACTION_TYPES = new Set([
  'update_discount_rule',
  'update_warranty_rule',
  'update_agent_action_rule',
  'create_tool_rule',
]);

const INNER_TABS = ['pending', 'suggested', 'approved', 'applied', 'ignored', 'history'] as const;
type InnerTab = (typeof INNER_TABS)[number];

const STATUS_MAP: Record<InnerTab, string | undefined> = {
  pending: 'pending_review',
  suggested: 'suggested',
  approved: 'approved',
  applied: 'applied',
  ignored: 'ignored',
  history: 'applied',
};

const KNOWLEDGE_FILES = [
  'FAQ.md',
  'PRODUCT_QA.md',
  'AI_REPLY_RULES.md',
  'WARRANTY_RULES.md',
  'DISCOUNT_ESCALATION_RULES.md',
  'INSTALLMENT_PRODUCT_RULES.md',
  'BRANCH_PROFILE_AND_PAYMENT_SETTINGS.md',
  'AGENT_ACTION_RULES.md',
];

function sourceLabel(item: AiLearningItem): string {
  if (isTrainingGroupItem(item)) return 'Group';
  const st = item.sourceType ?? item.source;
  if (st?.includes('product')) return 'Product';
  if (st?.includes('payment')) return 'Payment';
  if (st?.includes('warranty')) return 'Warranty';
  if (st?.includes('agent')) return 'Agent action';
  if (st?.includes('system')) return 'System';
  return 'Inbox';
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function innerTabForStatus(status?: string | null): InnerTab {
  switch (status) {
    case 'suggested':
      return 'suggested';
    case 'approved':
      return 'approved';
    case 'applied':
      return 'applied';
    case 'ignored':
      return 'ignored';
    case 'pending_review':
    default:
      return 'pending';
  }
}

interface ReviewState {
  itemId: string;
  selectedSuggestionId?: string;
  customAnswer: string;
  customInstruction: string;
  targetFile: string;
}

function reviewSeedFromItem(
  item?: Pick<AiLearningItem, 'adminFinalAnswer' | 'aiDraftAnswer' | 'targetFile' | 'suggestedTargetFile'>,
): Pick<ReviewState, 'customAnswer' | 'targetFile'> {
  return {
    customAnswer: item?.adminFinalAnswer ?? item?.aiDraftAnswer ?? '',
    targetFile: item?.targetFile ?? item?.suggestedTargetFile ?? 'FAQ.md',
  };
}

export function AiTrainingCenterPanel() {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const { isAdmin, role } = useRole();
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkItemId = searchParams.get('item');
  const listRef = useRef<HTMLElement>(null);
  const deepLinkErrorNotifiedRef = useRef<string | null>(null);
  const dismissedDeepLinkRef = useRef<string | null>(null);
  const [innerTab, setInnerTab] = useState<InnerTab>('pending');
  const [review, setReview] = useState<ReviewState | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualQuestion, setManualQuestion] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkSkipNotes, setBulkSkipNotes] = useState<Array<{ id: string; reason: string }>>([]);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [chatKindFilter, setChatKindFilter] = useState<TrainingChatKindFilter>('all');

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['ai-training', 'overview'],
    queryFn: () => aiTrainingApi.getOverview(),
  });

  const { data: trainingSettings } = useQuery({
    queryKey: ['ai-training', 'settings'],
    queryFn: () => aiTrainingApi.getSettings(),
  });

  const statusFilter = STATUS_MAP[innerTab];
  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['ai-training', 'items', innerTab, statusFilter],
    queryFn: () => aiTrainingApi.listItems({ status: statusFilter }),
  });

  const showChatKindFilter = useMemo(() => {
    if (trainingSettings?.trainingGroupChatsMode === 'separate') return true;
    return items.some(isTrainingGroupItem) && items.some(item => !isTrainingGroupItem(item));
  }, [items, trainingSettings?.trainingGroupChatsMode]);

  const visibleItems = useMemo(
    () => (showChatKindFilter ? filterTrainingItemsByChatKind(items, chatKindFilter) : items),
    [items, chatKindFilter, showChatKindFilter],
  );

  useEffect(() => {
    if (trainingSettings?.trainingGroupChatsMode === 'separate') {
      setChatKindFilter('direct');
    } else {
      setChatKindFilter('all');
    }
  }, [trainingSettings?.trainingGroupChatsMode, innerTab]);

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['ai-training', 'item', review?.itemId],
    queryFn: () => aiTrainingApi.getItem(review!.itemId),
    enabled: !!review?.itemId,
  });

  const {
    data: deepLinkItem,
    isError: deepLinkItemError,
    isLoading: deepLinkItemLoading,
    isFetched: deepLinkItemFetched,
  } = useQuery({
    queryKey: ['ai-training', 'item', deepLinkItemId],
    queryFn: () => aiTrainingApi.getItem(deepLinkItemId!),
    enabled: Boolean(deepLinkItemId),
    retry: false,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['ai-training'] });
  };

  const syncDeepLinkItemParam = useCallback(
    (itemId: string | null) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (itemId) next.set('item', itemId);
          else next.delete('item');
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const closeReview = useCallback(() => {
    const closingId = review?.itemId ?? deepLinkItemId;
    if (closingId) dismissedDeepLinkRef.current = closingId;
    syncDeepLinkItemParam(null);
    setReview(null);
  }, [syncDeepLinkItemParam, review?.itemId, deepLinkItemId]);

  const scanInboxMut = useMutation({
    mutationFn: () => aiTrainingApi.scanInbox(),
    onSuccess: r => {
      toast.success(t('ai.training.scanDone', { defaultValue: 'Scan complete: {{n}} new items', n: r.created }));
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const scanSystemMut = useMutation({
    mutationFn: () => aiTrainingApi.scanSystem(),
    onSuccess: r => {
      toast.success(t('ai.training.systemScanDone', { defaultValue: 'System scan: {{n}} suggestions', n: r.created }));
      invalidate();
    },
  });

  const reindexMut = useMutation({
    mutationFn: () => aiTrainingApi.reindex(true),
    onSuccess: () => {
      toast.success(t('ai.training.reindexed', { defaultValue: 'Knowledge reindexed' }));
      invalidate();
    },
  });

  const approveMut = useMutation({
    mutationFn: (body: ReviewState & { applyNow?: boolean }) =>
      aiTrainingApi.approve(body.itemId, {
        selectedSuggestionId: body.selectedSuggestionId,
        customAnswer: body.customAnswer || undefined,
        customInstruction: body.customInstruction || undefined,
        targetFile: body.targetFile,
        applyNow: body.applyNow ?? true,
      }),
    onSuccess: (data, variables) => {
      toast.success(
        variables.applyNow === false
          ? t('ai.training.approvedOnlyToast', {
              defaultValue: 'Training approved — apply from Applied tab or reindex when ready.',
            })
          : t('ai.training.applied', {
              defaultValue: 'Training approved and applied — similar inbox questions will reuse this answer.',
            }),
      );
      const reindexPending =
        variables.applyNow !== false &&
        (data as { approval?: { reindexStatus?: string } })?.approval?.reindexStatus === 'pending';
      if (reindexPending) {
        toast.info(
          t('ai.training.reindexPendingToast', {
            defaultValue: 'Knowledge index update is pending — use Reindex in Training Center.',
          }),
        );
      }
      closeReview();
      invalidate();
      void qc.invalidateQueries({ queryKey: ['ai-training', 'audit'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openReview = (item: AiLearningItem) => {
    dismissedDeepLinkRef.current = null;
    syncDeepLinkItemParam(item.id);
    setReview({
      itemId: item.id,
      ...reviewSeedFromItem(item),
      customInstruction: '',
    });
  };

  const selectedSuggestion = useMemo(() => {
    if (!detail || !review?.selectedSuggestionId) return null;
    return detail.suggestions.find(s => s.id === review.selectedSuggestionId) ?? null;
  }, [detail, review?.selectedSuggestionId]);

  const createManualMut = useMutation({
    mutationFn: () => aiTrainingApi.createManual({ question: manualQuestion }),
    onSuccess: () => {
      setManualQuestion('');
      setManualOpen(false);
      invalidate();
    },
  });

  const bulkIgnoreMut = useMutation({
    mutationFn: (ids: string[]) => aiTrainingApi.bulkIgnore(ids),
    onSuccess: (_r, ids) => {
      toast.success(
        t('ai.training.bulkIgnored', {
          defaultValue: 'Ignored {{n}} training items',
          n: ids.length,
        }),
      );
      setSelectedIds([]);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkApproveMut = useMutation({
    mutationFn: (input: { ids: string[]; overrides?: BulkApproveOverride[] }) =>
      aiTrainingApi.bulkApprove(input.ids, true, input.overrides),
    onSuccess: (result, _input) => {
      setBulkConfirmOpen(false);
      toast.success(
        t('ai.training.bulkApproved', {
          defaultValue: 'Approved {{n}} items (skipped {{s}})',
          n: result.approved.length,
          s: result.skipped.length,
        }),
      );
      if (result.failed.length) {
        toast.warning(
          t('ai.training.bulkApproveFailed', {
            defaultValue: '{{n}} items failed to approve',
            n: result.failed.length,
          }),
        );
      }
      if (result.skipped.length) {
        setBulkSkipNotes(result.skipped);
        toast.info(
          t('ai.training.bulkSkipped', {
            defaultValue: '{{n}} items skipped (see details below)',
            n: result.skipped.length,
          }),
          result.skipped
            .slice(0, 3)
            .map(s => s.reason)
            .join(' · '),
        );
      } else {
        setBulkSkipNotes([]);
      }
      setSelectedIds([]);
      closeReview();
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reviewableTab = innerTab === 'pending' || innerTab === 'suggested';
  const bulkApprovableCount = useMemo(
    () =>
      countBulkApprovable(items, selectedIds, {
        requireAdminApproval: trainingSettings?.requireAdminApproval !== false,
        isAdmin,
      }),
    [items, selectedIds, trainingSettings?.requireAdminApproval, isAdmin],
  );

  const bulkApprovableIds = useMemo(
    () =>
      selectedIds.filter(id => {
        const item = items.find(i => i.id === id);
        if (!item) return false;
        if (!['pending_review', 'suggested'].includes(item.status)) return false;
        if (itemRequiresAdminApproval(item, trainingSettings?.requireAdminApproval !== false) && !isAdmin) {
          return false;
        }
        return Boolean(item.aiDraftAnswer || item.adminFinalAnswer || item.status === 'suggested');
      }),
    [items, selectedIds, trainingSettings?.requireAdminApproval, isAdmin],
  );

  useEffect(() => {
    setSelectedIds([]);
  }, [innerTab]);

  useEffect(() => {
    if (!detail || !review || review.itemId !== detail.id) return;
    if (review.selectedSuggestionId) return;
    const pick = detail.suggestions.find(s => s.isRecommended) ?? detail.suggestions[0];
    if (!pick) return;
    setReview(prev =>
      prev && prev.itemId === detail.id
        ? {
            ...prev,
            selectedSuggestionId: pick.id,
            customAnswer: pick.responseText ?? prev.customAnswer,
            targetFile: pick.targetFile ?? prev.targetFile,
          }
        : prev,
    );
  }, [detail, review?.itemId, review?.selectedSuggestionId]);

  useEffect(() => {
    if (!deepLinkItemId) {
      deepLinkErrorNotifiedRef.current = null;
      dismissedDeepLinkRef.current = null;
      return;
    }

    if (dismissedDeepLinkRef.current === deepLinkItemId) {
      return;
    }

    const fromList = items.find(i => i.id === deepLinkItemId);
    if (deepLinkItemLoading && !fromList) return;

    if (deepLinkItemFetched && deepLinkItemError && !fromList) {
      if (deepLinkErrorNotifiedRef.current !== deepLinkItemId) {
        deepLinkErrorNotifiedRef.current = deepLinkItemId;
        toast.error(
          t('ai.training.itemNotFound', {
            defaultValue: 'Training item not found — it may have been applied or removed.',
          }),
        );
      }
      syncDeepLinkItemParam(null);
      setReview(prev => (prev?.itemId === deepLinkItemId ? null : prev));
      return;
    }

    const source = deepLinkItem ?? fromList;
    if (!source) return;

    if (source.status) {
      setInnerTab(innerTabForStatus(source.status));
    }
    setReview(prev => {
      if (prev?.itemId === deepLinkItemId && prev.customAnswer.trim()) return prev;
      return {
        itemId: deepLinkItemId,
        ...reviewSeedFromItem(source),
        customInstruction: '',
        selectedSuggestionId: prev?.itemId === deepLinkItemId ? prev.selectedSuggestionId : undefined,
      };
    });
  }, [
    deepLinkItemId,
    deepLinkItem,
    deepLinkItemError,
    deepLinkItemLoading,
    deepLinkItemFetched,
    items,
    syncDeepLinkItemParam,
    t,
    toast,
  ]);

  useEffect(() => {
    if (!deepLinkItemId || itemsLoading) return;
    const card = listRef.current?.querySelector(`[data-item-id="${deepLinkItemId}"]`);
    card?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [deepLinkItemId, itemsLoading, innerTab, items.length]);

  return (
    <div className="aitc-panel" data-testid="ai-training-center">
      <header className="aitc-header">
        <div>
          <h1>{t('ai.training.title', { defaultValue: 'AI Training Center' })}</h1>
          <p>{t('ai.training.subtitle', { defaultValue: 'Teach AI from inbox, customers, products, and system events.' })}</p>
          {role && !isAdmin && trainingSettings?.requireAdminApproval !== false ? (
            <p className="aitc-header__role-hint">
              {t('ai.training.operatorHint', {
                defaultValue: 'Signed in as {{role}} — high-risk items require an admin key.',
                role,
              })}
            </p>
          ) : null}
        </div>
        <div className="aitc-header__actions">
          <button type="button" className="aitc-btn" disabled={scanInboxMut.isPending} onClick={() => scanInboxMut.mutate()}>
            {scanInboxMut.isPending ? <Loader2 size={16} className="spin" /> : <Scan size={16} />}
            {t('ai.training.scanInbox', { defaultValue: 'Scan Inbox' })}
          </button>
          <button type="button" className="aitc-btn" disabled={scanSystemMut.isPending} onClick={() => scanSystemMut.mutate()}>
            {t('ai.training.scanSystem', { defaultValue: 'Scan System' })}
          </button>
          <button type="button" className="aitc-btn" onClick={() => setManualOpen(true)}>
            <Plus size={16} />
            {t('ai.training.addManual', { defaultValue: 'Add Manual' })}
          </button>
          <button
            type="button"
            className={`aitc-btn${overview?.needsReindex ? ' aitc-btn--warn' : ''}`}
            disabled={reindexMut.isPending}
            onClick={() => reindexMut.mutate()}
          >
            <RefreshCw size={16} />
            {t('ai.training.reindex', { defaultValue: 'Reindex' })}
          </button>
          <Link to={settingsPanelHref('ai-learning')} className="aitc-btn aitc-btn--ghost">
            <BookOpen size={16} />
            {t('ai.training.legacySettings', { defaultValue: 'Learning settings' })}
          </Link>
          <button type="button" className="aitc-btn aitc-btn--ghost" onClick={() => setSettingsOpen(true)} data-testid="ai-training-settings-open">
            <BookOpen size={16} />
            {t('ai.training.settings', { defaultValue: 'Settings' })}
          </button>
        </div>
      </header>

      <div className="aitc-kpis">
        {[
          { label: 'Pending Questions', value: overview?.pendingQuestions },
          { label: 'High Priority', value: overview?.highPriority },
          { label: 'Approved Today', value: overview?.approvedToday },
          { label: 'Applied Knowledge', value: overview?.appliedKnowledge },
          { label: 'Needs Reindex', value: overview?.needsReindex ? 'Yes' : 'No' },
          { label: 'AI Suggestions', value: overview?.aiSuggestions },
        ].map(k => (
          <div key={k.label} className="aitc-kpi">
            <span className="aitc-kpi__label">{k.label}</span>
            <span className="aitc-kpi__value">{overviewLoading ? '…' : k.value ?? 0}</span>
          </div>
        ))}
      </div>

      <div className="aitc-layout">
        <aside className="aitc-sidebar">
          {INNER_TABS.map(tab => (
            <button
              key={tab}
              type="button"
              className={`aitc-sidebar__btn${innerTab === tab ? ' aitc-sidebar__btn--active' : ''}`}
              onClick={() => setInnerTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </aside>

        <main className="aitc-list" ref={listRef}>
          {showChatKindFilter ? (
            <div className="aitc-chat-kind-bar" data-testid="ai-training-chat-kind-filter">
              {(['direct', 'group', 'all'] as const).map(kind => (
                <button
                  key={kind}
                  type="button"
                  className={`aitc-chat-kind-bar__btn${chatKindFilter === kind ? ' aitc-chat-kind-bar__btn--active' : ''}`}
                  onClick={() => setChatKindFilter(kind)}
                  data-testid={`ai-training-chat-kind-${kind}`}
                >
                  {kind === 'direct'
                    ? t('ai.training.directChats', { defaultValue: 'Direct chats' })
                    : kind === 'group'
                      ? t('ai.training.groupChats', { defaultValue: 'Groups' })
                      : t('ai.training.allChats', { defaultValue: 'All' })}
                </button>
              ))}
            </div>
          ) : null}
          {visibleItems.length > 0 ? (
            <div className="aitc-bulk-bar" data-testid="ai-training-bulk-bar">
              <label className="aitc-bulk-bar__select">
                <input
                  type="checkbox"
                  checked={selectedIds.length > 0 && selectedIds.length === visibleItems.length}
                  onChange={e =>
                    setSelectedIds(e.target.checked ? visibleItems.map(i => i.id) : [])
                  }
                />
                {t('ai.training.selectAll', { defaultValue: 'Select all' })}
              </label>
              {selectedIds.length > 0 ? (
                <>
                  {reviewableTab && bulkApprovableCount > 0 ? (
                    <button
                      type="button"
                      className="aitc-btn aitc-btn--primary"
                      disabled={bulkApproveMut.isPending}
                      onClick={() => setBulkConfirmOpen(true)}
                      data-testid="ai-training-bulk-approve"
                    >
                      {t('ai.training.bulkApprove', {
                        defaultValue: 'Approve selected ({{n}})',
                        n: bulkApprovableCount,
                      })}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="aitc-btn aitc-btn--ghost"
                    disabled={bulkIgnoreMut.isPending}
                    onClick={() => bulkIgnoreMut.mutate(selectedIds)}
                  >
                    {t('ai.training.bulkIgnore', {
                      defaultValue: 'Ignore selected ({{n}})',
                      n: selectedIds.length,
                    })}
                  </button>
                </>
              ) : null}
            </div>
          ) : null}
          {bulkSkipNotes.length > 0 ? (
            <div className="aitc-bulk-skip-notes" data-testid="ai-training-bulk-skip-notes">
              {bulkSkipNotes.map(row => (
                <p key={row.id}>
                  <strong>{row.id.slice(0, 8)}…</strong> — {row.reason}
                </p>
              ))}
            </div>
          ) : null}
          {itemsLoading ? (
            <div className="aitc-empty"><Loader2 className="spin" size={24} /></div>
          ) : visibleItems.length === 0 ? (
            <div className="aitc-empty">{t('ai.training.noItems', { defaultValue: 'No training items in this queue.' })}</div>
          ) : (
            visibleItems.map(item => (
              <article
                key={item.id}
                className={`aitc-card${deepLinkItemId === item.id ? ' aitc-card--focused' : ''}`}
                data-testid="ai-training-item-card"
                data-item-id={item.id}
              >
                <div className="aitc-card__top">
                  <label className="aitc-card__check">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={e =>
                        setSelectedIds(prev =>
                          e.target.checked
                            ? [...prev, item.id]
                            : prev.filter(id => id !== item.id),
                        )
                      }
                    />
                  </label>
                  <span className={`aitc-badge${isTrainingGroupItem(item) ? ' aitc-badge--group' : ''}`}>
                    {sourceLabel(item)}
                  </span>
                  {itemRequiresAdminApproval(item, trainingSettings?.requireAdminApproval !== false) ? (
                    <span className="aitc-badge aitc-badge--admin" data-testid="ai-training-admin-badge">
                      {t('ai.training.adminOnly', { defaultValue: 'Admin only' })}
                    </span>
                  ) : null}
                  {item.status === 'applied' ? (
                    <span className="aitc-badge aitc-badge--applied" data-testid="ai-training-applied-badge">
                      {t('ai.training.activeInInbox', { defaultValue: 'Active in inbox' })}
                    </span>
                  ) : null}
                  <span className={`aitc-priority aitc-priority--${item.priority}`}>{item.priority}</span>
                  {item.timesAsked > 1 ? (
                    <span className="aitc-badge aitc-badge--muted">{item.timesAsked}x</span>
                  ) : null}
                </div>
                <h3>{item.title ?? item.question}</h3>
                {item.conversationExcerpt ? (
                  <p className="aitc-card__excerpt">{item.conversationExcerpt}</p>
                ) : null}
                {item.aiDraftAnswer ? (
                  <p className="aitc-card__ai-reply"><strong>AI:</strong> {item.aiDraftAnswer.slice(0, 160)}</p>
                ) : null}
                <div className="aitc-card__meta">
                  <span>{item.issueType ?? item.source}</span>
                  <span>{item.targetFile ?? item.suggestedTargetFile ?? 'FAQ.md'}</span>
                  <span>{formatDate(item.createdAt)}</span>
                </div>
                <div className="aitc-card__actions">
                  <button type="button" className="aitc-btn aitc-btn--primary" onClick={() => openReview(item)}>
                    {t('ai.training.review', { defaultValue: 'Review' })}
                  </button>
                  <button
                    type="button"
                    className="aitc-btn aitc-btn--ghost"
                    onClick={() => aiTrainingApi.ignore(item.id).then(invalidate)}
                  >
                    {t('ai.training.ignore', { defaultValue: 'Ignore' })}
                  </button>
                  {item.sessionId && item.chatId ? (
                    <Link to={`/inbox?session=${encodeURIComponent(item.sessionId)}&chat=${encodeURIComponent(item.chatId)}`} className="aitc-btn aitc-btn--ghost">
                      {t('ai.training.openChat', { defaultValue: 'Open conversation' })}
                    </Link>
                  ) : null}
                </div>
              </article>
            ))
          )}
        </main>

        {review ? (
          <aside className="aitc-review" data-testid="ai-training-review-panel">
            {detailLoading || !detail ? (
              <Loader2 className="spin" size={24} />
            ) : (
              <TrainingReviewPanel
                detail={detail}
                review={review}
                selectedSuggestion={selectedSuggestion}
                trainingSettings={trainingSettings}
                isAdmin={isAdmin}
                onChange={patch => setReview(prev => (prev ? { ...prev, ...patch } : prev))}
                onClose={closeReview}
                onApprove={applyNow => review && approveMut.mutate({ ...review, applyNow })}
                approving={approveMut.isPending}
              />
            )}
          </aside>
        ) : null}
      </div>

      {manualOpen ? (
        <div className="aitc-modal-backdrop" onClick={() => setManualOpen(false)}>
          <div className="aitc-modal" onClick={e => e.stopPropagation()}>
            <h3>{t('ai.training.manualTitle', { defaultValue: 'Add manual training' })}</h3>
            <textarea
              value={manualQuestion}
              onChange={e => setManualQuestion(e.target.value)}
              placeholder={t('ai.training.manualPlaceholder', { defaultValue: 'What should AI learn?' })}
              rows={4}
            />
            <div className="aitc-modal__actions">
              <button type="button" className="aitc-btn aitc-btn--ghost" onClick={() => setManualOpen(false)}>Cancel</button>
              <button
                type="button"
                className="aitc-btn aitc-btn--primary"
                disabled={!manualQuestion.trim() || createManualMut.isPending}
                onClick={() => createManualMut.mutate()}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {settingsOpen && trainingSettings ? (
        <AiTrainingSettingsModal settings={trainingSettings} onClose={() => setSettingsOpen(false)} />
      ) : null}

      {bulkConfirmOpen ? (
        <AiTrainingBulkApproveModal
          items={items}
          ids={bulkApprovableIds}
          requireAdminApproval={trainingSettings?.requireAdminApproval !== false}
          isAdmin={isAdmin}
          pending={bulkApproveMut.isPending}
          onClose={() => setBulkConfirmOpen(false)}
          onConfirm={overrides =>
            bulkApproveMut.mutate({ ids: bulkApprovableIds, overrides: overrides.length ? overrides : undefined })
          }
        />
      ) : null}
    </div>
  );
}

function TrainingReviewPanel({
  detail,
  review,
  selectedSuggestion,
  trainingSettings,
  isAdmin,
  onChange,
  onClose,
  onApprove,
  approving,
}: {
  detail: AiTrainingItemDetail;
  review: ReviewState;
  selectedSuggestion: AiTrainingSuggestion | null;
  trainingSettings?: AiLearningSettings;
  isAdmin: boolean;
  onChange: (patch: Partial<ReviewState>) => void;
  onClose: () => void;
  onApprove: (applyNow: boolean) => void;
  approving: boolean;
}) {
  const { t } = useTranslation();

  const isHighRisk =
    Boolean(selectedSuggestion?.actionType && HIGH_RISK_ACTION_TYPES.has(selectedSuggestion.actionType)) ||
    itemRequiresAdminApproval(detail, trainingSettings?.requireAdminApproval !== false);
  const adminRequired = Boolean(trainingSettings?.requireAdminApproval && isHighRisk && !isAdmin);

  const previewBody = useMemo(
    () => ({
      selectedSuggestionId: review.selectedSuggestionId,
      customAnswer: review.customAnswer.trim() || undefined,
      customInstruction: review.customInstruction.trim() || undefined,
      targetFile: review.targetFile,
    }),
    [
      review.selectedSuggestionId,
      review.customAnswer,
      review.customInstruction,
      review.targetFile,
    ],
  );

  const previewEnabled =
    Boolean(previewBody.selectedSuggestionId) ||
    Boolean(previewBody.customAnswer) ||
    Boolean(previewBody.customInstruction);

  const { data: preview, isFetching: previewLoading } = useQuery({
    queryKey: ['ai-training', 'preview', detail.id, previewBody],
    queryFn: () => aiTrainingApi.previewApproval(detail.id, previewBody),
    enabled: previewEnabled,
    staleTime: 15_000,
  });

  return (
    <>
      <div className="aitc-review__head">
        <h2>{t('ai.training.reviewTitle', { defaultValue: 'Review training' })}</h2>
        <button type="button" className="aitc-btn aitc-btn--ghost" onClick={onClose} data-testid="ai-training-review-close">Close</button>
      </div>
      <p className="aitc-review__question">{detail.trainingQuestion}</p>
      <div className="aitc-review__context">
        <strong>{t('ai.training.customerQuestion', { defaultValue: 'Customer question' })}</strong>
        <p>{detail.question}</p>
        {detail.aiDraftAnswer ? (
          <>
            <strong>{t('ai.training.currentAiReply', { defaultValue: 'Current AI reply' })}</strong>
            <p>{detail.aiDraftAnswer}</p>
          </>
        ) : null}
        {detail.issueType ? <p className="aitc-review__issue">Issue: {detail.issueType}</p> : null}
      </div>

      <div className="aitc-review__options">
        <strong>{t('ai.training.suggestedOptions', { defaultValue: 'Suggested options' })}</strong>
        {detail.suggestions.map(s => (
          <label key={s.id} className={`aitc-option${review.selectedSuggestionId === s.id ? ' aitc-option--selected' : ''}`}>
            <input
              type="radio"
              name="suggestion"
              checked={review.selectedSuggestionId === s.id}
              onChange={() => onChange({
                selectedSuggestionId: s.id,
                customAnswer: s.responseText ?? review.customAnswer,
                targetFile: s.targetFile ?? review.targetFile,
              })}
            />
            <span className="aitc-option__label">{s.optionLabel}. {s.optionText}</span>
            {s.responseText ? <span className="aitc-option__reply">{s.responseText}</span> : null}
            {s.isRecommended ? <span className="aitc-option__rec">Recommended</span> : null}
          </label>
        ))}
      </div>

      <label className="aitc-field">
        {t('ai.training.customAnswer', { defaultValue: 'Custom answer' })}
        <textarea
          value={review.customAnswer}
          onChange={e => onChange({ customAnswer: e.target.value })}
          rows={3}
        />
      </label>

      <label className="aitc-field">
        {t('ai.training.customInstruction', { defaultValue: 'Custom instruction' })}
        <textarea
          value={review.customInstruction}
          onChange={e => onChange({ customInstruction: e.target.value })}
          rows={3}
          placeholder="Akisema anataka namba ya customer care, AI itume namba ya branch yake..."
        />
      </label>

      <label className="aitc-field">
        {t('ai.training.targetFile', { defaultValue: 'Target file' })}
        <select value={review.targetFile} onChange={e => onChange({ targetFile: e.target.value })}>
          {KNOWLEDGE_FILES.map(f => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </label>

      {selectedSuggestion?.risks?.length ? (
        <div className="aitc-warnings">
          {selectedSuggestion.risks.map(r => (
            <p key={r}>{r}</p>
          ))}
        </div>
      ) : null}

      {previewEnabled ? (
        <TrainingApprovalPreviewBlock preview={preview} loading={previewLoading} />
      ) : null}

      {adminRequired ? (
        <div className="aitc-warnings" data-testid="ai-training-admin-required">
          {t('ai.training.adminRequired', {
            defaultValue: 'This training change is high-risk. An admin API key is required to approve and apply.',
          })}
        </div>
      ) : null}

      <div className="aitc-review__audit">
        <div className="aitc-review__audit-head">
          <strong>{t('ai.training.auditTitle', { defaultValue: 'Activity' })}</strong>
          <Link
            to={`/ai?tab=logs&item=${encodeURIComponent(detail.id)}`}
            className="aitc-btn aitc-btn--ghost"
            data-testid="ai-training-review-all-logs"
          >
            {t('ai.training.viewAllLogs', { defaultValue: 'All logs' })}
          </Link>
        </div>
        <AiTrainingAuditTimeline trainingItemId={detail.id} limit={6} compact />
      </div>

      <div className="aitc-review__actions">
        <button
          type="button"
          className="aitc-btn aitc-btn--primary"
          disabled={approving || adminRequired}
          onClick={() => onApprove(true)}
        >
          {approving ? <Loader2 size={16} className="spin" /> : null}
          {t('ai.training.approveApply', { defaultValue: 'Approve & apply' })}
        </button>
        <button
          type="button"
          className="aitc-btn"
          disabled={approving || adminRequired}
          onClick={() => onApprove(false)}
        >
          {t('ai.training.approveOnly', { defaultValue: 'Approve only' })}
        </button>
        <button
          type="button"
          className="aitc-btn aitc-btn--ghost"
          onClick={() => aiTrainingApi.generateSuggestions(detail.id)}
        >
          {t('ai.training.regenerate', { defaultValue: 'Regenerate options' })}
        </button>
      </div>
    </>
  );
}

function TrainingApprovalPreviewBlock({
  preview,
  loading,
}: {
  preview?: AiTrainingApprovalPreview;
  loading: boolean;
}) {
  const { t } = useTranslation();

  if (loading && !preview) {
    return (
      <div className="aitc-preview" data-testid="ai-training-preview-loading">
        <Loader2 size={16} className="spin" />
        {t('ai.training.previewLoading', { defaultValue: 'Loading preview…' })}
      </div>
    );
  }

  if (!preview) return null;

  return (
    <div className="aitc-preview" data-testid="ai-training-preview">
      <strong>{t('ai.training.previewTitle', { defaultValue: 'Knowledge preview' })}</strong>
      <p className="aitc-preview__meta">
        {preview.targetFile}
        {preview.targetSection ? ` · ${preview.targetSection}` : ''}
        {preview.updateMode ? ` · ${preview.updateMode}` : ''}
      </p>
      {preview.warnings?.length ? (
        <div className="aitc-warnings">
          {preview.warnings.map(w => (
            <p key={w}>{w}</p>
          ))}
        </div>
      ) : null}
      <div className="aitc-preview__diff">
        <div className="aitc-preview__col">
          <span>{t('ai.training.previewBefore', { defaultValue: 'Before' })}</span>
          <pre>{preview.oldContentPreview || '—'}</pre>
        </div>
        <div className="aitc-preview__col">
          <span>{t('ai.training.previewAfter', { defaultValue: 'After' })}</span>
          <pre>{preview.newContentPreview || '—'}</pre>
        </div>
      </div>
    </div>
  );
}
