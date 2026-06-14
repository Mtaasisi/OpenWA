import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiChatConversation } from './entities/ai-chat-conversation.entity';
import { AiChatMessage } from './entities/ai-chat-message.entity';
import type { ToolAction } from './ai-chat.service';

@Injectable()
export class AiChatConversationsService {
  constructor(
    @InjectRepository(AiChatConversation, 'data')
    private readonly convRepo: Repository<AiChatConversation>,
    @InjectRepository(AiChatMessage, 'data')
    private readonly msgRepo: Repository<AiChatMessage>,
  ) {}

  async listConversations() {
    return this.convRepo.find({ order: { updatedAt: 'DESC' }, take: 50 });
  }

  async createConversation(title = 'New chat') {
    const now = new Date();
    const conv = this.convRepo.create({ title, createdAt: now, updatedAt: now });
    return this.convRepo.save(conv);
  }

  async deleteConversation(id: string) {
    const result = await this.convRepo.delete(id);
    if (!result.affected) throw new NotFoundException('Conversation not found');
  }

  async updateTitle(id: string, title: string) {
    const conv = await this.convRepo.findOne({ where: { id } });
    if (!conv) throw new NotFoundException('Conversation not found');
    conv.title = title;
    return this.convRepo.save(conv);
  }

  async listMessages(conversationId: string) {
    return this.msgRepo.find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
    });
  }

  async addMessage(
    conversationId: string,
    params: {
      role: 'user' | 'assistant' | 'system';
      content: string;
      toolCalls?: ToolAction[];
      agentAction?: Record<string, unknown>;
      provider?: string;
      model?: string;
      latencyMs?: number;
    },
  ) {
    const conv = await this.convRepo.findOne({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException('Conversation not found');

    const now = new Date();
    const msg = this.msgRepo.create({
      conversationId,
      role: params.role,
      content: params.content,
      toolCallsJson: params.toolCalls?.length ? JSON.stringify(params.toolCalls) : null,
      agentActionJson: params.agentAction ? JSON.stringify(params.agentAction) : null,
      provider: params.provider ?? null,
      model: params.model ?? null,
      latencyMs: params.latencyMs ?? null,
      createdAt: now,
    });
    await this.msgRepo.save(msg);

    if (params.role === 'user' && conv.title === 'New chat') {
      conv.title = params.content.slice(0, 60) || 'New chat';
    }
    conv.updatedAt = now;
    await this.convRepo.save(conv);
    return msg;
  }
}
