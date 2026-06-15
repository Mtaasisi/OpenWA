import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InboxThreadEvent } from './entities/inbox-thread-event.entity';

export interface RecordThreadEventInput {
  sessionId: string;
  chatId: string;
  eventType: string;
  actorType?: string;
  actorId?: string | null;
  actorName?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class InboxThreadEventService {
  constructor(
    @InjectRepository(InboxThreadEvent, 'data')
    private readonly repo: Repository<InboxThreadEvent>,
  ) {}

  async record(input: RecordThreadEventInput): Promise<InboxThreadEvent> {
    const row = this.repo.create({
      sessionId: input.sessionId,
      chatId: input.chatId,
      eventType: input.eventType,
      actorType: input.actorType ?? 'system',
      actorId: input.actorId ?? null,
      actorName: input.actorName ?? null,
      summary: input.summary ?? null,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
    });
    return this.repo.save(row);
  }

  async listForThread(
    sessionId: string,
    chatId: string,
    limit = 50,
  ): Promise<InboxThreadEvent[]> {
    return this.repo.find({
      where: { sessionId, chatId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
