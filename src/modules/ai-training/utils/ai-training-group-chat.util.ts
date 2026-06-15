import { AiTrainingSourceType } from '../ai-training.types';

export enum TrainingGroupChatsMode {
  SKIP = 'skip',
  SEPARATE = 'separate',
  INCLUDE = 'include',
}

export function isGroupChat(chatId: string | null | undefined): boolean {
  if (!chatId) return false;
  return chatId.toLowerCase().endsWith('@g.us');
}

export type GroupChatTrainingPolicy = 'skip' | 'include' | 'separate';

export function resolveGroupChatTrainingPolicy(
  chatId: string | null | undefined,
  mode: TrainingGroupChatsMode | string | null | undefined,
): GroupChatTrainingPolicy {
  if (!isGroupChat(chatId)) return 'include';
  const resolved = mode ?? TrainingGroupChatsMode.SKIP;
  if (resolved === TrainingGroupChatsMode.INCLUDE) return 'include';
  if (resolved === TrainingGroupChatsMode.SEPARATE) return 'separate';
  return 'skip';
}

export function applyGroupChatTrainingPolicy<
  T extends {
    chatId?: string | null;
    sourceType: AiTrainingSourceType;
    metadata?: Record<string, unknown> | null;
  },
>(input: T, mode: TrainingGroupChatsMode | string | null | undefined): T | null {
  const policy = resolveGroupChatTrainingPolicy(input.chatId, mode);
  if (policy === 'skip') return null;
  if (policy === 'separate') {
    return {
      ...input,
      sourceType: AiTrainingSourceType.GROUP_CONVERSATION,
      metadata: { ...(input.metadata ?? {}), isGroupChat: true },
    };
  }
  return input;
}
