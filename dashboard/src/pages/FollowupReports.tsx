import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { followupApi, type FollowupAutopilotReport, type FollowupAutopilotAuditEntry, type FollowupKpiReport } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { WorkspacePageHeader } from '../components/workspace';

export function FollowupReports() {
  const { t } = useTranslation();
  useDocumentTitle(t('followups.reports.title'));

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['followups', 'reports'],
    queryFn: () => followupApi.getReports(),
  });

  const { data: autopilotReport, isLoading: autopilotLoading } = useQuery({
    queryKey: ['followups', 'reports', 'autopilot'],
    queryFn: () => followupApi.getAutopilotReport(),
  });

  const { data: auditLog = [], isLoading: auditLoading } = useQuery({
    queryKey: ['followups', 'reports', 'autopilot-audit'],
    queryFn: () => followupApi.getAutopilotAudit({ limit: 30 }),
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['followups', 'staff'],
    queryFn: () => followupApi.listStaff(),
  });

  const staffName = (id: string) => staff.find(s => s.id === id)?.name ?? `${id.slice(0, 8)}…`;

  const totals = useMemo(() => {
    return reports.reduce(
      (acc, r) => ({
        due: acc.due + r.followupsDue,
        onTime: acc.onTime + r.followupsCompletedOnTime,
        late: acc.late + r.followupsCompletedLate,
        missed: acc.missed + r.followupsMissed,
        conversions: acc.conversions + r.conversionsAfterFollowup,
        lostWithout: acc.lostWithout + r.lostLeadsWithoutFollowup,
      }),
      { due: 0, onTime: 0, late: 0, missed: 0, conversions: 0, lostWithout: 0 },
    );
  }, [reports]);

  const autopilotCards = useMemo(() => {
    const r = autopilotReport as FollowupAutopilotReport | undefined;
    if (!r) return [];
    return [
      ['suggestionsCreated', r.suggestionsCreated],
      ['autoSent', r.autoSent],
      ['needsApproval', r.needsApproval],
      ['stopped', r.stopped],
      ['failed', r.failed],
      ['repliesReceived', r.repliesReceived],
      ['convertedSales', r.convertedSales],
      ['smsFallbackUsed', r.smsFallbackUsed],
      ['whatsappFailed', r.whatsappFailed],
    ] as const;
  }, [autopilotReport]);

  const handleExport = () => {
    const headers = [
      t('followups.reports.staff'),
      t('followups.reports.period'),
      t('followups.reports.due'),
      t('followups.reports.onTime'),
      t('followups.reports.late'),
      t('followups.reports.missed'),
      t('followups.reports.conversions'),
      t('followups.reports.lostWithout'),
    ];
    const lines = [
      headers.join(','),
      ...reports.map((r: FollowupKpiReport) =>
        [
          staffName(r.staffId),
          r.periodStart,
          r.followupsDue,
          r.followupsCompletedOnTime,
          r.followupsCompletedLate,
          r.followupsMissed,
          r.conversionsAfterFollowup,
          r.lostLeadsWithoutFollowup,
        ].join(','),
      ),
    ];
    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `followup-reports-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="followups-interakt">
      <WorkspacePageHeader
        title={t('followups.reports.title')}
        onExport={handleExport}
        exportDisabled={reports.length === 0}
        showSearch={false}
        showNewTask={false}
        extraActions={
          <>
            <Link to="/reports" className="fu-btn fu-btn--ghost">
              {t('reports.backToHub')}
            </Link>
            <Link to="/followups" className="fu-btn fu-btn--ghost">
              {t('followups.backToQueue')}
            </Link>
          </>
        }
      />

      <div className="followups-interakt__scroll">
        <section className="fu-reports-section">
          <h2 className="fu-reports-section__title">{t('followups.reports.autopilotTitle')}</h2>
          <p className="settings-hint settings-hint--muted">{t('followups.reports.autopilotHint')}</p>
          {autopilotLoading ? (
            <div className="followups-loading">
              <Loader2 className="spin" size={24} />
            </div>
          ) : autopilotCards.length === 0 ? (
            <div className="followups-empty">{t('followups.reports.autopilotEmpty')}</div>
          ) : (
            <div className="fu-bento" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
              {autopilotCards.map(([key, value]) => (
                <div key={key} className="fu-glass-card">
                  <span className="fu-glass-card__label">{t(`followups.reports.autopilot.${key}`)}</span>
                  <span className="fu-glass-card__value">{value}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="fu-reports-section">
          <h2 className="fu-reports-section__title">{t('followups.reports.autopilotAuditTitle')}</h2>
          <p className="settings-hint settings-hint--muted">{t('followups.reports.autopilotAuditHint')}</p>
          {auditLoading ? (
            <div className="followups-loading">
              <Loader2 className="spin" size={24} />
            </div>
          ) : auditLog.length === 0 ? (
            <div className="followups-empty">{t('followups.reports.autopilotAuditEmpty')}</div>
          ) : (
            <div className="fu-table-wrap fu-reports-table">
              <table className="fu-table">
                <thead>
                  <tr>
                    <th>{t('followups.reports.autopilotAudit.when')}</th>
                    <th>{t('followups.reports.autopilotAudit.status')}</th>
                    <th>{t('followups.reports.autopilotAudit.risk')}</th>
                    <th>{t('followups.reports.autopilotAudit.reason')}</th>
                    <th>{t('followups.reports.autopilotAudit.message')}</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLog.map((row: FollowupAutopilotAuditEntry) => (
                    <tr key={row.id}>
                      <td>{new Date(row.createdAt).toLocaleString()}</td>
                      <td>{row.resultStatus ?? '—'}</td>
                      <td>{row.riskLevel ?? '—'}</td>
                      <td>{row.decisionReason?.replace(/_/g, ' ') ?? '—'}</td>
                      <td style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.messageSent ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="fu-reports-section">
          <h2 className="fu-reports-section__title">{t('followups.reports.staffKpiTitle')}</h2>
          <div className="fu-bento" style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' }}>
            {(
              [
                ['due', totals.due],
                ['onTime', totals.onTime],
                ['late', totals.late],
                ['missed', totals.missed],
                ['conversions', totals.conversions],
                ['lostWithout', totals.lostWithout],
              ] as const
            ).map(([key, value]) => (
              <div key={key} className="fu-glass-card">
                <span className="fu-glass-card__label">{t(`followups.reports.${key}`)}</span>
                <span className="fu-glass-card__value">{value}</span>
              </div>
            ))}
          </div>

          {isLoading ? (
            <div className="followups-loading">
              <Loader2 className="spin" size={32} />
            </div>
          ) : reports.length === 0 ? (
            <div className="followups-empty">{t('followups.reports.empty')}</div>
          ) : (
            <div className="fu-table-wrap fu-reports-table">
              <table className="fu-table">
                <thead>
                  <tr>
                    <th>{t('followups.reports.staff')}</th>
                    <th>{t('followups.reports.period')}</th>
                    <th>{t('followups.reports.due')}</th>
                    <th>{t('followups.reports.onTime')}</th>
                    <th>{t('followups.reports.late')}</th>
                    <th>{t('followups.reports.missed')}</th>
                    <th>{t('followups.reports.conversions')}</th>
                    <th>{t('followups.reports.lostWithout')}</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r: FollowupKpiReport) => (
                    <tr key={`${r.staffId}-${r.periodStart}`}>
                      <td style={{ fontWeight: 600 }}>{staffName(r.staffId)}</td>
                      <td>{r.periodStart}</td>
                      <td>{r.followupsDue}</td>
                      <td>{r.followupsCompletedOnTime}</td>
                      <td>{r.followupsCompletedLate}</td>
                      <td>{r.followupsMissed}</td>
                      <td>{r.conversionsAfterFollowup}</td>
                      <td>{r.lostLeadsWithoutFollowup}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
