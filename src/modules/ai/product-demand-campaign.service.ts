import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ProductDemandCampaign,
  ProductDemandCampaignRecipient,
} from './entities/product-demand-campaign.entity';
import { ProductDemandEvent } from './entities/product-demand-event.entity';
import { ProductDemandSummary } from './entities/product-demand-summary.entity';
import { ProductDemandRecommendation } from './entities/product-demand-recommendation.entity';
import {
  ProductDemandCampaignChannel,
  ProductDemandCampaignStatus,
  ProductDemandRecommendationStatus,
} from './product-demand.enums';
import { SmsService } from '../sms/sms.service';
import { InboxSendPipelineService } from '../message/inbox-send-pipeline.service';
import { ApiKey } from '../auth/entities/api-key.entity';
import { WhatsAppCampaignPreflightService } from '../whatsapp-safety/services/whatsapp-campaign-preflight.service';

function phoneFromChatId(chatId: string): string | null {
  const local = chatId.split('@')[0]?.trim();
  if (!local || !/^\d+$/.test(local)) return null;
  return local.startsWith('+') ? local : `+${local}`;
}

@Injectable()
export class ProductDemandCampaignService {
  constructor(
    @InjectRepository(ProductDemandCampaign, 'data')
    private readonly campaignRepo: Repository<ProductDemandCampaign>,
    @InjectRepository(ProductDemandEvent, 'data')
    private readonly eventRepo: Repository<ProductDemandEvent>,
    @InjectRepository(ProductDemandSummary, 'data')
    private readonly summaryRepo: Repository<ProductDemandSummary>,
    @InjectRepository(ProductDemandRecommendation, 'data')
    private readonly recRepo: Repository<ProductDemandRecommendation>,
    private readonly smsService: SmsService,
    @Inject(forwardRef(() => InboxSendPipelineService))
    private readonly sendPipeline: InboxSendPipelineService,
    private readonly campaignPreflight: WhatsAppCampaignPreflightService,
  ) {}

  listCampaigns(): Promise<ProductDemandCampaign[]> {
    return this.campaignRepo.find({
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async getCampaignMetrics(): Promise<{
    draft: number;
    approved: number;
    sent: number;
    cancelled: number;
    total: number;
    sms: number;
    whatsapp: number;
    totalRecipients: number;
  }> {
    const rows = await this.campaignRepo.find({ take: 200 });
    return {
      draft: rows.filter(r => r.status === ProductDemandCampaignStatus.DRAFT).length,
      approved: rows.filter(r => r.status === ProductDemandCampaignStatus.APPROVED).length,
      sent: rows.filter(r => r.status === ProductDemandCampaignStatus.SENT).length,
      cancelled: rows.filter(r => r.status === ProductDemandCampaignStatus.CANCELLED).length,
      total: rows.length,
      sms: rows.filter(r => r.channel === ProductDemandCampaignChannel.SMS).length,
      whatsapp: rows.filter(r => r.channel === ProductDemandCampaignChannel.WHATSAPP).length,
      totalRecipients: rows.reduce((sum, r) => sum + (r.recipientCount ?? 0), 0),
    };
  }

  async getCampaign(id: string): Promise<ProductDemandCampaign> {
    const row = await this.campaignRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Campaign not found');
    return row;
  }

  async updateCampaign(
    id: string,
    patch: {
      title?: string;
      message?: string;
      channel?: ProductDemandCampaignChannel | string;
      sessionId?: string | null;
    },
  ): Promise<ProductDemandCampaign> {
    const row = await this.getCampaign(id);
    if (row.status === ProductDemandCampaignStatus.SENT) {
      throw new BadRequestException('Campaign already sent');
    }
    if (patch.title !== undefined) row.title = patch.title;
    if (patch.message !== undefined) row.message = patch.message;
    if (patch.channel !== undefined) row.channel = patch.channel;
    if (patch.sessionId !== undefined) row.sessionId = patch.sessionId;
    return this.campaignRepo.save(row);
  }

  async resolveRecipients(input: {
    summaryId?: string | null;
    productIds?: string[] | null;
    productNames?: string[] | null;
  }): Promise<ProductDemandCampaignRecipient[]> {
    const events: ProductDemandEvent[] = [];

    if (input.summaryId) {
      const summary = await this.summaryRepo.findOne({ where: { id: input.summaryId } });
      if (summary?.productId) {
        events.push(
          ...(await this.eventRepo.find({
            where: { matchedProductId: summary.productId },
            order: { createdAt: 'DESC' },
            take: 100,
          })),
        );
      } else if (summary?.detectedProductName) {
        events.push(
          ...(await this.eventRepo
            .createQueryBuilder('e')
            .where('LOWER(e.detectedProductName) = :name', {
              name: summary.detectedProductName.trim().toLowerCase(),
            })
            .orderBy('e.createdAt', 'DESC')
            .take(100)
            .getMany()),
        );
      }
    }

    if (!events.length && input.productNames?.length) {
      const name = input.productNames[0].trim().toLowerCase();
      events.push(
        ...(await this.eventRepo
          .createQueryBuilder('e')
          .where('LOWER(e.detectedProductName) = :name', { name })
          .orderBy('e.createdAt', 'DESC')
          .take(100)
          .getMany()),
      );
    }

    const seen = new Set<string>();
    const recipients: ProductDemandCampaignRecipient[] = [];

    for (const event of events) {
      const key = event.chatId
        ? `${event.sessionId ?? ''}:${event.chatId}`
        : event.customerId ?? event.id;
      if (seen.has(key)) continue;
      seen.add(key);

      recipients.push({
        phone: event.chatId ? phoneFromChatId(event.chatId) : null,
        customerId: event.customerId,
        sessionId: event.sessionId,
        chatId: event.chatId,
      });
    }

    return recipients;
  }

  async createFromRecommendation(
    recommendationId: string,
    createdBy?: string | null,
  ): Promise<ProductDemandCampaign> {
    const rec = await this.recRepo.findOne({ where: { id: recommendationId } });
    if (!rec) throw new NotFoundException('Recommendation not found');

    const productLabel = rec.productNames?.join(', ') ?? rec.title;
    const message = `Habari! ${productLabel} — ${rec.reason}. Wasiliana nasi kwa bei na stock.`;
    const recipients = await this.resolveRecipients({
      summaryId: rec.summaryId,
      productIds: rec.productIds,
      productNames: rec.productNames,
    });

    const sessionId =
      recipients.find(r => r.sessionId)?.sessionId ?? null;

    return this.campaignRepo.save(
      this.campaignRepo.create({
        title: rec.title,
        message,
        channel: ProductDemandCampaignChannel.SMS,
        status: ProductDemandCampaignStatus.DRAFT,
        productNames: rec.productNames,
        productIds: rec.productIds,
        recommendationId: rec.id,
        summaryId: rec.summaryId,
        branchId: rec.branchId,
        sessionId,
        recipients,
        recipientCount: recipients.length,
        createdBy: createdBy ?? null,
      }),
    );
  }

  async safetyPreflight(
    id: string,
    options?: { sessionId?: string; templateId?: string },
  ) {
    const row = await this.getCampaign(id);
    const sid =
      options?.sessionId ?? row.sessionId ?? row.recipients?.find(r => r.sessionId)?.sessionId;
    if (!sid) throw new BadRequestException('WhatsApp sessionId required');
    const preflightRecipients = (row.recipients ?? [])
      .filter(r => r.chatId)
      .map(r => ({
        phone: r.phone ?? phoneFromChatId(r.chatId!) ?? r.chatId!.replace(/@.*$/, ''),
        chatId: r.chatId!,
      }));
    return this.campaignPreflight.preflight({
      sessionId: sid,
      recipients: preflightRecipients,
      messageBody: row.message,
      templateId: options?.templateId,
    });
  }

  async approveLaunch(id: string, apiKey: ApiKey): Promise<ProductDemandCampaign> {
    const row = await this.getCampaign(id);
    const preflight = await this.safetyPreflight(id, { sessionId: row.sessionId ?? undefined });
    if (!preflight.launchAllowed) {
      throw new BadRequestException(
        `Cannot approve launch: ${preflight.requiredFixes.join('; ')}`,
      );
    }
    row.status = ProductDemandCampaignStatus.APPROVED;
    row.createdBy = apiKey.id;
    return this.campaignRepo.save(row);
  }

  async sendCampaign(
    id: string,
    apiKey: ApiKey,
    options?: {
      channel?: ProductDemandCampaignChannel | string;
      sessionId?: string;
      templateId?: string;
    },
  ): Promise<ProductDemandCampaign> {
    const row = await this.getCampaign(id);
    if (row.status === ProductDemandCampaignStatus.SENT) {
      throw new BadRequestException('Campaign already sent');
    }

    const channel = (options?.channel ?? row.channel) as ProductDemandCampaignChannel;
    const recipients = row.recipients ?? [];
    if (!recipients.length) {
      throw new BadRequestException('No recipients on this campaign');
    }

    if (channel === ProductDemandCampaignChannel.SMS) {
      const smsRecipients = recipients
        .map(r => {
          const phone = r.phone?.trim();
          if (!phone) return null;
          return {
            phone,
            customerId: r.customerId ?? undefined,
            customerName: r.customerName ?? undefined,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);
      if (!smsRecipients.length) {
        throw new BadRequestException('No phone numbers available for SMS campaign');
      }
      await this.smsService.bulkSend(
        { message: row.message, recipients: smsRecipients },
        apiKey,
      );
      row.sentCount = smsRecipients.length;
    } else {
      if (row.status !== ProductDemandCampaignStatus.APPROVED) {
        throw new BadRequestException(
          'WhatsApp campaign must be approved before send. Run approve-launch after preflight passes.',
        );
      }

      const sessionId =
        options?.sessionId ?? row.sessionId ?? recipients.find(r => r.sessionId)?.sessionId;
      if (!sessionId) {
        throw new BadRequestException('WhatsApp sessionId required');
      }

      const preflightRecipients = recipients
        .filter(r => r.chatId)
        .map(r => ({
          phone: r.phone ?? phoneFromChatId(r.chatId!) ?? r.chatId!.replace(/@.*$/, ''),
          chatId: r.chatId!,
        }));

      const preflight = await this.campaignPreflight.preflight({
        sessionId,
        recipients: preflightRecipients,
        messageBody: row.message,
        templateId: options?.templateId,
      });

      if (!preflight.launchAllowed) {
        throw new BadRequestException(
          `Campaign blocked by safety preflight: ${preflight.requiredFixes.join('; ')}`,
        );
      }

      let sent = 0;
      for (const recipient of recipients) {
        const chatId = recipient.chatId;
        const sid = recipient.sessionId ?? sessionId;
        if (!chatId) continue;
        const pre = preflight.recipients.find(r => r.chatId === chatId);
        if (pre?.skipped) continue;
        try {
          const result = await this.sendPipeline.send({
            apiKey,
            sessionId: sid,
            chatId,
            kind: 'text',
            text: row.message,
            source: 'campaign',
            automated: true,
          });
          if (result && typeof result === 'object' && 'messageId' in result) sent += 1;
        } catch {
          // Guard may queue or block individual recipients
        }
      }
      if (sent === 0) {
        throw new BadRequestException('No WhatsApp messages were sent');
      }
      row.sentCount = sent;
      row.sessionId = sessionId;
    }

    row.channel = channel;
    row.status = ProductDemandCampaignStatus.SENT;
    row.sentAt = new Date();
    return this.campaignRepo.save(row);
  }

  async markRecommendationAccepted(recommendationId: string): Promise<void> {
    const rec = await this.recRepo.findOne({ where: { id: recommendationId } });
    if (!rec) return;
    rec.status = ProductDemandRecommendationStatus.ACCEPTED;
    await this.recRepo.save(rec);
  }
}
