import { useState, useEffect } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Loader2, MessageCircle, MessageSquare } from 'lucide-react';
import { Modal } from './workspace/Modal';
import { StatusBadge } from './workspace';
import { SmsSetupForm } from './SmsSetupForm';
import { SessionQrModal } from './SessionQrModal';
import { WhatsAppLinkSafetyModal } from './WhatsAppLinkSafetyModal';
import { useToast } from './Toast';
import { useRole } from '../hooks/useRole';
import { useSessionStartFlow } from '../hooks/useSessionStartFlow';
import { sessionApi } from '../services/api';
import {
  getActiveChannels,
  getComingSoonChannels,
  type ChannelId,
} from '../lib/channels';
import './AddChannelModal.css';

type Step = 'pick' | 'whatsapp' | 'sms';

type AddChannelModalProps = {
  open: boolean;
  onClose: () => void;
  onComplete?: (addedType?: ChannelId) => void;
  initialType?: ChannelId;
};

export function AddChannelModal({
  open,
  onClose,
  onComplete,
  initialType,
}: AddChannelModalProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const { canWrite } = useRole();
  const [step, setStep] = useState<Step>(initialType === 'sms' ? 'sms' : initialType === 'whatsapp' ? 'whatsapp' : 'pick');
  const [newSessionName, setNewSessionName] = useState('');
  const [newSessionProxyUrl, setNewSessionProxyUrl] = useState('');
  const [newSessionProxyType, setNewSessionProxyType] = useState<
    'http' | 'https' | 'socks4' | 'socks5'
  >('socks5');
  const [creating, setCreating] = useState(false);
  const [existingSessions, setExistingSessions] = useState<{ name: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    if (initialType === 'sms') setStep('sms');
    else if (initialType === 'whatsapp') setStep('whatsapp');
    else setStep('pick');
  }, [open, initialType]);

  const {
    starting,
    qrModal,
    linkPreflight,
    closeQrModal,
    continueQrInBackground,
    startSessionFlow,
    confirmLinkPreflight,
    cancelLinkPreflight,
    retrySessionFlow,
  } = useSessionStartFlow({
      onReady: () => {
        toast.success(
          t('sessions.toasts.readyTitle'),
          `${t('sessions.toasts.readyDesc')} ${t('sessions.toasts.readySafetyHint')}`,
        );
        handleDone('whatsapp');
      },
      onError: msg => toast.error(t('sessions.create.errorTitle'), msg),
    });

  const reset = () => {
    setStep('pick');
    setNewSessionName('');
    setNewSessionProxyUrl('');
    setNewSessionProxyType('socks5');
    setCreating(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleDone = (addedType?: ChannelId) => {
    reset();
    onComplete?.(addedType);
    onClose();
  };

  const openPick = async () => {
    if (existingSessions.length === 0) {
      try {
        const list = await sessionApi.list();
        setExistingSessions(list);
      } catch {
        setExistingSessions([]);
      }
    }
    setStep('pick');
  };

  const handlePick = (id: ChannelId) => {
    if (id === 'whatsapp') setStep('whatsapp');
    else if (id === 'sms') setStep('sms');
  };

  const handleCreateWhatsapp = async () => {
    if (!newSessionName.trim()) return;
    try {
      setCreating(true);
      const session = await sessionApi.create({
        name: newSessionName,
        ...(newSessionProxyUrl.trim()
          ? {
              proxyUrl: newSessionProxyUrl.trim(),
              proxyType: newSessionProxyType,
            }
          : {}),
      });
      setNewSessionName('');
      toast.success(
        t('sessions.create.successTitle'),
        t('sessions.create.successDesc', { name: session.name }),
      );
      await startSessionFlow(session.id, [session]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('sessions.create.errorDefault');
      toast.error(t('sessions.create.errorTitle'), msg);
    } finally {
      setCreating(false);
    }
  };

  const title =
    step === 'pick'
      ? t('channels.addChannelTitle')
      : step === 'whatsapp'
        ? t('channels.configureWhatsapp')
        : t('channels.configureSms');

  const footer =
    step === 'pick' ? (
      <button type="button" className="fu-btn fu-btn--ghost" onClick={handleClose}>
        {t('common.cancel')}
      </button>
    ) : (
      <>
        <button type="button" className="fu-btn fu-btn--ghost" onClick={() => void openPick()}>
          {t('common.back')}
        </button>
        {step === 'whatsapp' ? (
          <button
            type="button"
            className="fu-btn fu-btn--primary"
            disabled={
              creating ||
              starting ||
              !canWrite ||
              !newSessionName.trim() ||
              !/^[a-z0-9-]+$/.test(newSessionName) ||
              newSessionName.length > 50 ||
              existingSessions.some(s => s.name === newSessionName)
            }
            onClick={() => void handleCreateWhatsapp()}
          >
            {creating || starting ? (
              <Loader2 className="spin" size={16} />
            ) : (
              t('channels.addWhatsappAccount')
            )}
          </button>
        ) : (
          <button type="button" className="fu-btn fu-btn--ghost" onClick={() => handleDone('sms')}>
            {t('common.done')}
          </button>
        )}
      </>
    );

  if (!open) return null;

  return (
    <>
      <Modal open={open} onClose={handleClose} title={title} footer={footer} maxWidth={560}>
        {step === 'pick' && (
          <div className="add-channel-modal">
            <p className="add-channel-modal__lead">{t('channels.chooseChannelType')}</p>
            <div className="add-channel-modal__grid">
              {getActiveChannels().map(ch => (
                <button
                  key={ch.id}
                  type="button"
                  className="add-channel-modal__option fu-glass-card"
                  onClick={() => handlePick(ch.id)}
                  disabled={!canWrite}
                >
                  <span
                    className="add-channel-modal__dot"
                    style={{ background: ch.color }}
                    aria-hidden
                  />
                  <span className="add-channel-modal__option-icon">
                    {ch.id === 'whatsapp' ? (
                      <MessageCircle size={22} />
                    ) : (
                      <MessageSquare size={22} />
                    )}
                  </span>
                  <span className="add-channel-modal__option-label">{t(ch.labelKey)}</span>
                  <span className="add-channel-modal__option-desc">
                    {ch.id === 'whatsapp'
                      ? t('channels.whatsappManageHint')
                      : t('channels.smsSetupDesc')}
                  </span>
                </button>
              ))}
              {getComingSoonChannels().map(ch => (
                <div
                  key={ch.id}
                  className="add-channel-modal__option add-channel-modal__option--soon fu-glass-card"
                  aria-disabled
                >
                  <span
                    className="add-channel-modal__dot"
                    style={{ background: ch.color }}
                    aria-hidden
                  />
                  <span className="add-channel-modal__option-label">{t(ch.labelKey)}</span>
                  <StatusBadge variant="neutral">{t('nav.comingSoonShort')}</StatusBadge>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 'whatsapp' && (
          <div className="add-channel-modal">
            <p className="add-channel-modal__lead">{t('channels.whatsappSetupLead')}</p>
            <label className="add-channel-modal__field">
              <span>{t('sessions.create.label')}</span>
              <input
                type="text"
                placeholder={t('sessions.create.placeholder')}
                value={newSessionName}
                onChange={e => {
                  const value = e.target.value.toLowerCase().replace(/\s+/g, '-');
                  setNewSessionName(value);
                }}
                onKeyDown={e => e.key === 'Enter' && void handleCreateWhatsapp()}
              />
            </label>
            <p className="add-channel-modal__hint">
              <Trans
                i18nKey="sessions.create.hint"
                components={[<code key="hint-code-0" />, <code key="hint-code-1" />]}
              />
            </p>
            {newSessionName && !/^[a-z0-9-]+$/.test(newSessionName) && (
              <p className="add-channel-modal__error">{t('sessions.create.invalidChars')}</p>
            )}
            {newSessionName &&
              /^[a-z0-9-]+$/.test(newSessionName) &&
              existingSessions.some(s => s.name === newSessionName) && (
                <p className="add-channel-modal__error">{t('sessions.create.duplicate')}</p>
              )}
            <label className="add-channel-modal__field">
              <span>{t('sessions.create.proxyUrlLabel')}</span>
              <input
                type="text"
                placeholder={t('sessions.create.proxyUrlPlaceholder')}
                value={newSessionProxyUrl}
                onChange={e => setNewSessionProxyUrl(e.target.value)}
              />
            </label>
            <p className="add-channel-modal__hint">{t('sessions.create.proxyUrlHint')}</p>
            {newSessionProxyUrl.trim() ? (
              <label className="add-channel-modal__field">
                <span>{t('sessions.create.proxyTypeLabel')}</span>
                <select
                  value={newSessionProxyType}
                  onChange={e =>
                    setNewSessionProxyType(
                      e.target.value as 'http' | 'https' | 'socks4' | 'socks5',
                    )
                  }
                >
                  <option value="socks5">SOCKS5 (recommended)</option>
                  <option value="http">HTTP</option>
                  <option value="https">HTTPS</option>
                  <option value="socks4">SOCKS4</option>
                </select>
              </label>
            ) : null}
          </div>
        )}

        {step === 'sms' && (
          <div className="add-channel-modal">
            <p className="add-channel-modal__lead">{t('channels.smsSetupDesc')}</p>
            <SmsSetupForm
              variant="modal"
              onSaved={() => handleDone('sms')}
            />
          </div>
        )}
      </Modal>

      {linkPreflight ? (
        <WhatsAppLinkSafetyModal
          sessionId={linkPreflight.sessionId}
          sessionName={linkPreflight.sessionName}
          action={linkPreflight.action}
          onConfirm={confirmLinkPreflight}
          onCancel={cancelLinkPreflight}
        />
      ) : null}

      {qrModal && (
        <SessionQrModal
          data={qrModal}
          onClose={() => {
            closeQrModal();
            handleDone('whatsapp');
          }}
          onRetry={sessionId => void retrySessionFlow(sessionId, [])}
          onContinueInBackground={() => {
            continueQrInBackground();
            handleDone('whatsapp');
          }}
        />
      )}
    </>
  );
}
