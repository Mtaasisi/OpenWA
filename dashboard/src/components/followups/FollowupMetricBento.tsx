import { useTranslation } from 'react-i18next';
import type { FollowUpQueueFilter } from '../../services/api';

export type FollowupMetricId =
  | 'due_today'
  | 'overdue'
  | 'payment_pending'
  | 'hot_leads'
  | 'done_today'
  | 'converted'
  | 'missed';

export type FollowupMetrics = Record<FollowupMetricId, number>;

type Props = {
  metrics: FollowupMetrics;
  doneGoal?: number;
  onMetricClick?: (filter: FollowUpQueueFilter) => void;
  /** Stitch: hide cards with zero counts; hide entire bento when all zero. */
  hideEmpty?: boolean;
};

export function FollowupMetricBento({ metrics, doneGoal, onMetricClick, hideEmpty = false }: Props) {
  const { t } = useTranslation();

  const dueTodayPct =
    doneGoal && doneGoal > 0
      ? Math.min(100, Math.round((metrics.done_today / doneGoal) * 100))
      : metrics.due_today > 0
        ? Math.min(100, Math.round((metrics.due_today / (metrics.due_today + metrics.overdue)) * 100))
        : 0;

  const cards: Array<{
    id: FollowupMetricId;
    filter?: FollowUpQueueFilter;
    className?: string;
    labelClass?: string;
    valueClass?: string;
    sub?: string;
    subClass?: string;
    progress?: number;
  }> = [
    {
      id: 'due_today',
      filter: 'due_today',
      labelClass: 'fu-glass-card__label',
      valueClass: 'fu-glass-card__value fu-glass-card__value--primary',
      sub: metrics.due_today > 0 ? t('followups.metrics.active') : undefined,
      subClass: 'fu-glass-card__sub fu-glass-card__sub--success',
      progress: dueTodayPct,
    },
    {
      id: 'overdue',
      filter: 'overdue',
      className: 'fu-glass-card--error',
      labelClass: 'fu-glass-card__label fu-glass-card__label--error',
      valueClass: 'fu-glass-card__value fu-glass-card__value--error',
      sub: metrics.overdue > 0 ? t('followups.metrics.requireAction') : undefined,
      subClass: 'fu-glass-card__sub fu-glass-card__sub--error',
    },
    {
      id: 'payment_pending',
      filter: 'payment_pending',
      sub: t('followups.metrics.awaitingLink'),
    },
    {
      id: 'hot_leads',
      filter: 'hot_leads',
      className: 'fu-glass-card--hot',
      labelClass: 'fu-glass-card__label fu-glass-card__label--primary',
      valueClass: 'fu-glass-card__value fu-glass-card__value--primary',
    },
    {
      id: 'done_today',
      sub: doneGoal ? t('followups.metrics.goal', { count: doneGoal }) : undefined,
      subClass: 'fu-glass-card__sub fu-glass-card__sub--success',
    },
    {
      id: 'converted',
      sub:
        metrics.done_today > 0
          ? t('followups.metrics.conversionRate', {
              rate: ((metrics.converted / Math.max(metrics.done_today, 1)) * 100).toFixed(1),
            })
          : undefined,
    },
    {
      id: 'missed',
      valueClass: 'fu-glass-card__value fu-glass-card__value--muted',
      sub: t('followups.metrics.yesterday'),
    },
  ];

  const visibleCards = hideEmpty ? cards.filter(card => metrics[card.id] > 0) : cards;
  if (visibleCards.length === 0) return null;

  return (
    <div className="fu-bento">
      {visibleCards.map(card => {
        const Tag = card.filter && onMetricClick ? 'button' : 'div';
        return (
          <Tag
            key={card.id}
            type={card.filter && onMetricClick ? 'button' : undefined}
            className={['fu-glass-card', card.className].filter(Boolean).join(' ')}
            onClick={card.filter && onMetricClick ? () => onMetricClick(card.filter!) : undefined}
          >
            <span className={card.labelClass ?? 'fu-glass-card__label'}>
              {t(`followups.metrics.${card.id}`)}
            </span>
            <div className="fu-glass-card__value-row">
              <span className={card.valueClass ?? 'fu-glass-card__value'}>{metrics[card.id]}</span>
            </div>
            {card.sub && <span className={card.subClass ?? 'fu-glass-card__sub'}>{card.sub}</span>}
            {card.progress != null && (
              <div className="fu-glass-card__progress">
                <div
                  className="fu-glass-card__progress-fill"
                  style={{ width: `${card.progress}%` }}
                />
              </div>
            )}
          </Tag>
        );
      })}
    </div>
  );
}
