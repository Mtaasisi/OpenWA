export function isGroupChatId(chatId?: string | null): boolean {
  return Boolean(chatId?.toLowerCase().endsWith('@g.us'));
}

export function isTrainingGroupItem(item: {
  chatId?: string | null;
  sourceType?: string | null;
  metadata?: Record<string, unknown> | null;
}): boolean {
  if (item.sourceType === 'group_conversation') return true;
  if (item.metadata?.isGroupChat === true) return true;
  return isGroupChatId(item.chatId);
}

export type TrainingChatKindFilter = 'all' | 'direct' | 'group';

export function filterTrainingItemsByChatKind<T extends { chatId?: string | null; sourceType?: string | null; metadata?: Record<string, unknown> | null }>(
  items: T[],
  filter: TrainingChatKindFilter,
): T[] {
  if (filter === 'all') return items;
  if (filter === 'group') return items.filter(isTrainingGroupItem);
  return items.filter(item => !isTrainingGroupItem(item));
}
