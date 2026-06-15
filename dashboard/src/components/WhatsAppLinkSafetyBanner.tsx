import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { whatsAppSafetyApi, type Session } from '../services/api';
import { countLinkPreflightIssues } from '../lib/whatsapp-link-safety.util';
import { sessionNeedsLink } from '../lib/session-link.util';
import { settingsPanelHref } from './settings/settings-nav-registry';

type Props = {
  sessions: Session[];
};

export function WhatsAppLinkSafetyBanner({ sessions }: Props) {
  const { t } = useTranslation();
  const linkTarget = sessions.find(sessionNeedsLink);
  const { data } = useQuery({
    queryKey: ['whatsapp-safety', 'link-preflight', linkTarget?.id ?? 'none'],
    queryFn: () => whatsAppSafetyApi.getLinkPreflight(linkTarget!.id),
    enabled: Boolean(linkTarget?.id),
    retry: false,
  });

  if (!linkTarget || !data || data.ready) return null;

  const issues = countLinkPreflightIssues(data);

  return (
    <div className="wa-link-safety-banner" role="status">
      {data.blockingOk ? (
        <AlertTriangle size={18} aria-hidden />
      ) : (
        <ShieldCheck size={18} aria-hidden />
      )}
      <div className="wa-link-safety-banner__text">
        <strong>{t('whatsappLinkSafety.bannerTitle')}</strong>
        <span>
          {t('whatsappLinkSafety.bannerBody', {
            count: issues,
            name: linkTarget.name,
          })}
        </span>
      </div>
      <Link
        to={settingsPanelHref('whatsapp-safety', { waTab: 'overview' })}
        className="wa-link-safety-banner__link"
      >
        {t('whatsappLinkSafety.bannerAction')}
      </Link>
    </div>
  );
}
