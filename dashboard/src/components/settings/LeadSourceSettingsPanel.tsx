import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ChevronDown, Loader2, BarChart3, RefreshCw, UserRound } from 'lucide-react';
import { followupApi } from '../../services/api';
import { LEAD_SOURCES, leadSourceLabel } from '../../lib/lead-sources';
import { useToast } from '../Toast';
import { SettingsIntegrationCard } from './SettingsIntegrationShell';

export function LeadSourceSettingsPanel() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [lastResult, setLastResult] = useState<{
    created: number;
    skipped: number;
    dryRun: boolean;
  } | null>(null);
  const [identityResult, setIdentityResult] = useState<{
    scanned: number;
    phonesFilled: number;
    namesFilled: number;
  } | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);

  const backfill = useMutation({
    mutationFn: (dryRun: boolean) => followupApi.backfillSaleAttributions(dryRun),
    onSuccess: result => {
      setLastResult(result);
      toast.success(
        result.dryRun
          ? t('leadSources.settings.backfillDryRunDone', { count: result.created })
          : t('leadSources.settings.backfillDone', { count: result.created }),
      );
    },
    onError: (err: Error) => toast.error(t('common.errorGeneric'), err.message),
  });

  const identityBackfill = useMutation({
    mutationFn: (dryRun: boolean) => followupApi.backfillIdentity(dryRun),
    onSuccess: (result, dryRun) => {
      setIdentityResult(result);
      if (!dryRun) {
        void queryClient.invalidateQueries({ queryKey: ['customers'] });
        void queryClient.invalidateQueries({ queryKey: ['pipeline'] });
      }
      toast.success(
        dryRun
          ? t('leadSources.settings.identityBackfillDryRunDone', {
              phones: result.phonesFilled,
              names: result.namesFilled,
            })
          : t('leadSources.settings.identityBackfillDone', {
              phones: result.phonesFilled,
              names: result.namesFilled,
            }),
      );
    },
    onError: (err: Error) => toast.error(t('common.errorGeneric'), err.message),
  });

  return (
    <div className="settings-crm-stack">
      <SettingsIntegrationCard title={t('leadSources.settings.standardSources')} icon="label">
        <p className="settings-int-hint">{t('leadSources.settings.hint')}</p>
        <ul className="lead-source-settings__list">
          {LEAD_SOURCES.map(src => (
            <li key={src}>{leadSourceLabel(src, t)}</li>
          ))}
        </ul>
      </SettingsIntegrationCard>

      {!moreOpen ? (
        <button
          type="button"
          className="fu-btn fu-btn--ghost fu-btn--sm settings-inline-more-btn"
          onClick={() => setMoreOpen(true)}
        >
          <span>{t('settings.moreOptions')}</span>
          <ChevronDown size={18} aria-hidden />
        </button>
      ) : null}

      {moreOpen ? (
        <button
          type="button"
          className="fu-btn fu-btn--ghost fu-btn--sm settings-inline-show-less"
          onClick={() => setMoreOpen(false)}
        >
          {t('settings.showLess')}
        </button>
      ) : null}

      {moreOpen ? (
        <>
      <SettingsIntegrationCard title={t('leadSources.settings.backfillTitle')} icon="sync">
        <p className="settings-int-hint">{t('leadSources.settings.backfillHint')}</p>
        <div className="lead-source-settings__actions">
          <button
            type="button"
            className="fu-btn fu-btn--ghost fu-btn--sm"
            disabled={backfill.isPending}
            onClick={() => backfill.mutate(true)}
          >
            {backfill.isPending ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
            {t('leadSources.settings.backfillPreview')}
          </button>
          <button
            type="button"
            className="fu-btn fu-btn--primary fu-btn--sm"
            disabled={backfill.isPending}
            onClick={() => backfill.mutate(false)}
          >
            {t('leadSources.settings.backfillRun')}
          </button>
          <Link to="/reports?section=pipeline" className="fu-btn fu-btn--ghost fu-btn--sm">
            <BarChart3 size={14} /> {t('leadSources.settings.viewReports')}
          </Link>
        </div>
        {lastResult && (
          <p className="settings-int-hint settings-int-hint--stack-top">
            {lastResult.dryRun
              ? t('leadSources.settings.backfillResultDry', {
                  created: lastResult.created,
                  skipped: lastResult.skipped,
                })
              : t('leadSources.settings.backfillResult', {
                  created: lastResult.created,
                  skipped: lastResult.skipped,
                })}
          </p>
        )}
      </SettingsIntegrationCard>

      <SettingsIntegrationCard
        title={t('leadSources.settings.identityBackfillTitle')}
        icon="person_search"
      >
        <p className="settings-int-hint">{t('leadSources.settings.identityBackfillHint')}</p>
        <div className="lead-source-settings__actions">
          <button
            type="button"
            className="fu-btn fu-btn--ghost fu-btn--sm"
            disabled={identityBackfill.isPending}
            onClick={() => identityBackfill.mutate(true)}
          >
            {identityBackfill.isPending ? (
              <Loader2 className="animate-spin" size={14} />
            ) : (
              <RefreshCw size={14} />
            )}
            {t('leadSources.settings.backfillPreview')}
          </button>
          <button
            type="button"
            className="fu-btn fu-btn--primary fu-btn--sm"
            disabled={identityBackfill.isPending}
            onClick={() => identityBackfill.mutate(false)}
          >
            <UserRound size={14} /> {t('leadSources.settings.identityBackfillRun')}
          </button>
        </div>
        {identityResult && (
          <p className="settings-int-hint settings-int-hint--stack-top">
            {t('leadSources.settings.identityBackfillResult', {
              scanned: identityResult.scanned,
              phones: identityResult.phonesFilled,
              names: identityResult.namesFilled,
            })}
          </p>
        )}
      </SettingsIntegrationCard>
        </>
      ) : null}
    </div>
  );
}
