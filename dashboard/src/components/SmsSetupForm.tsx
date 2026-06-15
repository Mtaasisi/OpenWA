import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Wallet, Power, PowerOff } from 'lucide-react';
import { smsApi } from '../services/api';
import { useRole } from '../hooks/useRole';

type SmsSetupFormProps = {
  /** modal = compact layout for Add Channel popup */
  variant?: 'panel' | 'modal';
  onSaved?: () => void;
};

export function SmsSetupForm({ variant = 'panel', onSaved }: SmsSetupFormProps) {
  const { t } = useTranslation();
  const { isAdmin, canWrite } = useRole();
  const queryClient = useQueryClient();
  const compact = variant === 'modal';

  const [profileId, setProfileId] = useState('');
  const [password, setPassword] = useState('');
  const [senderId, setSenderId] = useState('');
  const [countryCode, setCountryCode] = useState('ALL');
  const [priority, setPriority] = useState('High');
  const [testPhone, setTestPhone] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['sms', 'settings'],
    queryFn: () => smsApi.getSettings(),
    enabled: canWrite,
  });

  useEffect(() => {
    if (!settings) return;
    setProfileId(settings.profileId ?? '');
    setSenderId(settings.senderId ?? '');
    setCountryCode(settings.countryCode || 'ALL');
    setPriority(settings.priority || 'High');
  }, [settings]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['sms'] });
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      smsApi.saveSettings({
        profileId,
        password: password || undefined,
        senderId,
        countryCode,
        priority,
      }),
    onSuccess: () => {
      setPassword('');
      setFeedback(t('channels.smsPasswordMasked'));
      invalidate();
      onSaved?.();
    },
    onError: (err: Error) => setFeedback(err.message),
  });

  const testMutation = useMutation({
    mutationFn: () => smsApi.test({ toPhone: testPhone }),
    onSuccess: res => {
      setFeedback(res.message);
      invalidate();
      onSaved?.();
    },
    onError: (err: Error) => setFeedback(err.message),
  });

  const balanceMutation = useMutation({
    mutationFn: () => smsApi.checkBalance(),
    onSuccess: res => {
      setFeedback(
        res.success
          ? `${t('channels.smsBalance')}: ${res.balance ?? '—'}`
          : (res.error ?? 'Balance check failed'),
      );
      invalidate();
    },
    onError: (err: Error) => setFeedback(err.message),
  });

  const disableMutation = useMutation({
    mutationFn: () => smsApi.disable(),
    onSuccess: () => invalidate(),
  });

  const activateMutation = useMutation({
    mutationFn: () => smsApi.activate(),
    onSuccess: () => invalidate(),
  });

  if (isLoading && canWrite) {
    return (
      <div className="sms-panel__loading">
        <Loader2 className="spin" size={28} />
      </div>
    );
  }

  if (!canWrite) {
    return <p>{t('inbox.readOnly')}</p>;
  }

  return (
    <form
      className={`sms-panel__form${compact ? ' sms-panel__form--modal' : ''}`}
      onSubmit={e => {
        e.preventDefault();
        if (isAdmin) saveMutation.mutate();
      }}
    >
      <div className={`sms-panel__grid${compact ? ' sms-panel__grid--modal' : ''}`}>
        <label>
          <span>{t('channels.smsProvider')}</span>
          <input type="text" value="MobiShastra" readOnly disabled />
        </label>
        <label>
          <span>{t('channels.smsProfileId')}</span>
          <input
            value={profileId}
            onChange={e => setProfileId(e.target.value)}
            disabled={!isAdmin}
          />
        </label>
        <label>
          <span>{t('channels.smsPassword')}</span>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={settings?.passwordMasked ? '••••••••' : ''}
            disabled={!isAdmin}
          />
          {settings?.passwordMasked && !password && (
            <small>{t('channels.smsPasswordMasked')}</small>
          )}
        </label>
        <label>
          <span>{t('channels.smsSenderId')}</span>
          <input
            value={senderId}
            onChange={e => setSenderId(e.target.value)}
            disabled={!isAdmin}
          />
        </label>
        {!compact && (
          <>
            <label>
              <span>{t('channels.smsCountryCode')}</span>
              <input
                value={countryCode}
                onChange={e => setCountryCode(e.target.value)}
                disabled={!isAdmin}
              />
            </label>
            <label>
              <span>{t('channels.smsPriority')}</span>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value)}
                disabled={!isAdmin}
              >
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </label>
          </>
        )}
      </div>

      {!compact && (
        <div className="sms-panel__meta">
          {settings?.lastBalance != null && (
            <span>
              {t('channels.smsBalance')}: <strong>{settings.lastBalance}</strong>
            </span>
          )}
          {settings?.lastTestAt && (
            <span>
              {t('channels.smsLastTest')}: {new Date(settings.lastTestAt).toLocaleString()}
            </span>
          )}
          {settings?.lastError && (
            <span className="sms-panel__error">
              {t('channels.smsLastError')}: {settings.lastError}
            </span>
          )}
        </div>
      )}

      {feedback && <p className="sms-panel__feedback">{feedback}</p>}

      <div className={`sms-panel__actions${compact ? ' sms-panel__actions--modal' : ''}`}>
        {isAdmin && (
          <button
            type="submit"
            className="fu-btn fu-btn--primary"
            disabled={saveMutation.isPending || !profileId.trim() || !senderId.trim()}
          >
            {saveMutation.isPending ? <Loader2 className="spin" size={16} /> : t('channels.smsSaveCredentials')}
          </button>
        )}
        <label className="sms-panel__test-phone">
          <input
            type="tel"
            value={testPhone}
            onChange={e => setTestPhone(e.target.value)}
            placeholder={t('channels.smsTestPhone')}
          />
        </label>
        <button
          type="button"
          className="fu-btn fu-btn--secondary"
          disabled={!testPhone.trim() || testMutation.isPending}
          onClick={() => testMutation.mutate()}
        >
          {testMutation.isPending ? <Loader2 className="spin" size={16} /> : t('channels.smsTestSms')}
        </button>
        {!compact && (
          <>
            <button
              type="button"
              className="fu-btn fu-btn--secondary"
              disabled={balanceMutation.isPending}
              onClick={() => balanceMutation.mutate()}
            >
              {balanceMutation.isPending ? (
                <Loader2 className="spin" size={16} />
              ) : (
                <>
                  <Wallet size={14} /> {t('channels.smsCheckBalance')}
                </>
              )}
            </button>
            {isAdmin &&
              (settings?.isEnabled ? (
                <button
                  type="button"
                  className="fu-btn fu-btn--ghost"
                  disabled={disableMutation.isPending}
                  onClick={() => disableMutation.mutate()}
                >
                  <PowerOff size={14} /> {t('channels.smsDisable')}
                </button>
              ) : (
                <button
                  type="button"
                  className="fu-btn fu-btn--secondary"
                  disabled={activateMutation.isPending}
                  onClick={() => activateMutation.mutate()}
                >
                  <Power size={14} /> {t('channels.smsActivate')}
                </button>
              ))}
          </>
        )}
      </div>
    </form>
  );
}
