import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ModalOverlay } from '../ModalOverlay';
import { useToast } from '../Toast';
import { aiTrainingApi, type AiLearningSettings } from '../../services/api';

interface Props {
  settings: AiLearningSettings;
  onClose: () => void;
}

export function AiTrainingSettingsModal({ settings, onClose }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [draft, setDraft] = useState(settings);

  const save = useMutation({
    mutationFn: () => aiTrainingApi.patchSettings(draft),
    onSuccess: () => {
      toast.success(t('ai.training.settingsSaved', { defaultValue: 'Training settings saved' }));
      void qc.invalidateQueries({ queryKey: ['ai-training'] });
      void qc.invalidateQueries({ queryKey: ['ai-learning'] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = (key: keyof AiLearningSettings) => (checked: boolean) =>
    setDraft(prev => ({ ...prev, [key]: checked }));

  return (
    <ModalOverlay onClose={onClose}>
      <div className="aitc-modal" onClick={e => e.stopPropagation()}>
        <h3>{t('ai.training.settingsTitle', { defaultValue: 'AI Training settings' })}</h3>
        {[
          ['trainingCenterEnabled', 'Training Center enabled'],
          ['autoCreateFromLowConfidence', 'Auto-create from low-confidence replies'],
          ['autoCreateFromHumanReplies', 'Suggest learning from human replies'],
          ['dailyInboxScan', 'Daily inbox scan'],
          ['useLlmTrainingSuggestions', 'Use LLM for training option suggestions'],
          ['autoClusterRepeated', 'Auto-cluster repeated questions'],
          ['requireAdminApproval', 'Require admin approval before apply'],
          ['autoReindexAfterApproval', 'Auto-reindex after approval'],
          ['autoReindexSmallUpdatesOnly', 'Auto-reindex small updates only'],
          ['allowMarkdownWrites', 'Allow writing to markdown files'],
          ['allowMemoryWrites', 'Allow writing to AI memory'],
          ['allowDbTrainingRules', 'Allow DB training rules'],
          ['maskPrivateDataInExports', 'Mask private data in exports'],
        ].map(([key, label]) => (
          <label key={key} className="aitc-field" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={Boolean(draft[key as keyof AiLearningSettings])}
              onChange={e => toggle(key as keyof AiLearningSettings)(e.target.checked)}
            />
            {label}
          </label>
        ))}
        <label className="aitc-field">
          {t('ai.training.trainingMatchThreshold', {
            defaultValue: 'Training inbox match threshold (0.5–1)',
          })}
          <input
            type="number"
            step="0.05"
            min={0.5}
            max={1}
            data-testid="ai-training-settings-threshold"
            value={draft.trainingKnowledgeMatchThreshold ?? 0.65}
            onChange={e =>
              setDraft(prev => ({
                ...prev,
                trainingKnowledgeMatchThreshold: Number(e.target.value),
              }))
            }
          />
          <span className="aitc-field__hint">
            {t('ai.training.trainingMatchHint', {
              defaultValue:
                'Applied training answers auto-reply when question similarity meets this bar (legacy knowledge still uses high confidence).',
            })}
          </span>
        </label>
        <label className="aitc-field">
          {t('ai.training.groupChatsMode', {
            defaultValue: 'WhatsApp group chats in training',
          })}
          <select
            data-testid="ai-training-settings-group-chats"
            value={draft.trainingGroupChatsMode ?? 'skip'}
            onChange={e =>
              setDraft(prev => ({
                ...prev,
                trainingGroupChatsMode: e.target.value as AiLearningSettings['trainingGroupChatsMode'],
              }))
            }
          >
            <option value="skip">
              {t('ai.training.groupChatsSkip', { defaultValue: 'Skip groups (recommended)' })}
            </option>
            <option value="separate">
              {t('ai.training.groupChatsSeparate', {
                defaultValue: 'Include groups in a separate queue',
              })}
            </option>
            <option value="include">
              {t('ai.training.groupChatsInclude', { defaultValue: 'Include groups with direct chats' })}
            </option>
          </select>
          <span className="aitc-field__hint">
            {t('ai.training.groupChatsHint', {
              defaultValue:
                'Group threads (*@g.us) are noisy for 1:1 FAQ training. Skip them unless you review group answers separately.',
            })}
          </span>
        </label>
        <label className="aitc-field">
          Scan last X days
          <input
            type="number"
            min={1}
            max={90}
            value={draft.scanLastDays ?? 7}
            onChange={e => setDraft(prev => ({ ...prev, scanLastDays: Number(e.target.value) }))}
          />
        </label>
        <label className="aitc-field">
          Daily scan time (HH:mm)
          <input
            type="time"
            value={draft.dailyScanTime ?? '02:00'}
            onChange={e => setDraft(prev => ({ ...prev, dailyScanTime: e.target.value }))}
          />
        </label>
        <div className="aitc-modal__actions">
          <button type="button" className="aitc-btn aitc-btn--primary" onClick={() => save.mutate()}>
            {t('common.save', { defaultValue: 'Save' })}
          </button>
          <button type="button" className="aitc-btn aitc-btn--ghost" onClick={onClose}>
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
