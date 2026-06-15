import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MaterialSymbol } from '../MaterialSymbol';
import type { FollowupQueueItemView } from '../../services/api';
import {
  customerInitials,
  followupCustomerLabel,
  followupPhoneDisplay,
  formatDueTime,
  isHotPriority,
  lastMsgPreview,
  overdueLabel,
  reasonLabel,
  autopilotStatusBadge,
} from './followup-utils';
import { FollowupAutopilotSuggestionRow } from './FollowupAutopilotSuggestionRow';

const PAGE_SIZE = 10;

type Props = {
  rows: FollowupQueueItemView[];
  sessionName: (sessionId: string) => string;
  page: number;
  onPageChange: (page: number) => void;
  onRowClick: (item: FollowupQueueItemView) => void;
  onComplete: (item: FollowupQueueItemView) => void;
  isLoading?: boolean;
  highlightConversationId?: string | null;
  canWrite?: boolean;
};

export function FollowupQueueTable({
  rows,
  sessionName,
  page,
  onPageChange,
  onRowClick,
  onComplete,
  isLoading,
  highlightConversationId,
  canWrite = false,
}: Props) {
  const { t } = useTranslation();
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageRows = rows.slice(start, start + PAGE_SIZE);

  const stageLabel = (stage: string) =>
    t(`followups.stageLabels.${stage}`, { defaultValue: stage });

  if (isLoading) {
    return (
      <div className="followups-loading">
        <Loader2 className="spin" size={32} />
      </div>
    );
  }

  if (total === 0) {
    return <div className="followups-empty">{t('followups.empty')}</div>;
  }

  const pageButtons: number[] = [];
  for (let i = 1; i <= Math.min(totalPages, 5); i++) pageButtons.push(i);

  return (
    <div className="fu-table-wrap">
      <table className="fu-table">
        <thead>
          <tr>
            <th style={{ width: '26%' }}>{t('followups.table.customer')}</th>
            <th style={{ width: '11%' }}>{t('followups.table.account')}</th>
            <th style={{ width: '18%' }}>{t('followups.table.reason')}</th>
            <th style={{ width: '10%' }}>{t('followups.table.priority')}</th>
            <th style={{ width: '10%' }}>{t('followups.table.due')}</th>
            <th style={{ width: '14%' }}>{t('followups.table.lastMsg')}</th>
            <th className="fu-table__actions-col" style={{ width: '11%' }}>
              {t('followups.table.actions')}
            </th>
          </tr>
        </thead>
        <tbody>
          {pageRows.map(item => {
            const hot = isHotPriority(item.priority);
            const overdue = overdueLabel(item.dueAt, item.status);
            const account = sessionName(item.sessionId);
            const phoneDisplay = followupPhoneDisplay(item.chatId, item.customerPhone, t);

            return (
              <tr
                key={item.id}
                className={highlightConversationId === item.conversationId ? 'followup-card highlight' : ''}
                onClick={() => onRowClick(item)}
              >
                <td>
                  <div className="fu-table__customer">
                    <div className="fu-table__avatar">
                      {customerInitials(item.customerName, item.customerPhone, item.chatId, t)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div className="fu-table__name">
                        {followupCustomerLabel(item, t)}
                      </div>
                      {phoneDisplay && (
                        <div className="fu-table__phone">{phoneDisplay}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td>
                  <span
                    className={[
                      'fu-table__account-badge',
                      item.kpiPenaltyFlag ? 'fu-table__account-badge--primary' : '',
                    ].join(' ')}
                  >
                    {account}
                  </span>
                </td>
                <td>
                  <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {reasonLabel(item, stageLabel)}
                  </span>
                  {item.isAutopilot && autopilotStatusBadge(item.status) && (
                    <span className="ws-status-badge" style={{ marginTop: 4, display: 'inline-block' }}>
                      {autopilotStatusBadge(item.status)}
                    </span>
                  )}
                </td>
                <td>
                  {hot ? (
                    <span className="fu-table__priority--hot">
                      <MaterialSymbol name="local_fire_department" size={16} filled />
                      {t('followups.priority.hot')}
                    </span>
                  ) : (
                    <span className="fu-table__priority--normal">
                      <MaterialSymbol name="radio_button_checked" size={16} />
                      {t('followups.priority.normal')}
                    </span>
                  )}
                </td>
                <td>
                  <div>
                    <span style={{ fontWeight: 600 }}>{formatDueTime(item.dueAt)}</span>
                    {overdue && <div className="fu-table__due-overdue">{overdue}</div>}
                  </div>
                </td>
                <td className="fu-table__last-msg-cell">
                  {item.isAutopilot ? (
                    <FollowupAutopilotSuggestionRow item={item} />
                  ) : (
                    <span className="fu-table__last-msg" title={lastMsgPreview(item)}>
                      &ldquo;{lastMsgPreview(item)}&rdquo;
                    </span>
                  )}
                </td>
                <td onClick={e => e.stopPropagation()}>
                  <div className="fu-table__actions">
                    <Link
                      to={`/inbox?session=${item.sessionId}&chat=${encodeURIComponent(item.chatId)}`}
                      className="fu-table__action-btn"
                      title={t('followups.openInbox')}
                    >
                      <MaterialSymbol name="chat" size={18} />
                    </Link>
                    {canWrite && (
                      <button
                        type="button"
                        className="fu-table__action-btn fu-table__action-btn--success"
                        title={t('followups.markOutcome')}
                        onClick={() => onComplete(item)}
                      >
                        <MaterialSymbol name="check_circle" size={18} />
                      </button>
                    )}
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
            to: Math.min(start + PAGE_SIZE, total),
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
