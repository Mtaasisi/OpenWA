import { useState, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { followupApi } from '../services/api';
import { productsApi } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useFollowupPermissions } from '../hooks/useFollowupPermissions';
import { WorkspacePageHeader } from '../components/workspace';
import { leadSourceLabel, LEAD_SOURCES } from '../lib/lead-sources';
import { LeadSourceBadge } from '../components/LeadSourceBadge';
import { displayName } from '../components/customers/customer-utils';
import './Pipeline.css';

type ReportRange = '7d' | '30d' | '90d' | 'all';

const REPORT_RANGE_CHIPS: { id: ReportRange; labelKey: string }[] = [
  { id: '7d', labelKey: 'pipeline.reports.last7days' },
  { id: '30d', labelKey: 'pipeline.reports.last30days' },
  { id: '90d', labelKey: 'pipeline.reports.last90days' },
  { id: 'all', labelKey: 'pipeline.reports.allTime' },
];

function reportRangeDates(range: ReportRange): { from?: string; to?: string } {
  if (range === 'all') return {};
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  const from = new Date();
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  from.setDate(from.getDate() - days);
  from.setHours(0, 0, 0, 0);
  return { from: from.toISOString(), to: to.toISOString() };
}

function pct(won: number, total: number) {
  if (total === 0) return '0%';
  return `${Math.round((won / total) * 1000) / 10}%`;
}

function ReportSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="pipeline-reports-section fu-glass-card">
      <h3 className="pipeline-reports-section__title">{title}</h3>
      {children}
    </section>
  );
}

export function PipelineReports() {
  const { t } = useTranslation();
  useDocumentTitle(t('pipeline.reports.title'));
  const { canViewLeadSourceReports, isLoading: loadingPerms } = useFollowupPermissions();
  const [reportRange, setReportRange] = useState<ReportRange>('30d');
  const { from, to } = useMemo(() => reportRangeDates(reportRange), [reportRange]);

  const { data: inauzwaStatus } = useQuery({
    queryKey: ['products', 'inauzwa-status'],
    queryFn: () => productsApi.inauzwaSyncStatus(),
  });
  const branchId = inauzwaStatus?.preferences.branchId ?? inauzwaStatus?.branchId ?? undefined;

  const { data: conversion, isLoading: loadingConv } = useQuery({
    queryKey: ['pipeline', 'reports', 'conversion', branchId, from, to],
    queryFn: () => followupApi.getConversionReport(branchId, from, to),
  });

  const { data: leadSources, isLoading: loadingSources } = useQuery({
    queryKey: ['pipeline', 'reports', 'lead-sources', branchId, from, to],
    queryFn: () => followupApi.getLeadSourceReport(branchId, from, to),
    enabled: canViewLeadSourceReports,
  });

  const { data: abandoned = [], isLoading: loadingAbandoned } = useQuery({
    queryKey: ['pipeline', 'reports', 'abandoned', branchId],
    queryFn: () => followupApi.getAbandonedLeads(branchId),
  });

  const { data: paymentPending = [] } = useQuery({
    queryKey: ['pipeline', 'reports', 'payment-pending', branchId],
    queryFn: () => followupApi.getPaymentPendingLeads(branchId),
  });

  const { data: lostReasons = {} } = useQuery({
    queryKey: ['pipeline', 'reports', 'lost-reasons', branchId],
    queryFn: () => followupApi.getLostReasonReport(branchId),
  });

  const { data: dashboard } = useQuery({
    queryKey: ['pipeline', 'dashboard', branchId],
    queryFn: () => followupApi.getPipelineDashboard(branchId),
  });

  const isLoading = loadingPerms || loadingConv || loadingAbandoned || (canViewLeadSourceReports && loadingSources);

  return (
    <div className="followups-interakt pipeline-reports-interakt">
      <WorkspacePageHeader
        title={t('pipeline.reports.title')}
        showSearch={false}
        showExport={false}
        showNewTask={false}
        extraActions={
          <>
            <Link to="/reports" className="fu-btn fu-btn--ghost">
              {t('reports.backToHub')}
            </Link>
            <Link to="/pipeline" className="fu-btn fu-btn--ghost">
              {t('pipeline.backToPipeline')}
            </Link>
          </>
        }
      />

      <div className="followups-interakt__scroll">
        <div className="fu-view-row pipeline-reports-range">
          <span className="pipeline-reports-range__label">{t('pipeline.reports.dateRange')}</span>
          <div className="fu-chips">
            {REPORT_RANGE_CHIPS.map(chip => (
              <button
                key={chip.id}
                type="button"
                className={['fu-chip', reportRange === chip.id ? 'fu-chip--active' : ''].filter(Boolean).join(' ')}
                onClick={() => setReportRange(chip.id)}
              >
                {t(chip.labelKey)}
              </button>
            ))}
          </div>
        </div>

        {dashboard && (
          <div className="fu-bento pipeline-reports-bento">
            <div className="fu-glass-card">
              <span className="fu-glass-card__label">{t('pipeline.stats.leadsToday')}</span>
              <span className="fu-glass-card__value">{dashboard.totalLeadsToday}</span>
            </div>
            <div className="fu-glass-card">
              <span className="fu-glass-card__label">{t('pipeline.stats.paymentPending')}</span>
              <span className="fu-glass-card__value">{dashboard.paymentPending}</span>
            </div>
            <div className="fu-glass-card">
              <span className="fu-glass-card__label">{t('pipeline.stats.avgResponse')}</span>
              <span className="fu-glass-card__value">{dashboard.averageResponseTimeSeconds}s</span>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="followups-loading">
            <Loader2 className="spin" size={32} />
          </div>
        ) : (
          <>
            <ReportSection title={t('pipeline.reports.conversionBySource')}>
              <div className="fu-table-wrap fu-reports-table">
                <table className="fu-table">
                  <thead>
                    <tr>
                      <th>{t('pipeline.source')}</th>
                      <th>Total</th>
                      <th>Won</th>
                      <th>Lost</th>
                      <th>Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conversion &&
                      Object.entries(conversion.bySource).map(([src, row]) => (
                        <tr key={src}>
                          <td><LeadSourceBadge source={src} className="lead-source-badge--sm" /></td>
                          <td>{row.total}</td>
                          <td>{row.won}</td>
                          <td>{row.lost}</td>
                          <td>{pct(row.won, row.total)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </ReportSection>

            {canViewLeadSourceReports && leadSources && (
              <>
                <ReportSection title={t('leadSources.reports.salesBySource')}>
                  <div className="fu-table-wrap fu-reports-table">
                    <table className="fu-table">
                      <thead>
                        <tr>
                          <th>{t('pipeline.source')}</th>
                          <th>{t('leadSources.reports.leads')}</th>
                          <th>{t('leadSources.reports.sales')}</th>
                          <th>{t('leadSources.reports.revenue')}</th>
                          <th>{t('leadSources.reports.grossProfit')}</th>
                          <th>{t('leadSources.reports.conversionRate')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.keys({
                          ...leadSources.leadsBySource,
                          ...leadSources.salesBySource,
                        }).map(src => (
                          <tr key={src}>
                            <td><LeadSourceBadge source={src} className="lead-source-badge--sm" /></td>
                            <td>{leadSources.leadsBySource[src] ?? 0}</td>
                            <td>{leadSources.salesBySource[src] ?? 0}</td>
                            <td>{(leadSources.revenueBySource[src] ?? 0).toLocaleString()}</td>
                            <td>{(leadSources.grossProfitBySource[src] ?? 0).toLocaleString()}</td>
                            <td>{leadSources.conversionBySource[src]?.rate ?? 0}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ReportSection>

                <ReportSection title={t('leadSources.reports.lostBySource')}>
                  <div className="fu-table-wrap fu-reports-table">
                    <table className="fu-table">
                      <thead>
                        <tr>
                          <th>{t('pipeline.source')}</th>
                          <th>{t('leadSources.reports.lost')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(leadSources.lostLeadsBySource).map(([src, count]) => (
                          <tr key={src}>
                            <td><LeadSourceBadge source={src} className="lead-source-badge--sm" /></td>
                            <td>{count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ReportSection>

                {Object.keys(leadSources.leadsByStaffAndSource).length > 0 && (
                  <ReportSection title={t('leadSources.reports.leadsByStaffSource')}>
                    <div className="fu-table-wrap fu-reports-table">
                      <table className="fu-table">
                        <thead>
                          <tr>
                            <th>Staff</th>
                            {LEAD_SOURCES.map(src => (
                              <th key={src}>{leadSourceLabel(src, t)}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(leadSources.leadsByStaffAndSource).map(([staff, bySrc]) => (
                            <tr key={staff}>
                              <td>{staff === 'unassigned' ? t('pipeline.unassigned') : staff}</td>
                              {LEAD_SOURCES.map(src => (
                                <td key={src}>{bySrc[src] ?? 0}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </ReportSection>
                )}
              </>
            )}

            {!canViewLeadSourceReports && !loadingPerms && (
              <ReportSection title={t('leadSources.reports.salesBySource')}>
                <p className="pipeline-reports-muted">{t('leadSources.reports.noPermission')}</p>
              </ReportSection>
            )}

            <ReportSection title={t('pipeline.reports.conversionByStaff')}>
              <div className="fu-table-wrap fu-reports-table">
                <table className="fu-table">
                  <thead>
                    <tr>
                      <th>Staff</th>
                      <th>Total</th>
                      <th>Won</th>
                      <th>Lost</th>
                      <th>Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conversion &&
                      Object.entries(conversion.byStaff).map(([name, row]) => (
                        <tr key={name}>
                          <td>{name === 'unassigned' ? t('pipeline.unassigned') : name}</td>
                          <td>{row.total}</td>
                          <td>{row.won}</td>
                          <td>{row.lost}</td>
                          <td>{pct(row.won, row.total)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </ReportSection>

            <ReportSection title={t('pipeline.stats.lostReasons')}>
              {Object.keys(lostReasons).length === 0 ? (
                <p className="pipeline-reports-muted">{t('pipeline.reports.lostReasonsEmpty')}</p>
              ) : (
                <div className="fu-table-wrap fu-reports-table">
                  <table className="fu-table">
                    <thead>
                      <tr>
                        <th>{t('pipeline.lostReason')}</th>
                        <th>Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(lostReasons)
                        .sort((a, b) => b[1] - a[1])
                        .map(([reason, count]) => (
                          <tr key={reason}>
                            <td>{reason}</td>
                            <td>{count}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </ReportSection>

            <ReportSection title={t('pipeline.reports.paymentPendingList')}>
              {paymentPending.length === 0 ? (
                <p className="pipeline-reports-muted">{t('pipeline.reports.paymentPendingEmpty')}</p>
              ) : (
                <div className="fu-table-wrap fu-reports-table">
                  <table className="fu-table">
                    <thead>
                      <tr>
                        <th>{t('common.name')}</th>
                        <th>{t('pipeline.source')}</th>
                        <th>{t('followups.stage')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentPending.map(c => (
                        <tr key={c.id}>
                          <td>{displayName(c, t('pipeline.unnamed'))}</td>
                          <td><LeadSourceBadge source={c.source} className="lead-source-badge--sm" /></td>
                          <td>{c.stage}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </ReportSection>

            <ReportSection title={t('pipeline.reports.abandoned')}>
              {abandoned.length === 0 ? (
                <p className="pipeline-reports-muted">{t('pipeline.reports.abandonedEmpty')}</p>
              ) : (
                <div className="fu-table-wrap fu-reports-table">
                  <table className="fu-table">
                    <thead>
                      <tr>
                        <th>{t('common.name')}</th>
                        <th>{t('pipeline.source')}</th>
                        <th>{t('followups.stage')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {abandoned.map(c => (
                        <tr key={c.id}>
                          <td>{displayName(c, t('pipeline.unnamed'))}</td>
                          <td><LeadSourceBadge source={c.source} className="lead-source-badge--sm" /></td>
                          <td>{c.stage}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </ReportSection>
          </>
        )}
      </div>
    </div>
  );
}
