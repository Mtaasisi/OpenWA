import { Injectable, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { ApiKey } from '../auth/entities/api-key.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { MessageService, OutboundSendContext } from './message.service';
import { InboxCrmService } from './inbox-crm.service';
import { InboxThreadEventService } from './inbox-thread-event.service';
import { SendMediaMessageDto, MessageResponseDto } from './dto';

export type InboxSendKind = 'text' | 'image' | 'video' | 'document' | 'audio';

export interface InboxSendPipelineRequest {
  apiKey: ApiKey;
  sessionId: string;
  chatId: string;
  kind: InboxSendKind;
  text?: string;
  quotedMessageId?: string;
  media?: SendMediaMessageDto;
  source?: string;
  automated?: boolean;
}

export interface InboxAutomatedSendRequest {
  sessionId: string;
  chatId: string;
  text: string;
  source?: string;
  quotedMessageId?: string;
  sendContext?: Omit<OutboundSendContext, 'source'>;
}

@Injectable()
export class InboxSendPipelineService {
  constructor(
    @Inject(forwardRef(() => MessageService))
    private readonly messageService: MessageService,
    @Inject(forwardRef(() => InboxCrmService))
    private readonly inboxCrm: InboxCrmService,
    private readonly auditService: AuditService,
    private readonly threadEvents: InboxThreadEventService,
  ) {}

  async send(
    req: InboxSendPipelineRequest,
  ): Promise<MessageResponseDto | { ok: false; code: string; status: string; message: string }> {
    await this.messageService.assertInboxSendAllowed(req.apiKey, req.sessionId, req.chatId);

    const crm = await this.inboxCrm.getThreadCrm(req.sessionId, req.chatId).catch(() => null);
    if (req.automated && crm?.aiOptOut) {
      throw new BadRequestException('Customer opted out of automated messages for this chat');
    }

    let result:
      | MessageResponseDto
      | { ok: false; code: string; status: string; message: string };

    switch (req.kind) {
      case 'text':
        if (!req.text?.trim()) throw new BadRequestException('text is required');
        result = req.quotedMessageId?.trim()
          ? await this.messageService.replyFromInbox(
              req.apiKey,
              req.sessionId,
              req.chatId,
              req.quotedMessageId.trim(),
              req.text.trim(),
              { source: req.source ?? 'inbox-pipeline' },
            )
          : await this.messageService.sendTextFromInbox(
              req.apiKey,
              req.sessionId,
              req.chatId,
              req.text.trim(),
              { source: req.source ?? 'inbox-pipeline' },
            );
        break;
      case 'image':
        result = await this.messageService.sendImageFromInbox(
          req.apiKey,
          req.sessionId,
          this.withMediaQuote(req.media!, req.quotedMessageId),
        );
        break;
      case 'video':
        result = await this.messageService.sendVideoFromInbox(
          req.apiKey,
          req.sessionId,
          this.withMediaQuote(req.media!, req.quotedMessageId),
        );
        break;
      case 'document':
        result = await this.messageService.sendDocumentFromInbox(
          req.apiKey,
          req.sessionId,
          this.withMediaQuote(req.media!, req.quotedMessageId),
        );
        break;
      case 'audio':
        result = await this.messageService.sendAudioFromInbox(
          req.apiKey,
          req.sessionId,
          this.withMediaQuote(req.media!, req.quotedMessageId),
        );
        break;
      default:
        throw new BadRequestException(`Unsupported send kind: ${req.kind}`);
    }

    if ('ok' in result && result.ok === false) {
      await this.threadEvents.record({
        sessionId: req.sessionId,
        chatId: req.chatId,
        eventType: 'message_failed',
        actorType: req.automated ? 'ai' : 'staff',
        actorId: req.apiKey.id,
        actorName: req.apiKey.name,
        summary: result.message,
      });
      return result;
    }

    await this.threadEvents.record({
      sessionId: req.sessionId,
      chatId: req.chatId,
      eventType: req.automated ? 'ai_replied' : 'staff_message_sent',
      actorType: req.automated ? 'ai' : 'staff',
      actorId: req.apiKey.id,
      actorName: req.apiKey.name,
      summary: req.kind === 'text' ? req.text?.slice(0, 120) ?? null : `${req.kind} sent`,
    });

    await this.auditService.logInfo(AuditAction.MESSAGE_SENT, {
      sessionId: req.sessionId,
      metadata: {
        chatId: req.chatId,
        kind: req.kind,
        source: req.source ?? 'inbox-pipeline',
        automated: req.automated ?? false,
      },
    });

    return result as MessageResponseDto;
  }

  /** Session-level automated sends (AI auto-reply, staff WA bridge) without an inbox API key. */
  async sendAutomated(req: InboxAutomatedSendRequest): Promise<MessageResponseDto> {
    const crm = await this.inboxCrm.getThreadCrm(req.sessionId, req.chatId).catch(() => null);
    if (crm?.aiOptOut) {
      throw new BadRequestException('Customer opted out of automated messages for this chat');
    }

    const sendMeta: OutboundSendContext = {
      ...req.sendContext,
      source: req.source ?? 'inbox-pipeline-automated',
    };

    try {
      const result =
        req.quotedMessageId?.trim()
          ? await this.messageService.reply(
              req.sessionId,
              {
                chatId: req.chatId,
                quotedMessageId: req.quotedMessageId,
                text: req.text,
              },
              sendMeta,
            )
          : await this.messageService.sendText(
              req.sessionId,
              { chatId: req.chatId, text: req.text },
              sendMeta,
            );

      await this.threadEvents.record({
        sessionId: req.sessionId,
        chatId: req.chatId,
        eventType: 'ai_replied',
        actorType: 'ai',
        actorId: null,
        actorName: 'AI',
        summary: req.text.slice(0, 120),
      });

      await this.auditService.logInfo(AuditAction.MESSAGE_SENT, {
        sessionId: req.sessionId,
        metadata: {
          chatId: req.chatId,
          kind: 'text',
          source: sendMeta.source,
          automated: true,
        },
      });

      return result;
    } catch (error) {
      if (!this.isQueuedSendError(error)) {
        const reason = error instanceof Error ? error.message : String(error);
        await this.threadEvents.record({
          sessionId: req.sessionId,
          chatId: req.chatId,
          eventType: 'message_failed',
          actorType: 'ai',
          actorId: null,
          actorName: 'AI',
          summary: reason,
        });
      }
      throw error;
    }
  }

  private isQueuedSendError(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err);
    return msg.includes('queued for safe delivery');
  }

  private withMediaQuote(media: SendMediaMessageDto, quotedMessageId?: string): SendMediaMessageDto {
    const quoted = quotedMessageId?.trim() || media.quotedMessageId?.trim();
    if (!quoted) return media;
    return { ...media, quotedMessageId: quoted };
  }
}
