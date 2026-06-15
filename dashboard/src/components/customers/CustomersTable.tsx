import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { MaterialSymbol } from '../MaterialSymbol';
import { LeadSourceBadge } from '../LeadSourceBadge';
import { StatusBadge, type StatusBadgeVariant } from '../workspace';
import { useSessionsQuery } from '../../hooks/queries';
import type { PipelineCard } from '../../services/api';
import {
  customerSubtitle,
  displayName,
  fmtActivity,
  inboxLink,
  lastActivityIso,
} from './customer-utils';
import { CustomerRowAvatar } from './CustomerRowAvatar';

function isFollowUpDue(iso: string | null | undefined): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() <= Date.now();
}

function CustomerStatusChips({ card }: { card: PipelineCard }) {
  const { t } = useTranslation();
  const chips: { key: string; label: string; variant: StatusBadgeVariant }[] = [];
  if (card.crmResolved) {
    chips.push({ key: 'resolved', label: t('inbox.chipResolved'), variant: 'success' });
  }
  if (isFollowUpDue(card.crmFollowUpAt) || isFollowUpDue(card.nextFollowupAt)) {
    chips.push({ key: 'followup', label: t('customers.chipFollowUp'), variant: 'warning' });
  }
  if (card.inauzwaCustomerId) {
    chips.push({ key: 'inauzwa', label: t('customers.chipInauzwa'), variant: 'info' });
  }
  if ((card.linkedThreadCount ?? 1) > 1) {
    chips.push({
      key: 'threads',
      label: t('customers.chipThreads', { count: card.linkedThreadCount }),
      variant: 'neutral',
    });
  }
  if (chips.length === 0) return <span className="customers-table__muted">—</span>;
  return (
    <span className="customers-status-chips">
      {chips.map(c => (
        <StatusBadge key={c.key} variant={c.variant}>
          {c.label}
        </StatusBadge>
      ))}
    </span>
  );
}

type Props = {
  rows: PipelineCard[];
  isLoading?: boolean;
  onRowClick: (card: PipelineCard) => void;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
};

export function CustomersTable({
  rows,
  isLoading,
  onRowClick,
  page,
  pageSize,
  total,
  onPageChange,
}: Props) {
  const { t } = useTranslation();
  const { data: sessions = [] } = useSessionsQuery();
  const sessionStatusById = useMemo(
    () => new Map(sessions.map(s => [s.id, s.status])),
    [sessions],
  );
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageButtons: number[] = [];
  for (let i = 1; i <= Math.min(totalPages, 5); i++) pageButtons.push(i);

  if (isLoading) {
    return (
      <div className="followups-loading">
        <Loader2 className="spin" size={32} />
      </div>
    );
  }

  if (total === 0) {
    return <div className="followups-empty">{t('customers.empty')}</div>;
  }

  return (
    <div className="fu-table-wrap">
      <table className="fu-table customers-table">
        <thead>
          <tr>
            <th style={{ width: '21%' }}>{t('customers.colName')}</th>
            <th style={{ width: '11%' }}>{t('customers.colStage')}</th>
            <th style={{ width: '13%' }}>{t('customers.colStatus')}</th>
            <th style={{ width: '10%' }}>{t('customers.colSource')}</th>
            <th style={{ width: '13%' }}>{t('customers.colInterest')}</th>
            <th style={{ width: '11%' }}>{t('customers.colActivity')}</th>
            <th style={{ width: '9%' }}>{t('customers.colAssigned')}</th>
            <th className="fu-table__actions-col" style={{ width: '12%' }}>
              {t('customers.colActions')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(card => {
            const chatLink = inboxLink(card);
            const hot = card.priority === 'hot' || card.priority === 'high';
            const name = displayName(card, t('pipeline.unnamed'), t);
            const subtitle = customerSubtitle(card, t);
            return (
              <tr key={card.id} onClick={() => onRowClick(card)}>
                <td>
                  <div className="fu-table__customer">
                    <CustomerRowAvatar
                      card={card}
                      sessionStatus={sessionStatusById.get(card.sessionId)}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div className="fu-table__name">{name}</div>
                      {subtitle && <div className="fu-table__phone">{subtitle}</div>}
                    </div>
                  </div>
                </td>
                <td>
                  <span className={hot ? 'fu-table__priority--hot' : 'customers-stage-pill'}>
                    {t(`followups.stageLabels.${card.stage}`, { defaultValue: card.stage.replace(/_/g, ' ') })}
                  </span>
                </td>
                <td>
                  <CustomerStatusChips card={card} />
                </td>
                <td>
                  <LeadSourceBadge source={card.source} className="lead-source-badge--sm" />
                </td>
                <td>
                  <span className="fu-table__last-msg" title={card.productInterest || undefined}>
                    {card.productInterest || '—'}
                  </span>
                </td>
                <td>{fmtActivity(lastActivityIso(card))}</td>
                <td>{card.assignedStaffName || t('pipeline.unassigned')}</td>
                <td onClick={e => e.stopPropagation()}>
                  <div className="fu-table__actions">
                    {chatLink && (
                      <Link to={chatLink} className="fu-table__action-btn" title={t('customers.openChat')}>
                        <MaterialSymbol name="chat" size={18} />
                      </Link>
                    )}
                    <button
                      type="button"
                      className="fu-table__action-btn"
                      title={t('customers.viewDetails')}
                      onClick={() => onRowClick(card)}
                    >
                      <MaterialSymbol name="open_in_new" size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="fu-table-footer">
        <span>
          {t('followups.pagination.showing', {
            from: start + 1,
            to: Math.min(start + pageSize, total),
            total,
          })}
        </span>
        <div className="fu-pagination">
          <button
            type="button"
            className="fu-pagination__btn"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
          >
            <MaterialSymbol name="chevron_left" size={16} />
          </button>
          {pageButtons.map(p => (
            <button
              key={p}
              type="button"
              className={['fu-pagination__btn', p === safePage ? 'fu-pagination__btn--active' : ''].join(' ')}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          ))}
          <button
            type="button"
            className="fu-pagination__btn"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
          >
            <MaterialSymbol name="chevron_right" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
