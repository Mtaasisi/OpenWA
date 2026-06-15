import { backfillSaleAttributions } from './sale-attribution-backfill.util';
import { ConversationSource } from '../followup.enums';
import { QuoteStatus } from '../../quote/quote.enums';

function mockRepo<T extends object>() {
  return {
    find: jest.fn(),
    create: jest.fn((row: T) => row),
    save: jest.fn(async (row: T) => row),
    createQueryBuilder: jest.fn(),
  };
}

describe('sale-attribution-backfill.util', () => {
  it('creates attributions for linked conversations without existing rows', async () => {
    const convRepo = mockRepo();
    const quoteRepo = mockRepo();
    const attrRepo = mockRepo();

    (attrRepo.find as jest.Mock).mockResolvedValue([]);
    (convRepo.createQueryBuilder as jest.Mock).mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 'conv-1',
          linkedSaleId: 'SALE-001',
          source: ConversationSource.WHATSAPP,
          customerId: 'cust-1',
          assignedStaffId: 'staff-1',
          branchId: 'branch-1',
        },
      ]),
    });
    (quoteRepo.createQueryBuilder as jest.Mock).mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    });

    const result = await backfillSaleAttributions(
      convRepo as never,
      quoteRepo as never,
      attrRepo as never,
    );

    expect(result).toEqual({ created: 1, skipped: 0, dryRun: false });
    expect(attrRepo.save).toHaveBeenCalledTimes(1);
    expect(attrRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        saleId: 'SALE-001',
        leadSource: ConversationSource.WHATSAPP,
        conversationId: 'conv-1',
      }),
    );
  });

  it('skips sales that already have attribution and supports dry-run', async () => {
    const convRepo = mockRepo();
    const quoteRepo = mockRepo();
    const attrRepo = mockRepo();

    (attrRepo.find as jest.Mock).mockResolvedValue([{ saleId: 'SALE-001' }]);
    (convRepo.createQueryBuilder as jest.Mock).mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 'conv-1',
          linkedSaleId: 'SALE-001',
          source: ConversationSource.INSTAGRAM,
        },
      ]),
    });
    (quoteRepo.createQueryBuilder as jest.Mock).mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 'quote-1',
          linkedSaleId: 'SALE-002',
          leadSource: ConversationSource.WEBSITE,
          status: QuoteStatus.CONVERTED_TO_SALE,
          totalAmount: 500,
        },
      ]),
    });

    const result = await backfillSaleAttributions(
      convRepo as never,
      quoteRepo as never,
      attrRepo as never,
      { dryRun: true },
    );

    expect(result).toEqual({ created: 1, skipped: 1, dryRun: true });
    expect(attrRepo.save).not.toHaveBeenCalled();
  });
});
