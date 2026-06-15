import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { InboxProductPicker } from '../../InboxProductPicker';
import { useToast } from '../../Toast';
import { inboxDeepLink } from '../../customers/customer-utils';
import { productsApi } from '../../../services/api';

export type MissingProductChat = {
  sessionId: string;
  chatId: string;
  customerId: string | null;
  lastMessage: string | null;
  lastAskedAt: string;
};

type Props = {
  chats: MissingProductChat[];
  selectedChatKey: string;
  onSelectChatKey: (key: string) => void;
  sessionStatus?: string;
  productId: string;
  productName: string;
  onSent?: () => void;
};

function chatKey(chat: MissingProductChat): string {
  return `${chat.sessionId}:${chat.chatId}`;
}

function formatChatLabel(chat: MissingProductChat): string {
  const phone = chat.chatId.replace(/@.+$/, '');
  const preview = chat.lastMessage?.trim().slice(0, 40);
  return preview ? `${phone} — ${preview}` : phone;
}

export function AiMapMissingInboxSend({
  chats,
  selectedChatKey,
  onSelectChatKey,
  sessionStatus,
  productId,
  productName,
  onSent,
}: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const [catalogOpenSignal, setCatalogOpenSignal] = useState(0);

  const selected = chats.find(c => chatKey(c) === selectedChatKey) ?? chats[0] ?? null;

  const quickSend = useMutation({
    mutationFn: () =>
      productsApi.send(productId, {
        sessionId: selected!.sessionId,
        chatId: selected!.chatId,
        includeAllVariants: true,
        inStockOnly: true,
        includeImage: true,
      }),
    onSuccess: () => {
      toast.success(t('ai.learning.mapMissing.sentToChat', { name: productName }));
      onSent?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!chats.length) {
    return <p className="ail-muted">{t('ai.learning.mapMissing.noRecentChats')}</p>;
  }

  return (
    <div className="ail-field">
      <label>{t('ai.learning.mapMissing.recentChats')}</label>
      <select
        className="ail-filter-select"
        value={selectedChatKey || (selected ? chatKey(selected) : '')}
        onChange={e => onSelectChatKey(e.target.value)}
      >
        {chats.map(chat => (
          <option key={chatKey(chat)} value={chatKey(chat)}>
            {formatChatLabel(chat)}
          </option>
        ))}
      </select>
      {selected ? (
        <div className="ail-field-row ail-map-missing-send">
          <button
            type="button"
            className="ail-btn"
            onClick={() => setCatalogOpenSignal(n => n + 1)}
          >
            {t('ai.learning.mapMissing.browseAndSend')}
          </button>
          {catalogOpenSignal > 0 ? (
            <InboxProductPicker
              sessionId={selected.sessionId}
              chatId={selected.chatId}
              sessionStatus={sessionStatus}
              canWrite
              confirmBeforeSend
              headless
              openSignal={catalogOpenSignal}
              onSent={onSent}
            />
          ) : null}
          <button
            type="button"
            className="ail-btn ail-btn--primary"
            disabled={!productId || quickSend.isPending}
            onClick={() => quickSend.mutate()}
          >
            {t('ai.learning.mapMissing.sendMapped')}
          </button>
          <button
            type="button"
            className="ail-btn"
            onClick={() => navigate(inboxDeepLink(selected.sessionId, selected.chatId))}
          >
            {t('ai.learning.mapMissing.openChat')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
