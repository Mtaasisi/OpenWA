import { Trans, useTranslation } from 'react-i18next';
import { Loader2, RefreshCw, X } from 'lucide-react';
import '../pages/Sessions.css';

export interface SessionQrModalState {
  sessionId: string;
  sessionName: string;
  qrCode: string;
}

interface Props {
  data: SessionQrModalState;
  onClose: () => void;
}

export function SessionQrModal({ data, onClose }: Props) {
  const { t } = useTranslation();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal qr-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-header">
          <div className="modal-title">
            <h2>{t('sessions.qr.title')}</h2>
            <span className="session-name">{data.sessionName}</span>
          </div>
          <button type="button" className="btn-close" onClick={onClose} aria-label={t('common.close')}>
            <X size={20} color="#64748b" />
          </button>
        </div>
        <div className="modal-body" style={{ textAlign: 'center' }}>
          {data.qrCode ? (
            <>
              <img src={data.qrCode} alt="" style={{ maxWidth: '280px', borderRadius: '12px' }} />
              <div className="qr-instructions">
                <p className="qr-step">
                  <Trans i18nKey="sessions.qr.step1" components={{ strong: <strong /> }} />
                </p>
                <p className="qr-step">
                  <Trans i18nKey="sessions.qr.step2" components={{ strong: <strong /> }} />
                </p>
                <p className="qr-step">
                  <Trans i18nKey="sessions.qr.step3" components={{ strong: <strong /> }} />
                </p>
              </div>
              <p className="qr-auto-refresh">
                <RefreshCw size={14} className="spin-slow" /> {t('sessions.qr.autoRefresh')}
              </p>
            </>
          ) : (
            <div style={{ padding: '2rem' }}>
              <Loader2 className="animate-spin" size={48} />
              <p>{t('sessions.qr.generating')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
