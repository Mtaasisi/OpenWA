import { useCallback, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { InboxContextMenuState } from '../components/InboxContextMenu';
import {
  buildComposerContextMenuItems,
  buildConversationContextMenuItems,
  buildCrmContextMenuItems,
  buildGroupMemberContextMenuItems,
  buildHeaderContextMenuItems,
  buildListHeaderContextMenuItems,
  buildMessageContextMenuItems,
  buildSessionRailContextMenuItems,
  buildThreadBackgroundContextMenuItems,
  copyInboxText,
  detectDesktopForContextMenu,
  formatContextMenuHeader,
  formatFollowUpPresetDate,
  isImageMessageForClipboard,
  messageContextCopyText,
  whatsAppContactUrl,
} from '../lib/inbox-context-menu';
import { channelsUrl } from '../lib/channel-routes';
import { openDesktopExternal, openDesktopFolder } from '../lib/desktop-shell';
import { isGroupChat } from '../pages/inbox-helpers';
import {
  dispatchOpenNewChat,
  dispatchOpenQuickReplies,
  dispatchOpenResolve,
  dispatchScheduleFollowup,
} from '../lib/inbox-events';
import { inboxModKeyLabel } from '../pages/inbox-shortcuts';
import { getConversationTitle } from '../pages/inbox-helpers';
import {
  conversationChatIdCopyText,
  conversationPhoneCopyText,
} from '../lib/inbox-customer-display';
import { resolveGroupMemberPhone } from '../lib/group-participants';
import { followUpPatchFromDraft } from '../lib/inbox-followup-draft';
import { defaultFollowupDraft } from '../components/InboxFollowupQuickPicker';
import type { Conversation, InboxMessage, Session } from '../services/api';
import { followupApi, inboxApi } from '../services/api';
import type { InboxController } from '../pages/useInboxController';
import {
  isMediaMessage,
  isMessageMediaStarred,
  setMessageMediaStarred,
  loadMessageMediaBlob,
} from '../pages/inbox-media';
import { useToast } from '../components/Toast';
type ThreadRef = { sessionId: string; chatId: string };

export type InboxHeaderMenuExtras = {
  crmPanelOpen?: boolean;
  onRefreshChat?: () => void;
  onToggleCrmPanel?: () => void;
};

export type InboxComposerMenuExtras = {
  hasDraft?: boolean;
  onAttach?: () => void;
  onClearDraft?: () => void;
  onMessageSearch?: () => void;
};

export type InboxListHeaderMenuExtras = {
  unreadCount?: number;
  onRefresh?: () => void;
  onMarkAllRead?: () => void;
  onFocusSearch?: () => void;
};

export type InboxGroupMemberMenuExtras = {
  memberPhone?: string | null;
  isFiltered?: boolean;
  onSelectMember?: () => void;
  onToggleMemberFilter?: () => void;
};

export type InboxThreadMenuExtras = {
  canLoadOlder?: boolean;
  onRefresh?: () => void;
  onLoadOlder?: () => void;
  onScrollToBottom?: () => void;
  onSearchInChat?: () => void;
};

export function useInboxContextMenu(ctrl: InboxController) {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [menu, setMenu] = useState<InboxContextMenuState | null>(null);
  const isDesktop = detectDesktopForContextMenu();

  const { data: staff = [] } = useQuery({
    queryKey: ['followups', 'staff'],
    queryFn: () => followupApi.listStaff(),
    staleTime: 60_000,
    enabled: menu !== null,
  });

  const closeMenu = useCallback(() => setMenu(null), []);

  const presentMenuAt = useCallback(
    (x: number, y: number, items: InboxContextMenuState['items'], header?: string) => {
      setMenu({ x, y, items, header });
    },
    [],
  );

  const copyWithToast = useCallback(
    async (text: string) => {
      const ok = await copyInboxText(text);
      if (ok) toast.success(t('inbox.copied'));
      else toast.error(t('common.errorGeneric'));
    },
    [t, toast],
  );

  const assignConversation = useCallback(
    async (conv: Conversation, staffId: string | null) => {
      try {
        const followupConv =
          (await queryClient.fetchQuery({
            queryKey: ['followups', 'conv', conv.sessionId, conv.chatId],
            queryFn: () => followupApi.getConversation(conv.sessionId, conv.chatId),
          })) ?? (await followupApi.getConversation(conv.sessionId, conv.chatId));
        await followupApi.assignConversation(followupConv.id, staffId);
        void queryClient.invalidateQueries({ queryKey: ['followups', 'conv', conv.sessionId, conv.chatId] });
        void queryClient.invalidateQueries({ queryKey: ['inbox', 'conversations'] });
        toast.success(staffId ? t('pipeline.assigned') : t('pipeline.unassignedDone'));
      } catch (err) {
        toast.error(t('common.errorGeneric'), err instanceof Error ? err.message : undefined);
      }
    },
    [queryClient, t, toast],
  );

  const scheduleFollowUp = useCallback(
    (thread: ThreadRef) => {
      ctrl.openThread(thread);
      window.setTimeout(() => dispatchScheduleFollowup(thread), 0);
    },
    [ctrl],
  );

  const reopenConversation = useCallback(
    (thread: ThreadRef) => {
      void inboxApi
        .updateThreadCrm({
          sessionId: thread.sessionId,
          chatId: thread.chatId,
          resolved: false,
          resolvedReason: null,
          resolvedNote: null,
          outcome: null,
        })
        .then(() => {
          ctrl.invalidateInbox(thread);
          toast.success(t('inbox.interakt.reopenChat'));
        })
        .catch(() => toast.error(t('common.errorGeneric')));
    },
    [ctrl, t, toast],
  );

  const openResolveFlow = useCallback(
    (thread: ThreadRef) => {
      ctrl.openThread(thread);
      window.setTimeout(() => dispatchOpenResolve(thread), 0);
    },
    [ctrl],
  );

  const openAiPrompt = useCallback(
    (prompt: string) => {
      navigate(`/ai?prompt=${encodeURIComponent(prompt)}`);
    },
    [navigate],
  );

  const toggleAiForThread = useCallback(
    (thread: ThreadRef, paused: boolean) => {
      void inboxApi
        .updateThreadCrm({
          sessionId: thread.sessionId,
          chatId: thread.chatId,
          aiAutoReplyPaused: !paused,
        })
        .then(() => {
          ctrl.invalidateInbox(thread);
          toast.success(!paused ? t('inbox.interakt.pauseAi') : t('inbox.interakt.resumeAi'));
        })
        .catch(() => toast.error(t('common.errorGeneric')));
    },
    [ctrl, t, toast],
  );

  const buildConversationItems = useCallback(
    (conv: Conversation) => {
      const thread = { sessionId: conv.sessionId, chatId: conv.chatId };
      return buildConversationContextMenuItems({
        conv,
        t,
        modKey: inboxModKeyLabel(),
        canWrite: ctrl.canWrite,
        staff,
        assignedStaffId: conv.assignedStaffId,
        onTogglePin: () => ctrl.togglePinThread(thread),
        isPinned: ctrl.isThreadPinned(thread),
        onAssign: staffId => void assignConversation(conv, staffId),
        onScheduleFollowUp: () => scheduleFollowUp(thread),
        onResolve: () => openResolveFlow(thread),
        onReopen: () => reopenConversation(thread),
        onOpenPipeline: () => navigate('/pipeline'),
        onCopy: text => void copyWithToast(text),
      });
    },
    [
      assignConversation,
      copyWithToast,
      ctrl,
      navigate,
      openResolveFlow,
      reopenConversation,
      scheduleFollowUp,
      staff,
      t,
    ],
  );

  const presentConversationMenuAt = useCallback(
    (x: number, y: number, conv: Conversation) => {
      presentMenuAt(x, y, buildConversationItems(conv));
    },
    [buildConversationItems, presentMenuAt],
  );

  const showConversationMenu = useCallback(
    (event: ReactMouseEvent, conv: Conversation) => {
      event.preventDefault();
      event.stopPropagation();
      presentConversationMenuAt(event.clientX, event.clientY, conv);
    },
    [presentConversationMenuAt],
  );

  const appendInternalNote = useCallback(
    (thread: ThreadRef, excerpt: string) => {
      const trimmed = excerpt.trim();
      if (!trimmed) return;
      void inboxApi
        .getThreadCrm(thread.sessionId, thread.chatId)
        .then(crm => {
          const prev = crm.internalNote?.trim() ?? '';
          const next = prev ? `${prev}\n\n${trimmed}` : trimmed;
          return inboxApi.updateThreadCrm({
            sessionId: thread.sessionId,
            chatId: thread.chatId,
            internalNote: next,
          });
        })
        .then(() => {
          ctrl.invalidateInbox(thread);
          toast.success(t('inbox.contextMenu.addedToNote'));
        })
        .catch(() => toast.error(t('common.errorGeneric')));
    },
    [ctrl, t, toast],
  );

  const buildMessageMenuItems = useCallback(
    (
      message: InboxMessage,
      options: {
        sessionId: string;
        thread?: ThreadRef;
        openLightbox?: () => void;
      },
    ) => {
      const starred = isMessageMediaStarred(message);
      const excerpt = messageContextCopyText(message).trim();
      return buildMessageContextMenuItems({
        message,
        t,
        canWrite: ctrl.canWrite,
        isDesktop,
        hasMedia: isMediaMessage(message),
        isStarred: starred,
        onCopyText: () => void copyWithToast(messageContextCopyText(message)),
        onCopyTimestamp: () => void copyWithToast(message.createdAt),
        onDownloadMedia: () => {
          void loadMessageMediaBlob(options.sessionId, message.id).then(blob => {
            if (!blob) {
              toast.error(t('inbox.mediaUnavailable'));
              return;
            }
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `message-${message.id}`;
            anchor.click();
            URL.revokeObjectURL(url);
          });
        },
        onCopyImage:
          isDesktop && isImageMessageForClipboard(message)
            ? () => {
                void loadMessageMediaBlob(options.sessionId, message.id).then(async blob => {
                  if (!blob) {
                    toast.error(t('inbox.mediaUnavailable'));
                    return;
                  }
                  try {
                    const mime = blob.type.startsWith('image/') ? blob.type : 'image/png';
                    await navigator.clipboard.write([
                      new ClipboardItem({ [mime]: blob.type ? blob : new Blob([blob], { type: mime }) }),
                    ]);
                    toast.success(t('inbox.copied'));
                  } catch {
                    toast.error(t('common.errorGeneric'));
                  }
                });
              }
            : undefined,
        onRevealMediaFolder: isDesktop ? () => openDesktopFolder('media') : undefined,
        onAskAiSummarize: excerpt
          ? () =>
              openAiPrompt(
                t('inbox.contextMenu.aiSummarizePrompt', {
                  excerpt: excerpt.slice(0, 500),
                }),
              )
          : undefined,
        onAskAiDraftReply: excerpt
          ? () =>
              openAiPrompt(
                t('inbox.contextMenu.aiDraftReplyPrompt', {
                  excerpt: excerpt.slice(0, 500),
                }),
              )
          : undefined,
        onToggleStar: () => {
          void setMessageMediaStarred(message.id, !starred).then(ok => {
            if (ok) {
              toast.success(
                starred
                  ? t('inbox.unstarMedia', { defaultValue: 'Unstar media' })
                  : t('inbox.starMedia', { defaultValue: 'Star media' }),
              );
            }
          });
        },
        onAddToNote: () => {
          const excerpt = messageContextCopyText(message).trim();
          if (!excerpt || !options.thread) return;
          appendInternalNote(options.thread, excerpt);
        },
        onReply: () => {
          ctrl.openThread({ sessionId: options.sessionId, chatId: message.chatId });
          ctrl.startQuoteReply(message);
        },
        onOpenLightbox: () => options.openLightbox?.(),
      });
    },
    [appendInternalNote, copyWithToast, ctrl, isDesktop, openAiPrompt, t, toast],
  );

  const presentMessageMenuAt = useCallback(
    (
      x: number,
      y: number,
      message: InboxMessage,
      options: {
        sessionId: string;
        thread?: ThreadRef;
        openLightbox?: () => void;
      },
    ) => {
      presentMenuAt(
        x,
        y,
        buildMessageMenuItems(message, options),
        formatContextMenuHeader(message.createdAt),
      );
    },
    [buildMessageMenuItems, presentMenuAt],
  );

  const showMessageMenu = useCallback(
    (
      event: ReactMouseEvent,
      message: InboxMessage,
      options: {
        sessionId: string;
        thread?: ThreadRef;
        openLightbox?: () => void;
      },
    ) => {
      event.preventDefault();
      event.stopPropagation();
      presentMessageMenuAt(event.clientX, event.clientY, message, options);
    },
    [presentMessageMenuAt],
  );

  const applyFollowUpPreset = useCallback(
    (thread: ThreadRef, days: number) => {
      const patch = followUpPatchFromDraft({
        date: formatFollowUpPresetDate(days),
        time: '10:00',
        reason: defaultFollowupDraft().reason,
        note: '',
      });
      void inboxApi
        .updateThreadCrm({ sessionId: thread.sessionId, chatId: thread.chatId, ...patch })
        .then(() => {
          ctrl.invalidateInbox(thread);
          toast.success(t('inbox.contextMenu.followUpScheduled'));
        })
        .catch(() => toast.error(t('common.errorGeneric')));
    },
    [ctrl, t, toast],
  );

  const clearFollowUp = useCallback(
    (thread: ThreadRef) => {
      void inboxApi
        .updateThreadCrm({
          sessionId: thread.sessionId,
          chatId: thread.chatId,
          followUpAt: null,
          followUpReason: null,
          followUpNote: null,
        })
        .then(() => {
          ctrl.invalidateInbox(thread);
          toast.success(t('inbox.contextMenu.followUpCleared'));
        })
        .catch(() => toast.error(t('common.errorGeneric')));
    },
    [ctrl, t, toast],
  );

  const showCrmMenu = useCallback(
    (event: ReactMouseEvent, conv: Conversation) => {
      event.preventDefault();
      event.stopPropagation();
      const thread = { sessionId: conv.sessionId, chatId: conv.chatId };
      const title = getConversationTitle(conv, t);
      const items = buildCrmContextMenuItems({
        conv,
        t,
        canWrite: ctrl.canWrite,
        hasFollowUp: conv.hasFollowUp || Boolean(conv.followUpAt || conv.nextFollowupAt),
        showAiToggle: ctrl.canWrite && !isGroupChat(conv.chatId),
        aiPaused: conv.aiAutoReplyPaused ?? false,
        onCopyName: () => void copyWithToast(title),
        onCopyPhone: () =>
          void copyWithToast(
            conversationPhoneCopyText(
              {
                chatId: conv.chatId,
                customerPhone: conv.customerPhone,
                displayName: conv.displayName,
              },
              t,
            ),
          ),
        onCopyExternalId: () => void copyWithToast(conv.linkedExternalId?.trim() ?? ''),
        onCopyChatId: () => void copyWithToast(conversationChatIdCopyText(conv.chatId)),
        onFollowUpPreset: days => applyFollowUpPreset(thread, days),
        onClearFollowUp: () => clearFollowUp(thread),
        onOpenPipeline: () => navigate('/pipeline'),
        onToggleAi: () => toggleAiForThread(thread, conv.aiAutoReplyPaused ?? false),
      });
      presentMenuAt(event.clientX, event.clientY, items);
    },
    [applyFollowUpPreset, clearFollowUp, copyWithToast, ctrl.canWrite, navigate, presentMenuAt, t, toggleAiForThread],
  );

  const presentCrmMenuAt = useCallback(
    (x: number, y: number, conv: Conversation) => {
      const thread = { sessionId: conv.sessionId, chatId: conv.chatId };
      const title = getConversationTitle(conv, t);
      const items = buildCrmContextMenuItems({
        conv,
        t,
        canWrite: ctrl.canWrite,
        hasFollowUp: conv.hasFollowUp || Boolean(conv.followUpAt || conv.nextFollowupAt),
        showAiToggle: ctrl.canWrite && !isGroupChat(conv.chatId),
        aiPaused: conv.aiAutoReplyPaused ?? false,
        onCopyName: () => void copyWithToast(title),
        onCopyPhone: () =>
          void copyWithToast(
            conversationPhoneCopyText(
              {
                chatId: conv.chatId,
                customerPhone: conv.customerPhone,
                displayName: conv.displayName,
              },
              t,
            ),
          ),
        onCopyExternalId: () => void copyWithToast(conv.linkedExternalId?.trim() ?? ''),
        onCopyChatId: () => void copyWithToast(conversationChatIdCopyText(conv.chatId)),
        onFollowUpPreset: days => applyFollowUpPreset(thread, days),
        onClearFollowUp: () => clearFollowUp(thread),
        onOpenPipeline: () => navigate('/pipeline'),
        onToggleAi: () => toggleAiForThread(thread, conv.aiAutoReplyPaused ?? false),
      });
      presentMenuAt(x, y, items);
    },
    [applyFollowUpPreset, clearFollowUp, copyWithToast, ctrl.canWrite, navigate, presentMenuAt, t, toggleAiForThread],
  );

  const showSessionMenu = useCallback(
    (event: ReactMouseEvent, session: Session, sessionReady: boolean) => {
      event.preventDefault();
      event.stopPropagation();
      const items = buildSessionRailContextMenuItems({
        t,
        sessionName: session.name,
        sessionReady,
        onSwitch: () => ctrl.selectSessionRail(session.id),
        onStartSession: () => ctrl.handleStartSession(session.id),
        onOpenChannels: () => navigate(channelsUrl({ channel: 'whatsapp' })),
        onCopySessionId: () => void copyWithToast(session.id),
      });
      presentMenuAt(event.clientX, event.clientY, items);
    },
    [copyWithToast, ctrl, navigate, presentMenuAt, t],
  );

  const showHeaderMenu = useCallback(
    (event: ReactMouseEvent, conv: Conversation | undefined, extras?: InboxHeaderMenuExtras) => {
      if (!conv) return;
      event.preventDefault();
      event.stopPropagation();
      const base = buildConversationItems(conv);
      const thread = { sessionId: conv.sessionId, chatId: conv.chatId };
      const waUrl = whatsAppContactUrl(conv.chatId);
      const items = buildHeaderContextMenuItems(base, {
        t,
        crmOpen: extras?.crmPanelOpen ?? false,
        onRefresh: () => extras?.onRefreshChat?.(),
        onToggleCrm: () => extras?.onToggleCrmPanel?.(),
        showAiToggle: ctrl.canWrite && !isGroupChat(conv.chatId),
        aiPaused: conv.aiAutoReplyPaused ?? false,
        onToggleAi: () => toggleAiForThread(thread, conv.aiAutoReplyPaused ?? false),
        whatsAppUrl: waUrl,
        onOpenWhatsApp: waUrl ? () => openDesktopExternal(waUrl) : undefined,
      });
      setMenu({ x: event.clientX, y: event.clientY, items });
    },
    [buildConversationItems, ctrl.canWrite, t, toggleAiForThread],
  );

  const showListHeaderMenu = useCallback(
    (event: ReactMouseEvent, extras?: InboxListHeaderMenuExtras) => {
      event.preventDefault();
      event.stopPropagation();
      const modKey = inboxModKeyLabel();
      const items = buildListHeaderContextMenuItems({
        t,
        modKey,
        unreadCount: extras?.unreadCount ?? 0,
        onRefresh: () => extras?.onRefresh?.(),
        onNewChat: () => dispatchOpenNewChat(),
        onMarkAllRead: () => extras?.onMarkAllRead?.(),
        onFocusSearch: () => extras?.onFocusSearch?.(),
      });
      setMenu({ x: event.clientX, y: event.clientY, items });
    },
    [t],
  );

  const showComposerMenu = useCallback(
    (event: ReactMouseEvent, extras?: InboxComposerMenuExtras) => {
      event.preventDefault();
      event.stopPropagation();
      const modKey = inboxModKeyLabel();
      const items = buildComposerContextMenuItems({
        t,
        canWrite: ctrl.canWrite,
        hasDraft: extras?.hasDraft ?? false,
        modKey,
        onAttach: () => extras?.onAttach?.(),
        onQuickReplies: () => dispatchOpenQuickReplies(),
        onClearDraft: () => extras?.onClearDraft?.(),
        onMessageSearch: () => extras?.onMessageSearch?.(),
      });
      setMenu({ x: event.clientX, y: event.clientY, items });
    },
    [ctrl.canWrite, t],
  );

  const showThreadMenu = useCallback(
    (event: ReactMouseEvent, extras?: InboxThreadMenuExtras) => {
      event.preventDefault();
      event.stopPropagation();
      const modKey = inboxModKeyLabel();
      const items = buildThreadBackgroundContextMenuItems({
        t,
        modKey,
        canLoadOlder: extras?.canLoadOlder ?? false,
        onRefresh: () => extras?.onRefresh?.(),
        onLoadOlder: () => extras?.onLoadOlder?.(),
        onScrollToBottom: () => extras?.onScrollToBottom?.(),
        onSearchInChat: () => extras?.onSearchInChat?.(),
      });
      setMenu({ x: event.clientX, y: event.clientY, items });
    },
    [t],
  );

  const showGroupMemberMenu = useCallback(
    (event: ReactMouseEvent, memberId: string, extras?: InboxGroupMemberMenuExtras) => {
      event.preventDefault();
      event.stopPropagation();
      const phone =
        resolveGroupMemberPhone(memberId)?.trim() ||
        conversationPhoneCopyText({ chatId: memberId }, t) ||
        conversationChatIdCopyText(memberId);
      const items = buildGroupMemberContextMenuItems({
        t,
        isFiltered: extras?.isFiltered ?? false,
        onOpenCrm: () => extras?.onSelectMember?.(),
        onCopyPhone: () => void copyWithToast(phone),
        onFilterMessages: () => extras?.onToggleMemberFilter?.(),
      });
      setMenu({ x: event.clientX, y: event.clientY, items });
    },
    [copyWithToast, t],
  );

  return {
    menu,
    closeMenu,
    presentConversationMenuAt,
    presentMessageMenuAt,
    presentCrmMenuAt,
    showConversationMenu,
    showMessageMenu,
    showHeaderMenu,
    showCrmMenu,
    showSessionMenu,
    showListHeaderMenu,
    showComposerMenu,
    showGroupMemberMenu,
    showThreadMenu,
  };
}
