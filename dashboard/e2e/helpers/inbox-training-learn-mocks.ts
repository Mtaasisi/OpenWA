import type { Page } from '@playwright/test';
import {
  AI_TAKEOVER_CHAT_ELIGIBLE,
  AI_TAKEOVER_SESSION_ID,
  buildEligibleConversation,
  installInboxAiTakeoverMocks,
  seedInteraktTheme,
} from './inbox-ai-takeover-mocks';

export {
  AI_TAKEOVER_CHAT_ELIGIBLE,
  AI_TAKEOVER_SESSION_ID,
  seedInteraktTheme,
};

export function buildWaitingHumanConversation() {
  return {
    ...buildEligibleConversation(),
    aiHandlingState: 'waiting_human',
    aiAutoReplyPaused: false,
  };
}

export function buildTrainingLearnMessages() {
  return [
    {
      id: 'msg-in-train-1',
      sessionId: AI_TAKEOVER_SESSION_ID,
      chatId: AI_TAKEOVER_CHAT_ELIGIBLE,
      from: AI_TAKEOVER_CHAT_ELIGIBLE,
      to: '255700000001',
      body: 'Mko wapi?',
      type: 'chat',
      direction: 'incoming',
      waMessageId: 'wa-train-in-1',
      timestamp: Date.now() - 120_000,
      createdAt: new Date().toISOString(),
    },
  ];
}

export async function installInboxTrainingLearnMocks(page: Page): Promise<void> {
  await installInboxAiTakeoverMocks(page, {
    crm: {
      chatId: AI_TAKEOVER_CHAT_ELIGIBLE,
      aiHandlingState: 'waiting_human',
      aiAutoReplyPaused: false,
    },
    conversations: [buildWaitingHumanConversation()],
    messages: buildTrainingLearnMessages(),
  });
}
