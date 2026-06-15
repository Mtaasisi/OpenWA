import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Plus, Trash2, Loader2 } from 'lucide-react';
import {
  quickReplyApi,
  QUICK_REPLY_CATEGORIES,
  type QuickReplyTemplate,
} from '../../services/api';
import { useQuickReplyPermissions } from '../../hooks/useQuickReplyPermissions';
import { StatusBadge } from '../workspace';
import { productsApi } from '../../services/api';
import { SettingsIntegrationCard } from './SettingsIntegrationShell';

const PLACEHOLDERS =
  '{customer_name}, {product_name}, {price}, {staff_name}, {branch_name}, {payment_number}, {pickup_location}, {warranty}, {delivery_fee}';

export function QuickRepliesPanel() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { canManage } = useQuickReplyPermissions();
  const [editing, setEditing] = useState<Partial<QuickReplyTemplate> | null>(null);
  const [branchFilter, setBranchFilter] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);

  const { data: inauzwaStatus } = useQuery({
    queryKey: ['products', 'inauzwa-status'],
    queryFn: () => productsApi.inauzwaSyncStatus(),
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['products', 'inauzwa-branches'],
    queryFn: () => productsApi.listInauzwaBranches(),
    enabled: !!inauzwaStatus?.configured,
  });

  const effectiveBranch = branchFilter || inauzwaStatus?.branchId || '';

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['quick-reply', 'templates', 'manage', effectiveBranch],
    queryFn: () =>
      quickReplyApi.listTemplates({
        branchId: effectiveBranch || undefined,
        manage: true,
      }),
    enabled: canManage,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<QuickReplyTemplate>) => {
      const payload = {
        ...data,
        branchId: data.branchId === '' ? null : data.branchId,
      };
      if (data.id) return quickReplyApi.updateTemplate(data.id, payload);
      return quickReplyApi.createTemplate(payload);
    },
    onSuccess: () => {
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: ['quick-reply'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => quickReplyApi.deleteTemplate(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['quick-reply'] }),
  });

  if (!canManage) {
    return <p className="settings-int-hint">{t('quickReplies.manageDenied')}</p>;
  }

  if (isLoading) {
    return (
      <div className="settings-integration-loading">
        <Loader2 className="animate-spin" size={24} />
      </div>
    );
  }

  return (
    <>
      <SettingsIntegrationCard
        title={t('quickReplies.listTitle')}
        icon="quickreply"
        actions={
          <button
            type="button"
            className="fu-btn fu-btn--primary fu-btn--sm"
            onClick={() =>
              setEditing({
                isActive: true,
                language: 'en',
                branchId: effectiveBranch || null,
                category: 'greeting',
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
            <p className="settings-int-hint">
              {t('quickReplies.settingsHint', { placeholders: PLACEHOLDERS })}
            </p>
            <p className="settings-int-hint settings-int-hint--muted">
              {t('quickReplies.separateFromWa')}
            </p>
            {branches.length > 0 && (
              <div className="settings-int-field settings-int-field--narrow">
                <label className="settings-int-label">{t('quickReplies.branchFilter')}</label>
                <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
                  <option value="">{t('quickReplies.allBranches')}</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
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
                <span className="muted">{t(`quickReplies.categories.${tpl.category}`)}</span>
                {!tpl.isActive && (
                  <StatusBadge variant="neutral">{t('common.inactive')}</StatusBadge>
                )}
                {tpl.branchId ? (
                  <StatusBadge variant="warning">{t('quickReplies.branchSpecific')}</StatusBadge>
                ) : (
                  <StatusBadge variant="success">{t('quickReplies.global')}</StatusBadge>
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
                onChange={e =>
                  setEditing({
                    ...editing,
                    category: e.target.value as QuickReplyTemplate['category'],
                  })
                }
                required
              >
                <option value="">{t('followups.selectCategory')}</option>
                {QUICK_REPLY_CATEGORIES.map(c => (
                  <option key={c} value={c}>
                    {t(`quickReplies.categories.${c}`)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('quickReplies.body')}
              <textarea
                rows={4}
                value={editing.body ?? ''}
                onChange={e => setEditing({ ...editing, body: e.target.value })}
                required
              />
            </label>
            <label>
              {t('quickReplies.language')}
              <input
                value={editing.language ?? 'en'}
                onChange={e => setEditing({ ...editing, language: e.target.value })}
              />
            </label>
            <label>
              {t('quickReplies.branchId')}
              <select
                value={editing.branchId ?? ''}
                onChange={e => setEditing({ ...editing, branchId: e.target.value || null })}
              >
                <option value="">{t('quickReplies.global')}</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={editing.isActive ?? true}
                onChange={e => setEditing({ ...editing, isActive: e.target.checked })}
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
    </>
  );
}
