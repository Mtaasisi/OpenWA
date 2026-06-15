import type { InboxThreadCrm } from '../services/api';
import { isGroupChat } from '../pages/inbox-helpers';
import { InboxAiAutoReplyToggle } from './InboxAiAutoReplyToggle';
import { InboxAiOptOutToggle } from './InboxAiOptOutToggle';
import { InboxAiHandlingControls } from './InboxAiHandlingControls';
import { InboxFollowupAutopilotControls } from './InboxFollowupAutopilotControls';
import { InboxWhatsAppConsentStrip } from './InboxWhatsAppConsentStrip';

interface Props {
  sessionId: string;
  chatId: string;
  chatIdForGroup: string;
  crm: InboxThreadCrm | undefined;
  conversationFollowupAutopilotPaused?: boolean;
  className?: string;
  toggleClassName?: string;
  handlingClassName?: string;
}

/** Shared AI auto-reply / opt-out / handling block for Classic, Interakt, and Tactical CRM. */
export function InboxCrmAiControls({
  sessionId,
  chatId,
  chatIdForGroup,
  crm,
  conversationFollowupAutopilotPaused,
  className,
  toggleClassName,
  handlingClassName,
}: Props) {
  const isGroup = isGroupChat(chatIdForGroup);

  return (
    <div className={className}>
      <InboxAiAutoReplyToggle
        sessionId={sessionId}
        chatId={chatId}
        aiAutoReplyPaused={crm?.aiAutoReplyPaused ?? false}
        isGroup={isGroup}
        className={toggleClassName}
      />
      <InboxAiOptOutToggle
        sessionId={sessionId}
        chatId={chatId}
        aiOptOut={crm?.aiOptOut ?? false}
        isGroup={isGroup}
        className={toggleClassName}
      />
      <InboxAiHandlingControls
        sessionId={sessionId}
        chatId={chatId}
        isGroup={isGroup}
        crm={crm}
        className={handlingClassName}
        hideBadge={handlingClassName?.includes('interakt')}
      />
      <InboxFollowupAutopilotControls
        sessionId={sessionId}
        chatId={chatId}
        chatIdForGroup={chatIdForGroup}
        crm={crm}
        conversationFollowupAutopilotPaused={conversationFollowupAutopilotPaused}
        className={toggleClassName}
      />
      <InboxWhatsAppConsentStrip sessionId={sessionId} chatId={chatId} />
    </div>
  );
}
