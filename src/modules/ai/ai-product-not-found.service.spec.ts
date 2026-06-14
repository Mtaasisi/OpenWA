import { AiProductNotFoundService } from './ai-product-not-found.service';

const SESSION_ID = 'sess-11111111-1111-1111-1111-111111111111';
const CHAT_ID = '255700000000@c.us';

function createService(options?: {
  searchResults?: Array<{ id: string; name: string; inStock: boolean }>;
}) {
  const productsService = {
    searchForAgent: jest.fn(async () => options?.searchResults ?? []),
  };

  const productDemand = {
    recordFromMessage: jest.fn(async () => null),
  };

  const aiSettings = {
    getActiveConfig: jest.fn(async () => ({ replyWhenProductNotFound: true })),
  };

  const catalogRequestRepo = {
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn(async () => null),
    })),
    create: jest.fn((row: unknown) => row),
    save: jest.fn(async (row: unknown) => row),
  };

  const service = new AiProductNotFoundService(
    productsService as never,
    productDemand as never,
    aiSettings as never,
    catalogRequestRepo as never,
  );

  return { service, productsService, productDemand };
}

describe('AiProductNotFoundService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does not fallback when search_products finds a local inventory match', async () => {
    const { service, productDemand } = createService({
      searchResults: [{ id: 'prod-1', name: 'iPhone 15', inStock: true }],
    });

    const result = await service.tryResolveNotFoundReply({
      sessionId: SESSION_ID,
      chatId: CHAT_ID,
      incomingText: 'Nahitaji iPhone 15',
    });

    expect(result).toBeNull();
    expect(productDemand.recordFromMessage).not.toHaveBeenCalled();
  });

  it('returns fallback when product is missing from local inventory', async () => {
    const { service, productsService } = createService({ searchResults: [] });

    const result = await service.tryResolveNotFoundReply({
      sessionId: SESSION_ID,
      chatId: CHAT_ID,
      incomingText: 'Nahitaji MacBook Pro M4',
    });

    expect(result?.productQuery).toBeTruthy();
    expect(result?.reply).toBeTruthy();
    expect(productsService.searchForAgent).toHaveBeenCalled();
  });
});
