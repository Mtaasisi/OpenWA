import { useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Loader2, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  aiLearningCacheApi,
  type AiLearnedIntentRow,
  type AiUnknownMessageRow,
} from '../../services/api';
import { useToast } from '../Toast';
import { getAuthHeaders } from '../../lib/auth-storage';
import { useAiCostPermissions } from '../../hooks/useAiCostPermissions';
import { SettingsIntegrationShell } from './SettingsIntegrationShell';
import './AiLearningCenterPanel.css';
import './AiUsageCostPanel.css';

type Props = {
  onBack: () => void;
};

const TABS = ['intents', 'unknown', 'cache'] as const;
type Tab = (typeof TABS)[number];

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function AiLearningCenterPanel({ onBack }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const { canManage, permissions } = useAiCostPermissions();
  const canManageLearning = canManage || permissions.includes('ai.learning.manage');
  const [tab, setTab] = useState<Tab>('intents');
  const [approveTarget, setApproveTarget] = useState<AiUnknownMessageRow | null>(null);
  const [approveIntent, setApproveIntent] = useState('');
  const [approveReply, setApproveReply] = useState('');
  const [createPhrase, setCreatePhrase] = useState('');
  const [createIntent, setCreateIntent] = useState('greeting');
  const [createReply, setCreateReply] = useState('');
  const [mergePrimaryId, setMergePrimaryId] = useState('');
  const [mergeDuplicateIds, setMergeDuplicateIds] = useState('');
  const importInputRef = useRef<HTMLInputElement>(null);

  const intentsQ = useQuery({
    queryKey: ['ai-learning-cache', 'intents'],
    queryFn: () => aiLearningCacheApi.listLearnedIntents({ limit: 100 }),
    enabled: tab === 'intents',
  });

  const unknownQ = useQuery({
    queryKey: ['ai-learning-cache', 'unknown'],
    queryFn: () => aiLearningCacheApi.listUnknownMessages({ limit: 100 }),
    enabled: tab === 'unknown',
  });

  const cacheQ = useQuery({
    queryKey: ['ai-learning-cache', 'stats'],
    queryFn: () => aiLearningCacheApi.getCacheStats(),
    enabled: tab === 'cache',
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['ai-learning-cache'] });
  };

  const intentMutation = useMutation({
    mutationFn: async ({
      id,
      action,
    }: {
      id: string;
      action: 'approve' | 'disable' | 'reject';
    }) => {
      if (action === 'approve') return aiLearningCacheApi.approveLearnedIntent(id);
      if (action === 'disable') return aiLearningCacheApi.disableLearnedIntent(id);
      return aiLearningCacheApi.rejectLearnedIntent(id);
    },
    onSuccess: () => {
      toast.success(t('ai.learningCache.actionDone'));
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const unknownMutation = useMutation({
    mutationFn: async ({
      id,
      action,
      body,
    }: {
      id: string;
      action: 'approve' | 'reject' | 'ignore';
      body?: { reply?: string; intent?: string };
    }) => {
      if (action === 'approve') return aiLearningCacheApi.approveUnknownMessage(id, body ?? {});
      if (action === 'reject') return aiLearningCacheApi.rejectUnknownMessage(id);
      return aiLearningCacheApi.ignoreUnknownMessage(id);
    },
    onSuccess: () => {
      toast.success(t('ai.learningCache.actionDone'));
      setApproveTarget(null);
      setApproveIntent('');
      setApproveReply('');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      aiLearningCacheApi.createLearnedIntent({
        phrase: createPhrase.trim(),
        intent: createIntent.trim(),
        suggestedReply: createReply.trim(),
      }),
    onSuccess: res => {
      if (!res.ok) {
        toast.error(res.error ?? 'Could not save intent');
        return;
      }
      toast.success(t('ai.learningCache.createIntentDone'));
      setCreatePhrase('');
      setCreateReply('');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const mergeMutation = useMutation({
    mutationFn: () =>
      aiLearningCacheApi.mergeLearnedIntents({
        primaryId: mergePrimaryId.trim(),
        duplicateIds: mergeDuplicateIds
          .split(',')
          .map(s => s.trim())
          .filter(Boolean),
      }),
    onSuccess: res => {
      if (!res.ok) {
        toast.error(res.error ?? t('ai.learningCache.mergeFailed'));
        return;
      }
      toast.success(t('ai.learningCache.mergeDone'));
      setMergePrimaryId('');
      setMergeDuplicateIds('');
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const importMutation = useMutation({
    mutationFn: (csv: string) => aiLearningCacheApi.importLearnedIntentsCsv(csv),
    onSuccess: res => {
      if (!res.ok) {
        toast.error(res.error ?? t('ai.learningCache.importFailed'));
        return;
      }
      toast.success(
        t('ai.learningCache.importDone', {
          imported: res.imported ?? 0,
          skipped: res.skipped ?? 0,
        }),
      );
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const exportCsv = async () => {
    const res = await fetch('/api/admin/ai-learning/learned-intents-export.csv', {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      toast.error(t('ai.learningCache.exportFailed'));
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'learned-intents-export.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImportFile = async (file: File | undefined) => {
    if (!file) return;
    const csv = await file.text();
    importMutation.mutate(csv);
    if (importInputRef.current) importInputRef.current.value = '';
  };

  const openApproveUnknown = (row: AiUnknownMessageRow) => {
    setApproveTarget(row);
    setApproveIntent(row.detectedIntent ?? '');
    setApproveReply(row.aiSuggestedReply ?? '');
  };

  const renderIntentActions = (row: AiLearnedIntentRow) => {
    if (!canManageLearning) return null;
    return (
      <div className="ai-learning-center__actions">
        {row.status === 'pending_review' && (
          <>
            <button
              type="button"
              className="settings-wa__btn-primary"
              disabled={intentMutation.isPending}
              onClick={() => intentMutation.mutate({ id: row.id, action: 'approve' })}
            >
              {t('ai.learningCache.approve')}
            </button>
            <button
              type="button"
              className="settings-wa__btn-secondary"
              disabled={intentMutation.isPending}
              onClick={() => intentMutation.mutate({ id: row.id, action: 'reject' })}
            >
              {t('ai.learningCache.reject')}
            </button>
          </>
        )}
        {row.status === 'active' && (
          <button
            type="button"
            className="settings-wa__btn-secondary"
            disabled={intentMutation.isPending}
            onClick={() => intentMutation.mutate({ id: row.id, action: 'disable' })}
          >
            {t('ai.learningCache.disable')}
          </button>
        )}
      </div>
    );
  };

  const renderUnknownActions = (row: AiUnknownMessageRow) => {
    if (!canManageLearning) return null;
    if (approveTarget?.id === row.id) {
      return (
        <div className="ai-learning-center__approve-form">
          <label>
            {t('ai.learningCache.intentLabel')}
            <input value={approveIntent} onChange={e => setApproveIntent(e.target.value)} />
          </label>
          <label>
            {t('ai.learningCache.replyLabel')}
            <textarea rows={3} value={approveReply} onChange={e => setApproveReply(e.target.value)} />
          </label>
          <div className="ai-learning-center__actions">
            <button
              type="button"
              className="settings-wa__btn-primary"
              disabled={unknownMutation.isPending}
              onClick={() =>
                unknownMutation.mutate({
                  id: row.id,
                  action: 'approve',
                  body: { intent: approveIntent.trim(), reply: approveReply.trim() },
                })
              }
            >
              {t('ai.learningCache.confirmApprove')}
            </button>
            <button
              type="button"
              className="settings-wa__btn-secondary"
              onClick={() => setApproveTarget(null)}
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="ai-learning-center__actions">
        <button
          type="button"
          className="settings-wa__btn-primary"
          disabled={unknownMutation.isPending}
          onClick={() => openApproveUnknown(row)}
        >
          {t('ai.learningCache.approve')}
        </button>
        <button
          type="button"
          className="settings-wa__btn-secondary"
          disabled={unknownMutation.isPending}
          onClick={() => unknownMutation.mutate({ id: row.id, action: 'reject' })}
        >
          {t('ai.learningCache.reject')}
        </button>
        <button
          type="button"
          className="settings-wa__btn-secondary"
          disabled={unknownMutation.isPending}
          onClick={() => unknownMutation.mutate({ id: row.id, action: 'ignore' })}
        >
          {t('ai.learningCache.ignore')}
        </button>
      </div>
    );
  };

  const loading =
    (tab === 'intents' && intentsQ.isLoading) ||
    (tab === 'unknown' && unknownQ.isLoading) ||
    (tab === 'cache' && cacheQ.isLoading);

  return (
    <SettingsIntegrationShell
      chromeless
      backSection="ai"
      onBack={onBack}
      title={t('ai.learningCache.title')}
      askAiPanelId="ai-learning-cache"
    >
      <div className="ai-learning-center">
        {canManageLearning && tab === 'intents' && (
          <section className="ai-learning-center__create">
            <h3>{t('ai.learningCache.createIntentTitle')}</h3>
            <div className="ai-learning-center__approve-form">
              <label>
                {t('ai.learningCache.createIntentPhrase')}
                <input
                  className="ai-settings-input"
                  value={createPhrase}
                  onChange={e => setCreatePhrase(e.target.value)}
                />
              </label>
              <label>
                {t('ai.learningCache.createIntentIntent')}
                <input
                  className="ai-settings-input"
                  value={createIntent}
                  onChange={e => setCreateIntent(e.target.value)}
                />
              </label>
              <label>
                {t('ai.learningCache.createIntentReply')}
                <textarea
                  className="ai-settings-input"
                  rows={2}
                  value={createReply}
                  onChange={e => setCreateReply(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="settings-wa__btn-primary"
                disabled={
                  createMutation.isPending ||
                  !createPhrase.trim() ||
                  !createIntent.trim() ||
                  !createReply.trim()
                }
                onClick={() => createMutation.mutate()}
              >
                {t('ai.learningCache.createIntentSave')}
              </button>
            </div>
          </section>
        )}
        <div className="wa-safety-tabs settings-tabs" role="tablist">
          {TABS.map(id => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`settings-tab${tab === id ? ' active' : ''}`}
              onClick={() => setTab(id)}
            >
              {t(`ai.learningCache.tabs.${id}`)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="settings-integration-loading">
            <Loader2 className="animate-spin" size={24} />
          </div>
        ) : tab === 'intents' ? (
          <>
            {canManageLearning && (
              <div className="ai-learning-center__toolbar">
                <button type="button" className="settings-wa__btn-secondary" onClick={exportCsv}>
                  <Download size={14} /> {t('ai.learningCache.exportCsv')}
                </button>
                <button
                  type="button"
                  className="settings-wa__btn-secondary"
                  onClick={() => importInputRef.current?.click()}
                  disabled={importMutation.isPending}
                >
                  <Upload size={14} /> {t('ai.learningCache.importCsv')}
                </button>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  hidden
                  onChange={e => void onImportFile(e.target.files?.[0])}
                />
              </div>
            )}
            {canManageLearning && (
              <section className="ai-learning-center__merge">
                <h3>{t('ai.learningCache.mergeTitle')}</h3>
                <div className="ai-learning-center__approve-form">
                  <label>
                    {t('ai.learningCache.mergePrimary')}
                    <input
                      className="ai-settings-input"
                      value={mergePrimaryId}
                      onChange={e => setMergePrimaryId(e.target.value)}
                      placeholder={t('ai.learningCache.mergePrimaryHint')}
                    />
                  </label>
                  <label>
                    {t('ai.learningCache.mergeDuplicates')}
                    <input
                      className="ai-settings-input"
                      value={mergeDuplicateIds}
                      onChange={e => setMergeDuplicateIds(e.target.value)}
                      placeholder={t('ai.learningCache.mergeDuplicatesHint')}
                    />
                  </label>
                  <button
                    type="button"
                    className="settings-wa__btn-secondary"
                    disabled={
                      mergeMutation.isPending ||
                      !mergePrimaryId.trim() ||
                      !mergeDuplicateIds.trim()
                    }
                    onClick={() => mergeMutation.mutate()}
                  >
                    {t('ai.learningCache.mergeSave')}
                  </button>
                </div>
              </section>
            )}
          <div className="settings-table-wrap">
            <table className="settings-table">
              <thead>
                <tr>
                  <th>{t('ai.learningCache.tablePhrase')}</th>
                  <th>{t('ai.learningCache.tableId')}</th>
                  <th>{t('ai.learningCache.tableIntent')}</th>
                  <th>{t('ai.learningCache.tableStatus')}</th>
                  <th>{t('ai.learningCache.tableUsage')}</th>
                  <th>{t('ai.learningCache.tableLastUsed')}</th>
                  <th>{t('ai.learningCache.tableActions')}</th>
                </tr>
              </thead>
              <tbody>
                {(intentsQ.data?.items ?? []).map(row => (
                  <tr key={row.id}>
                    <td className="ai-learning-center__phrase">{row.phrase}</td>
                    <td className="ai-learning-center__id" title={row.id}>
                      {row.id.slice(0, 8)}…
                    </td>
                    <td>{row.intent}</td>
                    <td>{row.status}</td>
                    <td>{row.usageCount}</td>
                    <td>{formatDate(row.lastUsedAt)}</td>
                    <td>{renderIntentActions(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(intentsQ.data?.items ?? []).length === 0 && (
              <p className="settings-muted">{t('ai.learningCache.emptyIntents')}</p>
            )}
          </div>
          </>
        ) : tab === 'unknown' ? (
          <div className="settings-table-wrap">
            <table className="settings-table">
              <thead>
                <tr>
                  <th>{t('ai.learningCache.tableMessage')}</th>
                  <th>{t('ai.learningCache.tableIntent')}</th>
                  <th>{t('ai.learningCache.tableConfidence')}</th>
                  <th>{t('ai.learningCache.tableFrequency')}</th>
                  <th>{t('ai.learningCache.tableActions')}</th>
                </tr>
              </thead>
              <tbody>
                {(unknownQ.data?.items ?? []).map(row => (
                  <tr key={row.id}>
                    <td className="ai-learning-center__phrase">{row.rawText}</td>
                    <td>{row.detectedIntent ?? '—'}</td>
                    <td>{Math.round(Number(row.confidence))}%</td>
                    <td>{row.frequencyCount}</td>
                    <td>{renderUnknownActions(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(unknownQ.data?.items ?? []).length === 0 && (
              <p className="settings-muted">{t('ai.learningCache.emptyUnknown')}</p>
            )}
          </div>
        ) : (
          <>
            <div className="ai-usage-panel__cards">
              <div className="ai-usage-card">
                <span className="ai-usage-card__label">{t('ai.learningCache.activeIntents')}</span>
                <strong>{cacheQ.data?.activeCount ?? 0}</strong>
              </div>
              <div className="ai-usage-card">
                <span className="ai-usage-card__label">{t('ai.learningCache.totalCacheUsage')}</span>
                <strong>{cacheQ.data?.totalUsage ?? 0}</strong>
              </div>
            </div>
            <section className="ai-usage-section">
              <h3>{t('ai.learningCache.topIntents')}</h3>
              <ul className="ai-usage-list">
                {(cacheQ.data?.topIntents ?? []).map(row => (
                  <li key={row.intent}>
                    <span>{row.intent}</span>
                    <span>
                      {t('ai.learningCache.intentUsage', { count: row.count, usage: row.usage })}
                    </span>
                  </li>
                ))}
              </ul>
              {(cacheQ.data?.topIntents ?? []).length === 0 && (
                <p className="settings-muted">{t('ai.learningCache.emptyCache')}</p>
              )}
            </section>
          </>
        )}
      </div>
    </SettingsIntegrationShell>
  );
}
