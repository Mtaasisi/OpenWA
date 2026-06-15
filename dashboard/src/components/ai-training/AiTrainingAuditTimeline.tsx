import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { aiTrainingApi, type AiTrainingAuditEntry } from '../../services/api';

const ACTION_LABELS: Record<string, string> = {
  created: 'Created',
  suggestion_generated: 'Suggestions',
  answered: 'Answered',
  approved: 'Approved',
  applied: 'Applied',
  rejected: 'Rejected',
  reindexed: 'Reindexed',
  failed: 'Failed',
};

function actionClass(action: string): string {
  if (action === 'failed' || action === 'rejected') return 'aitc-audit__action--danger';
  if (action === 'applied' || action === 'approved' || action === 'reindexed') return 'aitc-audit__action--ok';
  return 'aitc-audit__action--muted';
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

interface Props {
  trainingItemId?: string;
  limit?: number;
  compact?: boolean;
  showItemLink?: boolean;
  actionFilter?: string;
}

export function AiTrainingAuditTimeline({
  trainingItemId,
  limit = 12,
  compact = false,
  showItemLink = false,
  actionFilter = 'all',
}: Props) {
  const { t } = useTranslation();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['ai-training', 'audit', trainingItemId ?? 'recent'],
    queryFn: () => aiTrainingApi.getAudit(trainingItemId),
  });

  const visible = rows
    .filter(row => actionFilter === 'all' || row.action === actionFilter)
    .slice(0, limit);

  if (isLoading) {
    return (
      <div className="aitc-audit aitc-audit--loading" data-testid="ai-training-audit-timeline">
        <Loader2 size={16} className="spin" />
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <div className="aitc-audit aitc-audit--empty" data-testid="ai-training-audit-timeline">
        {t('ai.training.auditEmpty', { defaultValue: 'No training audit entries yet.' })}
      </div>
    );
  }

  return (
    <div
      className={`aitc-audit${compact ? ' aitc-audit--compact' : ''}`}
      data-testid="ai-training-audit-timeline"
    >
      {visible.map((row: AiTrainingAuditEntry) => (
        <article key={row.id} className="aitc-audit__row">
          <div className="aitc-audit__head">
            <span className={`aitc-audit__action ${actionClass(row.action)}`}>
              {ACTION_LABELS[row.action] ?? row.action}
            </span>
            <time className="aitc-audit__time">{formatWhen(row.createdAt)}</time>
          </div>
          <p className="aitc-audit__summary">{row.summary}</p>
          <div className="aitc-audit__meta">
            {row.actorId ? <span>{row.actorType}: {row.actorId}</span> : <span>{row.actorType}</span>}
            {showItemLink && row.trainingItemId ? (
              <Link to={`/ai?tab=training&item=${encodeURIComponent(row.trainingItemId)}`}>
                {t('ai.training.openItem', { defaultValue: 'Open item' })}
              </Link>
            ) : null}
            {row.details && typeof row.details.backupPath === 'string' ? (
              <span>{String(row.details.backupPath)}</span>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
