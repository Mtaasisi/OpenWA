import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { aiTrainingCenterApi } from '../../lib/ai-training-center/api';
import type { TrainingSettingsForm } from '../../lib/ai-training-center/types';
import { useToast } from '../Toast';
import { useAiTrainingPermissions } from '../../hooks/useAiTrainingPermissions';
import { AITCErrorState, AITCLoadingSkeleton } from './shared';

const SETTINGS_TABS = [
  'general',
  'auto',
  'confidence',
  'buffer',
  'context',
  'models',
  'safety',
] as const;

export function TrainingSettingsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const { canManageTraining } = useAiTrainingPermissions();
  const [tab, setTab] = useState<typeof SETTINGS_TABS[number]>('general');
  const [form, setForm] = useState<TrainingSettingsForm | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['ai-training-center', 'settings'],
    queryFn: () => aiTrainingCenterApi.getSettings(),
  });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const saveMut = useMutation({
    mutationFn: (body: TrainingSettingsForm) => aiTrainingCenterApi.saveSettings(body),
    onSuccess: () => {
      toast.success('Settings saved');
      void qc.invalidateQueries({ queryKey: ['ai-training-center', 'settings'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = <K extends keyof TrainingSettingsForm>(key: K, value: TrainingSettingsForm[K]) => {
    setForm(prev => (prev ? { ...prev, [key]: value } : prev));
  };

  return (
    <>
      <header className="aitc-page-header">
        <div>
          <h1 className="aitc-page-header__title">AI Training Settings</h1>
          <p className="aitc-page-header__subtitle">
            Control auto-learning, approvals, message buffer, context and safety.
          </p>
        </div>
      </header>

      <div className="aitc-settings-tabs">
        {SETTINGS_TABS.map(t => (
          <button
            key={t}
            type="button"
            className={`aitc-tab${tab === t ? ' is-active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {isError && <AITCErrorState message="Failed to load settings." onRetry={() => refetch()} />}
      {isLoading || !form ? (
        <AITCLoadingSkeleton rows={6} />
      ) : (
        <div className="aitc-panel-card">
          {tab === 'general' && (
            <div className="aitc-settings-section">
              <label className="aitc-toggle-row">
                <span>Enable AI Training Center</span>
                <input type="checkbox" checked={form.enabled} onChange={e => set('enabled', e.target.checked)} disabled={!canManageTraining} />
              </label>
              <label className="aitc-toggle-row">
                <span>Enable learned reply cache</span>
                <input type="checkbox" checked={form.learnedReplyCache} onChange={e => set('learnedReplyCache', e.target.checked)} disabled={!canManageTraining} />
              </label>
              <label className="aitc-toggle-row">
                <span>Enable reply variations</span>
                <input type="checkbox" checked={form.replyVariations} onChange={e => set('replyVariations', e.target.checked)} disabled={!canManageTraining} />
              </label>
              <div className="aitc-field">
                <label>Default reply language</label>
                <select className="aitc-select" value={form.defaultLanguage} onChange={e => set('defaultLanguage', e.target.value as TrainingSettingsForm['defaultLanguage'])} disabled={!canManageTraining}>
                  <option value="sw">Swahili</option>
                  <option value="en">English</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>
            </div>
          )}

          {tab === 'auto' && (
            <div className="aitc-settings-section">
              <label className="aitc-toggle-row">
                <span>Auto learning</span>
                <input type="checkbox" checked={form.autoLearning} onChange={e => set('autoLearning', e.target.checked)} disabled={!canManageTraining} />
              </label>
              <label className="aitc-toggle-row">
                <span>Auto-learn safe intents</span>
                <input type="checkbox" checked={form.autoLearnSafeIntents} onChange={e => set('autoLearnSafeIntents', e.target.checked)} disabled={!canManageTraining} />
              </label>
              <label className="aitc-toggle-row">
                <span>Auto-approve greeting / location / delivery</span>
                <input type="checkbox" checked={form.autoApproveSafeIntents} onChange={e => set('autoApproveSafeIntents', e.target.checked)} disabled={!canManageTraining} />
              </label>
              <label className="aitc-toggle-row">
                <span>Disable auto-learning for complaints / payments</span>
                <input type="checkbox" checked={form.disableAutoLearningSensitive} onChange={e => set('disableAutoLearningSensitive', e.target.checked)} disabled={!canManageTraining} />
              </label>
            </div>
          )}

          {tab === 'confidence' && (
            <div className="aitc-settings-section">
              <div className="aitc-field">
                <label>Auto approve threshold: {form.autoApproveThreshold}%</label>
                <input type="range" min={50} max={100} value={form.autoApproveThreshold} onChange={e => set('autoApproveThreshold', Number(e.target.value))} disabled={!canManageTraining} style={{ width: '100%' }} />
              </div>
              <div className="aitc-field">
                <label>Pending review threshold: {form.pendingReviewThreshold}%</label>
                <input type="range" min={30} max={90} value={form.pendingReviewThreshold} onChange={e => set('pendingReviewThreshold', Number(e.target.value))} disabled={!canManageTraining} style={{ width: '100%' }} />
              </div>
              <div className="aitc-field">
                <label>Low confidence threshold: {form.lowConfidenceThreshold}%</label>
                <input type="range" min={10} max={60} value={form.lowConfidenceThreshold} onChange={e => set('lowConfidenceThreshold', Number(e.target.value))} disabled={!canManageTraining} style={{ width: '100%' }} />
              </div>
            </div>
          )}

          {tab === 'buffer' && (
            <div className="aitc-settings-section">
              <label className="aitc-toggle-row">
                <span>Enable message buffer</span>
                <input type="checkbox" checked={form.messageBufferEnabled} onChange={e => set('messageBufferEnabled', e.target.checked)} disabled={!canManageTraining} />
              </label>
              <div className="aitc-field">
                <label>Debounce seconds</label>
                <input className="aitc-input" type="number" value={form.debounceSeconds} onChange={e => set('debounceSeconds', Number(e.target.value))} disabled={!canManageTraining} />
              </div>
              <div className="aitc-field">
                <label>Max wait seconds</label>
                <input className="aitc-input" type="number" value={form.maxWaitSeconds} onChange={e => set('maxWaitSeconds', Number(e.target.value))} disabled={!canManageTraining} />
              </div>
              <div className="aitc-field">
                <label>Max messages per batch</label>
                <input className="aitc-input" type="number" value={form.maxMessagesPerBatch} onChange={e => set('maxMessagesPerBatch', Number(e.target.value))} disabled={!canManageTraining} />
              </div>
              <div className="aitc-field">
                <label>Max characters per batch</label>
                <input className="aitc-input" type="number" value={form.maxCharsPerBatch} onChange={e => set('maxCharsPerBatch', Number(e.target.value))} disabled={!canManageTraining} />
              </div>
              <label className="aitc-toggle-row">
                <span>One reply per burst</span>
                <input type="checkbox" checked={form.oneReplyPerBurst} onChange={e => set('oneReplyPerBurst', e.target.checked)} disabled={!canManageTraining} />
              </label>
            </div>
          )}

          {tab === 'context' && (
            <div className="aitc-settings-section">
              <div className="aitc-field">
                <label>Default context messages</label>
                <input className="aitc-input" type="number" min={3} max={5} value={form.defaultContextMessages} onChange={e => set('defaultContextMessages', Number(e.target.value))} disabled={!canManageTraining} />
              </div>
              <div className="aitc-field">
                <label>Max context messages (complex)</label>
                <input className="aitc-input" type="number" min={3} max={5} value={form.maxContextMessages} onChange={e => set('maxContextMessages', Number(e.target.value))} disabled={!canManageTraining} />
              </div>
              <label className="aitc-toggle-row">
                <span>Include CRM only when needed</span>
                <input type="checkbox" checked={form.includeCrmWhenNeeded} onChange={e => set('includeCrmWhenNeeded', e.target.checked)} disabled={!canManageTraining} />
              </label>
              <label className="aitc-toggle-row">
                <span>Include knowledge only when needed</span>
                <input type="checkbox" checked={form.includeKnowledgeWhenNeeded} onChange={e => set('includeKnowledgeWhenNeeded', e.target.checked)} disabled={!canManageTraining} />
              </label>
              <label className="aitc-toggle-row">
                <span>Include catalog only when needed</span>
                <input type="checkbox" checked={form.includeCatalogWhenNeeded} onChange={e => set('includeCatalogWhenNeeded', e.target.checked)} disabled={!canManageTraining} />
              </label>
              <label className="aitc-toggle-row">
                <span>Include memory only when needed</span>
                <input type="checkbox" checked={form.includeMemoryWhenNeeded} onChange={e => set('includeMemoryWhenNeeded', e.target.checked)} disabled={!canManageTraining} />
              </label>
            </div>
          )}

          {tab === 'models' && (
            <div className="aitc-settings-section">
              <div className="aitc-field">
                <label>Default model for auto reply</label>
                <input className="aitc-input" value={form.autoReplyModel} onChange={e => set('autoReplyModel', e.target.value)} disabled={!canManageTraining} />
              </div>
              <div className="aitc-field">
                <label>Classifier model</label>
                <input className="aitc-input" value={form.classifierModel} onChange={e => set('classifierModel', e.target.value)} disabled={!canManageTraining} />
              </div>
              <div className="aitc-field">
                <label>Training model</label>
                <input className="aitc-input" value={form.trainingModel} onChange={e => set('trainingModel', e.target.value)} disabled={!canManageTraining} />
              </div>
              <label className="aitc-toggle-row">
                <span>Allow premium model for auto reply</span>
                <input type="checkbox" checked={form.allowPremiumForAutoReply} onChange={e => set('allowPremiumForAutoReply', e.target.checked)} disabled={!canManageTraining} />
              </label>
              <div className="aitc-field">
                <label>Max output tokens: {form.maxOutputTokens}</label>
                <input type="range" min={120} max={400} value={form.maxOutputTokens} onChange={e => set('maxOutputTokens', Number(e.target.value))} disabled={!canManageTraining} style={{ width: '100%' }} />
              </div>
              <div className="aitc-field">
                <label>Temperature: {form.temperature}</label>
                <input type="range" min={0} max={1} step={0.1} value={form.temperature} onChange={e => set('temperature', Number(e.target.value))} disabled={!canManageTraining} style={{ width: '100%' }} />
              </div>
            </div>
          )}

          {tab === 'safety' && (
            <div className="aitc-settings-section">
              <label className="aitc-toggle-row">
                <span>Ignore group messages</span>
                <input type="checkbox" checked={form.ignoreGroupMessages} onChange={e => set('ignoreGroupMessages', e.target.checked)} disabled={!canManageTraining} />
              </label>
              <label className="aitc-toggle-row">
                <span>Ignore self messages</span>
                <input type="checkbox" checked={form.ignoreSelfMessages} onChange={e => set('ignoreSelfMessages', e.target.checked)} disabled={!canManageTraining} />
              </label>
              <label className="aitc-toggle-row">
                <span>Ignore duplicate message IDs</span>
                <input type="checkbox" checked={form.ignoreDuplicateIds} onChange={e => set('ignoreDuplicateIds', e.target.checked)} disabled={!canManageTraining} />
              </label>
              <label className="aitc-toggle-row">
                <span>Ignore promotional / shortcode messages</span>
                <input type="checkbox" checked={form.ignorePromotional} onChange={e => set('ignorePromotional', e.target.checked)} disabled={!canManageTraining} />
              </label>
              <label className="aitc-toggle-row">
                <span>Human review for complaints</span>
                <input type="checkbox" checked={form.humanReviewComplaints} onChange={e => set('humanReviewComplaints', e.target.checked)} disabled={!canManageTraining} />
              </label>
              <label className="aitc-toggle-row">
                <span>Human review for payment disputes</span>
                <input type="checkbox" checked={form.humanReviewPayments} onChange={e => set('humanReviewPayments', e.target.checked)} disabled={!canManageTraining} />
              </label>
              <label className="aitc-toggle-row">
                <span>Human review for low confidence</span>
                <input type="checkbox" checked={form.humanReviewLowConfidence} onChange={e => set('humanReviewLowConfidence', e.target.checked)} disabled={!canManageTraining} />
              </label>
            </div>
          )}

          {canManageTraining && (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
              <button type="button" className="aitc-btn aitc-btn--secondary" onClick={() => setForm(data ?? form)}>
                Cancel
              </button>
              <button
                type="button"
                className="aitc-btn aitc-btn--primary"
                disabled={saveMut.isPending}
                onClick={() => saveMut.mutate(form)}
              >
                Save Settings
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
