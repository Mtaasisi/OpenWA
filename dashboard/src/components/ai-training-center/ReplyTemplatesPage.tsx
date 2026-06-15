import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MaterialSymbol } from '../MaterialSymbol';
import { aiTrainingCenterApi } from '../../lib/ai-training-center/api';
import { useToast } from '../Toast';
import { useAiTrainingPermissions } from '../../hooks/useAiTrainingPermissions';
import { AITCErrorState, AITCEmptyState, AITCLoadingSkeleton, IntentBadge } from './shared';
import { AddReplyTemplateModal } from './modals';

const TABS = ['all', 'greeting', 'price', 'location', 'delivery', 'installment', 'other'] as const;

export function ReplyTemplatesPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const { canManageTraining } = useAiTrainingPermissions();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(searchParams.get('action') === 'new');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['ai-training-center', 'templates'],
    queryFn: () => aiTrainingCenterApi.listReplyTemplates(),
  });

  const createMut = useMutation({
    mutationFn: aiTrainingCenterApi.createReplyTemplate,
    onSuccess: () => {
      toast.success('Template saved');
      setModalOpen(false);
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
      void qc.invalidateQueries({ queryKey: ['ai-training-center', 'templates'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    let rows = data ?? [];
    if (tab !== 'all') rows = rows.filter(r => r.category === tab);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        r => r.name.toLowerCase().includes(q) || r.message.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [data, tab, search]);

  return (
    <>
      <header className="aitc-page-header">
        <div>
          <h1 className="aitc-page-header__title">Reply Templates</h1>
          <p className="aitc-page-header__subtitle">Create and manage reply templates used by AI.</p>
        </div>
        <div className="aitc-page-header__actions">
          {canManageTraining && (
            <button type="button" className="aitc-btn aitc-btn--primary" onClick={() => setModalOpen(true)}>
              <MaterialSymbol name="add" size={18} />
              New Template
            </button>
          )}
        </div>
      </header>

      <div className="aitc-filters">
        <input
          className="aitc-input"
          placeholder="Search templates…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="aitc-tabs">
        {TABS.map(t => (
          <button
            key={t}
            type="button"
            className={`aitc-tab${tab === t ? ' is-active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {isError && <AITCErrorState message="Failed to load templates." onRetry={() => refetch()} />}
      {isLoading ? (
        <AITCLoadingSkeleton />
      ) : filtered.length === 0 ? (
        <AITCEmptyState
          title="No templates"
          description="Create reply templates for common intents."
          actionLabel={canManageTraining ? 'New Template' : undefined}
          onAction={canManageTraining ? () => setModalOpen(true) : undefined}
        />
      ) : (
        <div className="aitc-template-grid">
          {filtered.map(tpl => (
            <article key={tpl.id} className="aitc-template-card">
              <div className="aitc-template-card__head">
                <h3 className="aitc-template-card__title">{tpl.name}</h3>
                <IntentBadge intent={tpl.category} />
              </div>
              <p className="aitc-template-card__preview">{tpl.message}</p>
              <div className="aitc-template-card__meta">
                <span>Used {tpl.usageCount} times</span>
                <span>{tpl.ratingPercent}% rating</span>
              </div>
            </article>
          ))}
        </div>
      )}

      {modalOpen && canManageTraining && (
        <AddReplyTemplateModal
          onClose={() => {
            setModalOpen(false);
            searchParams.delete('action');
            setSearchParams(searchParams, { replace: true });
          }}
          onSave={v => createMut.mutate(v)}
          saving={createMut.isPending}
        />
      )}
    </>
  );
}
