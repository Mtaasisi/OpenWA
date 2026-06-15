import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { Loader2, MessageSquare } from 'lucide-react';
import { smsApi } from '../services/api';
import { useToast } from './Toast';
import { ModalOverlay } from './ModalOverlay';
import './SendSmsModal.css';

interface SendSmsModalProps {
  open: boolean;
  onClose: () => void;
  defaultPhone?: string;
  defaultMessage?: string;
  customerId?: string;
  conversationId?: string;
  relatedType?: string;
  relatedId?: string;
  onSent?: () => void;
}

export function SendSmsModal({
  open,
  onClose,
  defaultPhone = '',
  defaultMessage = '',
  customerId,
  conversationId,
  relatedType,
  relatedId,
  onSent,
}: SendSmsModalProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [phone, setPhone] = useState(defaultPhone);
  const [message, setMessage] = useState(defaultMessage);
  const [segmentInfo, setSegmentInfo] = useState<{
    smsCount: number;
    warning?: string;
  } | null>(null);

  useEffect(() => {
    if (open) {
      setPhone(defaultPhone);
      setMessage(defaultMessage);
    }
  }, [open, defaultPhone, defaultMessage]);

  useEffect(() => {
    if (!message.trim()) {
      setSegmentInfo(null);
      return;
    }
    const timer = setTimeout(() => {
      void smsApi.previewSegments(message).then(setSegmentInfo).catch(() => setSegmentInfo(null));
    }, 300);
    return () => clearTimeout(timer);
  }, [message]);

  const sendMutation = useMutation({
    mutationFn: () =>
      smsApi.send({
        toPhone: phone,
        message,
        customerId,
        conversationId,
        relatedType,
        relatedId,
      }),
    onSuccess: res => {
      toast.success(t('sms.sendSuccess', { count: res.smsCount }));
      onSent?.();
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!open) return null;

  return (
    <ModalOverlay onClose={onClose}>
      <div className="sms-modal fu-glass-card" role="dialog" aria-labelledby="send-sms-title">
        <header className="sms-modal__head">
          <MessageSquare size={20} />
          <h2 id="send-sms-title">{t('sms.sendTitle')}</h2>
        </header>
        <div className="sms-modal__body">
          <label className="sms-modal__field">
            <span>{t('sms.phone')}</span>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="0712345678"
            />
          </label>
          <label className="sms-modal__field">
            <span>{t('sms.message')}</span>
            <textarea
              rows={4}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={t('sms.messagePlaceholder')}
            />
          </label>
          {segmentInfo && (
            <p className="sms-modal__segments">
              {t('sms.segmentCount', { count: segmentInfo.smsCount })}
              {segmentInfo.warning && (
                <span className="sms-modal__warn"> — {segmentInfo.warning}</span>
              )}
            </p>
          )}
        </div>
        <footer className="sms-modal__foot">
          <button type="button" className="fu-btn fu-btn--ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="fu-btn fu-btn--primary"
            disabled={!phone.trim() || !message.trim() || sendMutation.isPending}
            onClick={() => sendMutation.mutate()}
          >
            {sendMutation.isPending ? <Loader2 className="spin" size={16} /> : t('sms.send')}
          </button>
        </footer>
      </div>
    </ModalOverlay>
  );
}
