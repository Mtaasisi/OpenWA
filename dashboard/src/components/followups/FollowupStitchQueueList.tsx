import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { MaterialSymbol } from '../MaterialSymbol';
import type { FollowupQueueItemView } from '../../services/api';
import {
  customerInitials,
  followupCustomerLabel,
  followupPhoneDisplay,
  formatDueDate,
  isHotPriority,
  lastMsgPreview,
  overdueLabel,
  isDueOverdue,
  isAutopilotChip,
  reasonLabel,
  autopilotStatusBadge,
  type FollowupViewChip,
} from './followup-utils';
import { FollowupAutopilotSuggestionRow } from './FollowupAutopilotSuggestionRow';
import { FollowupStitchQueueSkeleton } from './FollowupStitchQueueSkeleton';

const PAGE_SIZE = 12;

type Props = {
  rows: FollowupQueueItemView[];
  sessionName: (sessionId: string) => string;
  page: number;
  onPageChange: (page: number) => void;
  selectedId?: string | null;
  onRowClick: (item: FollowupQueueItemView) => void;
  onComplete: (item: FollowupQueueItemView) => void;
  isLoading?: boolean;
  isFetching?: boolean;
  highlightConversationId?: string | null;
  canWrite?: boolean;
  onNewTask?: () => void;
  viewChip: FollowupViewChip;
};

export function FollowupStitchQueueList({
  rows,
  sessionName,
  page,
  onPageChange,
  selectedId,
  onRowClick,
  onComplete,
  isLoading,
  isFetching = false,
  highlightConversationId,
  canWrite = false,
  onNewTask,
  viewChip,
}: Props) {
  const { t } = useTranslation();
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageRows = rows.slice(start, start + PAGE_SIZE);

  const viewLabel = isAutopilotChip(viewChip)
    ? t(`followups.viewChipsAutopilot.${viewChip}`, { defaultValue: viewChip.replace(/_/g, ' ') })
    : t(`followups.viewChips.${viewChip}`);

  const queueHeader = (count?: number) => (
    <header className="followups-stitch-queue__header">
      <div className="followups-stitch-queue__header-text">
        <h3 className="followups-stitch-queue__title">{t('followups.stitch.queueTitle')}</h3>
        <p className="followups-stitch-queue__subtitle">{viewLabel}</p>
      </div>
      {count != null ? (
        <span className="followups-stitch-queue__count">
          {t('followups.stitch.taskCount', { count })}
        </span>
      ) : null}
    </header>
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!window.location.pathname.startsWith('/followups')) return;
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      if (!['arrowdown', 'arrowup', 'j', 'k'].includes(key) || pageRows.length === 0) return;
      event.preventDefault();
      const currentIndex = selectedId ? pageRows.findIndex(row => row.id === selectedId) : -1;
      let nextIndex = currentIndex;
      if (key === 'arrowdown' || key === 'j') {
        nextIndex = currentIndex < 0 ? 0 : Math.min(pageRows.length - 1, currentIndex + 1);
      } else {
        nextIndex = currentIndex < 0 ? pageRows.length - 1 : Math.max(0, currentIndex - 1);
      }
      onRowClick(pageRows[nextIndex]);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pageRows, selectedId, onRowClick]);

  const stageLabel = (stage: string) =>
    t(`followups.stageLabels.${stage}`, { defaultValue: stage });

  if (isLoading && total === 0) {
    return (
      <div className="followups-stitch-queue">
        <header className="followups-stitch-queue__header">
          <div className="followups-stitch-queue__header-text">
            <h3 className="followups-stitch-queue__title">{t('followups.stitch.queueTitle')}</h3>
            <p className="followups-stitch-queue__subtitle">{viewLabel}</p>
          </div>
        </header>
        <FollowupStitchQueueSkeleton />
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="followups-stitch-queue">
        {queueHeader()}
        <div className="followups-stitch-empty">
          <MaterialSymbol name="event_available" size={36} className="followups-stitch-empty__icon" />
          <p className="followups-stitch-empty__title">{t('followups.empty')}</p>
          <p className="followups-stitch-empty__hint">{t('followups.stitch.emptyHint')}</p>
          {canWrite && onNewTask ? (
            <button type="button" className="followups-stitch-empty__cta" onClick={onNewTask}>
              <MaterialSymbol name="add" size={18} />
              {t('followups.newTask')}
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const pageButtons: number[] = [];
  for (let i = 1; i <= Math.min(totalPages, 5); i++) pageButtons.push(i);

  return (
    <div className={['followups-stitch-queue', isFetching ? 'followups-stitch-queue--fetching' : ''].filter(Boolean).join(' ')}>
      {isFetching ? <div className="followups-stitch-queue__progress" aria-hidden /> : null}
      {queueHeader(total)}
      <ul className="followups-stitch-queue__list">
        {pageRows.map(item => {
          const hot = isHotPriority(item.priority);
          const overdue = overdueLabel(item.dueAt, item.status);
          const dueOverdue = isDueOverdue(item.dueAt, item.status);
          const phoneDisplay = followupPhoneDisplay(item.chatId, item.customerPhone, t);
          const isSelected = selectedId === item.id;
          const isHighlighted = highlightConversationId === item.conversationId;

          return (
            <li key={item.id}>
              <button
                type="button"
                className={[
                  'followups-stitch-queue__row',
                  isSelected ? 'followups-stitch-queue__row--selected' : '',
                  isHighlighted ? 'followups-stitch-queue__row--highlight' : '',
                  hot ? 'followups-stitch-queue__row--hot' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => onRowClick(item)}
              >
                <div className="followups-stitch-queue__avatar">
                  {customerInitials(item.customerName, item.customerPhone, item.chatId, t)}
                </div>
                <div className="followups-stitch-queue__body">
                  <div className="followups-stitch-queue__top">
                    <span className="followups-stitch-queue__name">
                      {followupCustomerLabel(item, t)}
                    </span>
                    <span
                      className={[
                        'followups-stitch-queue__time',
                        dueOverdue ? 'followups-stitch-queue__time--overdue' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {formatDueDate(item.dueAt)}
                    </span>
                  </div>
                  <div className="followups-stitch-queue__meta">
                    {phoneDisplay ? <span>{phoneDisplay}</span> : null}
                    <span className="followups-stitch-queue__dot" aria-hidden>
                      ·
                    </span>
                    <span>{sessionName(item.sessionId)}</span>
                  </div>
                  <div className="followups-stitch-queue__bottom">
                    <span className="followups-stitch-queue__reason">
                      {reasonLabel(item, stageLabel)}
                    </span>
                    {hot ? (
                      <span className="followups-stitch-queue__pill followups-stitch-queue__pill--hot">
                        {t('followups.priority.hot')}
                      </span>
                    ) : null}
                    {item.isAutopilot && autopilotStatusBadge(item.status) ? (
                      <span className="followups-stitch-queue__pill followups-stitch-queue__pill--ai">
                        {autopilotStatusBadge(item.status)}
                      </span>
                    ) : null}
                    {overdue ? (
                      <span className="followups-stitch-queue__pill followups-stitch-queue__pill--overdue">
                        {overdue}
                      </span>
                    ) : null}
                  </div>
                  <div className="followups-stitch-queue__preview">
                    {item.isAutopilot ? (
                      <FollowupAutopilotSuggestionRow item={item} />
                    ) : (
                      <span>&ldquo;{lastMsgPreview(item)}&rdquo;</span>
                    )}
                  </div>
                </div>
                <div
                  className="followups-stitch-queue__actions"
                  role="group"
                  aria-label={t('followups.stitch.rowActions')}
                  onClick={e => e.stopPropagation()}
                  onKeyDown={e => e.stopPropagation()}
                >
                  <Link
                    to={`/inbox?session=${item.sessionId}&chat=${encodeURIComponent(item.chatId)}`}
                    className="followups-stitch-queue__action"
                    title={t('followups.openInbox')}
                  >
                    <MaterialSymbol name="chat" size={18} />
                  </Link>
                  {canWrite ? (
                    <button
                      type="button"
                      className="followups-stitch-queue__action followups-stitch-queue__action--success"
                      title={t('followups.markOutcome')}
                      onClick={() => onComplete(item)}
                    >
                      <MaterialSymbol name="check_circle" size={18} />
                    </button>
                  ) : null}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      <footer className="followups-stitch-queue__footer">
        <span>
          {t('followups.pagination.showing', {
            from: start + 1,
            to: Math.min(start + PAGE_SIZE, total),
            total,
          })}
        </span>
        <div className="followups-stitch-queue__pages">
          <button
            type="button"
            className="followups-stitch-queue__page-btn"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
          >
            <MaterialSymbol name="chevron_left" size={18} />
          </button>
          {pageButtons.map(n => (
            <button
              key={n}
              type="button"
              className={[
                'followups-stitch-queue__page-btn',
                n === safePage ? 'followups-stitch-queue__page-btn--active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onPageChange(n)}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            className="followups-stitch-queue__page-btn"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
          >
            <MaterialSymbol name="chevron_right" size={18} />
          </button>
        </div>
      </footer>
    </div>
  );
}
