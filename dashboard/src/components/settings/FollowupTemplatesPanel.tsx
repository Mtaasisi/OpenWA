import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Plus, Trash2, Loader2 } from 'lucide-react';
import { followupApi, type FollowupTemplate } from '../../services/api';
import { StatusBadge } from '../workspace';
import { SettingsIntegrationCard } from './SettingsIntegrationShell';

const CATEGORIES = [
  'price_followup',
  'budget_followup',
  'payment_pending',
  'out_of_stock',
  'visit_branch',
  'dead_lead_recovery',
  'stock_back',
  'repair_ready',
];

const PLACEHOLDERS =
  '{customer_name}, {product_name}, {price}, {lower_price}, {staff_name}, {branch_name}, {payment_number}, {pickup_location}';

export function FollowupTemplatesPanel() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Partial<FollowupTemplate> | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['followups', 'templates'],
    queryFn: () => followupApi.listTemplates(),
  });

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<FollowupTemplate>) => {
      if (data.id) return followupApi.updateTemplate(data.id, data);
      return followupApi.createTemplate(data);
    },
    onSuccess: () => {
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: ['followups', 'templates'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => followupApi.deleteTemplate(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['followups', 'templates'] }),
  });

  if (isLoading) {
    return (
      <div className="settings-integration-loading">
        <Loader2 className="animate-spin" size={24} />
      </div>
    );
  }

  return (
    <SettingsIntegrationCard
      title={t('followups.templates.listTitle')}
      icon="description"
      actions={
        <button
          type="button"
          className="fu-btn fu-btn--primary fu-btn--sm"
          onClick={() => setEditing({ isActive: true, channel: 'whatsapp', language: 'en' })}
        >
          <Plus size={14} /> {t('common.create')}
        </button>
      }
    >
      {moreOpen ? (
        <>
          <button
            type="button"
            className="fu-btn fu-btn--ghost fu-btn--sm settings-inline-show-less"
            onClick={() => setMoreOpen(false)}
          >
            {t('settings.showLess')}
          </button>
          <p className="settings-int-hint">
            {t('followups.templates.hint', { placeholders: PLACEHOLDERS })}
          </p>
        </>
      ) : (
        <button
          type="button"
          className="fu-btn fu-btn--ghost fu-btn--sm settings-inline-more-btn"
          onClick={() => setMoreOpen(true)}
        >
          <span>{t('settings.moreOptions')}</span>
          <ChevronDown size={18} aria-hidden />
        </button>
      )}

      <ul className="followup-settings-list">
        {templates.map(tpl => (
          <li key={tpl.id} className="followup-settings-item">
            <div>
              <strong>{tpl.name}</strong>
              <span className="muted">{tpl.category}</span>
              {tpl.requiresWhatsappApproval && (
                <StatusBadge variant="warning">{tpl.whatsappTemplateStatus}</StatusBadge>
              )}
            </div>
            <div className="followup-settings-item__actions">
              <button
                type="button"
                className="fu-btn fu-btn--ghost fu-btn--sm"
                onClick={() => setEditing(tpl)}
              >
                {t('common.edit')}
              </button>
              <button
                type="button"
                className="fu-btn fu-btn--ghost fu-btn--sm"
                onClick={() => deleteMutation.mutate(tpl.id)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {editing && (
        <form
          className="followup-settings-form"
          onSubmit={e => {
            e.preventDefault();
            saveMutation.mutate(editing);
          }}
        >
          <label>
            {t('common.name')}
            <input
              value={editing.name ?? ''}
              onChange={e => setEditing({ ...editing, name: e.target.value })}
              required
            />
          </label>
          <label>
            {t('common.type')}
            <select
              value={editing.category ?? ''}
              onChange={e => setEditing({ ...editing, category: e.target.value })}
              required
            >
              <option value="">{t('followups.selectCategory')}</option>
              {CATEGORIES.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('followups.templates.body')}
            <textarea
              rows={4}
              value={editing.body ?? ''}
              onChange={e => setEditing({ ...editing, body: e.target.value })}
              required
            />
          </label>
          <label>
            SMS short version (optional)
            <textarea
              rows={2}
              value={editing.smsBody ?? ''}
              onChange={e => setEditing({ ...editing, smsBody: e.target.value })}
              placeholder="Shorter text for SMS fallback"
            />
          </label>
          <label>
            {t('followups.filters.channel')}
            <select
              value={editing.channel ?? 'whatsapp'}
              onChange={e => setEditing({ ...editing, channel: e.target.value })}
            >
              <option value="whatsapp">WhatsApp</option>
              <option value="sms">SMS</option>
              <option value="both">WhatsApp + SMS</option>
            </select>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={editing.requiresWhatsappApproval ?? false}
              onChange={e =>
                setEditing({ ...editing, requiresWhatsappApproval: e.target.checked })
              }
            />
            {t('followups.templates.requiresApproval')}
          </label>
          {editing.requiresWhatsappApproval && (
            <>
              <label>
                {t('followups.templates.waTemplateName')}
                <input
                  value={editing.whatsappTemplateName ?? ''}
                  onChange={e =>
                    setEditing({ ...editing, whatsappTemplateName: e.target.value })
                  }
                />
              </label>
              <label>
                {t('followups.templates.waStatus')}
                <select
                  value={editing.whatsappTemplateStatus ?? 'pending'}
                  onChange={e =>
                    setEditing({ ...editing, whatsappTemplateStatus: e.target.value })
                  }
                >
                  {['not_required', 'pending', 'approved', 'rejected'].map(s => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <div className="followup-modal__actions">
            <button
              type="button"
              className="fu-btn fu-btn--ghost fu-btn--sm"
              onClick={() => setEditing(null)}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="fu-btn fu-btn--primary fu-btn--sm"
              disabled={saveMutation.isPending}
            >
              {t('common.save')}
            </button>
          </div>
        </form>
      )}
    </SettingsIntegrationCard>
  );
}
