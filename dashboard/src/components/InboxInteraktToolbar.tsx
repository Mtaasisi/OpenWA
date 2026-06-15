import type { Conversation, InboxMessage } from '../services/api';
import { InboxComposerTools } from './InboxComposerTools';

interface Props {
  sessionId: string;
  chatId: string;
  conversation?: Conversation;
  sessionStatus?: string;
  canWrite: boolean;
  canSend: boolean;
  sending: boolean;
  onInsertQuickReply: (text: string) => void;
  onAppendComposer: (text: string) => void;
  onFocusComposer: () => void;
  onAttachClick: () => void;
  onQuoteSent: () => void;
  onProductSent?: () => void;
  addOptimisticMessage?: (message: InboxMessage) => void;
  removeOptimisticMessage?: (id: string) => void;
  onStartSession?: (sessionId: string) => void;
}

export function InboxInteraktToolbar(props: Props) {
  return <InboxComposerTools variant="interakt" {...props} />;
}
