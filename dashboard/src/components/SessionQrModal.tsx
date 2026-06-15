import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { ModalOverlay } from './ModalOverlay';
import { SessionQrConnectPanel } from './channels/SessionQrConnectPanel';
import type { Session } from '../services/api';
import '../pages/Sessions.css';
import './SessionQrModal.css';

export interface SessionQrModalState {
  sessionId: string;
  sessionName: string;
  qrCode: string;
  status?: Session['status'];
  statusMessage?: string;
  failureCode?: string;
}

interface Props {
  data: SessionQrModalState;
  onClose: () => void;
  onRetry?: (sessionId: string) => void;
  onContinueInBackground?: () => void;
}

export function SessionQrModal({ data, onClose, onRetry, onContinueInBackground }: Props) {
  const { t } = useTranslation();

  return (
    <ModalOverlay onClose={onClose}>
      <div className="modal qr-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-header">
          <div className="modal-title">
            <h2>{t('sessions.qr.title')}</h2>
            {data.sessionName ? <span className="session-name">{data.sessionName}</span> : null}
          </div>
          <button type="button" className="btn-close" onClick={onClose} aria-label={t('common.close')}>
            <X size={20} color="#64748b" />
          </button>
        </div>
        <div className="modal-body">
          <SessionQrConnectPanel
            data={data}
            onRetry={onRetry}
            onContinueInBackground={onContinueInBackground}
          />
        </div>
      </div>
    </ModalOverlay>
  );
}
