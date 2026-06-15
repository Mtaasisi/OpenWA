import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { MaterialSymbol } from '../MaterialSymbol';
import { inboxApi, type InboxThreadEventRow } from '../../services/api';
import { formatMessageTime } from '../../pages/inbox-helpers';
import './InboxThreadTimeline.css';

export type StitchActivityFilter = 'all' | 'messages' | 'system';

type Props = {
  sessionId: string;
  chatId: string;
  compact?: boolean;
  variant?: 'default' | 'stitch';
  activityFilter?: StitchActivityFilter;
};

function eventLabel(eventType: string, t: ReturnType<typeof useTranslation>['t']): string {
  const key = `inbox.threadEvents.${eventType}`;
  const translated = t(key, { defaultValue: '' });
  if (translated) return translated;
  return eventType.replace(/_/g, ' ');
}

function isMessageEvent(eventType: string): boolean {
  return eventType === 'staff_message_sent' || eventType === 'ai_replied';
}

function looksLikeDocument(summary: string | null): boolean {
  if (!summary) return false;
  return /\.(pdf|docx?|xlsx?|png|jpe?g|webp)$/i.test(summary.trim());
}

function documentFileName(summary: string | null): string | null {
  if (!summary) return null;
  const trimmed = summary.trim();
  if (looksLikeDocument(trimmed)) return trimmed;
  const match = trimmed.match(/['"]([^'"]+\.(pdf|docx?|xlsx?|png|jpe?g|webp))['"]/i);
  return match?.[1] ?? null;
}

function stitchTimelineDate(iso: string, t: ReturnType<typeof useTranslation>['t']): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = new Date();
  const timePart = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) {
    return t('inbox.stitch.timelineToday', { time: timePart, defaultValue: `Today, ${timePart}` });
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return t('inbox.stitch.timelineYesterday', { defaultValue: 'Yesterday' });
  }
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays > 1 && diffDays < 14) {
    return t('inbox.stitch.timelineDaysAgo', { count: diffDays, defaultValue: `${diffDays} days ago` });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function stitchEventTitle(
  event: InboxThreadEventRow,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  if (event.summary?.trim()) {
    const docName = documentFileName(event.summary);
    if (docName) {
      return t('inbox.stitch.timelineDocumentUploaded', {
        name: docName.replace(/\.[^.]+$/, '').replace(/_/g, ' '),
        defaultValue: `Document '${docName.replace(/\.[^.]+$/, '').replace(/_/g, ' ')}' uploaded`,
      });
    }
  }

  const actor = event.actorName?.trim();
  switch (event.eventType) {
    case 'staff_message_sent':
      return actor
        ? t('inbox.stitch.timelineMessageSentBy', { name: actor, defaultValue: `Message sent by ${actor}` })
        : t('inbox.threadEvents.staff_message_sent');
    case 'ai_replied':
      return t('inbox.stitch.timelineAiReplied', { defaultValue: 'AI auto-reply sent' });
    case 'human_took_over':
      return actor
        ? t('inbox.stitch.timelineStaffTookOver', { name: actor, defaultValue: `${actor} took over from AI` })
        : t('inbox.threadEvents.human_took_over');
    default:
      return event.summary?.trim() || eventLabel(event.eventType, t);
  }
}

function stitchEventExcerpt(event: InboxThreadEventRow): string | null {
  const summary = event.summary?.trim();
  if (!summary || looksLikeDocument(summary)) return null;
  if (isMessageEvent(event.eventType)) {
    const quoted = summary.replace(/^["']|["']$/g, '');
    return quoted.length > 0 ? `"${quoted}"` : null;
  }
  if (event.eventType === 'human_took_over' || event.eventType === 'ai_resumed') return null;
  return summary.length > 120 ? `${summary.slice(0, 117)}...` : summary;
}

function filterEvents(events: InboxThreadEventRow[], filter: StitchActivityFilter): InboxThreadEventRow[] {
  if (filter === 'all') return events;
  if (filter === 'messages') return events.filter(e => isMessageEvent(e.eventType));
  return events.filter(e => !isMessageEvent(e.eventType));
}

function StitchTimelineItem({
  event,
  isLatest,
  t,
}: {
  event: InboxThreadEventRow;
  isLatest: boolean;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  const title = stitchEventTitle(event, t);
  const excerpt = stitchEventExcerpt(event);
  const docName = documentFileName(event.summary);

  return (
    <li className="inbox-thread-timeline-stitch__item">
      <span
        className={`inbox-thread-timeline-stitch__dot${isLatest ? ' is-latest' : ''}`}
        aria-hidden
      />
      <div className="inbox-thread-timeline-stitch__content">
        <span className="inbox-thread-timeline-stitch__date">
          {stitchTimelineDate(event.createdAt, t)}
        </span>
        <p className="inbox-thread-timeline-stitch__title">{title}</p>
        {excerpt ? <p className="inbox-thread-timeline-stitch__excerpt">{excerpt}</p> : null}
        {docName ? (
          <div className="inbox-thread-timeline-stitch__doc">
            <MaterialSymbol name="description" size={16} className="inbox-thread-timeline-stitch__doc-icon" />
            <span>{docName}</span>
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function InboxThreadTimeline({
  sessionId,
  chatId,
  compact,
  variant = 'default',
  activityFilter = 'all',
}: Props) {
  const { t } = useTranslation();
  const { data = [], isLoading } = useQuery({
    queryKey: ['inbox', 'thread-events', sessionId, chatId],
    queryFn: () => inboxApi.getThreadEvents(sessionId, chatId),
    enabled: Boolean(sessionId && chatId),
    staleTime: 30_000,
  });

  const filtered = useMemo(() => filterEvents(data, activityFilter), [data, activityFilter]);

  if (isLoading) {
    return (
      <p className="inbox-thread-timeline__muted">
        <Loader2 size={14} className="animate-spin" aria-hidden /> {t('common.loading')}
      </p>
    );
  }

  if (filtered.length === 0) {
    return compact ? (
      <section className="inbox-interakt-crm-activity-empty animate-in">
        <p className="inbox-interakt-crm-activity-empty__title">
          {t('inbox.interakt.activityEmptyTitle', { defaultValue: 'No activity yet' })}
        </p>
        <p className="inbox-interakt-crm-activity-empty__desc">
          {t('inbox.interakt.activityEmptyDesc', {
            defaultValue: 'Takeover, sends, and AI events will appear here.',
          })}
        </p>
      </section>
    ) : (
      <p className="inbox-crm-muted">{t('workspace.emptyDefault')}</p>
    );
  }

  if (variant === 'stitch') {
    return (
      <ul className="inbox-thread-timeline-stitch" aria-label={t('inbox.crm.tabTimeline', { defaultValue: 'Timeline' })}>
        {filtered.map((row, index) => (
          <StitchTimelineItem key={row.id} event={row} isLatest={index === 0} t={t} />
        ))}
      </ul>
    );
  }

  return (
    <ul className="inbox-thread-timeline" aria-label={t('inbox.crm.tabTimeline', { defaultValue: 'Timeline' })}>
      {filtered.map(row => (
        <li key={row.id} className="inbox-thread-timeline__item">
          <span className="inbox-thread-timeline__dot" aria-hidden />
          <div className="inbox-thread-timeline__body">
            <p className="inbox-thread-timeline__title">
              {row.summary?.trim() || eventLabel(row.eventType, t)}
            </p>
            <p className="inbox-thread-timeline__meta">
              {eventLabel(row.eventType, t)}
              {row.actorName ? ` · ${row.actorName}` : ''}
              {' · '}
              {formatMessageTime(row.createdAt)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
