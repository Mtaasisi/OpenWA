import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MaterialSymbol } from '../MaterialSymbol';
import { useToast } from '../Toast';
import { aiTrainingCenterApi } from '../../lib/ai-training-center/api';
import { AITCModal } from './shared';
import type {
  BulkActionType,
  IntentFormValues,
  LearnedIntentView,
  ReplyTemplateFormValues,
  UnknownMessageView,
} from '../../lib/ai-training-center/types';

const INTENT_OPTIONS = [
  'greeting',
  'price_question',
  'product_question',
  'location',
  'delivery',
  'installment',
  'human_request',
  'complaint',
];

export function AddNewTrainingModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [importOpen, setImportOpen] = useState(false);

  return (
    <>
      <AITCModal
        title="Add New Training"
        onClose={onClose}
        footer={
          <button type="button" className="aitc-btn aitc-btn--secondary" onClick={onClose}>
            Cancel
          </button>
        }
      >
        <div className="aitc-option-cards">
          <button
            type="button"
            className="aitc-option-card"
            onClick={() => {
              onClose();
              navigate('/ai-training-center/learned-intents?action=add-intent');
            }}
          >
            <p className="aitc-option-card__title">Add New Intent</p>
            <p className="aitc-option-card__desc">Create a new intent with phrases and meanings.</p>
          </button>
          <button
            type="button"
            className="aitc-option-card"
            onClick={() => {
              onClose();
              navigate('/ai-training-center/reply-templates?action=new');
            }}
          >
            <p className="aitc-option-card__title">Add Reply Template</p>
            <p className="aitc-option-card__desc">Create a new reply template for AI.</p>
          </button>
          <button
            type="button"
            className="aitc-option-card"
            onClick={() => {
              onClose();
              navigate('/ai-training-center/unknown-messages');
            }}
          >
            <p className="aitc-option-card__title">Review Unknown Messages</p>
            <p className="aitc-option-card__desc">Review and train unknown messages.</p>
          </button>
          <button type="button" className="aitc-option-card" onClick={() => setImportOpen(true)}>
            <p className="aitc-option-card__title">Import Training Data</p>
            <p className="aitc-option-card__desc">Import learned intents from a CSV file.</p>
          </button>
        </div>
      </AITCModal>

      {importOpen && (
        <ImportTrainingDataModal
          onClose={() => setImportOpen(false)}
          onSuccess={() => {
            setImportOpen(false);
            onClose();
          }}
        />
      )}
    </>
  );
}

const IMPORT_CSV_SAMPLE = `phrase,intent,suggested_reply,reply_variations,status,usage_count
mambo,greeting,Mambo vipi Boss 😊 Karibu Inauzwa.,habari|vip,active,0`;

export function ImportTrainingDataModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState('');

  const importMut = useMutation({
    mutationFn: (csv: string) => aiTrainingCenterApi.importTrainingData(csv),
    onSuccess: res => {
      toast.success(`Imported ${res.imported} intents (${res.skipped} skipped)`);
      void qc.invalidateQueries({ queryKey: ['ai-training-center'] });
      onSuccess?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onFileChange = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <AITCModal
      title="Import Training Data"
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="aitc-btn aitc-btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="aitc-btn aitc-btn--primary"
            disabled={!csvText.trim() || importMut.isPending}
            onClick={() => importMut.mutate(csvText)}
          >
            {importMut.isPending ? 'Importing…' : 'Import CSV'}
          </button>
        </>
      }
    >
      <p style={{ fontSize: '0.8125rem', color: '#64748b', marginBottom: '0.75rem' }}>
        Upload or paste a CSV with columns: <code>phrase</code>, <code>intent</code>,{' '}
        <code>suggested_reply</code> (required). Optional: <code>reply_variations</code>,{' '}
        <code>status</code>, <code>usage_count</code>.
      </p>
      <div className="aitc-field">
        <label>CSV file</label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={e => onFileChange(e.target.files?.[0])}
        />
      </div>
      <div className="aitc-field">
        <label>Or paste CSV</label>
        <textarea
          className="aitc-input"
          rows={8}
          value={csvText}
          placeholder={IMPORT_CSV_SAMPLE}
          onChange={e => setCsvText(e.target.value)}
          style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.8125rem' }}
        />
      </div>
      <button
        type="button"
        className="aitc-btn aitc-btn--ghost"
        onClick={() => setCsvText(IMPORT_CSV_SAMPLE)}
      >
        Load sample format
      </button>
    </AITCModal>
  );
}

export function AddEditIntentModal({
  onClose,
  initial,
  onSave,
  saving,
}: {
  onClose: () => void;
  initial?: Partial<IntentFormValues>;
  onSave: (values: IntentFormValues) => void;
  saving?: boolean;
}) {
  const [phrase, setPhrase] = useState(initial?.phrase ?? '');
  const [variations, setVariations] = useState(initial?.variations ?? '');
  const [intent, setIntent] = useState(initial?.intent ?? 'greeting');
  const [meaning, setMeaning] = useState(initial?.meaning ?? '');
  const [confidence, setConfidence] = useState(initial?.confidence ?? 90);
  const [status, setStatus] = useState<IntentFormValues['status']>(initial?.status ?? 'active');
  const [replyVariations, setReplyVariations] = useState<string[]>(
    initial?.replyVariations ?? [''],
  );

  return (
    <AITCModal
      title={initial?.phrase ? 'Edit Intent' : 'Add Intent'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="aitc-btn aitc-btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="aitc-btn aitc-btn--primary"
            disabled={saving || !phrase.trim()}
            onClick={() =>
              onSave({
                phrase,
                variations,
                intent,
                meaning,
                confidence,
                status,
                replyVariations: replyVariations.filter(v => v.trim()),
              })
            }
          >
            Save Intent
          </button>
        </>
      }
    >
      <div className="aitc-field">
        <label>Phrase customer says</label>
        <input className="aitc-input" value={phrase} onChange={e => setPhrase(e.target.value)} />
      </div>
      <div className="aitc-field">
        <label>Other variations (comma separated)</label>
        <input className="aitc-input" value={variations} onChange={e => setVariations(e.target.value)} />
      </div>
      <div className="aitc-field">
        <label>Intent</label>
        <select className="aitc-select" value={intent} onChange={e => setIntent(e.target.value)}>
          {INTENT_OPTIONS.map(o => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>
      <div className="aitc-field">
        <label>Meaning (optional)</label>
        <input className="aitc-input" value={meaning} onChange={e => setMeaning(e.target.value)} />
      </div>
      <div className="aitc-field">
        <label>Confidence: {confidence}%</label>
        <input
          type="range"
          min={0}
          max={100}
          value={confidence}
          onChange={e => setConfidence(Number(e.target.value))}
          style={{ width: '100%' }}
        />
      </div>
      <div className="aitc-field">
        <label>Status</label>
        <select
          className="aitc-select"
          value={status}
          onChange={e => setStatus(e.target.value as IntentFormValues['status'])}
        >
          <option value="active">Active</option>
          <option value="pending_review">Pending Review</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>
      <div className="aitc-field">
        <label>Reply variations</label>
        {replyVariations.map((v, i) => (
          <div key={i} style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.35rem' }}>
            <input
              className="aitc-input"
              value={v}
              onChange={e => {
                const next = [...replyVariations];
                next[i] = e.target.value;
                setReplyVariations(next);
              }}
            />
            <button
              type="button"
              className="aitc-icon-btn"
              onClick={() => setReplyVariations(replyVariations.filter((_, j) => j !== i))}
              aria-label="Remove variation"
            >
              <MaterialSymbol name="delete" size={18} />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="aitc-btn aitc-btn--ghost"
          onClick={() => setReplyVariations([...replyVariations, ''])}
        >
          Add Variation
        </button>
      </div>
    </AITCModal>
  );
}

export function IntentDetailsDrawer({
  intent,
  onClose,
  onEdit,
  onDisable,
}: {
  intent: LearnedIntentView;
  onClose: () => void;
  onEdit: () => void;
  onDisable: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="aitc-drawer-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Intent details"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside className="aitc-drawer">
        <header className="aitc-drawer__header">
          <strong>{intent.phrase}</strong>
          <button type="button" className="aitc-icon-btn" onClick={onClose} aria-label="Close">
            <MaterialSymbol name="close" size={22} />
          </button>
        </header>
        <div className="aitc-drawer__body">
          <p><strong>Intent:</strong> {intent.intent}</p>
          <p><strong>Status:</strong> {intent.status}</p>
          <p><strong>Confidence:</strong> {intent.confidence}%</p>
          <p><strong>Usage:</strong> {intent.usageCount}</p>
          <p><strong>Trained by:</strong> {intent.trainedBy ?? '—'}</p>
          <p><strong>Phrases:</strong> {intent.examples.join(', ')}</p>
          {intent.meaning && <p><strong>Meaning:</strong> {intent.meaning}</p>}
          {intent.suggestedReply && (
            <div className="aitc-panel-card" style={{ marginTop: '0.75rem' }}>
              <p className="aitc-panel-card__title">Reply preview</p>
              <p style={{ fontSize: '0.875rem', margin: 0 }}>{intent.suggestedReply}</p>
            </div>
          )}
        </div>
        <footer className="aitc-drawer__footer">
          <button type="button" className="aitc-btn aitc-btn--primary" onClick={onEdit}>
            Edit Intent
          </button>
          <button type="button" className="aitc-btn aitc-btn--danger" onClick={onDisable}>
            Disable Intent
          </button>
        </footer>
      </aside>
    </div>
  );
}

export function AddReplyTemplateModal({
  onClose,
  onSave,
  saving,
}: {
  onClose: () => void;
  onSave: (values: ReplyTemplateFormValues) => void;
  saving?: boolean;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('greeting');
  const [message, setMessage] = useState('');
  const [language, setLanguage] = useState('mixed');
  const [active, setActive] = useState(true);
  const vars = ['{customer_name}', '{product_name}', '{price}', '{shop_name}'];

  return (
    <AITCModal
      title="Add Reply Template"
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="aitc-btn aitc-btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="aitc-btn aitc-btn--primary"
            disabled={saving || !name.trim() || !message.trim()}
            onClick={() => onSave({ name, category, message, language, active })}
          >
            Save Template
          </button>
        </>
      }
    >
      <div className="aitc-field">
        <label>Template name</label>
        <input className="aitc-input" value={name} onChange={e => setName(e.target.value)} />
      </div>
      <div className="aitc-field">
        <label>Category</label>
        <select className="aitc-select" value={category} onChange={e => setCategory(e.target.value)}>
          <option value="greeting">Greeting</option>
          <option value="price">Price</option>
          <option value="location">Location</option>
          <option value="delivery">Delivery</option>
          <option value="installment">Installment</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div className="aitc-field">
        <label>Template message</label>
        <textarea value={message} onChange={e => setMessage(e.target.value)} />
        <div className="aitc-var-chips" style={{ marginTop: '0.35rem' }}>
          {vars.map(v => (
            <button
              key={v}
              type="button"
              className="aitc-var-chip"
              onClick={() => setMessage(m => `${m}${m ? ' ' : ''}${v}`)}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      <div className="aitc-field">
        <label>Reply language</label>
        <select className="aitc-select" value={language} onChange={e => setLanguage(e.target.value)}>
          <option value="sw">Swahili</option>
          <option value="en">English</option>
          <option value="mixed">Mixed</option>
        </select>
      </div>
      <label className="aitc-toggle-row">
        <span>Active</span>
        <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
      </label>
    </AITCModal>
  );
}

export function ReviewUnknownMessageModal({
  item,
  onClose,
  onReject,
  onSave,
  onSaveNext,
  saving,
}: {
  item: UnknownMessageView;
  onClose: () => void;
  onReject: () => void;
  onSave: (body: { intent: string; reply: string; confidence: number }) => void;
  onSaveNext?: () => void;
  saving?: boolean;
}) {
  const [intent, setIntent] = useState(item.detectedIntent ?? 'product_question');
  const [reply, setReply] = useState(item.suggestedReply ?? '');
  const [confidence, setConfidence] = useState(item.confidence);

  useEffect(() => {
    setIntent(item.detectedIntent ?? 'product_question');
    setReply(item.suggestedReply ?? '');
    setConfidence(item.confidence);
  }, [item]);

  return (
    <AITCModal
      title="Review Unknown Message"
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="aitc-btn aitc-btn--danger" onClick={onReject} disabled={saving}>
            Reject
          </button>
          <button
            type="button"
            className="aitc-btn aitc-btn--primary"
            disabled={saving}
            onClick={() => onSave({ intent, reply, confidence })}
          >
            Save & Train
          </button>
          {onSaveNext && (
            <button
              type="button"
              className="aitc-btn aitc-btn--primary"
              disabled={saving}
              onClick={() => {
                onSave({ intent, reply, confidence });
                onSaveNext();
              }}
            >
              Save & Train + Next
            </button>
          )}
        </>
      }
    >
      <div className="aitc-panel-card">
        <p className="aitc-panel-card__title">Customer message</p>
        <p style={{ margin: 0 }}>{item.message}</p>
      </div>
      <div className="aitc-field">
        <label>AI detected intent</label>
        <select className="aitc-select" value={intent} onChange={e => setIntent(e.target.value)}>
          {INTENT_OPTIONS.map(o => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>
      {item.suggestedMeaning && (
        <p style={{ fontSize: '0.8125rem', color: '#64748b' }}>
          <strong>Suggested meaning:</strong> {item.suggestedMeaning}
        </p>
      )}
      <div className="aitc-field">
        <label>Reply to train</label>
        <textarea value={reply} onChange={e => setReply(e.target.value)} />
      </div>
      <div className="aitc-field">
        <label>Confidence: {confidence}%</label>
        <input
          type="range"
          min={0}
          max={100}
          value={confidence}
          onChange={e => setConfidence(Number(e.target.value))}
          style={{ width: '100%' }}
        />
      </div>
    </AITCModal>
  );
}

export function BulkActionsModal({
  count,
  onClose,
  onApply,
  saving,
  target = 'unknown',
}: {
  count: number;
  onClose: () => void;
  onApply: (
    action: BulkActionType,
    options?: { category?: string; replyTemplateId?: string },
  ) => void;
  saving?: boolean;
  target?: 'intents' | 'unknown';
}) {
  const [action, setAction] = useState<BulkActionType>('approve');
  const [category, setCategory] = useState('greeting');
  const [replyTemplateId, setReplyTemplateId] = useState('');

  const { data: replyTemplates = [] } = useQuery({
    queryKey: ['ai-training-center', 'reply-templates'],
    queryFn: () => aiTrainingCenterApi.listReplyTemplates(),
    enabled: target === 'intents' && action === 'assign_template',
    staleTime: 60_000,
  });

  const canApply =
    action !== 'assign_template' || replyTemplateId.trim().length > 0;

  return (
    <AITCModal
      title="Bulk Actions"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="aitc-btn aitc-btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="aitc-btn aitc-btn--primary"
            disabled={saving || !canApply}
            onClick={() =>
              onApply(action, {
                category: action === 'change_category' ? category : undefined,
                replyTemplateId:
                  action === 'assign_template' ? replyTemplateId : undefined,
              })
            }
          >
            {saving ? 'Applying…' : 'Apply Action'}
          </button>
        </>
      }
    >
      <p style={{ fontSize: '0.8125rem', color: '#64748b' }}>
        This will affect <strong>{count}</strong> selected items.
      </p>
      <div className="aitc-field">
        <label>Select action</label>
        <select
          className="aitc-select"
          value={action}
          onChange={e => setAction(e.target.value as BulkActionType)}
        >
          <option value="approve">Approve Selected</option>
          <option value="reject">Reject Selected</option>
          <option value="disable">Disable Selected</option>
          <option value="change_category">Change Category</option>
          {target === 'intents' && <option value="assign_template">Assign Reply Template</option>}
        </select>
      </div>
      {action === 'change_category' && (
        <div className="aitc-field">
          <label>Update category</label>
          <select className="aitc-select" value={category} onChange={e => setCategory(e.target.value)}>
            {INTENT_OPTIONS.map(o => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
      )}
      {action === 'assign_template' && (
        <div className="aitc-field">
          <label>Reply template</label>
          <select
            className="aitc-select"
            value={replyTemplateId}
            onChange={e => setReplyTemplateId(e.target.value)}
          >
            <option value="">Select template…</option>
            {replyTemplates.map(t => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.category})
              </option>
            ))}
          </select>
        </div>
      )}
    </AITCModal>
  );
}
