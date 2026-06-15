import { useTranslation } from 'react-i18next';
import { MaterialSymbol } from './MaterialSymbol';
import './InboxLargeAccountBanner.css';

type Props = {
  threadTotal?: number;
  activeSinceDays: number;
  recentWindowActive: boolean;
  unifiedView?: boolean;
  onShowAllHistory?: () => void;
  onFocusSearch?: () => void;
  onSwitchToSingleAccount?: () => void;
  className?: string;
};

export function InboxLargeAccountBanner({
  threadTotal,
  activeSinceDays,
  recentWindowActive,
  unifiedView = false,
  onShowAllHistory,
  onFocusSearch,
  onSwitchToSingleAccount,
  className,
}: Props) {
  const { t } = useTranslation();

  const title = unifiedView
    ? t('inbox.largeAccount.unifiedTitle')
    : recentWindowActive
      ? t('inbox.largeAccount.recentWindowTitle', { days: activeSinceDays })
      : t('inbox.largeAccount.title');

  const desc = unifiedView
    ? t('inbox.largeAccount.unifiedDesc', { total: threadTotal ?? '—' })
    : recentWindowActive
      ? t('inbox.largeAccount.recentWindowDesc', {
          days: activeSinceDays,
          total: threadTotal ?? '—',
        })
      : t('inbox.largeAccount.desc', { total: threadTotal ?? '—' });

  return (
    <div
      className={['inbox-large-account-banner', className].filter(Boolean).join(' ')}
      role="status"
    >
      <MaterialSymbol name="info" size={18} className="inbox-large-account-banner__icon" />
      <div className="inbox-large-account-banner__copy">
        <p className="inbox-large-account-banner__title">{title}</p>
        <p className="inbox-large-account-banner__desc">{desc}</p>
      </div>
      <div className="inbox-large-account-banner__actions">
        {unifiedView && onSwitchToSingleAccount ? (
          <button
            type="button"
            className="inbox-large-account-banner__btn inbox-large-account-banner__btn--primary"
            onClick={onSwitchToSingleAccount}
          >
            {t('inbox.largeAccount.singleAccount')}
          </button>
        ) : null}
        {onFocusSearch ? (
          <button type="button" className="inbox-large-account-banner__btn" onClick={onFocusSearch}>
            {t('inbox.largeAccount.search')}
          </button>
        ) : null}
        {!unifiedView && recentWindowActive && onShowAllHistory ? (
          <button type="button" className="inbox-large-account-banner__btn" onClick={onShowAllHistory}>
            {t('inbox.largeAccount.showAll')}
          </button>
        ) : null}
      </div>
    </div>
  );
}
