import { useTranslation } from 'react-i18next';
import { MessageCircle, Send, FileText, CheckCircle, Megaphone } from 'lucide-react';
import { MaterialSymbol } from '../MaterialSymbol';
import { DashboardSection } from './DashboardSection';
import { AccountBadge, QuickActionButton, EmptyState } from './index';
import { inboxLink, formatRelativeTime, type WorkQueueItem } from '../../lib/dashboard-metrics';

interface DashboardTodaysWorkProps {
  items: WorkQueueItem[];
}

function workKindSymbol(kind: WorkQueueItem['kind']): string {
  switch (kind) {
    case 'followup':
      return 'event_repeat';
    case 'quote':
      return 'request_quote';
    case 'ai-stocking':
      return 'inventory_2';
    case 'ai-learning':
      return 'school';
    case 'demand-campaign':
      return 'campaign';
    case 'profile-name-review':
      return 'person_search';
    case 'profile-learning-review':
      return 'school';
    case 'lost-demand-waiting':
      return 'inventory_2';
    case 'ai-escalation':
      return 'psychology';
    case 'wa-queue-approval':
      return 'pending_actions';
    case 'wa-health-alert':
      return 'health_and_safety';
    default:
      return 'chat';
  }
}

function workKindTone(kind: WorkQueueItem['kind']): string {
  switch (kind) {
    case 'followup':
      return 'dash-work-card--due';
    case 'quote':
      return 'dash-work-card--quote';
    default:
      return '';
  }
}

export function DashboardTodaysWork({ items }: DashboardTodaysWorkProps) {
  const { t } = useTranslation();

  return (
    <DashboardSection
      title={t('dashboard.controlRoom.todaysWork')}
      icon={<MaterialSymbol name="today" size={20} className="dash-section__title-icon" />}
      badge={items.length > 0 ? items.length : undefined}
      linkTo="/followups"
      linkLabel={t('dashboard.controlRoom.viewAllWork')}
    >
      {items.length === 0 ? (
        <EmptyState
          title={t('dashboard.controlRoom.workEmpty')}
          description={t('dashboard.controlRoom.workEmptyDesc')}
        />
      ) : (
        <div className="dash-work-queue">
          {items.map(item => (
            <article key={item.id} className={`dash-work-card ${workKindTone(item.kind)}`.trim()}>
              <div className="dash-work-card__icon-well" aria-hidden>
                <MaterialSymbol name={workKindSymbol(item.kind)} size={20} />
              </div>
              <div className="dash-work-card__main">
                <div className="dash-work-card__top">
                  <span className="dash-work-card__customer">{item.customer}</span>
                  {item.dueAt && (
                    <span className="dash-work-card__due">{formatRelativeTime(item.dueAt, t)}</span>
                  )}
                </div>
                <p className="dash-work-card__reason">{t(item.reasonKey)}</p>
                <div className="dash-work-card__meta">
                  <AccountBadge name={item.accountName} subtitle={item.assignedStaff ?? undefined} />
                </div>
                <div className="dash-work-card__actions">
                  {item.sessionId && item.chatId && (
                    <QuickActionButton
                      label={t('dashboard.controlRoom.actions.openChat')}
                      to={inboxLink(item.sessionId, item.chatId)}
                      icon={MessageCircle}
                    />
                  )}
                  {item.kind === 'followup' && item.conversationId && (
                    <QuickActionButton
                      label={t('dashboard.controlRoom.actions.sendFollowup')}
                      to={`/followups?conversation=${item.conversationId}`}
                      icon={Send}
                    />
                  )}
                  {item.kind === 'quote' && item.sessionId && item.chatId && (
                    <QuickActionButton
                      label={t('dashboard.controlRoom.actions.createQuote')}
                      to={inboxLink(item.sessionId, item.chatId)}
                      icon={FileText}
                    />
                  )}
                  {item.kind === 'followup' && (
                    <QuickActionButton
                      label={t('dashboard.controlRoom.actions.markDone')}
                      to="/followups"
                      icon={CheckCircle}
                    />
                  )}
                  {item.kind === 'demand-campaign' && item.actionTo && (
                    <QuickActionButton
                      label={t('dashboard.controlRoom.actions.openCampaigns')}
                      to={item.actionTo}
                      icon={Megaphone}
                    />
                  )}
                  {(item.kind === 'wa-queue-approval' || item.kind === 'wa-health-alert') &&
                    item.actionTo && (
                      <QuickActionButton
                        label={
                          item.kind === 'wa-queue-approval'
                            ? t('dashboard.controlRoom.actions.reviewWaQueue')
                            : t('dashboard.controlRoom.actions.viewWaSafety')
                        }
                        to={item.actionTo}
                        icon={CheckCircle}
                      />
                    )}
                  {(item.kind === 'profile-name-review' ||
                    item.kind === 'profile-learning-review' ||
                    item.kind === 'lost-demand-waiting') &&
                    item.actionTo && (
                      <QuickActionButton
                        label={
                          item.kind === 'lost-demand-waiting'
                            ? t('dashboard.controlRoom.actions.viewFollowups')
                            : t('dashboard.controlRoom.actions.openCustomers', {
                                defaultValue: 'Open Customers',
                              })
                        }
                        to={item.actionTo}
                        icon={item.kind === 'lost-demand-waiting' ? Send : CheckCircle}
                      />
                    )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </DashboardSection>
  );
}
