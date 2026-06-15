export const OPENWA_NEW_CHAT_EVENT = 'openwa-new-chat';
export const OPENWA_OPEN_QUICK_REPLIES_EVENT = 'openwa-open-quick-replies';
export const OPENWA_COMPOSER_TAB_EVENT = 'openwa-composer-tab';
export const OPENWA_OPEN_RESOLVE_EVENT = 'openwa-open-resolve';
export const OPENWA_OPEN_TRANSFER_EVENT = 'openwa-open-transfer';
export const OPENWA_SCHEDULE_FOLLOWUP_EVENT = 'openwa-schedule-followup';
export const OPENWA_REFRESH_STITCH_SUGGESTIONS_EVENT = 'openwa-refresh-stitch-suggestions';
export const INBOX_TABS_UPDATED_EVENT = 'openwa-inbox-tabs-updated';

export type OpenComposerTabDetail = 'reply' | 'notes' | 'followup' | 'quote';

export type InboxActionThreadDetail = { sessionId: string; chatId: string };

export function dispatchOpenNewChat(): void {
  window.dispatchEvent(new CustomEvent(OPENWA_NEW_CHAT_EVENT));
}

export function dispatchOpenQuickReplies(): void {
  window.dispatchEvent(new CustomEvent(OPENWA_OPEN_QUICK_REPLIES_EVENT));
}

export function dispatchComposerTab(tab: OpenComposerTabDetail): void {
  window.dispatchEvent(new CustomEvent<OpenComposerTabDetail>(OPENWA_COMPOSER_TAB_EVENT, { detail: tab }));
}

export function dispatchOpenResolve(thread: InboxActionThreadDetail): void {
  window.dispatchEvent(new CustomEvent<InboxActionThreadDetail>(OPENWA_OPEN_RESOLVE_EVENT, { detail: thread }));
}

export function dispatchOpenTransfer(thread: InboxActionThreadDetail): void {
  window.dispatchEvent(new CustomEvent<InboxActionThreadDetail>(OPENWA_OPEN_TRANSFER_EVENT, { detail: thread }));
}

export function dispatchScheduleFollowup(thread: InboxActionThreadDetail): void {
  window.dispatchEvent(new CustomEvent<InboxActionThreadDetail>(OPENWA_SCHEDULE_FOLLOWUP_EVENT, { detail: thread }));
}

export function dispatchRefreshStitchSuggestions(thread: InboxActionThreadDetail): void {
  window.dispatchEvent(
    new CustomEvent<InboxActionThreadDetail>(OPENWA_REFRESH_STITCH_SUGGESTIONS_EVENT, { detail: thread }),
  );
}
