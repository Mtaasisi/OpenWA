import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Loader2 } from 'lucide-react';
import { followupApi, sessionApi, type FollowUpAutopilotMode } from '../../services/api';
import { useToast } from '../Toast';
import { SettingsIntegrationCard } from './SettingsIntegrationShell';
import { SettingsAskAiButton, settingsAskAiPromptForPanel } from './SettingsAskAiButton';

const MODES: FollowUpAutopilotMode[] = ['off', 'suggest_only', 'auto_send_safe', 'full_autopilot'];

export function FollowupAutopilotSettingsPanel() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [moreOpen, setMoreOpen] = useState(false);
  const { data: settings, isLoading } = useQuery({
    queryKey: ['followup', 'autopilot', 'settings'],
    queryFn: () => followupApi.getAutopilotSettings(),
  });

  const { data: dashboard } = useQuery({
    queryKey: ['followup', 'autopilot', 'dashboard'],
    queryFn: () => followupApi.getAutopilotDashboard(),
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => sessionApi.list(),
  });

  const unpauseMutation = useMutation({
    mutationFn: (sessionId: string) => followupApi.unpauseAutopilotSession(sessionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['followup', 'autopilot'] });
      toast.success(t('followups.autopilot.unpausedToast'));
    },
    onError: (err: Error) => toast.error(t('followups.autopilot.unpauseFailed'), err.message),
  });

  const saveMutation = useMutation({
    mutationFn: (patch: Parameters<typeof followupApi.updateAutopilotSettings>[0]) =>
      followupApi.updateAutopilotSettings(patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['followup', 'autopilot'] });
      toast.success(t('followups.autopilot.savedToast'));
    },
    onError: (err: Error) => toast.error(t('followups.autopilot.saveFailed'), err.message),
  });

  if (isLoading || !settings) {
    return (
      <div className="settings-integration-loading">
        <Loader2 className="animate-spin" size={24} />
      </div>
    );
  }

  const patch = (key: string, value: unknown) => {
    saveMutation.mutate({ [key]: value } as Parameters<typeof followupApi.updateAutopilotSettings>[0]);
  };

  return (
    <div className="settings-crm-stack">
      <div className="settings-int-shell__inline-actions" style={{ justifyContent: 'flex-end' }}>
        <SettingsAskAiButton
          prompt={settingsAskAiPromptForPanel('followup-autopilot') ?? 'Zima follow-up autopilot'}
        />
      </div>
      {(dashboard?.pausedAccounts.length ?? 0) > 0 && (
        <SettingsIntegrationCard title={t('followups.autopilot.pausedAccountsTitle')} icon="pause_circle">
          <p className="settings-int-hint settings-int-hint--muted">
            {t('followups.autopilot.pausedAccountsHint')}
          </p>
          <ul className="settings-int-list">
            {dashboard!.pausedAccounts.map(sessionId => {
              const name = sessions.find(s => s.id === sessionId)?.name ?? sessionId.slice(0, 12);
              return (
                <li key={sessionId} className="settings-int-list-row">
                  <span>{name}</span>
                  <button
                    type="button"
                    className="fu-btn fu-btn--ghost fu-btn--sm"
                    disabled={unpauseMutation.isPending}
                    onClick={() => unpauseMutation.mutate(sessionId)}
                  >
                    {t('followups.autopilot.unpause')}
                  </button>
                </li>
              );
            })}
          </ul>
        </SettingsIntegrationCard>
      )}

      <SettingsIntegrationCard title={t('followups.autopilot.settingsTitle')} icon="smart_toy">
        <form
          className="followup-settings-form followup-settings-form--spaced"
          onSubmit={e => e.preventDefault()}
        >
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={e => patch('enabled', e.target.checked)}
            />
            {t('followups.autopilot.masterSwitch')}
          </label>

          <label>
            {t('followups.autopilot.modeLabel')}
            <select
              value={settings.autopilotMode}
              onChange={e => patch('autopilotMode', e.target.value as FollowUpAutopilotMode)}
            >
              {MODES.map(m => (
                <option key={m} value={m}>
                  {t(`followups.autopilot.modes.${m}`, { defaultValue: m.replace(/_/g, ' ') })}
                </option>
              ))}
            </select>
          </label>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={settings.businessHoursOnly}
              onChange={e => patch('businessHoursOnly', e.target.checked)}
            />
            {t('followups.autopilot.businessHoursOnly')}
          </label>
        </form>

        {!moreOpen ? (
          <button
            type="button"
            className="fu-btn fu-btn--ghost fu-btn--sm settings-inline-more-btn"
            onClick={() => setMoreOpen(true)}
          >
            <span>{t('settings.moreOptions')}</span>
            <ChevronDown size={18} aria-hidden />
          </button>
        ) : (
          <>
            <button
              type="button"
              className="fu-btn fu-btn--ghost fu-btn--sm settings-inline-show-less"
              onClick={() => setMoreOpen(false)}
            >
              {t('settings.showLess')}
            </button>
            <p className="settings-int-hint settings-int-hint--muted">
              {t('followups.autopilot.settingsMeta')}
            </p>
            <form
              className="followup-settings-form followup-settings-form--spaced"
              onSubmit={e => e.preventDefault()}
            >
              <label>
                {t('followups.autopilot.quietHoursStart')}
                <input
                  type="time"
                  value={settings.quietHoursStart}
                  onChange={e => patch('quietHoursStart', e.target.value)}
                />
              </label>

              <label>
                {t('followups.autopilot.quietHoursEnd')}
                <input
                  type="time"
                  value={settings.quietHoursEnd}
                  onChange={e => patch('quietHoursEnd', e.target.value)}
                />
              </label>

              <label>
                {t('followups.autopilot.maxPerCustomerPerDay')}
                <input
                  type="number"
                  min={1}
                  value={settings.maxFollowupsPerCustomerPerDay}
                  onChange={e => patch('maxFollowupsPerCustomerPerDay', Number(e.target.value))}
                />
              </label>

              <label>
                {t('followups.autopilot.maxPerLead')}
                <input
                  type="number"
                  min={1}
                  value={settings.maxFollowupsPerLead}
                  onChange={e => patch('maxFollowupsPerLead', Number(e.target.value))}
                />
              </label>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={settings.requireApprovalForMediumRisk}
                  onChange={e => patch('requireApprovalForMediumRisk', e.target.checked)}
                />
                {t('followups.autopilot.requireApprovalMedium')}
              </label>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={settings.requireApprovalForHighRisk}
                  onChange={e => patch('requireApprovalForHighRisk', e.target.checked)}
                />
                {t('followups.autopilot.requireApprovalHigh')}
              </label>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={settings.allowSmsFallback}
                  onChange={e => patch('allowSmsFallback', e.target.checked)}
                />
                {t('followups.autopilot.allowSmsFallback')}
              </label>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={settings.allowWhatsAppSmsBoth}
                  onChange={e => patch('allowWhatsAppSmsBoth', e.target.checked)}
                />
                {t('followups.autopilot.allowWhatsAppSmsBoth')}
              </label>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={settings.allowGroupAutopilot}
                  onChange={e => patch('allowGroupAutopilot', e.target.checked)}
                />
                {t('followups.autopilot.allowGroupAutopilot')}
              </label>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={settings.pauseOnHighFailureRate}
                  onChange={e => patch('pauseOnHighFailureRate', e.target.checked)}
                />
                {t('followups.autopilot.pauseOnHighFailureRate')}
              </label>

              <label>
                {t('followups.autopilot.staffTakeoverPauseMinutes')}
                <input
                  type="number"
                  min={15}
                  value={settings.staffTakeoverPauseMinutes}
                  onChange={e => patch('staffTakeoverPauseMinutes', Number(e.target.value))}
                />
              </label>
            </form>
          </>
        )}
      </SettingsIntegrationCard>
    </div>
  );
}
