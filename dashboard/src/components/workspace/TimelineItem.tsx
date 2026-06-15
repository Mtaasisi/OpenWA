import type { ReactNode } from 'react';

type TimelineItemProps = {
  title?: string;
  action?: string;
  meta?: string;
  time?: string;
  icon?: ReactNode;
  children?: ReactNode;
  variant?: 'dot' | 'feed';
};

export function TimelineItem({
  title,
  action,
  meta,
  time,
  icon,
  children,
  variant = 'feed',
}: TimelineItemProps) {
  const displayTitle = action ?? title ?? '';

  if (variant === 'dot') {
    return (
      <div className="ws-timeline-item ws-timeline-item--dot">
        <span className="ws-timeline-item__dot" />
        <div>
          <p className="ws-timeline-item__title">{displayTitle}</p>
          {meta && <p className="ws-timeline-item__meta">{meta}</p>}
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="ws-timeline-item ws-timeline-item--feed">
      {icon && <div className="ws-timeline-item__icon">{icon}</div>}
      <div className="ws-timeline-item__body">
        <p className="ws-timeline-item__title">{displayTitle}</p>
        {meta && <p className="ws-timeline-item__meta">{meta}</p>}
        {children}
      </div>
      {time && <time className="ws-timeline-item__time">{time}</time>}
    </div>
  );
}
