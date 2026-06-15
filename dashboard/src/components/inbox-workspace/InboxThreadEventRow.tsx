import { useTranslation } from 'react-i18next';
import type { InboxThreadEventRow as ThreadEvent } from '../../services/api';
import './InboxThreadEventRow.css';

type Props = {
  event: ThreadEvent;
  formatTime: (iso: string) => string;
  variant?: 'classic' | 'interakt' | 'tactical' | 'stitch';
};

export function threadEventLabel(
  eventType: string,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  const key = `inbox.threadEvents.${eventType}`;
  const translated = t(key, { defaultValue: '' });
  if (translated) return translated;
  return eventType.replace(/_/g, ' ');
}

export function InboxThreadEventRow({ event, formatTime, variant = 'classic' }: Props) {
  const { t } = useTranslation();
  const title = event.summary?.trim() || threadEventLabel(event.eventType, t);
  const meta = [
    threadEventLabel(event.eventType, t),
    event.actorName,
    formatTime(event.createdAt),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      className={`inbox-thread-event-row inbox-thread-event-row--${variant}`}
      role="listitem"
      aria-label={title}
    >
      <div className="inbox-thread-event-row__pill">
        <span className="inbox-thread-event-row__title">{title}</span>
        <span className="inbox-thread-event-row__meta">{meta}</span>
      </div>
    </div>
  );
}
