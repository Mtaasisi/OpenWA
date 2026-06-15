import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MessageCircle, FileText, Calendar, Trophy, XCircle } from 'lucide-react';
import { DashboardSection } from './DashboardSection';
import {
  DataTable,
  type DataTableColumn,
  ChannelBadge,
  AccountBadge,
  QuickActionButton,
  EmptyState,
} from './index';
import { PipelineLeadDetail } from '../PipelineLeadDetail';
import { useRole } from '../../hooks/useRole';
import { inboxLink, formatRelativeTime, formatCompactCurrency, type ThreadValue } from '../../lib/dashboard-metrics';
import { avatarInitials, pipelineStageLabelShort } from '../../pages/inbox-helpers';
import { displayName, isAiEscalationPipelineCard } from '../customers/customer-utils';
import type { PipelineCard } from '../../services/api';

interface DashboardHotLeadsProps {
  leads: PipelineCard[];
  compact?: boolean;
  quoteValueByThread?: Map<string, ThreadValue>;
}

function priorityBadgeClass(priority: string): string {
  const p = priority.toLowerCase();
  if (p.includes('hot') || p === 'high') return 'dash-opportunity-row__badge--hot';
  if (p.includes('warm') || p === 'medium') return 'dash-opportunity-row__badge--warm';
  return 'dash-opportunity-row__badge--neutral';
}

function priorityLabel(priority: string): string {
  if (!priority) return '—';
  const p = priority.toLowerCase();
  if (p.includes('hot') || p === 'high') return 'Hot';
  if (p.includes('warm') || p === 'medium') return 'Warm';
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

export function DashboardHotLeads({
  leads,
  compact = false,
  quoteValueByThread,
}: DashboardHotLeadsProps) {
  const { t } = useTranslation();
  const { canWrite } = useRole();
  const [selected, setSelected] = useState<PipelineCard | null>(null);

  const columns: DataTableColumn<PipelineCard>[] = [
    {
      key: 'customer',
      header: t('dashboard.controlRoom.columns.customer'),
      render: row => displayName(row, t('pipeline.unnamed'), t),
    },
    {
      key: 'channel',
      header: t('dashboard.controlRoom.columns.channel'),
      render: row => (
        <>
          <ChannelBadge channel="whatsapp" />
          <AccountBadge name={row.channel ?? row.source} />
        </>
      ),
    },
    {
      key: 'product',
      header: t('dashboard.controlRoom.columns.product'),
      render: row => row.productInterest ?? '—',
    },
    {
      key: 'stage',
      header: t('dashboard.controlRoom.columns.stage'),
      render: row => (
        <span
          className={
            isAiEscalationPipelineCard(row) ? 'dash-opportunity-row__badge--hot' : undefined
          }
        >
          {pipelineStageLabelShort(row.stage, t)}
        </span>
      ),
    },
    {
      key: 'staff',
      header: t('dashboard.controlRoom.columns.staff'),
      render: row => row.assignedStaffName ?? '—',
    },
    {
      key: 'next',
      header: t('dashboard.controlRoom.columns.nextAction'),
      render: row => row.nextAction ?? '—',
    },
    {
      key: 'last',
      header: t('dashboard.controlRoom.columns.lastMessage'),
      render: row =>
        formatRelativeTime(row.lastCustomerMessageAt ?? row.lastStaffMessageAt ?? '', t),
    },
    {
      key: 'actions',
      header: t('dashboard.controlRoom.columns.actions'),
      render: row => (
        <div className="ws-data-table__actions">
          {!row.isManual && row.sessionId !== 'manual' && (
            <QuickActionButton
              label={t('dashboard.controlRoom.actions.openChat')}
              to={inboxLink(row.sessionId, row.chatId)}
              icon={MessageCircle}
            />
          )}
          <QuickActionButton
            label={t('dashboard.controlRoom.actions.createQuote')}
            to={
              row.sessionId && row.chatId
                ? inboxLink(row.sessionId, row.chatId)
                : '/pipeline'
            }
            icon={FileText}
          />
          <QuickActionButton
            label={t('dashboard.controlRoom.actions.scheduleFollowup')}
            to={`/followups?conversation=${row.id}`}
            icon={Calendar}
          />
          {!isAiEscalationPipelineCard(row) && (
            <>
              <QuickActionButton
                label={t('dashboard.controlRoom.actions.markWon')}
                onClick={() => setSelected(row)}
                icon={Trophy}
              />
              <QuickActionButton
                label={t('dashboard.controlRoom.actions.markLost')}
                onClick={() => setSelected(row)}
                icon={XCircle}
              />
            </>
          )}
        </div>
      ),
    },
  ];

  const visibleLeads = leads.slice(0, compact ? 5 : 15);

  return (
    <DashboardSection
      title={t('dashboard.controlRoom.hotLeads')}
      linkTo="/pipeline"
      linkLabel={t('dashboard.controlRoom.openPipeline')}
    >
      {leads.length === 0 ? (
        <EmptyState
          title={t('dashboard.controlRoom.hotLeadsEmpty')}
          description={t('dashboard.controlRoom.hotLeadsEmptyDesc')}
        />
      ) : compact ? (
        <div className="dash-opportunity-list">
          {visibleLeads.map(row => {
            const name = displayName(row, t('pipeline.unnamed'), t);
            const href =
              !row.isManual && row.sessionId !== 'manual'
                ? inboxLink(row.sessionId, row.chatId)
                : '/pipeline';
            const threadValue = quoteValueByThread?.get(`${row.sessionId}:${row.chatId}`);
            return (
              <Link key={row.id} to={href} className="dash-opportunity-row">
                <div className="dash-opportunity-row__avatar" aria-hidden>
                  {avatarInitials(name)}
                </div>
                <div className="dash-opportunity-row__body">
                  <p className="dash-opportunity-row__name">{name}</p>
                  <p className="dash-opportunity-row__subtitle">
                    {row.productInterest ??
                      row.nextAction ??
                      pipelineStageLabelShort(row.stage, t)}
                  </p>
                </div>
                <div className="dash-opportunity-row__meta">
                  {threadValue != null && threadValue.amount > 0 && (
                    <p className="dash-opportunity-row__amount">
                      {formatCompactCurrency(threadValue.amount, threadValue.currency ?? '')}
                    </p>
                  )}
                  <span className={`dash-opportunity-row__badge ${priorityBadgeClass(row.priority)}`}>
                    {priorityLabel(row.priority)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <DataTable columns={columns} rows={visibleLeads} rowKey={r => r.id} />
      )}
      {selected && (
        <PipelineLeadDetail
          card={selected}
          canWrite={canWrite}
          onClose={() => setSelected(null)}
        />
      )}
    </DashboardSection>
  );
}
