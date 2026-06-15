import type { ReactNode } from 'react';
import { MaterialSymbol } from './MaterialSymbol';
import type { Conversation } from '../services/api';

type InboxStitchConversationListProps = {
  pinned: Conversation[];
  recent: Conversation[];
  pinnedLabel: string;
  recentLabel: string;
  renderRow: (conv: Conversation, showPinIcon: boolean) => ReactNode;
};

/** Stitch inbox list — normal document flow (no virtualizer; avoids row overlap bugs). */
export function InboxStitchConversationList({
  pinned,
  recent,
  pinnedLabel,
  recentLabel,
  renderRow,
}: InboxStitchConversationListProps) {
  if (pinned.length === 0 && recent.length === 0) return null;

  return (
    <div className="inbox-stitch-conversation-list">
      {pinned.length > 0 ? (
        <>
          <div className="inbox-stitch-list-section">
            <MaterialSymbol name="push_pin" size={16} filled className="inbox-stitch-list-section__icon" />
            <span>{pinnedLabel}</span>
          </div>
          {pinned.map(conv => renderRow(conv, true))}
        </>
      ) : null}
      {pinned.length > 0 && recent.length > 0 ? (
        <div className="inbox-stitch-list-section inbox-stitch-list-section--recent">
          <span>{recentLabel}</span>
        </div>
      ) : null}
      {recent.map(conv => renderRow(conv, false))}
    </div>
  );
}
