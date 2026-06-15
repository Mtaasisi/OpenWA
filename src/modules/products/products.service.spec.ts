import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ConversationStage } from '../followup/followup.enums';
import { AuditAction } from '../audit/entities/audit-log.entity';
import type { Product } from './entities/product.entity';
import type { ProductVariant } from './entities/product-variant.entity';

const SESSION_ID = 'sess-11111111-1111-1111-1111-111111111111';
const CHAT_ID = '255700000000@c.us';
const PRODUCT_ID = 'prod-11111111-1111-1111-1111-111111111111';
const VARIANT_ID = 'var-11111111-1111-1111-1111-111111111111';

function mockVariant(overrides: Partial<ProductVariant> = {}): ProductVariant {
  return {
    id: VARIANT_ID,
    productId: PRODUCT_ID,
    name: '128GB',
    sku: null,
    sellingPrice: 500,
    quantity: 5,
    variantType: 'standard',
    isParent: false,
    parentVariantId: null,
    attributes: null,
    isActive: true,
    sortOrder: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as ProductVariant;
}

function mockProduct(overrides: Partial<Product> & { variants?: ProductVariant[] } = {}): Product {
  const { variants = [], ...rest } = overrides;
  return {
    id: PRODUCT_ID,
    name: 'iPhone 15',
    description: 'Latest model',
    sku: 'IP15',
    category: 'Phones',
    imageUrl: null,
    imageUrls: null,
    currency: 'TZS',
    sellingPrice: 500,
    isActive: true,
    sortOrder: 0,
    variants,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...rest,
  } as Product;
}

function createService(overrides?: {
  product?: Product;
  messageService?: Record<string, jest.Mock>;
  inauzwaSyncService?: Record<string, jest.Mock>;
  inauzwaPreferences?: Record<string, jest.Mock>;
}) {
  const productRepo = {
    findOne: jest.fn().mockResolvedValue(overrides?.product ?? mockProduct()),
  };
  const variantRepo = { findOne: jest.fn() };
  const messageService = {
    assertInboxSendAllowed: jest.fn().mockResolvedValue(undefined),
    sendText: jest.fn().mockResolvedValue({ messageId: 'msg-text', timestamp: 1 }),
    sendImage: jest.fn().mockResolvedValue({ messageId: 'msg-img', timestamp: 2 }),
    sendImageAlbum: jest.fn().mockResolvedValue({ messageId: 'msg-album', timestamp: 3 }),
    ...overrides?.messageService,
  };
  const inauzwaSyncService = {
    isConfigured: jest.fn().mockResolvedValue(false),
    canQuickSync: jest.fn().mockResolvedValue(false),
    quickSync: jest.fn(),
    ...overrides?.inauzwaSyncService,
  };
  const inauzwaPreferences = {
    shouldRefreshBeforeSend: jest.fn().mockResolvedValue(false),
    ...overrides?.inauzwaPreferences,
  };
  const followupHookService = { handleStageChange: jest.fn().mockResolvedValue(undefined) };
  const followupConversationService = {
    recordStaffMessage: jest.fn().mockResolvedValue(undefined),
    getOrCreate: jest.fn().mockResolvedValue({ id: 'conv-1' }),
    update: jest.fn().mockResolvedValue(undefined),
  };
  const auditService = { logInfo: jest.fn().mockResolvedValue({}) };

  const service = new ProductsService(
    productRepo as never,
    variantRepo as never,
    messageService as never,
    inauzwaSyncService as never,
    inauzwaPreferences as never,
    followupHookService as never,
    followupConversationService as never,
    auditService as never,
    undefined,
  );

  return {
    service,
    productRepo,
    messageService,
    followupConversationService,
    followupHookService,
    auditService,
  };
}

const apiKey = { id: 'staff-1', allowedSessions: null } as never;
const baseDto = {
  sessionId: SESSION_ID,
  chatId: CHAT_ID,
  inStockOnly: true,
  includeImage: false,
  includeAllVariants: true,
  refreshStock: false,
};

describe('ProductsService.sendToChat', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sends text only and records audit + follow-up product interest', async () => {
    const product = mockProduct({ sellingPrice: 500, variants: [mockVariant({ quantity: 5 })] });
    const { service, messageService, auditService, followupConversationService } = createService({
      product,
    });

    const result = await service.sendToChat(PRODUCT_ID, baseDto, apiKey);

    expect(messageService.assertInboxSendAllowed).toHaveBeenCalledWith(apiKey, SESSION_ID, CHAT_ID);
    expect(messageService.sendText).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({ chatId: CHAT_ID, text: expect.stringContaining('iPhone 15') }),
      { actorStaffId: 'staff-1' },
    );
    expect(messageService.sendImage).not.toHaveBeenCalled();
    expect(result).toEqual({ messageId: 'msg-text', timestamp: 1 });
    expect(auditService.logInfo).toHaveBeenCalledWith(
      AuditAction.MESSAGE_SENT,
      expect.objectContaining({
        apiKey,
        sessionId: SESSION_ID,
        metadata: expect.objectContaining({
          source: 'product-send',
          productId: PRODUCT_ID,
          variantId: null,
          includeImage: false,
          chatId: CHAT_ID,
          messageId: 'msg-text',
        }),
      }),
    );
    expect(followupConversationService.update).toHaveBeenCalledWith(
      'conv-1',
      expect.objectContaining({
        productInterest: 'iPhone 15',
        productId: PRODUCT_ID,
        stage: ConversationStage.PRICE_SENT,
      }),
    );
  });

  it('sends with a single product image', async () => {
    const product = mockProduct({
      imageUrl: 'https://cdn.example.com/phone.jpg',
      variants: [],
    });
    const { service, messageService } = createService({ product });

    await service.sendToChat(PRODUCT_ID, { ...baseDto, includeImage: true }, apiKey);

    expect(messageService.sendImage).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({
        chatId: CHAT_ID,
        url: 'https://cdn.example.com/phone.jpg',
        caption: expect.stringContaining('iPhone 15'),
      }),
    );
    expect(messageService.sendText).not.toHaveBeenCalled();
  });

  it('sends with multiple product images as an album', async () => {
    const product = mockProduct({
      imageUrls: ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg'],
      variants: [],
    });
    const { service, messageService } = createService({ product });

    await service.sendToChat(PRODUCT_ID, { ...baseDto, includeImage: true }, apiKey);

    expect(messageService.sendImageAlbum).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({
        chatId: CHAT_ID,
        urls: ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg'],
      }),
    );
    expect(messageService.sendImage).not.toHaveBeenCalled();
  });

  it('sends a specific variant when variantId is provided', async () => {
    const variant = mockVariant({ name: '256GB', quantity: 3 });
    const product = mockProduct({ variants: [variant] });
    const { service, messageService } = createService({ product });

    await service.sendToChat(
      PRODUCT_ID,
      { ...baseDto, variantId: VARIANT_ID, includeAllVariants: false },
      apiKey,
    );

    expect(messageService.sendText).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({ text: expect.stringContaining('256GB') }),
      { actorStaffId: 'staff-1' },
    );
  });

  it('throws when in-stock-only filter leaves nothing to send for selected variant', async () => {
    const product = mockProduct({
      variants: [mockVariant({ quantity: 0 })],
    });
    const { service, messageService } = createService({ product });

    await expect(
      service.sendToChat(
        PRODUCT_ID,
        { ...baseDto, variantId: VARIANT_ID, includeAllVariants: false },
        apiKey,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(messageService.sendText).not.toHaveBeenCalled();
  });

  it('blocks send when session is disconnected', async () => {
    const { service, messageService } = createService({
      messageService: {
        assertInboxSendAllowed: jest.fn().mockRejectedValue(
          new BadRequestException(
            `Session '${SESSION_ID}' is not connected (status: disconnected). Start or reconnect the WhatsApp session first.`,
          ),
        ),
      },
    });

    await expect(service.sendToChat(PRODUCT_ID, baseDto, apiKey)).rejects.toThrow(
      BadRequestException,
    );
    expect(messageService.sendText).not.toHaveBeenCalled();
  });

  it('blocks send when API key is unauthorized for the session', async () => {
    const { service, messageService } = createService({
      messageService: {
        assertInboxSendAllowed: jest.fn().mockRejectedValue(
          new ForbiddenException('API key not authorized for this WhatsApp session'),
        ),
      },
    });

    await expect(service.sendToChat(PRODUCT_ID, baseDto, apiKey)).rejects.toThrow(
      ForbiddenException,
    );
    expect(messageService.sendText).not.toHaveBeenCalled();
  });

  it('updates follow-up conversation stage and product interest after send', async () => {
    const product = mockProduct({
      variants: [mockVariant({ quantity: 0 })],
      sellingPrice: 400,
    });
    const { service, followupConversationService, followupHookService } = createService({
      product,
    });

    await service.sendToChat(PRODUCT_ID, { ...baseDto, inStockOnly: false }, apiKey);

    expect(followupConversationService.getOrCreate).toHaveBeenCalledWith(SESSION_ID, CHAT_ID);
    expect(followupConversationService.update).toHaveBeenCalledWith(
      'conv-1',
      expect.objectContaining({
        productInterest: 'iPhone 15',
        productId: PRODUCT_ID,
        stage: ConversationStage.PRODUCT_SUGGESTED,
      }),
    );
    expect(followupHookService.handleStageChange).toHaveBeenCalledWith(
      SESSION_ID,
      CHAT_ID,
      ConversationStage.PRODUCT_SUGGESTED,
    );
  });

  it('continues send when INAUZWA quick sync fails', async () => {
    const product = mockProduct({ variants: [mockVariant({ quantity: 2 })] });
    const { service, messageService } = createService({
      product,
      inauzwaPreferences: { shouldRefreshBeforeSend: jest.fn().mockResolvedValue(true) },
      inauzwaSyncService: {
        canQuickSync: jest.fn().mockResolvedValue(true),
        quickSync: jest.fn().mockRejectedValue(
          new BadRequestException(
            'vendorId is required for database/Supabase sync. Log in to INAUZWA or set INAUZWA_VENDOR_ID.',
          ),
        ),
      },
    });

    const result = await service.sendToChat(PRODUCT_ID, { ...baseDto, refreshStock: true }, apiKey);

    expect(messageService.sendText).toHaveBeenCalled();
    expect(result).toEqual({ messageId: 'msg-text', timestamp: 1 });
  });

  it('sends text when includeImage is true but product has no image', async () => {
    const product = mockProduct({ imageUrl: null, variants: [] });
    const { service, messageService } = createService({ product });

    const result = await service.sendToChat(PRODUCT_ID, { ...baseDto, includeImage: true }, apiKey);

    expect(messageService.sendImage).not.toHaveBeenCalled();
    expect(messageService.sendText).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({ chatId: CHAT_ID, text: expect.stringContaining('iPhone 15') }),
      { actorStaffId: 'staff-1' },
    );
    expect(result).toEqual({ messageId: 'msg-text', timestamp: 1 });
  });

  it('falls back to text when product image send fails', async () => {
    const product = mockProduct({
      imageUrl: 'https://cdn.example.com/phone.jpg',
      variants: [],
    });
    const { service, messageService } = createService({
      product,
      messageService: {
        sendImage: jest.fn().mockRejectedValue(new Error('MessageMedia.fromUrl failed')),
      },
    });

    const result = await service.sendToChat(PRODUCT_ID, { ...baseDto, includeImage: true }, apiKey);

    expect(messageService.sendImage).toHaveBeenCalled();
    expect(messageService.sendText).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({ chatId: CHAT_ID, text: expect.stringContaining('iPhone 15') }),
      { actorStaffId: 'staff-1' },
    );
    expect(result).toEqual({ messageId: 'msg-text', timestamp: 1 });
  });
});
