import type { TFunction } from 'i18next';
import type { InboxContextMenuEntry } from '../components/InboxContextMenu';
import type { Conversation, InboxMessage } from '../services/api';
import { isMediaMessage, mediaLabel } from '../pages/inbox-media';
import { getConversationTitle, isGroupChat } from '../pages/inbox-helpers';
import {
  conversationChatIdCopyText,
  conversationPhoneCopyText,
} from './inbox-customer-display';
import { isDesktopApp } from './desktop-shell';

export function formatContextMenuHeader(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const time = d
    .toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    .replace(/\sAM|\sPM/i, match => match.toLowerCase());

  if (d.toDateString() === now.toDateString()) return `Today ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`;
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
}

export async function copyInboxText(text: string): Promise<boolean> {
  const value = text.trim();
  if (!value) return false;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export function messageContextCopyText(message: InboxMessage): string {
  if (message.body?.trim()) return message.body;
  return mediaLabel(message.type);
}

export function buildListHeaderContextMenuItems(input: {
  t: TFunction;
  unreadCount: number;
  modKey: string;
  onRefresh: () => void;
  onNewChat: () => void;
  onMarkAllRead: () => void;
  onFocusSearch: () => void;
}): InboxContextMenuEntry[] {
  const items: InboxContextMenuEntry[] = [
    {
      kind: 'item',
      id: 'refresh',
      label: input.t('inbox.contextMenu.refreshList'),
      shortcut: `${input.modKey}⇧R`,
      onSelect: input.onRefresh,
    },
    {
      kind: 'item',
      id: 'search',
      label: input.t('inbox.contextMenu.focusSearch'),
      shortcut: `${input.modKey}K`,
      onSelect: input.onFocusSearch,
    },
    {
      kind: 'item',
      id: 'new-chat',
      label: input.t('inbox.contextMenu.newChat'),
      shortcut: `${input.modKey}⇧N`,
      onSelect: input.onNewChat,
    },
  ];
  if (input.unreadCount > 0) {
    items.push({
      kind: 'item',
      id: 'mark-all-read',
      label: input.t('inbox.interakt.markAllRead', { count: input.unreadCount }),
      onSelect: input.onMarkAllRead,
    });
  }
  return items;
}

export function whatsAppContactUrl(chatId: string): string | null {
  if (chatId.includes('@g.us') || chatId.includes('@lid')) return null;
  const digits = chatId.replace(/@c\.us$|@s\.whatsapp\.net$/i, '').replace(/\D/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits}`;
}

export function buildHeaderContextMenuItems(
  base: InboxContextMenuEntry[],
  input: {
    t: TFunction;
    crmOpen: boolean;
    onRefresh: () => void;
    onToggleCrm: () => void;
    showAiToggle?: boolean;
    aiPaused?: boolean;
    onToggleAi?: () => void;
    whatsAppUrl?: string | null;
    onOpenWhatsApp?: () => void;
  },
): InboxContextMenuEntry[] {
  const rest = base.filter(entry => entry.kind !== 'item' || entry.id !== 'open');
  const head: InboxContextMenuEntry[] = [
    {
      kind: 'item',
      id: 'refresh-chat',
      label: input.t('inbox.contextMenu.refreshChat'),
      onSelect: input.onRefresh,
    },
    {
      kind: 'item',
      id: 'toggle-crm',
      label: input.crmOpen ? input.t('inbox.hideCustomerPanel') : input.t('inbox.contextMenu.showCrmPanel'),
      shortcut: '⌘I',
      onSelect: input.onToggleCrm,
    },
  ];
  if (input.showAiToggle && input.onToggleAi) {
    head.push({
      kind: 'item',
      id: 'toggle-ai',
      label: input.aiPaused ? input.t('inbox.interakt.resumeAi') : input.t('inbox.interakt.pauseAi'),
      onSelect: input.onToggleAi,
    });
  }
  if (input.whatsAppUrl && input.onOpenWhatsApp) {
    head.push({
      kind: 'item',
      id: 'open-whatsapp',
      label: input.t('inbox.contextMenu.openWhatsApp'),
      onSelect: input.onOpenWhatsApp,
    });
  }
  return [...head, { kind: 'separator' }, ...rest];
}

export function buildThreadBackgroundContextMenuItems(input: {
  t: TFunction;
  modKey: string;
  canLoadOlder: boolean;
  onRefresh: () => void;
  onLoadOlder: () => void;
  onScrollToBottom: () => void;
  onSearchInChat: () => void;
}): InboxContextMenuEntry[] {
  const items: InboxContextMenuEntry[] = [
    {
      kind: 'item',
      id: 'refresh-thread',
      label: input.t('inbox.contextMenu.refreshChat'),
      onSelect: input.onRefresh,
    },
    {
      kind: 'item',
      id: 'search-thread',
      label: input.t('inbox.contextMenu.searchInChat'),
      shortcut: `${input.modKey}F`,
      onSelect: input.onSearchInChat,
    },
    {
      kind: 'item',
      id: 'scroll-bottom',
      label: input.t('inbox.contextMenu.scrollToBottom'),
      onSelect: input.onScrollToBottom,
    },
  ];
  if (input.canLoadOlder) {
    items.push({
      kind: 'item',
      id: 'load-older',
      label: input.t('inbox.loadOlder'),
      onSelect: input.onLoadOlder,
    });
  }
  return items;
}

export function buildComposerContextMenuItems(input: {
  t: TFunction;
  canWrite: boolean;
  hasDraft: boolean;
  modKey: string;
  onAttach: () => void;
  onQuickReplies: () => void;
  onClearDraft: () => void;
  onMessageSearch: () => void;
}): InboxContextMenuEntry[] {
  const items: InboxContextMenuEntry[] = [];
  if (input.canWrite) {
    items.push(
      {
        kind: 'item',
        id: 'attach',
        label: input.t('inbox.attachImage'),
        shortcut: `${input.modKey}⇧A`,
        onSelect: input.onAttach,
      },
      {
        kind: 'item',
        id: 'quick-replies',
        label: input.t('inbox.contextMenu.quickReplies'),
        shortcut: `${input.modKey}⇧P`,
        onSelect: input.onQuickReplies,
      },
    );
  }
  items.push({
    kind: 'item',
    id: 'message-search',
    label: input.t('inbox.contextMenu.searchInChat'),
    shortcut: `${input.modKey}F`,
    onSelect: input.onMessageSearch,
  });
  if (input.canWrite && input.hasDraft) {
    items.push({ kind: 'separator' });
    items.push({
      kind: 'item',
      id: 'clear-draft',
      label: input.t('inbox.contextMenu.clearDraft'),
      onSelect: input.onClearDraft,
    });
  }
  return items;
}

function formatFollowUpPresetDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function buildCrmContextMenuItems(input: {
  conv: Conversation;
  t: TFunction;
  canWrite: boolean;
  hasFollowUp: boolean;
  showAiToggle: boolean;
  aiPaused: boolean;
  onCopyName: () => void;
  onCopyPhone: () => void;
  onCopyExternalId: () => void;
  onCopyChatId: () => void;
  onFollowUpPreset: (days: number) => void;
  onClearFollowUp: () => void;
  onOpenPipeline: () => void;
  onToggleAi?: () => void;
}): InboxContextMenuEntry[] {
  const phoneCopy = conversationPhoneCopyText(
    {
      chatId: input.conv.chatId,
      customerPhone: input.conv.customerPhone,
      displayName: input.conv.displayName,
    },
    input.t,
  );
  const chatIdCopy = conversationChatIdCopyText(input.conv.chatId);
  const items: InboxContextMenuEntry[] = [
    {
      kind: 'item',
      id: 'copy-name',
      label: input.t('inbox.contextMenu.copyName'),
      onSelect: input.onCopyName,
    },
  ];
  if (!isGroupChat(input.conv.chatId) && phoneCopy) {
    items.push({
      kind: 'item',
      id: 'copy-phone',
      label: input.t('inbox.contextMenu.copyPhone'),
      onSelect: input.onCopyPhone,
    });
  }
  if (input.conv.linkedExternalId?.trim()) {
    items.push({
      kind: 'item',
      id: 'copy-external',
      label: input.t('inbox.contextMenu.copyExternalId'),
      onSelect: input.onCopyExternalId,
    });
  }
  if (chatIdCopy) {
    items.push({
      kind: 'item',
      id: 'copy-chat-id',
      label: input.t('inbox.contextMenu.copyChatId'),
      onSelect: input.onCopyChatId,
    });
  }

  if (input.canWrite) {
    items.push({ kind: 'separator' });
    const presetItems: InboxContextMenuEntry[] = [
      {
        kind: 'item',
        id: 'fu-tomorrow',
        label: input.t('inbox.contextMenu.followUpTomorrow'),
        onSelect: () => input.onFollowUpPreset(1),
      },
      {
        kind: 'item',
        id: 'fu-3days',
        label: input.t('inbox.contextMenu.followUp3Days'),
        onSelect: () => input.onFollowUpPreset(3),
      },
      {
        kind: 'item',
        id: 'fu-week',
        label: input.t('inbox.contextMenu.followUpWeek'),
        onSelect: () => input.onFollowUpPreset(7),
      },
    ];
    items.push({
      kind: 'submenu',
      id: 'follow-up-presets',
      label: input.t('inbox.contextMenu.scheduleFollowUp'),
      items: presetItems,
    });
    if (input.hasFollowUp) {
      items.push({
        kind: 'item',
        id: 'clear-follow-up',
        label: input.t('inbox.contextMenu.clearFollowUp'),
        onSelect: input.onClearFollowUp,
      });
    }
    if (input.showAiToggle && input.onToggleAi) {
      items.push({
        kind: 'item',
        id: 'toggle-ai',
        label: input.aiPaused ? input.t('inbox.interakt.resumeAi') : input.t('inbox.interakt.pauseAi'),
        onSelect: input.onToggleAi,
      });
    }
  }

  items.push({ kind: 'separator' });
  items.push({
    kind: 'item',
    id: 'pipeline',
    label: input.t('inbox.contextMenu.openPipeline'),
    onSelect: input.onOpenPipeline,
  });

  return items;
}

export function buildSessionRailContextMenuItems(input: {
  t: TFunction;
  sessionName: string;
  sessionReady: boolean;
  onSwitch: () => void;
  onStartSession: () => void;
  onOpenChannels: () => void;
  onCopySessionId: () => void;
}): InboxContextMenuEntry[] {
  const items: InboxContextMenuEntry[] = [
    {
      kind: 'item',
      id: 'switch',
      label: input.t('inbox.contextMenu.switchSession', { name: input.sessionName }),
      onSelect: input.onSwitch,
    },
  ];
  if (!input.sessionReady) {
    items.push({
      kind: 'item',
      id: 'start',
      label: input.t('inbox.startSession'),
      onSelect: input.onStartSession,
    });
  }
  items.push({ kind: 'separator' });
  items.push({
    kind: 'item',
    id: 'channels',
    label: input.t('inbox.contextMenu.openChannels'),
    onSelect: input.onOpenChannels,
  });
  items.push({
    kind: 'item',
    id: 'copy-session',
    label: input.t('inbox.contextMenu.copySessionId'),
    onSelect: input.onCopySessionId,
  });
  return items;
}

export { formatFollowUpPresetDate };

export function buildGroupMemberContextMenuItems(input: {
  t: TFunction;
  onOpenCrm: () => void;
  onCopyPhone: () => void;
  onFilterMessages: () => void;
  isFiltered: boolean;
}): InboxContextMenuEntry[] {
  return [
    {
      kind: 'item',
      id: 'member-crm',
      label: input.t('inbox.contextMenu.openMemberCrm'),
      onSelect: input.onOpenCrm,
    },
    {
      kind: 'item',
      id: 'member-copy',
      label: input.t('inbox.contextMenu.copyMemberPhone'),
      onSelect: input.onCopyPhone,
    },
    { kind: 'separator' },
    {
      kind: 'item',
      id: 'member-filter',
      label: input.isFiltered
        ? input.t('inbox.contextMenu.clearMemberFilter')
        : input.t('inbox.contextMenu.filterMemberMessages'),
      onSelect: input.onFilterMessages,
    },
  ];
}

function staffAssignMenuIcon(member: { name: string; role: string }): string {
  if (/key/i.test(member.name)) return 'key';
  if (member.role === 'admin') return 'badge';
  return 'person';
}

function staffAssignMenuLabel(
  member: { name: string; role: string },
  t: TFunction,
): string {
  if (/key/i.test(member.name)) return member.name;
  return t('inbox.contextMenu.staffUser', { name: member.name });
}

export function buildConversationContextMenuItems(input: {
  conv: Conversation;
  t: TFunction;
  modKey: string;
  canWrite: boolean;
  staff: { id: string; name: string; role: string }[];
  assignedStaffId?: string | null;
  onTogglePin: () => void;
  isPinned?: boolean;
  onAssign: (staffId: string | null) => void;
  onScheduleFollowUp: () => void;
  onResolve: () => void;
  onReopen: () => void;
  onOpenPipeline: () => void;
  onCopy: (text: string) => void;
}): InboxContextMenuEntry[] {
  const {
    conv,
    t,
    modKey,
    canWrite,
    staff,
    assignedStaffId,
    onTogglePin,
    isPinned: isPinnedInput,
    onAssign,
    onScheduleFollowUp,
    onResolve,
    onReopen,
    onOpenPipeline,
    onCopy,
  } = input;

  const pinned = isPinnedInput ?? false;
  const title = getConversationTitle(conv, t);
  const phoneCopy = conversationPhoneCopyText(
    {
      chatId: conv.chatId,
      customerPhone: conv.customerPhone,
      displayName: conv.displayName,
    },
    t,
  );
  const chatIdCopy = conversationChatIdCopyText(conv.chatId);
  const items: InboxContextMenuEntry[] = [
    {
      kind: 'item',
      id: pinned ? 'unpin' : 'pin',
      label: pinned ? t('inbox.contextMenu.unpin') : t('inbox.contextMenu.pin'),
      shortcut: `${modKey}P`,
      accent: pinned,
      onSelect: onTogglePin,
    },
  ];

  if (!isGroupChat(conv.chatId) && phoneCopy) {
    items.push({
      kind: 'item',
      id: 'copy-phone',
      label: t('inbox.contextMenu.copyPhoneShort'),
      shortcut: `${modKey}C`,
      onSelect: () => onCopy(phoneCopy),
    });
  }

  if (chatIdCopy) {
    items.push({
      kind: 'item',
      id: 'copy-chat-id',
      label: t('inbox.contextMenu.copyChatId'),
      onSelect: () => onCopy(chatIdCopy),
    });
  }

  if (title) {
    items.push({
      kind: 'item',
      id: 'copy-name',
      label: t('inbox.contextMenu.copyNameShort'),
      onSelect: () => onCopy(title),
    });
  }

  if (canWrite) {
    if (staff.length > 0) {
      const assignItems: InboxContextMenuEntry[] = [
        {
          kind: 'item',
          id: 'assign-none',
          label: t('inbox.interakt.unassigned'),
          onSelect: () => onAssign(null),
        },
        ...staff.map(member => ({
          kind: 'item' as const,
          id: `assign-${member.id}`,
          icon: staffAssignMenuIcon(member),
          label: staffAssignMenuLabel(member, t),
          onSelect: () => onAssign(member.id),
        })),
      ];
      items.push({
        kind: 'submenu',
        id: 'assign',
        label:
          assignedStaffId && staff.find(s => s.id === assignedStaffId)
            ? t('inbox.contextMenu.assignToNamed', {
                name: staff.find(s => s.id === assignedStaffId)?.name ?? '',
              })
            : t('inbox.contextMenu.assignTo'),
        items: assignItems,
      });
    }

    items.push({
      kind: 'item',
      id: 'follow-up',
      label: t('inbox.contextMenu.schedule'),
      shortcut: `${modKey}T`,
      onSelect: onScheduleFollowUp,
    });

    if (conv.resolved) {
      items.push({
        kind: 'item',
        id: 'reopen',
        label: t('inbox.interakt.reopenChat'),
        onSelect: onReopen,
      });
    } else {
      items.push({
        kind: 'item',
        id: 'resolve',
        label: t('inbox.contextMenu.resolve'),
        danger: true,
        onSelect: onResolve,
      });
    }
  }

  items.push({ kind: 'separator' });
  items.push({
    kind: 'item',
    id: 'pipeline',
    label: t('inbox.contextMenu.openPipeline'),
    shortcut: `${modKey}L`,
    onSelect: onOpenPipeline,
  });

  return items;
}

export function isImageMessageForClipboard(message: InboxMessage): boolean {
  return message.type === 'image' || message.type === 'sticker';
}

export function buildMessageContextMenuItems(input: {
  message: InboxMessage;
  t: TFunction;
  canWrite: boolean;
  isDesktop: boolean;
  onCopyText: () => void;
  onCopyTimestamp: () => void;
  onDownloadMedia: () => void;
  onCopyImage?: () => void;
  onRevealMediaFolder?: () => void;
  onToggleStar: () => void;
  isStarred: boolean;
  hasMedia: boolean;
  onAddToNote: () => void;
  onReply: () => void;
  onOpenLightbox: () => void;
  onAskAiSummarize?: () => void;
  onAskAiDraftReply?: () => void;
}): InboxContextMenuEntry[] {
  const {
    message,
    t,
    canWrite,
    isDesktop,
    onCopyText,
    onCopyTimestamp,
    onDownloadMedia,
    onCopyImage,
    onRevealMediaFolder,
    onToggleStar,
    isStarred,
    hasMedia,
    onAddToNote,
    onReply,
    onOpenLightbox,
    onAskAiSummarize,
    onAskAiDraftReply,
  } = input;

  const items: InboxContextMenuEntry[] = [
    {
      kind: 'item',
      id: 'copy-text',
      label: t('inbox.copyMessage'),
      shortcut: '⌘C',
      onSelect: onCopyText,
    },
    {
      kind: 'item',
      id: 'copy-time',
      label: t('inbox.contextMenu.copyTimestamp'),
      onSelect: onCopyTimestamp,
    },
  ];

  if (hasMedia || isMediaMessage(message)) {
    items.push({ kind: 'separator' });
    items.push({
      kind: 'item',
      id: 'open-media',
      label: t('inbox.interakt.mediaLightbox'),
      onSelect: onOpenLightbox,
    });
    items.push({
      kind: 'item',
      id: 'download-media',
      label: isDesktop ? t('inbox.contextMenu.saveMedia') : t('inbox.downloadMedia'),
      onSelect: onDownloadMedia,
    });
    items.push({
      kind: 'item',
      id: 'star-media',
      label: isStarred ? t('inbox.unstarMedia', { defaultValue: 'Unstar media' }) : t('inbox.starMedia', { defaultValue: 'Star media' }),
      onSelect: onToggleStar,
    });
    if (isDesktop && isImageMessageForClipboard(message) && onCopyImage) {
      items.push({
        kind: 'item',
        id: 'copy-image',
        label: t('inbox.contextMenu.copyImage'),
        onSelect: onCopyImage,
      });
    }
    if (isDesktop && onRevealMediaFolder) {
      items.push({
        kind: 'item',
        id: 'reveal-media',
        label: t('inbox.contextMenu.revealMediaFolder'),
        onSelect: onRevealMediaFolder,
      });
    }
  }

  if (message.body?.trim() && onAskAiSummarize && onAskAiDraftReply) {
    items.push({ kind: 'separator' });
    items.push({
      kind: 'submenu',
      id: 'ask-ai',
      label: t('inbox.contextMenu.askAi'),
      items: [
        {
          kind: 'item',
          id: 'ai-summarize',
          label: t('inbox.contextMenu.aiSummarize'),
          onSelect: onAskAiSummarize,
        },
        {
          kind: 'item',
          id: 'ai-draft',
          label: t('inbox.contextMenu.aiDraftReply'),
          onSelect: onAskAiDraftReply,
        },
      ],
    });
  }

  if (canWrite) {
    items.push({ kind: 'separator' });
    if (message.body?.trim()) {
      items.push({
        kind: 'item',
        id: 'add-note',
        label: t('inbox.contextMenu.addToNote'),
        onSelect: onAddToNote,
      });
    }
    items.push({
      kind: 'item',
      id: 'reply',
      label: t('inbox.contextMenu.reply'),
      icon: 'reply',
      shortcut: '⌘R',
      disabled: !message.waMessageId?.trim(),
      onSelect: onReply,
    });
  }

  return items;
}

export function detectDesktopForContextMenu(): boolean {
  return isDesktopApp();
}
