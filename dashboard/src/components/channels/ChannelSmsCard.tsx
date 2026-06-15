import { useTranslation } from 'react-i18next';
import { MaterialSymbol } from '../MaterialSymbol';
import type { SmsStatusView } from '../../services/api';

type Props = {
  sms: SmsStatusView;
  selected?: boolean;
  onSelect: () => void;
};

export function ChannelSmsCard({ sms, selected, onSelect }: Props) {
  const { t } = useTranslation();
  const hasError = Boolean(sms.lastError?.trim());
  const connected = sms.status === 'connected' && sms.connected;

  return (
    <div
      role="button"
      tabIndex={0}
      className={['cc-card', selected ? 'cc-card--selected' : ''].filter(Boolean).join(' ')}
      onClick={onSelect}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="cc-card__head">
        <div className="cc-card__who">
          <div
            className={[
              'cc-card__icon cc-card__icon--sms',
              connected ? '' : 'cc-card__icon--sms-muted',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <MaterialSymbol name="sms" size={28} />
          </div>
          <div>
            <h3 className="cc-card__name">{t('channels.smsSetupTitle')}</h3>
            <p className={`cc-card__desc${hasError || !connected ? ' cc-card__desc--error' : ''}`}>
              {hasError
                ? t('channels.smsStatus.not_connected')
                : sms.lastBalance != null
                  ? `${t('channels.smsBalance')}: ${sms.lastBalance}`
                  : t('channels.smsProvider')}
            </p>
          </div>
        </div>
        <span
          className={`cc-card__badge ${
            connected ? 'cc-card__badge--connected' : 'cc-card__badge--disconnected'
          }`}
        >
          {connected
            ? t('channels.card.connected', { defaultValue: 'Connected' })
            : t('channels.card.disconnected', { defaultValue: 'Disconnected' })}
        </span>
      </div>

      {hasError ? (
        <div className="cc-card__error-box">
          <p>
            {t('channels.card.errorPrefix', { defaultValue: 'Error' })}: {sms.lastError}
          </p>
        </div>
      ) : null}
    </div>
  );
}
