import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Download, Search, Filter, Loader2, FileText, Trash2 } from 'lucide-react';
import type { AuditLog } from '../services/api';
import { auditApi } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useRole } from '../hooks/useRole';
import { useLogsQuery } from '../hooks/queries';
import { PageHeader } from '../components/PageHeader';
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
  const header = ['timestamp', 'action', 'session', 'api_key', 'ip', 'severity'];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = rows.map(log =>
    [
      log.createdAt,
      log.action,
      log.sessionName || log.sessionId || '',
      log.apiKeyName || '',
      log.ipAddress || '',
      log.severity,
    ]
      .map(v => escape(String(v)))
      .join(','),
  );
  return [header.join(','), ...lines].join('\n');
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

  if (loading && logs.length === 0) {
    return (
      <div
        className={`logs-page ${embedded ? 'settings-embed' : ''}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: embedded ? '200px' : '400px',
        }}
      >
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  const headerActions = (
    <>
      {isAdmin && (
        <button
          type="button"
          className="btn-secondary"
          disabled={cleaning}
          onClick={() => void handleCleanupQrNoise()}
          title={t('logs.cleanupQrHint')}
        >
          {cleaning ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />}
          {t('logs.cleanupQr')}
        </button>
      )}
      <button
        type="button"
        className="btn-secondary"
        disabled={exporting || total === 0}
        onClick={() => void handleExportCsv()}
      >
        {exporting ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
        {t('logs.exportCsv')}
      </button>
    </>
  );

  return (
    <div className={`logs-page ${embedded ? 'settings-embed' : ''}`}>
      {toast && (
        <div className="logs-toast" role="status">
          {toast}
          <button type="button" onClick={() => setToast(null)}>
            ×
          </button>
        </div>
      )}

      {!embedded && (
        <PageHeader title={t('logs.title')} subtitle={t('logs.subtitle')} actions={headerActions} />
      )}

      {embedded && <div className="settings-embed-toolbar">{headerActions}</div>}

      <div className="filters-bar">
        <div className="search-input">
          <Search size={18} />
          <input
            type="text"
            placeholder={t('logs.searchPlaceholder')}
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <Filter size={16} />
          <select
            value={severityFilter}
            onChange={e => {
              setSeverityFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">{t('logs.severity.all')}</option>
            <option value="info">{t('logs.severity.info')}</option>
            <option value="warn">{t('logs.severity.warn')}</option>
            <option value="error">{t('logs.severity.error')}</option>
          </select>
        </div>

        <div className="filter-group">
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

      <div className="logs-table-container">
        <div className="logs-table">
          <div className="table-row header">
            <span>{t('logs.columns.timestamp')}</span>
            <span>{t('logs.columns.action')}</span>
            <span>{t('logs.columns.session')}</span>
            <span>{t('logs.columns.apiKey')}</span>
            <span>{t('logs.columns.ip')}</span>
            <span>{t('logs.columns.severity')}</span>
          </div>
          {logs.length === 0 ? (
            <div className="empty-table-state">
              <FileText size={48} strokeWidth={1} />
              <h3>{t('logs.empty.title')}</h3>
              <p>{t('logs.empty.description')}</p>
            </div>
          ) : (
            logs.map(log => (
              <div key={log.id} className="table-row">
                <span className="timestamp">{formatTimestamp(log.createdAt)}</span>
                <span className="action">{log.action}</span>
                <span title={log.sessionId}>{sessionLabel(log)}</span>
                <span className="api-key">{log.apiKeyName || '—'}</span>
                <span className="ip">{log.ipAddress || '—'}</span>
                <span>
                  <span className={`severity-badge ${log.severity}`}>{log.severity.toUpperCase()}</span>
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button type="button" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
            {t('common.previous')}
          </button>
          <span className="page-numbers">
            {pageNumbers.map(p => (
              <button
                key={p}
                type="button"
                className={p === page ? 'active' : ''}
                onClick={() => setPage(p)}
              >
                {p}
              </button>
            ))}
          </span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            {t('common.next')}
          </button>
        </div>
      )}
    </div>
  );
}
