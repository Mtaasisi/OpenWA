import {
  TrainingGroupChatsMode,
  applyGroupChatTrainingPolicy,
  isGroupChat,
  resolveGroupChatTrainingPolicy,
} from './ai-training-group-chat.util';
import { AiTrainingSourceType } from '../ai-training.types';

describe('ai-training-group-chat.util', () => {
  const directChat = '255700000001@c.us';
  const groupChat = '120363123456789012@g.us';

  it('detects WhatsApp group chat ids', () => {
    expect(isGroupChat(groupChat)).toBe(true);
    expect(isGroupChat(directChat)).toBe(false);
    expect(isGroupChat(null)).toBe(false);
  });

  it('skips group chats by default', () => {
    expect(resolveGroupChatTrainingPolicy(groupChat, undefined)).toBe('skip');
    expect(resolveGroupChatTrainingPolicy(groupChat, TrainingGroupChatsMode.SKIP)).toBe('skip');
  });

  it('allows direct chats regardless of mode', () => {
    expect(resolveGroupChatTrainingPolicy(directChat, TrainingGroupChatsMode.SKIP)).toBe('include');
  });

  it('tags separate group items with group source type', () => {
    const result = applyGroupChatTrainingPolicy(
      {
        chatId: groupChat,
        sourceType: AiTrainingSourceType.INBOX_MESSAGE,
      },
      TrainingGroupChatsMode.SEPARATE,
    );
    expect(result?.sourceType).toBe(AiTrainingSourceType.GROUP_CONVERSATION);
    expect(result?.metadata).toEqual({ isGroupChat: true });
  });

  it('returns null when group chats are skipped', () => {
    expect(
      applyGroupChatTrainingPolicy(
        { chatId: groupChat, sourceType: AiTrainingSourceType.INBOX_MESSAGE },
        TrainingGroupChatsMode.SKIP,
      ),
    ).toBeNull();
  });
});
