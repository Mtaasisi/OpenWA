import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ModalOverlay } from '../ModalOverlay';
import type { ConversationPriority, ConversationSource } from '../../services/api';

const SOURCES: ConversationSource[] = [
  'whatsapp',
  'instagram',
  'facebook',
  'website',
  'phone_call',
  'walk_in',
  'referral',
  'other',
];

const PRIORITIES: ConversationPriority[] = ['low', 'normal', 'high', 'hot'];

type StaffOption = { id: string; name: string };

type Props = {
  open: boolean;
  staff: StaffOption[];
  onClose: () => void;
  onSubmit: (data: {
    customerName: string;
    customerPhone?: string;
    source: ConversationSource;
    assignedStaffId?: string;
    priority?: ConversationPriority;
    productInterest?: string;
    notes?: string;
  }) => void;
  pending?: boolean;
};

export function FollowupNewTaskModal({ open, staff, onClose, onSubmit, pending }: Props) {
  const { t } = useTranslation();
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [source, setSource] = useState<ConversationSource>('whatsapp');
  const [assignedStaffId, setAssignedStaffId] = useState('');
  const [priority, setPriority] = useState<ConversationPriority>('normal');
  const [productInterest, setProductInterest] = useState('');
  const [notes, setNotes] = useState('');

  if (!open) return null;

  const handleSubmit = () => {
    if (!customerName.trim()) return;
    onSubmit({
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || undefined,
      source,
      assignedStaffId: assignedStaffId || undefined,
      priority,
      productInterest: productInterest.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <ModalOverlay onClose={onClose} className="fu-modal-overlay">
      <div className="fu-modal" onClick={e => e.stopPropagation()} role="dialog">
        <h3>{t('followups.newTask')}</h3>
        <label htmlFor="fu-new-name">{t('followups.newTaskForm.name')}</label>
        <input
          id="fu-new-name"
          value={customerName}
          onChange={e => setCustomerName(e.target.value)}
          placeholder={t('followups.newTaskForm.namePlaceholder')}
        />
        <label htmlFor="fu-new-phone">{t('followups.newTaskForm.phone')}</label>
        <input
          id="fu-new-phone"
          value={customerPhone}
          onChange={e => setCustomerPhone(e.target.value)}
        />
        <label htmlFor="fu-new-source">{t('followups.source')}</label>
        <select id="fu-new-source" value={source} onChange={e => setSource(e.target.value as ConversationSource)}>
          {SOURCES.map(s => (
            <option key={s} value={s}>
              {t(`followups.sources.${s}`, { defaultValue: s })}
            </option>
          ))}
        </select>
        <label htmlFor="fu-new-staff">{t('followups.newTaskForm.assignee')}</label>
        <select id="fu-new-staff" value={assignedStaffId} onChange={e => setAssignedStaffId(e.target.value)}>
          <option value="">{t('followups.filters.allStaff')}</option>
          {staff.map(s => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <label htmlFor="fu-new-priority">{t('followups.table.priority')}</label>
        <select
          id="fu-new-priority"
          value={priority}
          onChange={e => setPriority(e.target.value as ConversationPriority)}
        >
          {PRIORITIES.map(p => (
            <option key={p} value={p}>
              {t(`followups.priority.${p}`, { defaultValue: p })}
            </option>
          ))}
        </select>
        <label htmlFor="fu-new-product">{t('followups.newTaskForm.product')}</label>
        <input
          id="fu-new-product"
          value={productInterest}
          onChange={e => setProductInterest(e.target.value)}
        />
        <label htmlFor="fu-new-notes">{t('followups.newTaskForm.notes')}</label>
        <textarea
          id="fu-new-notes"
          rows={3}
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
        <div className="fu-modal__actions">
          <button type="button" className="fu-btn fu-btn--ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="fu-btn fu-btn--primary"
            disabled={!customerName.trim() || pending}
            onClick={handleSubmit}
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
