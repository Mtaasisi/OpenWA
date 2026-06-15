import type { WhatsAppLinkPreflightSummaryRow } from '../../services/api';

type LinkSafetyDisplay = {
  label: string;
  tone: 'ok' | 'warn';
};

export function getLinkSafetyDisplay(
  linkSafetyRow: WhatsAppLinkPreflightSummaryRow | undefined,
  connected: boolean,
  t: (key: string, options?: Record<string, unknown>) => string,
): LinkSafetyDisplay | null {
  if (!linkSafetyRow) return null;
  if (linkSafetyRow.issueCount > 0) {
    return {
      label: t('channels.card.safetyChecks', {
        count: linkSafetyRow.issueCount,
        defaultValue: '{{count}} safety checks',
      }),
      tone: 'warn',
    };
  }
  if (!linkSafetyRow.ready) {
    return {
      label: t('channels.card.safetyReview', { defaultValue: 'Review link safety' }),
      tone: 'warn',
    };
  }
  if (connected) {
    return {
      label: t('channels.card.safetyReady', { defaultValue: 'Link safety OK' }),
      tone: 'ok',
    };
  }
  return null;
}
