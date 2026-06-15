import type { Conversation } from '../services/api';
import { isGroupChat } from '../pages/inbox-helpers';

/** True when AI auto-reply can still run on this direct chat (not paused / human / opt-out). */
export function isAiAutoReplyEligible(conv: Conversation | null | undefined): boolean {
  if (!conv || isGroupChat(conv.chatId)) return false;
  if (conv.aiOptOut) return false;
  if (conv.aiAutoReplyPaused) return false;
  const state = conv.aiHandlingState ?? 'idle';
  return state !== 'waiting_human' && state !== 'human_handling';
}

/** Staff compose sends pause AI — confirm before sending when AI is still active. */
export function shouldConfirmAiTakeoverBeforeStaffSend(conv: Conversation | null | undefined): boolean {
  return isAiAutoReplyEligible(conv);
}

export function countDirectAiEligible(conversations: Conversation[]): number {
  return conversations.filter(c => !c.resolved && isAiAutoReplyEligible(c)).length;
}

export function countDirectAiBlocked(conversations: Conversation[]): number {
  return conversations.filter(c => {
    if (c.resolved || isGroupChat(c.chatId)) return false;
    return !isAiAutoReplyEligible(c);
  }).length;
}

/** True when AI is temporarily paused because staff sent a manual reply. */
export function isManualTakeoverActive(crm: { autopilotPauseReason?: string | null; manualTakeoverUntil?: string | null } | null | undefined): boolean {
  if (!crm || crm.autopilotPauseReason !== 'manual_takeover') return false;
  if (!crm.manualTakeoverUntil) return true;
  return new Date(crm.manualTakeoverUntil).getTime() > Date.now();
}

export function manualTakeoverMinutesRemaining(crm: { manualTakeoverUntil?: string | null } | null | undefined): number {
  if (!crm?.manualTakeoverUntil) return 0;
  return Math.max(0, Math.ceil((new Date(crm.manualTakeoverUntil).getTime() - Date.now()) / 60_000));
}
