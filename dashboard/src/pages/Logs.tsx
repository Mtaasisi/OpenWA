import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Download, Loader2, FileText, Trash2 } from 'lucide-react';
import type { AuditLog } from '../services/api';
import { auditApi } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useRole } from '../hooks/useRole';
import { useLogsQuery } from '../hooks/queries';
import { WorkspacePageHeader, EmptyState, StatusBadge } from '../components/workspace';
import type { StatusBadgeVariant } from '../components/workspace/StatusBadge';
import { MaterialSymbol } from '../components/MaterialSymbol';
import './Logs.css';

const AUDIT_ACTIONS = [
  'session_created',
  'session_started',
  'session_stopped',
  'session_deleted',
  'session_qr_generated',
  'session_connected',
  'session_disconnected',
  'message_sent',
  'message_failed',
  'api_key_created',
  'webhook_created',
] as const;

function logsToCsv(rows: AuditLog[]): string {
  const header = ['timestamp', 'action', 'session', 'details', 'api_key', 'ip', 'severity'];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const detailFor = (log: AuditLog) => {
    const reason = log.metadata?.reason;
    if (typeof reason === 'string' && reason) return reason;
    if (log.errorMessage) return log.errorMessage;
    return '';
  };
  const lines = rows.map(log =>
    [
      log.createdAt,
      log.action,
      log.sessionName || log.sessionId || '',
      detailFor(log),
      log.apiKeyName || '',
      log.ipAddress || '',
      log.severity,
    ]
      .map(v => escape(String(v)))
      .join(','),
  );
  return [header.join(','), ...lines].join('\n');
}

function logDetail(log: AuditLog): string {
  const reason = log.metadata?.reason;
  if (typeof reason === 'string' && reason) return reason;
  if (log.errorMessage) return log.errorMessage;
  return '—';
}

function severityVariant(severity: string): StatusBadgeVariant {
  if (severity === 'error') return 'error';
  if (severity === 'warn') return 'warning';
  return 'info';
}

export function Logs({ embedded = false }: { embedded?: boolean } = {}) {
  const { t } = useTranslation();
  useDocumentTitle(embedded ? t('settings.title') : t('logs.title'));
  const { isAdmin } = useRole();
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
  const limit = 20;

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const severityParam = severityFilter !== 'all' ? severityFilter : undefined;
  const actionParam = actionFilter !== 'all' ? actionFilter : undefined;

  const { data, isLoading: loading, refetch } = useLogsQuery({
    severity: severityParam,
    action: actionParam,
    q: searchQuery || undefined,
    page,
    limit,
  });

  const logs: AuditLog[] = data?.data ?? [];
  const total: number = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const formatTimestamp = (date: string) => new Date(date).toLocaleString();

  const sessionLabel = (log: AuditLog) => {
    if (log.sessionName) return log.sessionName;
    if (log.sessionId) return log.sessionId.substring(0, 12);
    return '—';
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const { data: all } = await auditApi.list({
        severity: severityParam,
        action: actionParam,
        q: searchQuery || undefined,
        limit: Math.min(total || 5000, 5000),
        offset: 0,
      });
      const blob = new Blob([logsToCsv(all)], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `openwa-audit-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setToast(err instanceof Error ? err.message : t('logs.exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  const handleCleanupQrNoise = async () => {
    if (!window.confirm(t('logs.cleanupQrConfirm'))) return;
    setCleaning(true);
    try {
      const { deleted } = await auditApi.cleanupQrPollNoise();
      setToast(t('logs.cleanupQrDone', { count: deleted }));
      void queryClient.invalidateQueries({ queryKey: ['logs'] });
      void refetch();
    } catch (err) {
      setToast(err instanceof Error ? err.message : t('logs.cleanupQrFailed'));
    } finally {
      setCleaning(false);
    }
  };

  const pageNumbers = useMemo(() => {
    const max = 5;
    if (totalPages <= max) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const start = Math.max(1, Math.min(page - 2, totalPages - max + 1));
    return Array.from({ length: max }, (_, i) => start + i);
  }, [page, totalPages]);

  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  const toolbarActions = (
    <>
      {isAdmin && (
        <button
          type="button"
          className="fu-btn fu-btn--ghost"
          disabled={cleaning}
          onClick={() => void handleCleanupQrNoise()}
          title={t('logs.cleanupQrHint')}
        >
          {cleaning ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
          {t('logs.cleanupQr')}
        </button>
      )}
      <button
        type="button"
        className="fu-btn fu-btn--ghost"
        disabled={exporting || total === 0}
        onClick={() => void handleExportCsv()}
      >
        {exporting ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
        {t('logs.exportCsv')}
      </button>
    </>
  );

  const body = (
    <>
      {toast && (
        <div className="logs-toast" role="status">
          {toast}
          <button type="button" onClick={() => setToast(null)} aria-label={t('common.close')}>
            ×
          </button>
        </div>
      )}

      {embedded && !moreOptionsOpen ? (
        <button
          type="button"
          className="fu-btn fu-btn--ghost fu-btn--sm settings-inline-more-btn"
          onClick={() => setMoreOptionsOpen(true)}
        >
          <span>{t('settings.moreOptions')}</span>
        </button>
      ) : null}

      {embedded && moreOptionsOpen ? (
        <>
          <button
            type="button"
            className="fu-btn fu-btn--ghost fu-btn--sm settings-inline-more-btn"
            onClick={() => setMoreOptionsOpen(false)}
          >
            <span>{t('settings.showLess')}</span>
          </button>
          <div className="logs-interakt__toolbar">{toolbarActions}</div>
        </>
      ) : null}

      {!embedded ? <div className="logs-interakt__toolbar">{toolbarActions}</div> : null}

      <div className="fu-filters logs-interakt__filters">
        <div className="fu-header__search logs-interakt__search">
          <MaterialSymbol name="search" size={16} />
          <input
            type="search"
            placeholder={t('logs.searchPlaceholder')}
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
          />
        </div>
        <div className="fu-filter-pill">
          <MaterialSymbol name="flag" size={18} className="fu-filter-pill__icon" />
          <select
            value={severityFilter}
            onChange={e => {
              setSeverityFilter(e.target.value);
              setPage(1);
            }}
            aria-label={t('logs.severity.all')}
          >
            <option value="all">{t('logs.severity.all')}</option>
            <option value="info">{t('logs.severity.info')}</option>
            <option value="warn">{t('logs.severity.warn')}</option>
            <option value="error">{t('logs.severity.error')}</option>
          </select>
        </div>
        <div className="fu-filter-pill">
          <MaterialSymbol name="bolt" size={18} className="fu-filter-pill__icon" />
          <select
            value={actionFilter}
            onChange={e => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            aria-label={t('logs.actionFilter')}
          >
            <option value="all">{t('logs.action.all')}</option>
            {AUDIT_ACTIONS.map(action => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && logs.length === 0 ? (
        <div className="logs-interakt__loading">
          <Loader2 className="animate-spin" size={28} />
        </div>
      ) : logs.length === 0 ? (
        <EmptyState
          icon={<FileText size={32} strokeWidth={1.25} />}
          title={t('logs.empty.title')}
          description={t('logs.empty.description')}
        />
      ) : (
        <div className="fu-table-wrap fu-reports-table">
          <table className="fu-table logs-table">
            <thead>
              <tr>
                <th>{t('logs.columns.timestamp')}</th>
                <th>{t('logs.columns.action')}</th>
                <th>{t('logs.columns.session')}</th>
                <th>{t('logs.columns.details')}</th>
                <th>{t('logs.columns.apiKey')}</th>
                <th>{t('logs.columns.ip')}</th>
                <th>{t('logs.columns.severity')}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td className="logs-cell-mono">{formatTimestamp(log.createdAt)}</td>
                  <td className="logs-cell-action">{log.action}</td>
                  <td title={log.sessionId ?? undefined}>{sessionLabel(log)}</td>
                  <td className="logs-cell-detail" title={logDetail(log)}>
                    {logDetail(log)}
                  </td>
                  <td className="logs-cell-mono">{log.apiKeyName || '—'}</td>
                  <td className="logs-cell-mono">{log.ipAddress || '—'}</td>
                  <td>
                    <StatusBadge variant={severityVariant(log.severity)}>
                      {log.severity.toUpperCase()}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="fu-table-footer">
              <span>{t('followups.pagination.showing', { from, to, total })}</span>
              <div className="fu-pagination">
                <button
                  type="button"
                  className="fu-pagination__btn"
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  <MaterialSymbol name="chevron_left" size={16} />
                </button>
                {pageNumbers.map(p => (
                  <button
                    key={p}
                    type="button"
                    className={['fu-pagination__btn', p === page ? 'fu-pagination__btn--active' : ''].join(' ')}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                ))}
                <button
                  type="button"
                  className="fu-pagination__btn"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  <MaterialSymbol name="chevron_right" size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );

  if (embedded) {
    return <div className="logs-interakt logs-interakt--embed">{body}</div>;
  }

  return (
    <div className="followups-interakt logs-interakt">
      <WorkspacePageHeader
        title={t('logs.title')}
        showSearch={false}
        showExport={false}
        showNewTask={false}
        extraActions={toolbarActions}
      />
      <div className="followups-interakt__scroll">{body}</div>
    </div>
  );
}
