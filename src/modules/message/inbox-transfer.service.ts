import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InboxThreadCrm } from './entities/inbox-thread-crm.entity';
import { FollowupConversation } from '../followup/entities/followup-conversation.entity';
import { SessionService } from '../session/session.service';
import { MessageService } from './message.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { assertApiKeySessionAccess } from '../../common/utils/api-key-session.util';
import { ApiKey } from '../auth/entities/api-key.entity';
import { isInboxChat } from '../../common/utils/inbox-chat.util';
import { SessionStatus } from '../session/entities/session.entity';
import { InboxTransferDto } from './dto/inbox-transfer.dto';

export interface InboxTransferResult {
  ok: boolean;
  fromSessionId: string;
  toSessionId: string;
  chatId: string;
  notifySent: boolean;
  notifyWarning?: string;
}

@Injectable()
export class InboxTransferService {
  constructor(
    @InjectRepository(InboxThreadCrm, 'data')
    private readonly crmRepository: Repository<InboxThreadCrm>,
    @InjectRepository(FollowupConversation, 'data')
    private readonly followupRepository: Repository<FollowupConversation>,
    @Inject(forwardRef(() => SessionService))
    private readonly sessionService: SessionService,
    @Inject(forwardRef(() => MessageService))
    private readonly messageService: MessageService,
    private readonly auditService: AuditService,
    @InjectDataSource('data')
    private readonly dataSource: DataSource,
  ) {}

  async transferChat(apiKey: ApiKey, dto: InboxTransferDto): Promise<InboxTransferResult> {
    const reason = dto.reason?.trim();
    if (!reason) {
      throw new BadRequestException('Transfer reason is required');
    }
    if (!isInboxChat(dto.chatId)) {
      throw new BadRequestException('Invalid chat id');
    }
    if (dto.fromSessionId === dto.toSessionId) {
      throw new BadRequestException('Source and destination sessions must differ');
    }

    assertApiKeySessionAccess(apiKey, dto.fromSessionId);
    assertApiKeySessionAccess(apiKey, dto.toSessionId);

    const fromSession = await this.sessionService.findOne(dto.fromSessionId);
    const toSession = await this.sessionService.findOne(dto.toSessionId);

    const hasThread = await this.messageService.hasInboxThread(dto.fromSessionId, dto.chatId);
    if (!hasThread) {
      throw new NotFoundException('Conversation not found on source session');
    }

    await this.dataSource.transaction(async manager => {
      const crmRepo = manager.getRepository(InboxThreadCrm);
      const followupRepo = manager.getRepository(FollowupConversation);

      const oldCrm = await crmRepo.findOne({
        where: { sessionId: dto.fromSessionId, chatId: dto.chatId },
      });
      const followup = await followupRepo.findOne({
        where: { sessionId: dto.fromSessionId, chatId: dto.chatId },
      });

      if (oldCrm) {
        const existingDest = await crmRepo.findOne({
          where: { sessionId: dto.toSessionId, chatId: dto.chatId },
        });
        if (existingDest) {
          Object.assign(existingDest, {
            resolved: oldCrm.resolved,
            resolvedAt: oldCrm.resolvedAt,
            resolvedReason: oldCrm.resolvedReason,
            resolvedNote: oldCrm.resolvedNote,
            internalNote: oldCrm.internalNote,
            followUpAt: oldCrm.followUpAt,
            customerName: oldCrm.customerName ?? existingDest.customerName,
            customerPhone: oldCrm.customerPhone ?? existingDest.customerPhone,
            linkedExternalId: oldCrm.linkedExternalId ?? existingDest.linkedExternalId,
            aiAutoReplyPaused: oldCrm.aiAutoReplyPaused,
            aiHandlingState: oldCrm.aiHandlingState,
            aiEscalatedAt: oldCrm.aiEscalatedAt,
            aiFailureCount: oldCrm.aiFailureCount,
            aiOptOut: oldCrm.aiOptOut,
            resolvedByStaffId: oldCrm.resolvedByStaffId,
            outcome: oldCrm.outcome,
          });
          await crmRepo.save(existingDest);
        } else {
          const moved = crmRepo.create({
            sessionId: dto.toSessionId,
            chatId: dto.chatId,
            resolved: oldCrm.resolved,
            resolvedAt: oldCrm.resolvedAt,
            resolvedReason: oldCrm.resolvedReason,
            resolvedNote: oldCrm.resolvedNote,
            internalNote: oldCrm.internalNote,
            followUpAt: oldCrm.followUpAt,
            customerName: oldCrm.customerName,
            customerPhone: oldCrm.customerPhone,
            linkedExternalId: oldCrm.linkedExternalId,
            aiAutoReplyPaused: oldCrm.aiAutoReplyPaused,
            aiHandlingState: oldCrm.aiHandlingState,
            aiEscalatedAt: oldCrm.aiEscalatedAt,
            aiFailureCount: oldCrm.aiFailureCount,
            aiOptOut: oldCrm.aiOptOut,
            resolvedByStaffId: oldCrm.resolvedByStaffId,
            outcome: oldCrm.outcome,
          });
          await crmRepo.save(moved);
        }
        await crmRepo.delete({ sessionId: dto.fromSessionId, chatId: dto.chatId });
      }

      if (followup) {
        followup.sessionId = dto.toSessionId;
        const stamp = `[Transferred ${new Date().toISOString()} from ${fromSession.name} to ${toSession.name}] ${reason}`;
        followup.internalNote = followup.internalNote
          ? `${followup.internalNote}\n${stamp}`
          : stamp;
        await followupRepo.save(followup);
      }
    });

    void this.auditService.logInfo(AuditAction.INBOX_CHAT_TRANSFERRED, {
      apiKey,
      sessionId: dto.toSessionId,
      metadata: {
        fromSessionId: dto.fromSessionId,
        toSessionId: dto.toSessionId,
        chatId: dto.chatId,
        reason,
        actorId: apiKey.id,
      },
    });

    let notifySent = false;
    let notifyWarning: string | undefined;
    if (dto.notifyCustomer) {
      if (toSession.status !== SessionStatus.READY) {
        notifyWarning = 'Transfer completed but destination session is not ready to notify customer';
      } else {
        try {
          const text = `Your conversation has been transferred to ${toSession.name}. We will continue assisting you from this number.`;
          await this.messageService.sendText(
            dto.toSessionId,
            { chatId: dto.chatId, text },
            { actorStaffId: apiKey.id, source: 'transfer-notify' },
          );
          notifySent = true;
        } catch (err) {
          notifyWarning =
            err instanceof Error ? err.message : 'Failed to send transfer notification';
        }
      }
    }

    return {
      ok: true,
      fromSessionId: dto.fromSessionId,
      toSessionId: dto.toSessionId,
      chatId: dto.chatId,
      notifySent,
      notifyWarning,
    };
  }
}
