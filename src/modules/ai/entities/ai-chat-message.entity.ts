import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { AiChatConversation } from './ai-chat-conversation.entity';

@Entity('ai_chat_messages')
export class AiChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  conversationId: string;

  @ManyToOne(() => AiChatConversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversationId' })
  conversation: AiChatConversation;

  @Column({ type: 'varchar' })
  role: 'user' | 'assistant' | 'system';

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'text', nullable: true })
  toolCallsJson: string | null;

  @Column({ type: 'text', nullable: true })
  agentActionJson: string | null;

  @Column({ type: 'varchar', nullable: true })
  provider: string | null;

  @Column({ type: 'varchar', nullable: true })
  model: string | null;

  @Column({ type: 'int', nullable: true })
  latencyMs: number | null;

  @CreateDateColumn()
  createdAt: Date;
}
