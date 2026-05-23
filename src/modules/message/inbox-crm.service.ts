import { Injectable, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { InboxThreadCrm } from './entities/inbox-thread-crm.entity';
import { UpdateInboxThreadCrmDto, InboxThreadCrmDto } from './dto/inbox-thread-crm.dto';
import { isInboxChat } from '../../common/utils/inbox-chat.util';
import { SessionService } from '../session/session.service';

@Injectable()
export class InboxCrmService {
  constructor(
    @InjectRepository(InboxThreadCrm, 'data')
    private readonly crmRepository: Repository<InboxThreadCrm>,
    @Inject(forwardRef(() => SessionService))
    private readonly sessionService: SessionService,
  ) {}

  async getThreadCrm(sessionId: string, chatId: string): Promise<InboxThreadCrmDto> {
    await this.sessionService.findOne(sessionId);
    if (!isInboxChat(chatId)) {
      throw new BadRequestException('Invalid chat id');
    }
    const row = await this.crmRepository.findOne({ where: { sessionId, chatId } });
    return row ? this.toDto(row) : this.emptyDto(sessionId, chatId);
  }

  async upsertThreadCrm(
    sessionId: string,
    chatId: string,
    dto: UpdateInboxThreadCrmDto,
  ): Promise<InboxThreadCrmDto> {
    await this.sessionService.findOne(sessionId);
    if (!isInboxChat(chatId)) {
      throw new BadRequestException('Invalid chat id');
    }

    let row = await this.crmRepository.findOne({ where: { sessionId, chatId } });
    if (!row) {
      row = this.crmRepository.create({ sessionId, chatId, resolved: false });
    }

    if (dto.resolved !== undefined) {
      row.resolved = dto.resolved;
      row.resolvedAt = dto.resolved ? new Date() : null;
    }
    if (dto.internalNote !== undefined) {
      row.internalNote = dto.internalNote;
    }
    if (dto.followUpAt !== undefined) {
      row.followUpAt = dto.followUpAt ? new Date(dto.followUpAt) : null;
    }
    if (dto.customerName !== undefined) {
      row.customerName = dto.customerName;
    }
    if (dto.customerPhone !== undefined) {
      row.customerPhone = dto.customerPhone;
    }
    if (dto.linkedExternalId !== undefined) {
      row.linkedExternalId = dto.linkedExternalId;
    }

    const saved = await this.crmRepository.save(row);
    return this.toDto(saved);
  }

  async getCrmMapForSession(
    sessionId: string,
    chatIds: string[],
  ): Promise<Map<string, InboxThreadCrm>> {
    if (chatIds.length === 0) return new Map();
    const rows = await this.crmRepository.find({
      where: { sessionId, chatId: In(chatIds) },
    });
    return new Map(rows.map(r => [r.chatId, r]));
  }

  private toDto(row: InboxThreadCrm): InboxThreadCrmDto {
    return {
      sessionId: row.sessionId,
      chatId: row.chatId,
      resolved: row.resolved,
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      internalNote: row.internalNote,
      followUpAt: row.followUpAt?.toISOString() ?? null,
      customerName: row.customerName,
      customerPhone: row.customerPhone,
      linkedExternalId: row.linkedExternalId,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private emptyDto(sessionId: string, chatId: string): InboxThreadCrmDto {
    return {
      sessionId,
      chatId,
      resolved: false,
      resolvedAt: null,
      internalNote: null,
      followUpAt: null,
      customerName: null,
      customerPhone: null,
      linkedExternalId: null,
      updatedAt: new Date(0).toISOString(),
    };
  }
}
