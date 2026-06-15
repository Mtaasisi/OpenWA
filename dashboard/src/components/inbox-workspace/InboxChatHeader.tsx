import type { ComponentProps } from 'react';
import type { InboxVariant } from '../../pages/inbox-workspace-types';
import { InboxInteraktChatHeader } from '../InboxInteraktChatHeader';
import { InboxStitchChatHeader } from '../InboxStitchChatHeader';

export type InboxChatHeaderProps = ComponentProps<typeof InboxInteraktChatHeader> & {
  variant?: InboxVariant;
};

export function InboxChatHeader({ variant = 'interakt', ...props }: InboxChatHeaderProps) {
  if (variant === 'classic') {
    return null;
  }
  if (variant === 'stitch') {
    return (
      <div className="inbox-chat-header inbox-chat-header--stitch" data-inbox-variant="stitch">
        <InboxStitchChatHeader {...props} />
      </div>
    );
  }
  return (
    <div
      className={
        variant === 'tactical'
          ? 'inbox-chat-header inbox-chat-header--tactical tac-chat-header-host'
          : 'inbox-chat-header inbox-chat-header--interakt'
      }
      data-inbox-variant={variant}
    >
      <InboxInteraktChatHeader {...props} />
    </div>
  );
}

export { InboxInteraktChatHeader };
export type { InteraktComposerTab } from '../InboxInteraktChatHeader';
