import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { aiTrainingCenterApi } from '../../lib/ai-training-center/api';
import type { UnknownMessageView } from '../../lib/ai-training-center/types';
import { useToast } from '../Toast';
import { useAiTrainingPermissions } from '../../hooks/useAiTrainingPermissions';
import {
  AITCErrorState,
  AITCEmptyState,
  AITCLoadingSkeleton,
  ConfidenceIndicator,
  IntentBadge,
  StatusBadge,
} from './shared';
import { BulkActionsModal, ReviewUnknownMessageModal } from './modals';

const TABS = ['all', 'pending_review', 'approved', 'rejected'] as const;

export function UnknownMessagesPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const { canManageTraining } = useAiTrainingPermissions();
  const [tab, setTab] = useState<string>('pending_review');
  const [review, setReview] = useState<UnknownMessageView | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['ai-training-center', 'unknown'],
    queryFn: () => aiTrainingCenterApi.listUnknownMessages(),
  });

  const approveMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { intent?: string; reply?: string } }) =>
      aiTrainingCenterApi.approveUnknown(id, body),
    onSuccess: () => {
      toast.success('Message trained');
      setReview(null);
      void qc.invalidateQueries({ queryKey: ['ai-training-center'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectMut = useMutation({
    mutationFn: (id: string) => aiTrainingCenterApi.rejectUnknown(id),
    onSuccess: () => {
      toast.success('Message rejected');
      setReview(null);
      void qc.invalidateQueries({ queryKey: ['ai-training-center'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkMut = useMutation({
    mutationFn: ({
      ids,
      action,
      category,
    }: {
      ids: string[];
      action: 'approve' | 'reject' | 'disable' | 'change_category';
      category?: string;
    }) => aiTrainingCenterApi.bulkUnknownMessages(ids, action, category),
    onSuccess: (_, vars) => {
      toast.success(`Bulk ${vars.action.replace('_', ' ')} applied to ${vars.ids.length} items`);
      setBulkOpen(false);
      setChecked(new Set());
      void qc.invalidateQueries({ queryKey: ['ai-training-center'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    let rows = data ?? [];
    if (tab !== 'all') rows = rows.filter(r => r.status === tab);
    return rows;
  }, [data, tab]);

  const pendingQueue = filtered.filter(r => r.status === 'pending_review');
  const nextAfter = (current: UnknownMessageView) => {
    const idx = pendingQueue.findIndex(r => r.id === current.id);
    return pendingQueue[idx + 1] ?? null;
  };

  return (
    <>
      <header className="aitc-page-header">
        <div>
          <h1 className="aitc-page-header__title">Unknown Messages</h1>
          <p className="aitc-page-header__subtitle">
            Messages AI doesn’t understand yet. Review and train them.
          </p>
        </div>
        <div className="aitc-page-header__actions">
          {canManageTraining && checked.size > 0 && (
            <button type="button" className="aitc-btn aitc-btn--secondary" onClick={() => setBulkOpen(true)}>
              Bulk Actions ({checked.size})
            </button>
          )}
        </div>
      </header>

      <div className="aitc-tabs">
        {TABS.map(t => (
          <button
            key={t}
            type="button"
            className={`aitc-tab${tab === t ? ' is-active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'all' ? 'All Unknown' : t.replace('_', ' ')}
          </button>
        ))}
      </div>

      {isError && <AITCErrorState message="Failed to load unknown messages." onRetry={() => refetch()} />}
      {isLoading ? (
        <AITCLoadingSkeleton />
      ) : filtered.length === 0 ? (
        <AITCEmptyState
          title="No unknown messages"
          description="When AI cannot classify a message, it will appear here."
        />
      ) : (
        <div className="aitc-table-wrap">
          <table className="aitc-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    onChange={e => {
                      if (e.target.checked) setChecked(new Set(filtered.map(r => r.id)));
                      else setChecked(new Set());
                    }}
                  />
                </th>
                <th>Message</th>
                <th>Detected intent</th>
                <th>Confidence</th>
                <th>Frequency</th>
                <th>Last seen</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => (
                <tr key={row.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={checked.has(row.id)}
                      onChange={e => {
                        const next = new Set(checked);
                        if (e.target.checked) next.add(row.id);
                        else next.delete(row.id);
                        setChecked(next);
                      }}
                    />
                  </td>
                  <td>{row.message}</td>
                  <td>
                    {row.detectedIntent ? (
                      <IntentBadge intent={row.detectedIntent} />
                    ) : (
                      <StatusBadge status="unknown" />
                    )}
                  </td>
                  <td><ConfidenceIndicator value={row.confidence} /></td>
                  <td>{row.frequency}</td>
                  <td>{new Date(row.lastSeen).toLocaleDateString()}</td>
                  <td>
                    {canManageTraining && row.status === 'pending_review' && (
                      <button type="button" className="aitc-btn aitc-btn--primary" onClick={() => setReview(row)}>
                        Review
                      </button>
                    )}
                    {row.status !== 'pending_review' && <StatusBadge status={row.status} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {review && canManageTraining && (
        <ReviewUnknownMessageModal
          item={review}
          onClose={() => setReview(null)}
          saving={approveMut.isPending || rejectMut.isPending}
          onReject={() => rejectMut.mutate(review.id)}
          onSave={body =>
            approveMut.mutate({
              id: review.id,
              body: { intent: body.intent, reply: body.reply },
            })
          }
          onSaveNext={() => {
            const next = nextAfter(review);
            approveMut.mutate({
              id: review.id,
              body: {
                intent: review.detectedIntent ?? undefined,
                reply: review.suggestedReply ?? undefined,
              },
            });
            setReview(next);
          }}
        />
      )}

      {bulkOpen && (
        <BulkActionsModal
          count={checked.size}
          onClose={() => setBulkOpen(false)}
          saving={bulkMut.isPending}
          onApply={(action, options) => {
            if (action === 'assign_template') return;
            bulkMut.mutate({
              ids: [...checked],
              action,
              category: options?.category,
            });
          }}
        />
      )}
    </>
  );
}
