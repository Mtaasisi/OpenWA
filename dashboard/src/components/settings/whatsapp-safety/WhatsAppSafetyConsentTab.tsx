import { useTranslation } from 'react-i18next';
import type { UseMutationResult } from '@tanstack/react-query';
import type { WhatsAppSafetyConsentRow } from '../../../services/api';

type Props = {
  optedOut: WhatsAppSafetyConsentRow[];
  marketingGaps: WhatsAppSafetyConsentRow[];
  restoreGrantMarketing: boolean;
  onRestoreGrantMarketingChange: (value: boolean) => void;
  restoreConsent: UseMutationResult<
    unknown,
    Error,
    { id: string; canMarketing?: boolean },
    unknown
  >;
  patchConsent: UseMutationResult<
    unknown,
    Error,
    { id: string; patch: { canMarketing?: boolean; canFollowup?: boolean } },
    unknown
  >;
};

export function WhatsAppSafetyConsentTab({
  optedOut,
  marketingGaps,
  restoreGrantMarketing,
  onRestoreGrantMarketingChange,
  restoreConsent,
  patchConsent,
}: Props) {
  const { t } = useTranslation();

  return (
    <>
      <section className="wa-safety-bento">
        <h3 className="wa-safety-section-title">{t('whatsappSafety.consent.optedOutTitle')}</h3>
        <label className="wa-safety-check-row">
          <input
            type="checkbox"
            checked={restoreGrantMarketing}
            onChange={e => onRestoreGrantMarketingChange(e.target.checked)}
          />
          {t('whatsappSafety.consent.grantMarketingOnRestore')}
        </label>
        {optedOut.length === 0 ? (
          <p className="wa-safety-empty">{t('whatsappSafety.consent.empty')}</p>
        ) : (
          <ul className="wa-safety-list">
            {optedOut.slice(0, 50).map(c => (
              <li key={c.id} className="wa-safety-list-row">
                <span className="wa-safety-list-row__main">
                  {c.phone} — {c.optOutReason ?? t('whatsappSafety.consent.optedOut')}
                </span>
                <button
                  type="button"
                  className="wa-safety-btn wa-safety-btn--primary"
                  disabled={restoreConsent.isPending}
                  onClick={() =>
                    restoreConsent.mutate({
                      id: c.id,
                      canMarketing: restoreGrantMarketing,
                    })
                  }
                >
                  {t('whatsappSafety.consent.restore')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="wa-safety-bento">
        <h3 className="wa-safety-section-title">{t('whatsappSafety.consent.marketingGapsTitle')}</h3>
        <p className="wa-safety-section-hint">{t('whatsappSafety.consent.marketingGapsHint')}</p>
        {marketingGaps.length === 0 ? (
          <p className="wa-safety-empty">{t('whatsappSafety.consent.marketingGapsEmpty')}</p>
        ) : (
          <ul className="wa-safety-list">
            {marketingGaps.slice(0, 50).map(c => (
              <li key={c.id} className="wa-safety-list-row wa-safety-consent-row">
                <span className="wa-safety-list-row__main">{c.phone}</span>
                <label>
                  <input
                    type="checkbox"
                    checked={Boolean(c.canMarketing)}
                    disabled={patchConsent.isPending}
                    onChange={e =>
                      patchConsent.mutate({
                        id: c.id,
                        patch: { canMarketing: e.target.checked },
                      })
                    }
                  />
                  {t('whatsappSafety.consent.canMarketing')}
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={c.canFollowup !== false}
                    disabled={patchConsent.isPending}
                    onChange={e =>
                      patchConsent.mutate({
                        id: c.id,
                        patch: { canFollowup: e.target.checked },
                      })
                    }
                  />
                  {t('whatsappSafety.consent.canFollowup')}
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
