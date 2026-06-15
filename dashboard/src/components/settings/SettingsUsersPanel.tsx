import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { usersApi, type StaffUser } from '../../services/api';
import { useToast } from '../Toast';
import { ModalOverlay } from '../ModalOverlay';
import { MaterialSymbol } from '../MaterialSymbol';
import { StatusBadge } from '../workspace';
import { SettingsIntegrationShell } from './SettingsIntegrationShell';
import './SettingsUsersPanel.css';

const ROLES = ['admin', 'operator', 'viewer'] as const;
const MIN_PASSWORD_LENGTH = 8;

type Props = {
  onBack: () => void;
};

function validateCreateUserForm(form: {
  email: string;
  name: string;
  password: string;
}): string | null {
  if (!form.name.trim()) return 'users.validation.nameRequired';
  if (!form.email.trim()) return 'users.validation.emailRequired';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    return 'users.validation.emailInvalid';
  }
  if (!form.password) return 'users.validation.passwordRequired';
  if (form.password.length < MIN_PASSWORD_LENGTH) return 'users.validation.passwordMinLength';
  return null;
}

export function SettingsUsersPanel({ onBack }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ email: '', name: '', password: '', role: 'operator' });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['auth', 'users'],
    queryFn: () => usersApi.list(),
  });

  const metrics = useMemo(
    () => ({
      total: users.length,
      active: users.filter(u => u.isActive).length,
      admins: users.filter(u => u.role === 'admin').length,
    }),
    [users],
  );

  const createMutation = useMutation({
    mutationFn: () =>
      usersApi.create({
        email: form.email.trim(),
        name: form.name.trim(),
        password: form.password,
        role: form.role,
      }),
    onSuccess: () => {
      toast.success(t('users.created'));
      setShowCreate(false);
      setForm({ email: '', name: '', password: '', role: 'operator' });
      void qc.invalidateQueries({ queryKey: ['auth', 'users'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => usersApi.deactivate(id),
    onSuccess: () => {
      toast.success(t('users.deactivated'));
      void qc.invalidateQueries({ queryKey: ['auth', 'users'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <SettingsIntegrationShell chromeless backSection="system" title={t('users.title')} onBack={onBack} askAiPanelId="users">
      <div className="interakt-panel settings-users-panel">
        <div className="settings-users-kpi-grid">
          <div className="settings-users-kpi">
            <p className="settings-users-kpi__label">{t('users.metrics.total')}</p>
            <p className="settings-users-kpi__value">{metrics.total}</p>
          </div>
          <div className="settings-users-kpi">
            <p className="settings-users-kpi__label">{t('users.metrics.active')}</p>
            <p className="settings-users-kpi__value">{metrics.active}</p>
          </div>
          <div className="settings-users-kpi">
            <p className="settings-users-kpi__label">{t('users.metrics.admins')}</p>
            <p className="settings-users-kpi__value">{metrics.admins}</p>
          </div>
        </div>

        <section className="settings-users-card">
          <header className="settings-users-card__head">
            <h2 className="settings-users-card__title">
              <MaterialSymbol name="group" size={20} />
              {t('users.listTitle')}
            </h2>
            <button
              type="button"
              className="settings-users-btn settings-users-btn--primary settings-users-btn--sm"
              onClick={() => setShowCreate(true)}
            >
              <Plus size={14} />
              {t('users.add')}
            </button>
          </header>

          {isLoading ? (
            <div className="settings-integration-loading" style={{ padding: '2rem' }}>
              <Loader2 className="animate-spin" size={24} />
            </div>
          ) : users.length === 0 ? (
            <p className="settings-users-empty">{t('users.empty')}</p>
          ) : (
            <div className="settings-users-table-wrap">
              <table className="settings-users-table">
                <thead>
                  <tr>
                    <th>{t('users.columns.name')}</th>
                    <th>{t('users.columns.email')}</th>
                    <th>{t('users.columns.role')}</th>
                    <th>{t('users.columns.status')}</th>
                    <th aria-hidden />
                  </tr>
                </thead>
                <tbody>
                  {users.map((user: StaffUser) => (
                    <tr key={user.id}>
                      <td className="settings-users-table__name">{user.name}</td>
                      <td>{user.email}</td>
                      <td>
                        <span
                          className={`settings-users-role${user.role === 'admin' ? ' settings-users-role--admin' : ''}`}
                        >
                          {t(`apiKeys.roles.${user.role}`)}
                        </span>
                      </td>
                      <td>
                        <StatusBadge variant={user.isActive ? 'success' : 'neutral'}>
                          {user.isActive ? t('users.active') : t('users.inactive')}
                        </StatusBadge>
                      </td>
                      <td>
                        {user.isActive && (
                          <button
                            type="button"
                            className="settings-users-btn settings-users-btn--sm"
                            onClick={() => deactivateMutation.mutate(user.id)}
                            disabled={deactivateMutation.isPending}
                          >
                            <Trash2 size={14} />
                            {t('users.deactivate')}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {showCreate && (
        <ModalOverlay
          onClose={() => setShowCreate(false)}
          className="fu-modal-overlay settings-users-modal-overlay"
        >
          <div
            className="settings-users-modal"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-users-create-title"
          >
            <header className="settings-users-modal__head">
              <h3 id="settings-users-create-title">{t('users.createTitle')}</h3>
              <button
                type="button"
                className="settings-users-modal__close"
                onClick={() => setShowCreate(false)}
                aria-label={t('common.close')}
              >
                <MaterialSymbol name="close" size={20} />
              </button>
            </header>
            <div className="settings-users-modal__body">
              <div className="settings-users-modal__field">
                <label htmlFor="settings-user-name">{t('users.fields.name')}</label>
                <input
                  id="settings-user-name"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="settings-users-modal__field">
                <label htmlFor="settings-user-email">{t('users.fields.email')}</label>
                <input
                  id="settings-user-email"
                  type="email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="settings-users-modal__field">
                <label htmlFor="settings-user-password">{t('users.fields.password')}</label>
                <input
                  id="settings-user-password"
                  type="password"
                  minLength={MIN_PASSWORD_LENGTH}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                />
                <p className="settings-users-modal__hint">
                  {t('users.passwordHint', { count: MIN_PASSWORD_LENGTH })}
                </p>
              </div>
              <div className="settings-users-modal__field">
                <label htmlFor="settings-user-role">{t('users.fields.role')}</label>
                <select
                  id="settings-user-role"
                  value={form.role}
                  onChange={e => setForm({ ...form, role: e.target.value })}
                >
                  {ROLES.map(role => (
                    <option key={role} value={role}>
                      {t(`apiKeys.roles.${role}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <footer className="settings-users-modal__footer">
              <button
                type="button"
                className="settings-users-btn"
                onClick={() => setShowCreate(false)}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="settings-users-btn settings-users-btn--primary"
                disabled={createMutation.isPending}
                onClick={() => {
                  const errorKey = validateCreateUserForm(form);
                  if (errorKey) {
                    toast.error(t(errorKey, { count: MIN_PASSWORD_LENGTH }));
                    return;
                  }
                  createMutation.mutate();
                }}
              >
                {createMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : null}
                {t('users.create')}
              </button>
            </footer>
          </div>
        </ModalOverlay>
      )}
    </SettingsIntegrationShell>
  );
}
