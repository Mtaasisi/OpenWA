import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLinkedChannels } from '../hooks/useLinkedChannels';
import {
  WorkspacePageHeader,
  StatusBadge,
  ChannelBadge,
} from '../components/workspace';
import { getChannelDef, type ChannelId } from '../lib/channels';
import { MaterialSymbol } from '../components/MaterialSymbol';
import './Content.css';

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

const UPCOMING_POSTS: { id: 'launch' | 'promo' | 'story'; channelId: ChannelId }[] = [
  { id: 'launch', channelId: 'instagram' },
  { id: 'promo', channelId: 'facebook' },
  { id: 'story', channelId: 'tiktok' },
];

function buildCalendarCells(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ day: number | null; isToday: boolean }> = [];
  const today = new Date();
  for (let i = 0; i < firstDay; i++) cells.push({ day: null, isToday: false });
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      day: d,
      isToday:
        today.getFullYear() === year &&
        today.getMonth() === month &&
        today.getDate() === d,
    });
  }
  while (cells.length % 7 !== 0) cells.push({ day: null, isToday: false });
  return cells;
}

export function Content() {
  const { t, i18n } = useTranslation();
  const { hasSocialChannels } = useLinkedChannels();
  useDocumentTitle(t('content.pageTitle'));

  const now = new Date();
  const calendarCells = useMemo(
    () => buildCalendarCells(now.getFullYear(), now.getMonth()),
    [now.getFullYear(), now.getMonth()],
  );
  const monthLabel = now.toLocaleString(i18n.language, { month: 'long', year: 'numeric' });

  return (
    <div className="followups-interakt content-interakt">
      <WorkspacePageHeader
        title={t('content.pageTitle')}
        showSearch={false}
        showExport={false}
        showNewTask={false}
      />

      <div className="followups-interakt__scroll">
        <div className="fu-bento content-bento">
          <div className="fu-glass-card">
            <span className="fu-glass-card__label">{t('content.metrics.scheduled')}</span>
            <span className="fu-glass-card__value">0</span>
          </div>
          <div className="fu-glass-card">
            <span className="fu-glass-card__label">{t('content.metrics.drafts')}</span>
            <span className="fu-glass-card__value">0</span>
          </div>
          <div className="fu-glass-card">
            <span className="fu-glass-card__label">{t('content.metrics.published')}</span>
            <span className="fu-glass-card__value">0</span>
          </div>
        </div>

        <div className="content-coming-soon-strip">
          <StatusBadge variant="coming-soon">{t('nav.comingSoon')}</StatusBadge>
          <p>{t('content.comingSoonDescription')}</p>
          {!hasSocialChannels && (
            <p className="content-panel__connect-hint">
              {t('content.connectSocialHint')}{' '}
              <Link to="/channels">{t('content.connectSocialCta')}</Link>
            </p>
          )}
        </div>

        <div className="content-layout">
          <section className="content-calendar fu-glass-card" aria-label={t('content.calendar.title')}>
            <header className="content-section__head">
              <h3>{t('content.calendar.title')}</h3>
              <span className="content-calendar__month">{monthLabel}</span>
            </header>
            <div className="content-calendar__weekdays">
              {WEEKDAY_KEYS.map(key => (
                <span key={key}>{t(`content.calendar.weekdays.${key}`)}</span>
              ))}
            </div>
            <div className="content-calendar__grid">
              {calendarCells.map((cell, idx) => (
                <div
                  key={idx}
                  className={[
                    'content-calendar__cell',
                    cell.day == null ? 'content-calendar__cell--empty' : '',
                    cell.isToday ? 'content-calendar__cell--today' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {cell.day != null && <span>{cell.day}</span>}
                </div>
              ))}
            </div>
          </section>

          <section className="content-upcoming fu-glass-card" aria-label={t('content.upcoming.title')}>
            <header className="content-section__head">
              <h3>{t('content.upcoming.title')}</h3>
            </header>
            <ul className="content-upcoming__list">
              {UPCOMING_POSTS.map(post => {
                const def = getChannelDef(post.channelId);
                return (
                  <li key={post.id} className="content-upcoming__item">
                    <div className="content-upcoming__item-main">
                      <p className="content-upcoming__item-title">
                        {t(`content.placeholders.${post.id}.title`)}
                      </p>
                      <p className="content-upcoming__item-meta">
                        {t(`content.placeholders.${post.id}.schedule`)}
                      </p>
                    </div>
                    {def && (
                      <ChannelBadge channelId={post.channelId} forceShow disabled />
                    )}
                    <MaterialSymbol name="schedule" size={18} className="content-upcoming__item-icon" />
                  </li>
                );
              })}
            </ul>
            <p className="content-upcoming__hint">{t('content.upcoming.hint')}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
