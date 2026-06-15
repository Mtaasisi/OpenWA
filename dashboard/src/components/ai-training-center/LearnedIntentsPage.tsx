import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MaterialSymbol } from '../MaterialSymbol';
import { aiTrainingCenterApi } from '../../lib/ai-training-center/api';
import type { LearnedIntentView } from '../../lib/ai-training-center/types';
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
import { AddEditIntentModal, BulkActionsModal, IntentDetailsDrawer } from './modals';

const TABS = ['all', 'active', 'pending_review', 'disabled'] as const;

export function LearnedIntentsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const { canManageTraining } = useAiTrainingPermissions();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<LearnedIntentView | null>(null);
  const [editOpen, setEditOpen] = useState(searchParams.get('action') === 'add-intent');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['ai-training-center', 'intents'],
    queryFn: () => aiTrainingCenterApi.listLearnedIntents(),
  });

  const disableMut = useMutation({
    mutationFn: (id: string) => aiTrainingCenterApi.disableIntent(id),
    onSuccess: () => {
      toast.success('Intent disabled');
      setSelected(null);
      void qc.invalidateQueries({ queryKey: ['ai-training-center'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createMut = useMutation({
    mutationFn: aiTrainingCenterApi.createIntent,
    onSuccess: () => {
      toast.success('Intent saved');
      setEditOpen(false);
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
      void qc.invalidateQueries({ queryKey: ['ai-training-center'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkMut = useMutation({
    mutationFn: ({
      ids,
      action,
      category,
      replyTemplateId,
    }: {
      ids: string[];
      action: 'approve' | 'reject' | 'disable' | 'change_category' | 'assign_template';
      category?: string;
      replyTemplateId?: string;
    }) => aiTrainingCenterApi.bulkLearnedIntents(ids, action, { category, replyTemplateId }),
    onSuccess: (_, vars) => {
      toast.success(`Bulk ${vars.action.replace('_', ' ')} applied to ${vars.ids.length} intents`);
      setBulkOpen(false);
      setChecked(new Set());
      void qc.invalidateQueries({ queryKey: ['ai-training-center'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportMut = useMutation({
    mutationFn: () => aiTrainingCenterApi.exportLearnedIntentsCsv(),
    onSuccess: () => toast.success('Export downloaded'),
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    let rows = data ?? [];
    if (tab !== 'all') rows = rows.filter(r => r.status === tab);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        r =>
          r.phrase.toLowerCase().includes(q) ||
          r.intent.toLowerCase().includes(q) ||
          r.examples.some(e => e.toLowerCase().includes(q)),
      );
    }
    return rows;
  }, [data, tab, search]);

  return (
    <>
      <header className="aitc-page-header">
        <div>
          <h1 className="aitc-page-header__title">Learned Intents</h1>
          <p className="aitc-page-header__subtitle">Manage phrases and intents your AI has learned.</p>
        </div>
        <div className="aitc-page-header__actions">
          {canManageTraining && checked.size > 0 && (
            <button type="button" className="aitc-btn aitc-btn--secondary" onClick={() => setBulkOpen(true)}>
              Bulk Actions ({checked.size})
            </button>
          )}
          <button
            type="button"
            className="aitc-btn aitc-btn--secondary"
            disabled={exportMut.isPending}
            onClick={() => exportMut.mutate()}
          >
            {exportMut.isPending ? 'Exporting…' : 'Export'}
          </button>
          {canManageTraining && (
            <button type="button" className="aitc-btn aitc-btn--primary" onClick={() => setEditOpen(true)}>
              <MaterialSymbol name="add" size={18} />
              Add Intent
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
            {t === 'all' ? 'All Intents' : t.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="aitc-filters">
        <input
          className="aitc-input"
          placeholder="Search intents or phrases…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ minWidth: 220 }}
        />
      </div>

      {isError && <AITCErrorState message="Failed to load intents." onRetry={() => refetch()} />}
      {isLoading ? (
        <AITCLoadingSkeleton />
      ) : filtered.length === 0 ? (
        <AITCEmptyState
          title="No intents yet"
          description="Add intents manually or train from unknown messages."
          actionLabel={canManageTraining ? 'Add Intent' : undefined}
          onAction={canManageTraining ? () => setEditOpen(true) : undefined}
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
                    checked={checked.size === filtered.length && filtered.length > 0}
                    onChange={e => {
                      if (e.target.checked) setChecked(new Set(filtered.map(r => r.id)));
                      else setChecked(new Set());
                    }}
                  />
                </th>
                <th>Phrase / Examples</th>
                <th>Intent</th>
                <th>Confidence</th>
                <th>Status</th>
                <th>Usage</th>
                <th>Last used</th>
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
                      aria-label={`Select ${row.phrase}`}
                    />
                  </td>
                  <td>
                    <strong>{row.phrase}</strong>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {row.examples.slice(0, 4).join(', ')}
                    </div>
                  </td>
                  <td><IntentBadge intent={row.intent} /></td>
                  <td><ConfidenceIndicator value={row.confidence} /></td>
                  <td><StatusBadge status={row.status} /></td>
                  <td>{row.usageCount}</td>
                  <td>{row.lastUsedAt ? new Date(row.lastUsedAt).toLocaleDateString() : '—'}</td>
                  <td>
                    <button type="button" className="aitc-btn aitc-btn--ghost" onClick={() => setSelected(row)}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="aitc-pagination">Showing {filtered.length} intents</div>
        </div>
      )}

      {selected && (
        <IntentDetailsDrawer
          intent={selected}
          onClose={() => setSelected(null)}
          onEdit={() => {
            setEditOpen(true);
            setSelected(null);
          }}
          onDisable={() => disableMut.mutate(selected.id)}
        />
      )}

      {editOpen && canManageTraining && (
        <AddEditIntentModal
          onClose={() => {
            setEditOpen(false);
            searchParams.delete('action');
            setSearchParams(searchParams, { replace: true });
          }}
          onSave={v => createMut.mutate(v)}
          saving={createMut.isPending}
        />
      )}

      {bulkOpen && canManageTraining && (
        <BulkActionsModal
          target="intents"
          count={checked.size}
          onClose={() => setBulkOpen(false)}
          saving={bulkMut.isPending}
          onApply={(action, options) =>
            bulkMut.mutate({
              ids: [...checked],
              action,
              category: options?.category,
              replyTemplateId: options?.replyTemplateId,
            })
          }
        />
      )}
    </>
  );
}
