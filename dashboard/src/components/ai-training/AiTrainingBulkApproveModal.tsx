import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ModalOverlay } from '../ModalOverlay';
import type { AiLearningItem } from '../../services/api';
import {
  buildBulkApproveOverrides,
  buildBulkApproveDraftEdits,
  type BulkApproveOverride,
} from '../../lib/ai-training-bulk';
import { itemRequiresAdminApproval } from '../../lib/ai-training-risk';

interface Props {
  items: AiLearningItem[];
  ids: string[];
  requireAdminApproval: boolean;
  isAdmin: boolean;
  pending: boolean;
  onClose: () => void;
  onConfirm: (overrides: BulkApproveOverride[]) => void;
}

export function AiTrainingBulkApproveModal({
  items,
  ids,
  requireAdminApproval,
  isAdmin,
  pending,
  onClose,
  onConfirm,
}: Props) {
  const { t } = useTranslation();
  const selectedItems = useMemo(
    () => ids.map(id => items.find(item => item.id === id)).filter(Boolean) as AiLearningItem[],
    [ids, items],
  );
  const [draftEdits, setDraftEdits] = useState(() => buildBulkApproveDraftEdits(items, ids));

  const draftCount = Object.values(draftEdits).filter(v => v.trim()).length;

  return (
    <ModalOverlay onClose={onClose}>
      <div
        className="aitc-modal aitc-bulk-modal"
        data-testid="ai-training-bulk-modal"
        onClick={e => e.stopPropagation()}
      >
        <h3>{t('ai.training.bulkModalTitle', { defaultValue: 'Bulk approve training' })}</h3>
        <p className="aitc-bulk-modal__hint">
          {t('ai.training.bulkModalHint', {
            defaultValue:
              'Review answers for {{n}} items. Saved drafts are sent as overrides; empty rows use the recommended MCQ on approve.',
            n: selectedItems.length,
          })}
        </p>
        {draftCount > 0 ? (
          <p className="aitc-bulk-modal__draft-note" data-testid="ai-training-bulk-draft-note">
            {t('ai.training.bulkDraftNote', {
              defaultValue: '{{n}} items include saved draft answers.',
              n: draftCount,
            })}
          </p>
        ) : null}
        <div className="aitc-bulk-modal__list">
          {selectedItems.map(item => {
            const adminOnly = itemRequiresAdminApproval(item, requireAdminApproval) && !isAdmin;
            return (
              <article key={item.id} className="aitc-bulk-modal__row" data-testid="ai-training-bulk-row">
                <div className="aitc-bulk-modal__row-head">
                  <strong>{item.title ?? item.question}</strong>
                  {adminOnly ? (
                    <span className="aitc-badge aitc-badge--admin">
                      {t('ai.training.adminOnly', { defaultValue: 'Admin only' })}
                    </span>
                  ) : null}
                </div>
                <label className="aitc-field">
                  {t('ai.training.bulkAnswerLabel', { defaultValue: 'Answer to apply' })}
                  <textarea
                    rows={3}
                    value={draftEdits[item.id] ?? ''}
                    placeholder={t('ai.training.bulkAnswerPlaceholder', {
                      defaultValue: 'Leave empty to use recommended MCQ',
                    })}
                    disabled={adminOnly}
                    onChange={e =>
                      setDraftEdits(prev => ({
                        ...prev,
                        [item.id]: e.target.value,
                      }))
                    }
                  />
                </label>
              </article>
            );
          })}
        </div>
        <div className="aitc-modal__actions">
          <button type="button" className="aitc-btn aitc-btn--ghost" onClick={onClose}>
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </button>
          <button
            type="button"
            className="aitc-btn aitc-btn--primary"
            disabled={pending}
            data-testid="ai-training-bulk-confirm"
            onClick={() => onConfirm(buildBulkApproveOverrides(items, ids, draftEdits))}
          >
            {t('ai.training.bulkConfirm', {
              defaultValue: 'Approve & apply ({{n}})',
              n: selectedItems.length,
            })}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
