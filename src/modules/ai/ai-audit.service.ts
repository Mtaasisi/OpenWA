import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';

@Injectable()
export class AiAuditService {
  constructor(private readonly audit: AuditService) {}

  logToolCall(
    sessionId: string,
    chatId: string,
    tool: string,
    args: Record<string, unknown>,
  ): void {
    void this.audit.logInfo(AuditAction.AI_TOOL_CALL, {
      sessionId,
      metadata: { chatId, tool, args },
    });
  }

  logAiReply(
    sessionId: string,
    chatId: string,
    meta: {
      provider?: string;
      model?: string;
      latencyMs?: number;
      escalated?: boolean;
      source: 'customer_agent' | 'staff_wa' | 'staff_chat' | 'opt_out_ack';
    },
  ): void {
    void this.audit.logInfo(AuditAction.AI_REPLY, {
      sessionId,
      metadata: { chatId, ...meta },
    });
  }
}
