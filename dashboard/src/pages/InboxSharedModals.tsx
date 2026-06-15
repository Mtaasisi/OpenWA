import { SessionQrModal } from '../components/SessionQrModal';
import { WhatsAppLinkSafetyModal } from '../components/WhatsAppLinkSafetyModal';
import { InboxNewChatModal } from '../components/InboxNewChatModal';
import { InboxTransferChatModal } from '../components/InboxTransferChatModal';
import { InboxInteraktActionModals } from '../components/InboxInteraktActionModals';
import { InboxAiTakeoverSendConfirmModal } from '../components/InboxAiTakeoverSendConfirmModal';
import type { InboxController } from './useInboxController';
import type { Conversation } from '../services/api';

type ActionModalsProps = {
  thread: { sessionId: string; chatId: string } | null;
  conversation?: Conversation;
  canWrite: boolean;
  quoteOpen: boolean;
  followupOpen: boolean;
  onCloseQuote: () => void;
  onCloseFollowup: () => void;
  onCrmUpdated: () => void;
  onQuoteSent: () => void;
};

type Props = {
  ctrl: InboxController;
  actionModals?: ActionModalsProps | null;
};

export function InboxSharedModals({ ctrl, actionModals }: Props) {
  return (
    <>
      {ctrl.linkPreflight ? (
        <WhatsAppLinkSafetyModal
          sessionId={ctrl.linkPreflight.sessionId}
          sessionName={ctrl.linkPreflight.sessionName}
          action={ctrl.linkPreflight.action}
          onConfirm={ctrl.confirmLinkPreflight}
          onCancel={ctrl.cancelLinkPreflight}
        />
      ) : null}
      {ctrl.qrModal ? (
        <SessionQrModal
          data={ctrl.qrModal}
          onClose={ctrl.closeQrModal}
          onRetry={sessionId => void ctrl.retrySessionFlow(sessionId, ctrl.allSessions)}
          onContinueInBackground={ctrl.continueQrInBackground}
        />
      ) : null}
      <InboxNewChatModal
        open={ctrl.newChatOpen}
        onClose={ctrl.closeNewChat}
        sessions={ctrl.allSessions}
        defaultSessionId={
          ctrl.viewMode === 'one' ? ctrl.sessionId || undefined : ctrl.activeSessionId || undefined
        }
        onOpen={ctrl.handleNewChatOpen}
      />
      {ctrl.selectedThread && ctrl.allSessions.length > 1 ? (
        <InboxTransferChatModal
          open={ctrl.transferModalOpen}
          onClose={() => ctrl.setTransferModalOpen(false)}
          fromSessionId={ctrl.selectedThread.sessionId}
          chatId={ctrl.selectedThread.chatId}
          sessions={ctrl.allSessions}
          onTransferred={(toSessionId, chatId) => {
            ctrl.setTransferModalOpen(false);
            ctrl.handleNewChatOpen(toSessionId, chatId);
          }}
        />
      ) : null}
      {actionModals ? <InboxInteraktActionModals {...actionModals} /> : null}
      <InboxAiTakeoverSendConfirmModal
        open={ctrl.aiTakeoverSendConfirmOpen}
        onConfirm={ctrl.confirmAiTakeoverSend}
        onCancel={ctrl.cancelAiTakeoverSend}
      />
    </>
  );
}
