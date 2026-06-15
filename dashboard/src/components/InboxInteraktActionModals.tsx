import { InboxQuoteBuilder } from './InboxQuoteBuilder';
import { InboxScheduleFollowupModal } from './InboxScheduleFollowupModal';
import { type Conversation } from '../services/api';

interface Props {
  thread: { sessionId: string; chatId: string } | null;
  conversation?: Conversation;
  canWrite: boolean;
  quoteOpen: boolean;
  followupOpen: boolean;
  onCloseQuote: () => void;
  onCloseFollowup: () => void;
  onCrmUpdated: () => void;
  onQuoteSent: () => void;
}

export function InboxInteraktActionModals({
  thread,
  conversation,
  canWrite,
  quoteOpen,
  followupOpen,
  onCloseQuote,
  onCloseFollowup,
  onCrmUpdated,
  onQuoteSent,
}: Props) {
  if (!thread) return null;

  return (
    <>
      {quoteOpen && (
        <InboxQuoteBuilder
          sessionId={thread.sessionId}
          chatId={thread.chatId}
          customerName={conversation?.customerName ?? conversation?.displayName}
          customerPhone={conversation?.customerPhone ?? undefined}
          canWrite={canWrite}
          embedded
          variant="interakt"
          onRequestClose={onCloseQuote}
          onSent={() => {
            onQuoteSent();
            onCloseQuote();
          }}
        />
      )}

      <InboxScheduleFollowupModal
        open={followupOpen}
        thread={thread}
        conversation={conversation}
        canWrite={canWrite}
        onClose={onCloseFollowup}
        onSaved={onCrmUpdated}
      />
    </>
  );
}
