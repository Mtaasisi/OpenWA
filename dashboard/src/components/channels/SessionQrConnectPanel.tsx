import { useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
  AlertCircle,
  Check,
  Loader2,
  MessageSquare,
  QrCode,
  Rocket,
  Smartphone,
} from 'lucide-react';
import type { SessionQrModalState } from '../SessionQrModal';
import type { Session } from '../../services/api';
import '../SessionQrModal.css';

type ConnectStepId = 'start' | 'scan' | 'link' | 'sync';

const CONNECT_STEPS: { id: ConnectStepId; icon: typeof Rocket }[] = [
  { id: 'start', icon: Rocket },
  { id: 'scan', icon: QrCode },
  { id: 'link', icon: Smartphone },
  { id: 'sync', icon: MessageSquare },
];

function failureMessage(failureCode: string | undefined, t: (key: string) => string): string {
  if (!failureCode) return t('sessions.qr.failedGeneric');
  const key = `sessions.qr.failure.${failureCode}`;
  const translated = t(key);
  return translated === key ? t('sessions.qr.failedGeneric') : translated;
}

function activeStepIndex(status: Session['status'] | undefined, hasQr: boolean): number {
  if (status === 'loading_chats') return 3;
  if (status === 'authenticating') return 2;
  if (status === 'qr_ready') return hasQr ? 1 : 0;
  return 0;
}

function stepState(stepIdx: number, activeIdx: number): 'complete' | 'active' | 'pending' {
  if (stepIdx < activeIdx) return 'complete';
  if (stepIdx === activeIdx) return 'active';
  return 'pending';
}

function postScanHeadline(status: Session['status'] | undefined, t: (key: string) => string): string {
  if (status === 'authenticating') return t('sessions.qr.authenticating');
  if (status === 'loading_chats') return t('sessions.qr.loadingChats');
  return t('sessions.qr.preparing');
}

function postScanSubline(
  status: Session['status'] | undefined,
  statusMessage: string | undefined,
  t: (key: string) => string,
): string {
  if (status === 'authenticating') {
    return statusMessage || t('sessions.qr.subline.linking');
  }
  if (status === 'loading_chats') {
    return statusMessage || t('sessions.qr.subline.syncingHint');
  }
  return statusMessage || t('sessions.qr.subline.wait');
}

type Props = {
  data: SessionQrModalState;
  variant?: 'modal' | 'inline';
  onRetry?: (sessionId: string) => void;
  onContinueInBackground?: () => void;
};

export function SessionQrConnectPanel({
  data,
  variant = 'modal',
  onRetry,
  onContinueInBackground,
}: Props) {
  const { t } = useTranslation();
  const isFailed = data.status === 'failed';
  const hasQr = Boolean(data.qrCode);
  const awaitingQrImage = data.status === 'qr_ready' && !hasQr;
  const isPostScan = data.status === 'authenticating' || data.status === 'loading_chats';
  const showQr =
    hasQr &&
    !isFailed &&
    data.status !== 'ready' &&
    data.status !== 'authenticating' &&
    data.status !== 'loading_chats';

  const activeIdx = activeStepIndex(data.status, hasQr);
  const showProgress = isPostScan;
  const progressPercent = Math.round((activeIdx / (CONNECT_STEPS.length - 1)) * 100);

  const prepareSubline = useMemo(() => {
    if (data.status === 'initializing') return t('sessions.qr.subline.starting');
    if (awaitingQrImage) return t('sessions.qr.subline.preparingQr');
    return null;
  }, [awaitingQrImage, data.status, t]);

  return (
    <div
      className={[
        'session-qr-connect-panel',
        variant === 'inline' ? 'session-qr-connect-panel--inline' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {showProgress ? (
        <div className="qr-modal__progress-wrap" aria-hidden>
          <div className="qr-modal__progress-bar">
            <div className="qr-modal__progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="qr-modal__steps">
            {CONNECT_STEPS.map((step, idx) => {
              const state = stepState(idx, activeIdx);
              const Icon = step.icon;
              return (
                <div key={step.id} className={`qr-modal__step qr-modal__step--${state}`}>
                  <span className="qr-modal__step-icon">
                    {state === 'complete' ? (
                      <Check size={14} strokeWidth={2.5} />
                    ) : state === 'active' && step.id !== 'scan' ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Icon size={14} />
                    )}
                  </span>
                  <span className="qr-modal__step-label">
                    {t(`sessions.qr.progress.${step.id}`)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {isFailed ? (
        <div className="qr-failed-state">
          <AlertCircle size={40} className="qr-failed-icon" />
          <p>{failureMessage(data.failureCode, t)}</p>
          {onRetry ? (
            <button type="button" className="btn btn-primary" onClick={() => onRetry(data.sessionId)}>
              {t('sessions.qr.retry')}
            </button>
          ) : null}
        </div>
      ) : showQr ? (
        <>
          <div className="qr-modal__qr-frame">
            <img src={data.qrCode} alt="" className="qr-modal__qr-image" />
          </div>
          <p className="qr-modal__instructions">
            <Trans
              i18nKey="sessions.qr.scanInstructions"
              components={[<strong key="qr-inst-0" />, <strong key="qr-inst-1" />]}
            />
          </p>
        </>
      ) : isPostScan ? (
        <>
          <p className="qr-modal__headline">{postScanHeadline(data.status, t)}</p>
          <p className="qr-modal__subline">{postScanSubline(data.status, data.statusMessage, t)}</p>
          <div className="qr-modal__loading-panel">
            {data.status === 'loading_chats' ? (
              <>
                <Loader2 size={44} className="qr-modal__loading-icon animate-spin" />
                <div className="qr-modal__sync-bar" aria-hidden>
                  <div className="qr-modal__sync-bar-fill" />
                </div>
              </>
            ) : (
              <Loader2 size={44} className="qr-modal__loading-icon animate-spin" />
            )}
            {onContinueInBackground && data.status === 'loading_chats' ? (
              <button
                type="button"
                className="btn btn-secondary qr-modal__bg-btn"
                onClick={onContinueInBackground}
              >
                {t('sessions.qr.continueInBackground')}
              </button>
            ) : null}
          </div>
        </>
      ) : awaitingQrImage ? (
        <div className="qr-modal__loading-panel">
          <div className="qr-modal__qr-frame">
            <div
              className="qr-modal__qr-skeleton"
              aria-busy="true"
              aria-label={t('sessions.qr.preparing')}
            />
          </div>
          {prepareSubline ? (
            <p className="qr-modal__subline" style={{ margin: 0 }}>
              {prepareSubline}
            </p>
          ) : null}
        </div>
      ) : data.status === 'initializing' ? (
        <div className="qr-modal__loading-panel">
          <Loader2 size={44} className="qr-modal__loading-icon animate-spin" />
          {prepareSubline ? (
            <p className="qr-modal__subline" style={{ margin: 0 }}>
              {prepareSubline}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="qr-modal__loading-panel">
          <Loader2 size={44} className="qr-modal__loading-icon animate-spin" />
        </div>
      )}
    </div>
  );
}
