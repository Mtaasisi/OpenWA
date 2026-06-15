import { AiLearnedIntentService } from './ai-learned-intent.service';
import { AiLearnedIntentStatus } from '../entities/ai-learned-intent.entity';

describe('AiLearnedIntentService', () => {
  const greetingRow = {
    id: 'li-1',
    phrase: 'mambo',
    normalizedPhrase: 'mambo',
    intent: 'greeting',
    suggestedReply: 'Mambo vipi Boss 😊',
    replyVariations: ['Poa sana 😊'],
    status: AiLearnedIntentStatus.ACTIVE,
    usageCount: 2,
    branchId: null,
  };

  function makeService(rows: typeof greetingRow[] = [greetingRow]) {
    const exactQb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(greetingRow),
    };
    const listQb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      clone: jest.fn().mockReturnValue(exactQb),
      getMany: jest.fn().mockResolvedValue(rows),
    };
    const repo = {
      createQueryBuilder: jest.fn().mockReturnValue(listQb),
      create: jest.fn(),
      save: jest.fn(),
    };
    const aiSettings = {
      getActiveConfig: jest.fn().mockResolvedValue({ learnedReplyCacheEnabled: true }),
    };
    return {
      service: new AiLearnedIntentService(repo as never, aiSettings as never),
      aiSettings,
    };
  }

  it('returns cache hit for exact normalized phrase', async () => {
    const { service } = makeService();
    const result = await service.tryReply({ text: 'Mambo', branchId: null, contactId: 'c1' });
    expect(result.hit).toBe(true);
    if (result.hit) {
      expect(result.matchType).toBe('exact');
      expect(result.reply).toContain('Mambo');
    }
  });

  it('skips when learned cache disabled in config', async () => {
    const { service, aiSettings } = makeService();
    aiSettings.getActiveConfig.mockResolvedValue({ learnedReplyCacheEnabled: false });
    const result = await service.tryReply({ text: 'mambo' });
    expect(result.hit).toBe(false);
  });

  it('merges duplicates into primary and disables them', async () => {
    const primary = { ...greetingRow, id: 'li-primary', usageCount: 5, suggestedReply: 'Hi' };
    const dupe1 = {
      ...greetingRow,
      id: 'li-dupe-1',
      phrase: 'habari',
      normalizedPhrase: 'habari',
      usageCount: 3,
      suggestedReply: 'Habari Boss',
      replyVariations: ['Karibu'],
    };
    const dupe2 = {
      ...greetingRow,
      id: 'li-dupe-2',
      phrase: 'vipi',
      normalizedPhrase: 'vipi',
      usageCount: 2,
      suggestedReply: 'Poa',
      replyVariations: null,
    };

    const repo = {
      findOne: jest.fn().mockResolvedValue(primary),
      find: jest.fn().mockResolvedValue([dupe1, dupe2]),
      save: jest.fn().mockImplementation(async (row: { id: string }) => row),
      createQueryBuilder: jest.fn(),
      create: jest.fn(),
    };
    const aiSettings = { getActiveConfig: jest.fn() };
    const service = new AiLearnedIntentService(repo as never, aiSettings as never);

    const result = await service.mergeIntents('li-primary', ['li-dupe-1', 'li-dupe-2']);
    expect(result.ok).toBe(true);
    expect(result.item?.usageCount).toBe(10);
    expect(result.item?.replyVariations).toEqual(
      expect.arrayContaining(['Habari Boss', 'Karibu', 'Poa']),
    );
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'li-dupe-1', status: AiLearnedIntentStatus.DISABLED }),
    );
  });
});
