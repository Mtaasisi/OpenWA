import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import { jsonColumnType } from '../../../common/utils/column-types';

export enum MessageDirection {
  INCOMING = 'incoming',
  OUTGOING = 'outgoing',
}

export enum MessageStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
}

@Entity('messages')
@Index(['sessionId', 'createdAt'])
@Index(['sessionId', 'chatId', 'createdAt'])
@Index(['chatId'])
@Index(['sessionId', 'waMessageId'], { unique: true, where: '"waMessageId" IS NOT NULL' })
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  sessionId: string;

  @Column({ nullable: true })
  waMessageId: string;

  @Column()
  chatId: string;

  @Column()
  from: string;

  @Column()
  to: string;

  @Column({ type: 'text', nullable: true })
  body: string;

  @Column({ default: 'text' })
  type: string;

  @Column({
    type: 'varchar',
    default: MessageDirection.OUTGOING,
  })
  direction: MessageDirection;

  @Column({ type: 'bigint', nullable: true })
  timestamp: number;

  @Column({ type: jsonColumnType(), nullable: true })
  metadata: Record<string, unknown>;

  @Column({
    type: 'varchar',
    default: MessageStatus.SENT,
  })
  @Index()
  status: MessageStatus;

  @Column({ default: false })
  isAiGenerated: boolean;

  @Column({ type: 'varchar', length: 32, nullable: true })
  aiProvider: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  aiModel: string | null;

  @Column({ type: 'int', nullable: true })
  aiTokensUsed: number | null;

  @Column({ type: 'int', nullable: true })
  aiLatencyMs: number | null;

  @CreateDateColumn()
  createdAt: Date;
}
