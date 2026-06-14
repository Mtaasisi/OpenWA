import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiProcessedInboundMessage } from '../entities/ai-processed-inbound-message.entity';
import { AiUsageFeature } from './ai-cost.types';

@Injectable()
export class AiProcessedMessageService {
  constructor(
    @InjectRepository(AiProcessedInboundMessage, 'data')
    private readonly repo: Repository<AiProcessedInboundMessage>,
  ) {}

  async wasProcessed(
    sessionId: string,
    messageId: string,
    feature: AiUsageFeature | string,
  ): Promise<boolean> {
    const existing = await this.repo.findOne({
      where: { sessionId, messageId, feature },
    });
    return !!existing;
  }

  async markProcessed(
    sessionId: string,
    messageId: string,
    feature: AiUsageFeature | string,
    requestId?: string,
  ): Promise<boolean> {
    try {
      await this.repo.save(
        this.repo.create({
          sessionId,
          messageId,
          feature,
          requestId: requestId ?? null,
        }),
      );
      return true;
    } catch {
      // Unique constraint — already processed
      return false;
    }
  }
}
