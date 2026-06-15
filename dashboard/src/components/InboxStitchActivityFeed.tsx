import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  InboxThreadTimeline,
  type StitchActivityFilter,
} from './inbox-workspace/InboxThreadTimeline';

type Props = {
  sessionId: string;
  chatId: string;
};

const FILTER_OPTIONS: { key: StitchActivityFilter; labelKey: string }[] = [
  { key: 'all', labelKey: 'inbox.stitch.activityFilterAll' },
  { key: 'messages', labelKey: 'inbox.stitch.activityFilterMessages' },
  { key: 'system', labelKey: 'inbox.stitch.activityFilterSystem' },
];

export function InboxStitchActivityFeed({ sessionId, chatId }: Props) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<StitchActivityFilter>('all');
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const activeLabel = FILTER_OPTIONS.find(o => o.key === filter)?.labelKey ?? FILTER_OPTIONS[0].labelKey;

  return (
    <div className="inbox-stitch-activity-feed">
      <div className="inbox-stitch-activity-feed__head">
        <h4 className="inbox-stitch-activity-feed__title">{t('inbox.stitch.activityFeed')}</h4>
        <div className="inbox-stitch-activity-feed__filter-wrap" ref={wrapRef}>
          <button
            type="button"
            className={`inbox-stitch-activity-feed__filter${menuOpen ? ' is-open' : ''}`}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(v => !v)}
          >
            {filter === 'all' ? t('inbox.stitch.activityFilter') : t(activeLabel)}
          </button>
          {menuOpen ? (
            <div className="inbox-stitch-activity-filter-menu" role="menu">
              {FILTER_OPTIONS.map(option => (
                <button
                  key={option.key}
                  type="button"
                  role="menuitem"
                  className={`inbox-stitch-activity-filter-menu__item${
                    filter === option.key ? ' is-active' : ''
                  }`}
                  onClick={() => {
                    setFilter(option.key);
                    setMenuOpen(false);
                  }}
                >
                  {t(option.labelKey)}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <InboxThreadTimeline
        sessionId={sessionId}
        chatId={chatId}
        compact
        variant="stitch"
        activityFilter={filter}
      />
    </div>
  );
}
