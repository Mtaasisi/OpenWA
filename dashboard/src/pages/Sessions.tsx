import { useState, useEffect, useCallback } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Plus, QrCode, RefreshCw, Trash2, Eye, Loader2, Play, Square, X, Search, Filter } from 'lucide-react';
import { sessionApi, type Session } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useToast } from '../components/Toast';
import { useRole } from '../hooks/useRole';
import { useSessionStartFlow } from '../hooks/useSessionStartFlow';
import { SessionQrModal } from '../components/SessionQrModal';
import { isSessionConnecting, isSessionRunning, canCallSessionStart } from '../lib/session-status';
import { PageHeader } from '../components/PageHeader';
import './Sessions.css';

export function Sessions({ embedded = false }: { embedded?: boolean } = {}) {
  const { t } = useTranslation();
  useDocumentTitle(embedded ? t('settings.title') : t('sessions.title'));
  const toast = useToast();
  const { canWrite } = useRole();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await sessionApi.list();
      setSessions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('sessions.create.errorDefault'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const { starting, qrModal, closeQrModal, startSessionFlow } = useSessionStartFlow({
    onReady: () => {
      toast.success(t('sessions.toasts.readyTitle'), t('sessions.toasts.readyDesc'));
      void fetchSessions();
    },
    onError: msg => setError(msg),
    onSessionStatus: useCallback(
      (event: { sessionId: string; status: string }) => {
        setSessions(prev =>
          prev.map(s => (s.id === event.sessionId ? { ...s, status: event.status as Session['status'] } : s)),
        );
        if (event.status === 'ready') {
          toast.success(t('sessions.toasts.readyTitle'), t('sessions.toasts.readyDesc'));
        } else if (event.status === 'disconnected') {
          toast.warning(t('sessions.toasts.disconnectedTitle'), t('sessions.toasts.disconnectedDesc'));
        }
      },
      [toast, t],
    ),
  });

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  const handleCreate = async () => {
    if (!newSessionName.trim()) return;
    try {
      setCreating(true);
      const newSession = await sessionApi.create(newSessionName);
      setSessions(prev => [...prev, newSession]);
      setNewSessionName('');
      setShowCreateModal(false);
      toast.success(t('sessions.create.successTitle'), t('sessions.create.successDesc', { name: newSession.name }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('sessions.create.errorDefault');
      setError(msg);
      toast.error(t('sessions.create.errorTitle'), msg);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    const session = sessions.find(s => s.id === id);
    try {
      await sessionApi.delete(id);
      setSessions(prev => prev.filter(s => s.id !== id));
      toast.success(
        t('sessions.delete.successTitle'),
        session ? t('sessions.delete.successDescNamed', { name: session.name }) : t('sessions.delete.successDescGeneric'),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('sessions.delete.errorDefault');
      console.error('Failed to delete:', err);
      toast.error(t('sessions.delete.errorTitle'), msg);
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleStart = (id: string) => {
    void startSessionFlow(id, sessions).catch(err => {
      console.error('Failed to start:', err);
      void fetchSessions();
    });
  };

  const handleShowQR = (id: string) => {
    void startSessionFlow(id, sessions);
  };

  const handleStop = async (id: string) => {
    try {
      await sessionApi.stop(id);
      setSessions(prev => prev.map(s => (s.id === id ? { ...s, status: 'disconnected' } : s)));
      if (qrModal?.sessionId === id) closeQrModal();
    } catch (err) {
      console.error('Failed to stop:', err);
      void fetchSessions();
    }
  };

  const formatLastActive = (date?: string) => {
    if (!date) return t('common.never');
    const diff = Date.now() - new Date(date).getTime();
    if (diff < 60000) return t('common.justNow');
    if (diff < 3600000) return t('common.minAgo', { count: Math.floor(diff / 60000) });
    return new Date(date).toLocaleDateString();
  };

  const formatStatus = (status: string) => t(`sessionStatus.${status}`, { defaultValue: status });

  const filteredSessions = sessions.filter(s => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && s.status === 'ready') ||
      (statusFilter === 'inactive' && ['created', 'disconnected', 'failed'].includes(s.status)) ||
      (statusFilter === 'connecting' && isSessionConnecting(s.status));
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div
        className={`sessions-page ${embedded ? 'settings-embed' : ''}`}
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

  return (
    <div className={`sessions-page ${embedded ? 'settings-embed' : ''}`}>
      {!embedded ? (
        <PageHeader
          title={t('sessions.title')}
          subtitle={t('sessions.subtitle')}
          actions={
            canWrite && (
              <button type="button" className="btn-primary" onClick={() => setShowCreateModal(true)}>
                <Plus size={18} />
                {t('sessions.newSession')}
              </button>
            )
          }
        />
      ) : (
        canWrite && (
          <div className="settings-embed-toolbar">
            <button type="button" className="btn-primary" onClick={() => setShowCreateModal(true)}>
              <Plus size={18} />
              {t('sessions.newSession')}
            </button>
            <button type="button" className="btn-secondary" onClick={() => void fetchSessions()}>
              <RefreshCw size={16} />
              {t('common.refresh')}
            </button>
          </div>
        )
      )}

      <div className="filters-bar">
        <div className="search-input">
          <Search size={18} />
          <input
            type="text"
            placeholder={t('sessions.searchPlaceholder')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <Filter size={16} />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">{t('sessions.filter.all')}</option>
            <option value="active">{t('sessions.filter.active')}</option>
            <option value="inactive">{t('sessions.filter.inactive')}</option>
            <option value="connecting">{t('sessions.filter.connecting')}</option>
          </select>
        </div>
      </div>

      {error && (
        <div
          style={{
            background: '#FEE2E2',
            padding: '1rem',
            borderRadius: '8px',
            color: '#DC2626',
            marginBottom: '1rem',
          }}
        >
          {error}
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('sessions.create.title')}</h2>
              <button type="button" className="btn-icon" onClick={() => setShowCreateModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <label>{t('sessions.create.label')}</label>
              <input
                type="text"
                placeholder={t('sessions.create.placeholder')}
                value={newSessionName}
                onChange={e => {
                  const value = e.target.value.toLowerCase().replace(/\s+/g, '-');
                  setNewSessionName(value);
                }}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
              <p className="input-hint">
                <Trans i18nKey="sessions.create.hint" components={{ code: <code /> }} />
              </p>
              {newSessionName && !/^[a-z0-9-]+$/.test(newSessionName) && (
                <p className="input-error">{t('sessions.create.invalidChars')}</p>
              )}
              {newSessionName && newSessionName.length > 50 && (
                <p className="input-error">{t('sessions.create.tooLong', { length: newSessionName.length })}</p>
              )}
              {newSessionName &&
                /^[a-z0-9-]+$/.test(newSessionName) &&
                newSessionName.length <= 50 &&
                sessions.some(s => s.name === newSessionName) && (
                  <p className="input-error">{t('sessions.create.duplicate')}</p>
                )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleCreate}
                disabled={
                  creating ||
                  !newSessionName.trim() ||
                  !/^[a-z0-9-]+$/.test(newSessionName) ||
                  newSessionName.length > 50 ||
                  sessions.some(s => s.name === newSessionName)
                }
              >
                {creating ? <Loader2 className="animate-spin" size={16} /> : t('common.create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {qrModal && <SessionQrModal data={qrModal} onClose={closeQrModal} />}

      {selectedSession && (
        <div className="modal-overlay" onClick={() => setSelectedSession(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('sessions.details.title')}</h2>
              <button type="button" className="btn-icon" onClick={() => setSelectedSession(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">{t('sessions.details.name')}</span>
                  <span className="detail-value">{selectedSession.name}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">{t('sessions.details.status')}</span>
                  <span className={`status-badge ${selectedSession.status}`}>{formatStatus(selectedSession.status)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">{t('sessions.details.sessionId')}</span>
                  <span className="detail-value mono">{selectedSession.id}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">{t('sessions.details.phone')}</span>
                  <span className="detail-value">{selectedSession.phone || t('sessions.details.phoneNone')}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">{t('sessions.details.created')}</span>
                  <span className="detail-value">{new Date(selectedSession.createdAt).toLocaleString()}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">{t('sessions.details.lastActive')}</span>
                  <span className="detail-value">
                    {selectedSession.lastActive ? new Date(selectedSession.lastActive).toLocaleString() : t('common.never')}
                  </span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setSelectedSession(null)}>
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmId && (
        <div className="modal-overlay" onClick={() => setDeleteConfirmId(null)}>
          <div className="modal confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('sessions.delete.title')}</h2>
              <button type="button" className="btn-icon" onClick={() => setDeleteConfirmId(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                <Trans
                  i18nKey="sessions.delete.message"
                  values={{ name: sessions.find(s => s.id === deleteConfirmId)?.name }}
                  components={{ strong: <strong /> }}
                />
              </p>
              <p className="text-muted">{t('sessions.delete.warning')}</p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setDeleteConfirmId(null)}>
                {t('common.cancel')}
              </button>
              <button type="button" className="btn-danger" onClick={() => handleDelete(deleteConfirmId)}>
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="sessions-grid">
        {filteredSessions.length === 0 ? (
          <div className="empty-state">
            <QrCode size={48} />
            <h3>{t('sessions.empty.title')}</h3>
            <p>{t('sessions.empty.description')}</p>
          </div>
        ) : (
          filteredSessions.map(session => (
            <div key={session.id} className="session-card">
              <div className="card-header">
                <h3 title={session.name}>{session.name}</h3>
                <span className={`status-pill ${session.status}`}>{formatStatus(session.status)}</span>
              </div>

              {isSessionConnecting(session.status) ? (
                <div className="qr-placeholder">
                  <QrCode size={80} className="qr-icon" />
                  <p>{session.status === 'qr_ready' ? t('sessions.qr.scanToConnect') : t('sessions.qr.preparing')}</p>
                  <button
                    type="button"
                    className="btn-sm"
                    onClick={() => handleShowQR(session.id)}
                    disabled={session.status !== 'qr_ready' && session.status !== 'authenticating'}
                  >
                    {session.status === 'qr_ready' ? t('sessions.qr.showQr') : t('sessions.qr.loading')}
                  </button>
                </div>
              ) : (
                <div className="session-info">
                  <div className="info-row">
                    <span className="info-label">{t('sessions.card.phone')}</span>
                    <span className="info-value">{session.phone || '—'}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">{t('sessions.card.sessionId')}</span>
                    <span className="info-value mono">{session.id.substring(0, 12)}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">{t('sessions.card.lastActive')}</span>
                    <span className="info-value">{formatLastActive(session.lastActive)}</span>
                  </div>
                </div>
              )}

              <div className="card-actions">
                <button type="button" className="btn-action" onClick={() => setSelectedSession(session)}>
                  <Eye size={16} />
                  {t('sessions.actions.view')}
                </button>
                {canWrite && canCallSessionStart(session.status) ? (
                  <button
                    type="button"
                    className="btn-action"
                    onClick={() => handleStart(session.id)}
                    disabled={starting}
                  >
                    {starting ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
                    {starting ? t('sessions.actions.starting', { defaultValue: 'Starting…' }) : t('sessions.actions.start')}
                  </button>
                ) : canWrite && isSessionRunning(session.status) ? (
                  <button type="button" className="btn-action" onClick={() => handleStop(session.id)}>
                    <Square size={16} />
                    {t('sessions.actions.stop')}
                  </button>
                ) : null}
                {canWrite && (
                  <button type="button" className="btn-action danger" onClick={() => setDeleteConfirmId(session.id)}>
                    <Trash2 size={16} />
                    {t('sessions.actions.delete')}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
