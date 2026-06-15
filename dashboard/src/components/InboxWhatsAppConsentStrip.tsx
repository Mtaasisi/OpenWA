import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { MaterialSymbol } from './MaterialSymbol';
import { whatsAppSafetyApi } from '../services/api';
import { isGroupChat } from '../pages/inbox-helpers';
import { phoneDigitsFromChatId } from '../lib/inbox-customer-display';
import { whatsappSafetyTabHref } from './settings/settings-nav-registry';

interface Props {
  sessionId: string;
  chatId: string;
  className?: string;
}

export function InboxWhatsAppConsentStrip({ sessionId, chatId, className }: Props) {
  const { t } = useTranslation();

  const isDirect = !isGroupChat(chatId) && phoneDigitsFromChatId(chatId) != null;

  const { data: consent } = useQuery({
    queryKey: ['whatsapp-safety', 'consent-lookup', sessionId, chatId],
    queryFn: () => whatsAppSafetyApi.lookupConsent(sessionId, chatId),
    enabled: isDirect,
    staleTime: 60_000,
  });

  if (!isDirect || !consent) return null;

  const optedOut = consent.optInStatus === 'opted_out' || consent.optInStatus === 'suppressed';
  const noMarketing = !optedOut && !consent.canMarketing;
  const outsideWindow = consent.requiresTemplate;

  if (!optedOut && !noMarketing && !outsideWindow) return null;

  let message = t('inbox.waConsent.outside24h', {
    defaultValue: 'Outside 24h window — approved template required for proactive sends',
  });
  let tone: 'danger' | 'warning' | 'info' = 'info';
  let icon = 'schedule';

  if (optedOut) {
    message = t('inbox.waConsent.optedOut', {
      defaultValue: 'Customer opted out — outbound sends are blocked',
    });
    tone = 'danger';
    icon = 'block';
  } else if (noMarketing) {
    message = t('inbox.waConsent.noMarketing', {
      defaultValue: 'No marketing consent — campaigns and bulk outreach blocked',
    });
    tone = 'warning';
    icon = 'campaign';
  }

  return (
    <div className={`inbox-wa-consent-strip inbox-wa-consent-strip--${tone}${className ? ` ${className}` : ''}`} role="status">
      <MaterialSymbol name={icon} size={16} className="inbox-wa-consent-strip__icon" />
      <p className="inbox-wa-consent-strip__text">{message}</p>
      <Link to={whatsappSafetyTabHref('consent')} className="inbox-wa-consent-strip__link">
        {t('inbox.waConsent.manage', { defaultValue: 'Safety settings' })}
      </Link>
    </div>
  );
}
