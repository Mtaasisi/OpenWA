import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SessionService } from '../session/session.service';
import { WhatsAppOutboundService } from '../whatsapp-safety/services/whatsapp-outbound.service';
import { WhatsAppSendAuditService } from '../whatsapp-safety/services/whatsapp-send-audit.service';
import { WhatsAppWarmupService } from '../whatsapp-safety/services/whatsapp-warmup.service';
import { WhatsAppConsentService } from '../whatsapp-safety/services/whatsapp-consent.service';
import {
  WhatsAppMessageType,
  WhatsAppSendAuditDecision,
  WhatsAppSendSource,
} from '../whatsapp-safety/enums/whatsapp-safety.enums';
import { isInboxChat } from '../../common/utils/inbox-chat.util';
import type {
  Catalog,
  Product,
  PaginatedProducts,
  MessageResult,
} from '../../engine/interfaces/whatsapp-engine.interface';

const NATIVE_CATALOG_UNSUPPORTED =
  'Native WhatsApp catalog messages are not supported on linked-device sessions. Use POST /products/:productId/send for formatted product messages with safety guard.';

@Injectable()
export class CatalogService {
  constructor(
    private readonly sessionService: SessionService,
    private readonly whatsappOutbound: WhatsAppOutboundService,
    private readonly auditService: WhatsAppSendAuditService,
    private readonly warmupService: WhatsAppWarmupService,
    private readonly consentService: WhatsAppConsentService,
  ) {}

  async getCatalog(sessionId: string): Promise<Catalog | null> {
    const engine = this.sessionService.getEngine(sessionId);
    if (!engine) {
      throw new NotFoundException(`Session ${sessionId} not found or not connected`);
    }
    return engine.getCatalog();
  }

  async getProducts(sessionId: string, page = 1, limit = 20): Promise<PaginatedProducts> {
    const engine = this.sessionService.getEngine(sessionId);
    if (!engine) {
      throw new NotFoundException(`Session ${sessionId} not found or not connected`);
    }
    return engine.getProducts({ page, limit });
  }

  async getProduct(sessionId: string, productId: string): Promise<Product | null> {
    const engine = this.sessionService.getEngine(sessionId);
    if (!engine) {
      throw new NotFoundException(`Session ${sessionId} not found or not connected`);
    }
    return engine.getProduct(productId);
  }

  async sendProduct(
    sessionId: string,
    chatId: string,
    productId: string,
    body?: string,
    actorStaffId?: string,
  ): Promise<MessageResult> {
    const engine = this.sessionService.getEngine(sessionId);
    if (!engine) {
      throw new NotFoundException(`Session ${sessionId} not found or not connected`);
    }

    const auditBody = body?.trim() || `[catalog product ${productId}]`;
    await this.assertCatalogSendAllowed(sessionId, chatId, auditBody, actorStaffId);

    try {
      const result = await engine.sendProduct(chatId, productId, body);
      void this.recordCatalogSent(sessionId, chatId, auditBody);
      return result;
    } catch (err) {
      if (err instanceof Error && /not yet implemented|not implemented/i.test(err.message)) {
        throw new BadRequestException(NATIVE_CATALOG_UNSUPPORTED);
      }
      throw err;
    }
  }

  async sendCatalog(
    sessionId: string,
    chatId: string,
    body?: string,
    actorStaffId?: string,
  ): Promise<MessageResult> {
    const engine = this.sessionService.getEngine(sessionId);
    if (!engine) {
      throw new NotFoundException(`Session ${sessionId} not found or not connected`);
    }

    const auditBody = body?.trim() || '[catalog link]';
    await this.assertCatalogSendAllowed(sessionId, chatId, auditBody, actorStaffId);

    try {
      const result = await engine.sendCatalog(chatId, body);
      void this.recordCatalogSent(sessionId, chatId, auditBody);
      return result;
    } catch (err) {
      if (err instanceof Error && /not yet implemented|not implemented/i.test(err.message)) {
        throw new BadRequestException(NATIVE_CATALOG_UNSUPPORTED);
      }
      throw err;
    }
  }

  private async assertCatalogSendAllowed(
    sessionId: string,
    chatId: string,
    body: string,
    actorStaffId?: string,
  ): Promise<void> {
    if (!isInboxChat(chatId)) {
      throw new BadRequestException(
        'Cannot send to this chat type. Use a personal or group chat, not status/broadcast.',
      );
    }

    const guardCheck = await this.whatsappOutbound.checkBeforeSend({
      sessionId,
      chatId,
      body,
      options: {
        source: WhatsAppSendSource.PRODUCT_SEND,
        messageType: WhatsAppMessageType.PRODUCT_SEND,
        isManualStaffSend: Boolean(actorStaffId),
        actorStaffId,
      },
    });
    this.whatsappOutbound.assertCanSend(guardCheck);
  }

  private recordCatalogSent(sessionId: string, chatId: string, body: string): void {
    const phone = chatId.replace(/@.*$/, '');
    void this.warmupService.recordOutbound(sessionId, WhatsAppMessageType.PRODUCT_SEND);
    void this.consentService.recordOutbound(sessionId, phone);
    void this.auditService.log({
      sessionId,
      chatId,
      phone,
      source: WhatsAppSendSource.PRODUCT_SEND,
      messageType: WhatsAppMessageType.PRODUCT_SEND,
      decision: WhatsAppSendAuditDecision.SENT,
      reason: 'Native catalog message sent',
      body,
    });
  }
}
