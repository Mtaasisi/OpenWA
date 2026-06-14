import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { AiCustomerIntent, AiSignalType } from '../ai-signal.enums';

@Entity('ai_reply_events')
@Index(['sessionId', 'chatId', 'createdAt'])
@Index(['signalType', 'createdAt'])
export class AiReplyEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  sessionId: string;

  @Column()
  chatId: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  signalType: AiSignalType | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  detectedIntent: AiCustomerIntent | null;

  @Column({ type: 'text', nullable: true })
  incomingText: string | null;

  @Column({ type: 'text', nullable: true })
  replyText: string | null;

  @Column({ default: false })
  escalated: boolean;

  @Column({ type: 'varchar', nullable: true })
  branchId: string | null;

  @Column({ type: 'varchar', nullable: true })
  productId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
