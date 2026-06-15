import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Plus, Trash2, Loader2 } from 'lucide-react';
import { followupApi, type FollowupRule } from '../../services/api';
import { StatusBadge } from '../workspace';
import { SettingsIntegrationCard } from './SettingsIntegrationShell';

export function FollowupRulesPanel() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Partial<FollowupRule> | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['followups', 'rules'],
    queryFn: () => followupApi.listRules(),
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['followups', 'templates'],
    queryFn: () => followupApi.listTemplates(),
  });

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<FollowupRule>) => {
      if (data.id) return followupApi.updateRule(data.id, data);
      return followupApi.createRule(data);
    },
    onSuccess: () => {
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: ['followups', 'rules'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => followupApi.deleteRule(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['followups', 'rules'] }),
  });

  if (isLoading) return <Loader2 className="animate-spin" size={24} />;

  return (
    <SettingsIntegrationCard
      title={t('followups.rules.title')}
      icon="rule"
      actions={
        <button
          type="button"
          className="fu-btn fu-btn--primary fu-btn--sm"
          onClick={() =>
            setEditing({
              active: true,
              mode: 'create_task',
              delayMinutes: 60,
              maxAttempts: 3,
              stopIfCustomerReplied: true,
              stopIfSaleLinked: true,
            })
          }
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
          <p className="settings-int-hint">{t('followups.rules.hint')}</p>
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
        {rules.map(rule => (
          <li key={rule.id} className="followup-settings-item">
            <div>
              <strong>{rule.name}</strong>
              <span className="muted">
                {rule.triggerEvent} · {rule.delayMinutes}min · {rule.mode}
              </span>
              {!rule.active && <StatusBadge variant="neutral">{t('common.inactive')}</StatusBadge>}
            </div>
            <div className="followup-settings-item__actions">
              <button
                type="button"
                className="fu-btn fu-btn--ghost fu-btn--sm"
                onClick={() => setEditing(rule)}
              >
                {t('common.edit')}
              </button>
              <button
                type="button"
                className="fu-btn fu-btn--ghost fu-btn--sm"
                onClick={() => deleteMutation.mutate(rule.id)}
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
            {t('followups.rules.trigger')}
            <select
              value={editing.triggerEvent ?? ''}
              onChange={e => setEditing({ ...editing, triggerEvent: e.target.value })}
              required
            >
              {[
                'stage_entered',
                'no_customer_reply',
                'no_payment',
                'out_of_stock',
                'visit_scheduled',
                'stale_conversation',
                'manual',
              ].map(ev => (
                <option key={ev} value={ev}>
                  {ev}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('followups.stage')}
            <select
              value={editing.stage ?? ''}
              onChange={e => setEditing({ ...editing, stage: e.target.value || null })}
            >
              <option value="">{t('followups.anyStage')}</option>
              {[
                'new_lead',
                'price_sent',
                'waiting_customer_reply',
                'payment_pending',
                'product_suggested',
              ].map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('followups.rules.delayMinutes')}
            <input
              type="number"
              min={0}
              value={editing.delayMinutes ?? 0}
              onChange={e => setEditing({ ...editing, delayMinutes: Number(e.target.value) })}
            />
          </label>
          <label>
            {t('followups.rules.template')}
            <select
              value={editing.templateId ?? ''}
              onChange={e => setEditing({ ...editing, templateId: e.target.value || null })}
            >
              <option value="">{t('followups.none')}</option>
              {templates.map(tpl => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('followups.rules.mode')}
            <select
              value={editing.mode ?? 'create_task'}
              onChange={e =>
                setEditing({ ...editing, mode: e.target.value as 'create_task' | 'auto_send' })
              }
            >
              <option value="create_task">{t('followups.rules.createTask')}</option>
              <option value="auto_send">{t('followups.rules.autoSend')}</option>
            </select>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={editing.active ?? true}
              onChange={e => setEditing({ ...editing, active: e.target.checked })}
            />
            {t('common.active')}
          </label>
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
