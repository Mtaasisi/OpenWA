import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, AlertTriangle } from 'lucide-react';
import type { WhatsAppLinkPreflightSummaryRow } from '../services/api';
import { settingsPanelHref } from './settings/settings-nav-registry';
import './WhatsAppLinkSafetyModal.css';

type Props = {
  row: WhatsAppLinkPreflightSummaryRow;
  variant?: 'chip' | 'panel';
};

export function WhatsAppLinkSafetySessionChip({ row, variant = 'chip' }: Props) {
  const { t } = useTranslation();
  if (row.ready) {
    if (variant === 'chip') return null;
    return (
      <div className="wa-link-safety-session wa-link-safety-session--ok">
        <ShieldCheck size={16} aria-hidden />
        <span>{t('whatsappLinkSafety.sessionReady')}</span>
      </div>
    );
  }

  const href = settingsPanelHref('whatsapp-safety', { waTab: 'overview' });
  const label =
    row.blockingOk === false
      ? t('whatsappLinkSafety.sessionChipBlocking', { count: row.issueCount })
      : t('whatsappLinkSafety.sessionChip', { count: row.issueCount });

  if (variant === 'chip') {
    return (
      <Link to={href} className="wa-link-safety-session-chip" onClick={e => e.stopPropagation()}>
        {row.blockingOk === false ? (
          <AlertTriangle size={12} aria-hidden />
        ) : (
          <ShieldCheck size={12} aria-hidden />
        )}
        <span>{label}</span>
      </Link>
    );
  }

  return (
    <div
      className={`wa-link-safety-session${row.blockingOk === false ? ' wa-link-safety-session--blocking' : ''}`}
    >
      {row.blockingOk === false ? <AlertTriangle size={16} aria-hidden /> : <ShieldCheck size={16} aria-hidden />}
      <div className="wa-link-safety-session__text">
        <strong>{t('whatsappLinkSafety.sessionPanelTitle')}</strong>
        <span>{label}</span>
      </div>
      <Link to={href} className="wa-link-safety__fix-btn">
        {t('whatsappLinkSafety.bannerAction')}
      </Link>
    </div>
  );
}
