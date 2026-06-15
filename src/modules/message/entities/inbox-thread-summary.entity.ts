import { dateTimeColumnType } from '../../../common/utils/column-types';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MessageDirection } from './message.entity';

/** Denormalized inbox thread row for fast list queries and pagination. */
@Entity('inbox_thread_summaries')
@Index(['sessionId', 'chatId'], { unique: true })
@Index(['sessionId', 'lastMessageAt'])
@Index(['lastMessageAt'])
export class InboxThreadSummary {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  sessionId: string;

  @Column()
  chatId: string;

  @Column({ type: dateTimeColumnType() })
  lastMessageAt: Date;

  @Column({ type: 'bigint', nullable: true })
  lastTimestamp: number | null;

  @Column({ type: 'text', nullable: true })
  lastPreview: string | null;

  @Column({ type: 'varchar', nullable: true })
  lastMessageType: string | null;

  @Column({ type: 'varchar', nullable: true })
  lastMessageId: string | null;

  @Column({ type: 'varchar' })
  lastDirection: MessageDirection;

  @Column({ type: 'int', default: 0 })
  messageCount: number;

  @Column({ type: 'varchar', nullable: true })
  displayName: string | null;

  @Column({ type: 'int', default: 0 })
  unreadCount: number;

  /** True when the most recent inbound message was sent via a WhatsApp broadcast list. */
  @Column({ type: 'boolean', default: false })
  lastInboundBroadcast: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
