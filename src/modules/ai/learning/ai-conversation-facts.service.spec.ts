import { AiConversationFactsService } from './ai-conversation-facts.service';

describe('AiConversationFactsService', () => {
  it('builds a summary block from stored facts', async () => {
    const facts = [
      {
        factType: 'budget',
        factKey: 'amount',
        factValue: '1500000',
        updatedAt: new Date(),
      },
      {
        factType: 'product_interest',
        factKey: 'type',
        factValue: 'laptop',
        updatedAt: new Date(),
      },
    ];
    const repo = {
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(facts),
      })),
    };

    const service = new AiConversationFactsService(repo as never);
    const block = await service.buildFactsSummaryBlock('sess:chat');
    expect(block).toContain('budget/amount: 1500000');
    expect(block).toContain('product_interest/type: laptop');
  });
});
