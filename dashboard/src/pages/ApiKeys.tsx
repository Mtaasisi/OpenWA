import { useState, useEffect, useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type VisibilityState,
} from '@tanstack/react-table';
import { Plus, Copy, RefreshCw, Trash2, Eye, EyeOff, Loader2, X, Check, KeyRound, AlertTriangle } from 'lucide-react';
import type { ApiKey } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useApiKeysQuery, useCreateApiKeyMutation, useDeleteApiKeyMutation, useRevokeApiKeyMutation } from '../hooks/queries';
import { PageHeader } from '../components/PageHeader';
import { ModalOverlay } from '../components/ModalOverlay';
import { MaterialSymbol } from '../components/MaterialSymbol';
import { StatusBadge } from '../components/workspace';
import './ApiKeys.css';

const roleNames = ['admin', 'operator', 'viewer'] as const;

function useWindowSize() {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return width;
}

const columnHelper = createColumnHelper<ApiKey>();

export function ApiKeys({ embedded = false }: { embedded?: boolean } = {}) {
  const { t } = useTranslation();
  const modalOverlayClass = embedded
    ? 'modal-overlay api-keys-modal-overlay'
    : 'modal-overlay';
  const modalShellClass = embedded ? 'api-keys-modal' : 'modal';
  useDocumentTitle(t('apiKeys.title'));
  const { data: apiKeys = [], isLoading: loading } = useApiKeysQuery();
  const createMutation = useCreateApiKeyMutation();
  const deleteMutation = useDeleteApiKeyMutation();
  const revokeMutation = useRevokeApiKeyMutation();
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [newKey, setNewKey] = useState({ name: '', role: 'operator' });
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'delete' | 'revoke'; id: string; name: string } | null>(
    null,
  );

  const windowWidth = useWindowSize();
  const isMobile = windowWidth < 768;
  const isSmall = windowWidth < 640;
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const metrics = useMemo(
    () => ({
      total: apiKeys.length,
      active: apiKeys.filter(k => k.isActive).length,
      revoked: apiKeys.filter(k => !k.isActive).length,
    }),
    [apiKeys],
  );

  useEffect(() => {
    setColumnVisibility({ key: !isSmall, lastUsed: !isMobile });
  }, [isMobile, isSmall]);

  const handleCreate = async () => {
    if (!newKey.name) return;
    try {
      const created = await createMutation.mutateAsync({ name: newKey.name, role: newKey.role });
      setCreatedKey(created.apiKey || null);
      setNewKey({ name: '', role: 'operator' });
    } catch (err) {
      console.error('Failed to create:', err);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await revokeMutation.mutateAsync(id);
    } catch (err) {
      console.error('Failed to revoke:', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const confirmAndExecute = () => {
    if (!confirmAction) return;
    if (confirmAction.type === 'delete') handleDelete(confirmAction.id);
    else handleRevoke(confirmAction.id);
    setConfirmAction(null);
  };

  const toggleKeyVisibility = (id: string) => {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: () => t('apiKeys.columns.name'),
        cell: info => <span className="name-cell">{info.getValue()}</span>,
      }),
      columnHelper.accessor('keyPrefix', {
        id: 'key',
        header: () => t('apiKeys.columns.key'),
        cell: info => {
          const apiKey = info.row.original;
          return (
            <span className="key-cell">
              <code>{visibleKeys.has(apiKey.id) ? apiKey.keyPrefix + '...' : apiKey.keyPrefix + '****'}</code>
              <button className="icon-btn-sm" onClick={() => toggleKeyVisibility(apiKey.id)}>
                {visibleKeys.has(apiKey.id) ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </span>
          );
        },
      }),
      columnHelper.accessor('role', {
        header: () => t('apiKeys.columns.role'),
        cell: info => <span className="permission-badge">{info.getValue()}</span>,
      }),
      columnHelper.accessor('isActive', {
        header: () => t('apiKeys.columns.status'),
        cell: info =>
          embedded ? (
            <StatusBadge variant={info.getValue() ? 'success' : 'neutral'}>
              {info.getValue() ? t('apiKeys.statuses.active') : t('apiKeys.statuses.revoked')}
            </StatusBadge>
          ) : (
            <span className={`status-badge ${info.getValue() ? 'active' : 'inactive'}`}>
              {info.getValue() ? t('apiKeys.statuses.active') : t('apiKeys.statuses.revoked')}
            </span>
          ),
      }),
      columnHelper.accessor('lastUsedAt', {
        id: 'lastUsed',
        header: () => t('apiKeys.columns.lastUsed'),
        cell: info => (
          <span className="last-used">
            {info.getValue() ? new Date(info.getValue()!).toLocaleDateString() : t('common.never')}
          </span>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: () => t('apiKeys.columns.actions'),
        cell: info => {
          const apiKey = info.row.original;
          return (
            <span className="actions-cell">
              <button
                className="icon-btn"
                onClick={() => copyToClipboard(apiKey.keyPrefix, apiKey.id)}
                title={t('apiKeys.actions.copy')}
              >
                {copied === apiKey.id ? <Check size={16} /> : <Copy size={16} />}
              </button>
              {apiKey.isActive && (
                <button
                  className="icon-btn"
                  onClick={() => setConfirmAction({ type: 'revoke', id: apiKey.id, name: apiKey.name })}
                  title={t('apiKeys.actions.revoke')}
                >
                  <RefreshCw size={16} />
                </button>
              )}
              <button
                className="icon-btn danger"
                onClick={() => setConfirmAction({ type: 'delete', id: apiKey.id, name: apiKey.name })}
                title={t('apiKeys.actions.delete')}
              >
                <Trash2 size={16} />
              </button>
            </span>
          );
        },
      }),
    ],
    [visibleKeys, copied, t, embedded],
  );

  const table = useReactTable({
    data: apiKeys,
    columns,
    state: { columnVisibility },
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
  });

  if (loading) {
    return (
      <div
        className="api-keys-page"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}
      >
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  const createButton = (
    <button
      type="button"
      className={embedded ? 'api-keys-btn api-keys-btn--primary api-keys-btn--sm' : 'btn-primary'}
      onClick={() => setShowModal(true)}
    >
      <Plus size={embedded ? 14 : 18} />
      {t('apiKeys.createBtn')}
    </button>
  );

  const keysTable = (
    <div className="keys-table-container">
      {apiKeys.length === 0 ? (
        <div className="empty-table-state">
          <KeyRound size={48} strokeWidth={1} />
          <h3>{t('apiKeys.empty.title')}</h3>
          <p>{t('apiKeys.empty.description')}</p>
        </div>
      ) : (
        <table className="keys-table">
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id} className="table-row header">
                {headerGroup.headers.map(header => (
                  <th key={header.id}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr key={row.id} className="table-row">
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  return (
    <div className={`api-keys-page ${embedded ? 'settings-embed api-keys-page--embed' : ''}`}>
      {!embedded ? (
        <PageHeader title={t('apiKeys.title')} subtitle={t('apiKeys.subtitle')} actions={createButton} />
      ) : (
        <div className="api-keys-kpi-grid">
          <div className="api-keys-kpi">
            <p className="api-keys-kpi__label">{t('apiKeys.metrics.total')}</p>
            <p className="api-keys-kpi__value">{metrics.total}</p>
          </div>
          <div className="api-keys-kpi">
            <p className="api-keys-kpi__label">{t('apiKeys.metrics.active')}</p>
            <p className="api-keys-kpi__value">{metrics.active}</p>
          </div>
          <div className="api-keys-kpi">
            <p className="api-keys-kpi__label">{t('apiKeys.metrics.revoked')}</p>
            <p className="api-keys-kpi__value">{metrics.revoked}</p>
          </div>
        </div>
      )}

      {showModal && (
        <ModalOverlay
          className={modalOverlayClass}
          onClose={() => {
            setShowModal(false);
            setCreatedKey(null);
          }}
        >
          <div className={modalShellClass} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            {embedded ? (
              <>
                <header className="api-keys-modal__head">
                  <h2>{createdKey ? t('apiKeys.createdTitle') : t('apiKeys.modalTitle')}</h2>
                  <button
                    type="button"
                    className="api-keys-modal__close"
                    onClick={() => {
                      setShowModal(false);
                      setCreatedKey(null);
                    }}
                    aria-label={t('common.close')}
                  >
                    <MaterialSymbol name="close" size={20} />
                  </button>
                </header>
                <div className="api-keys-modal__body">
                  {createdKey ? (
                    <>
                      <p className="api-keys-modal__hint">{t('apiKeys.createdHint')}</p>
                      <div className="api-keys-modal__copy-row">
                        <code className="api-keys-modal__key">{createdKey}</code>
                        <button
                          type="button"
                          className="api-keys-btn api-keys-btn--primary"
                          onClick={() => copyToClipboard(createdKey, 'modal')}
                        >
                          {copied === 'modal' ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="api-keys-modal__field">
                        <label htmlFor="api-key-name">{t('common.name')}</label>
                        <input
                          id="api-key-name"
                          type="text"
                          placeholder={t('apiKeys.namePlaceholder')}
                          value={newKey.name}
                          onChange={e => setNewKey({ ...newKey, name: e.target.value })}
                        />
                      </div>
                      <div className="api-keys-modal__field">
                        <label htmlFor="api-key-role">{t('common.role')}</label>
                        <select
                          id="api-key-role"
                          value={newKey.role}
                          onChange={e => setNewKey({ ...newKey, role: e.target.value })}
                        >
                          {roleNames.map(r => (
                            <option key={r} value={r}>
                              {t(`apiKeys.roles.${r}`)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                </div>
                {!createdKey && (
                  <footer className="api-keys-modal__footer">
                    <button type="button" className="api-keys-btn" onClick={() => setShowModal(false)}>
                      {t('common.cancel')}
                    </button>
                    <button type="button" className="api-keys-btn api-keys-btn--primary" onClick={handleCreate}>
                      {t('common.create')}
                    </button>
                  </footer>
                )}
              </>
            ) : (
              <>
                <div className="modal-header">
                  <h2>{createdKey ? t('apiKeys.createdTitle') : t('apiKeys.modalTitle')}</h2>
                  <button
                    className="btn-icon"
                    onClick={() => {
                      setShowModal(false);
                      setCreatedKey(null);
                    }}
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="modal-body">
                  {createdKey ? (
                    <div>
                      <p style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>{t('apiKeys.createdHint')}</p>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <code
                          style={{
                            flex: 1,
                            padding: '0.75rem',
                            background: 'var(--bg-secondary)',
                            borderRadius: '6px',
                            wordBreak: 'break-all',
                          }}
                        >
                          {createdKey}
                        </code>
                        <button className="btn-primary" onClick={() => copyToClipboard(createdKey, 'modal')}>
                          {copied === 'modal' ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <label>{t('common.name')}</label>
                      <input
                        type="text"
                        placeholder={t('apiKeys.namePlaceholder')}
                        value={newKey.name}
                        onChange={e => setNewKey({ ...newKey, name: e.target.value })}
                      />
                      <label>{t('common.role')}</label>
                      <select value={newKey.role} onChange={e => setNewKey({ ...newKey, role: e.target.value })}>
                        {roleNames.map(r => (
                          <option key={r} value={r}>
                            {t(`apiKeys.roles.${r}`)}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                </div>
                {!createdKey && (
                  <div className="modal-footer">
                    <button className="btn-secondary" onClick={() => setShowModal(false)}>
                      {t('common.cancel')}
                    </button>
                    <button className="btn-primary" onClick={handleCreate}>
                      {t('common.create')}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </ModalOverlay>
      )}

      <div className="api-keys-content">
        {embedded ? (
          <section className="api-keys-card">
            <header className="api-keys-card__head">
              <h2 className="api-keys-card__title">
                <MaterialSymbol name="key" size={20} />
                {t('apiKeys.listTitle')}
              </h2>
              {createButton}
            </header>
            {keysTable}
          </section>
        ) : (
          keysTable
        )}

        <div className="permissions-reference">
          <h3>{t('apiKeys.rolesTitle')}</h3>
          <div className="permissions-list">
            {roleNames.map(r => (
              <div key={r} className="perm-item">
                <code>{r}</code>
                <span>{t(`apiKeys.roleDescriptions.${r}`)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="permissions-reference">
          <h3>{t('apiKeys.aiCostPermissionsTitle')}</h3>
          <div className="permissions-list">
            {(['ai.cost.view', 'ai.cost.manage'] as const).map(code => (
              <div key={code} className="perm-item">
                <code>{code}</code>
                <span>{t(`apiKeys.aiCostPermissions.${code}`)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {confirmAction && (
        <ModalOverlay onClose={() => setConfirmAction(null)} className={modalOverlayClass}>
          <div
            className={embedded ? 'api-keys-modal api-keys-modal--confirm' : 'modal confirm-modal'}
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {embedded ? (
              <>
                <header className="api-keys-modal__head">
                  <h2>
                    {confirmAction.type === 'delete'
                      ? t('apiKeys.confirm.deleteTitle')
                      : t('apiKeys.confirm.revokeTitle')}
                  </h2>
                  <button
                    type="button"
                    className="api-keys-modal__close"
                    onClick={() => setConfirmAction(null)}
                    aria-label={t('common.close')}
                  >
                    <MaterialSymbol name="close" size={20} />
                  </button>
                </header>
                <div className="api-keys-modal__body api-keys-modal__body--center">
                  <AlertTriangle size={44} className="api-keys-modal__warn-icon" />
                  <p className="api-keys-modal__confirm-text">
                    <Trans
                      i18nKey={
                        confirmAction.type === 'delete'
                          ? 'apiKeys.confirm.deleteMessage'
                          : 'apiKeys.confirm.revokeMessage'
                      }
                      values={{ name: confirmAction.name }}
                      components={{ strong: <strong /> }}
                    />
                  </p>
                </div>
                <footer className="api-keys-modal__footer">
                  <button type="button" className="api-keys-btn" onClick={() => setConfirmAction(null)}>
                    {t('common.cancel')}
                  </button>
                  <button type="button" className="api-keys-btn api-keys-btn--danger" onClick={confirmAndExecute}>
                    {confirmAction.type === 'delete'
                      ? t('apiKeys.confirm.delete')
                      : t('apiKeys.confirm.revoke')}
                  </button>
                </footer>
              </>
            ) : (
              <>
                <div className="modal-header">
                  <h2>
                    {confirmAction.type === 'delete'
                      ? t('apiKeys.confirm.deleteTitle')
                      : t('apiKeys.confirm.revokeTitle')}
                  </h2>
                  <button className="btn-icon" onClick={() => setConfirmAction(null)}>
                    <X size={20} />
                  </button>
                </div>
                <div className="modal-body">
                  <div className="confirm-icon-wrapper">
                    <AlertTriangle size={48} className="confirm-warning-icon" />
                  </div>
                  <p className="confirm-message">
                    <Trans
                      i18nKey={
                        confirmAction.type === 'delete'
                          ? 'apiKeys.confirm.deleteMessage'
                          : 'apiKeys.confirm.revokeMessage'
                      }
                      values={{ name: confirmAction.name }}
                      components={{ strong: <strong /> }}
                    />
                  </p>
                </div>
                <div className="modal-footer">
                  <button className="btn-secondary" onClick={() => setConfirmAction(null)}>
                    {t('common.cancel')}
                  </button>
                  <button className="btn-danger" onClick={confirmAndExecute}>
                    {confirmAction.type === 'delete'
                      ? t('apiKeys.confirm.delete')
                      : t('apiKeys.confirm.revoke')}
                  </button>
                </div>
              </>
            )}
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
