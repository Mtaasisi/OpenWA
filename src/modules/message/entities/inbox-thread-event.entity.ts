import { dateTimeColumnType } from '../../../common/utils/column-types';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';

@Entity('inbox_thread_events')
@Index(['sessionId', 'chatId', 'createdAt'])
export class InboxThreadEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  sessionId: string;

  @Column()
  chatId: string;

  @Column({ type: 'varchar', length: 64 })
  eventType: string;

  @Column({ type: 'varchar', length: 16, default: 'system' })
  actorType: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  actorId: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  actorName: string | null;

  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @Column({ type: 'text', nullable: true })
  metadataJson: string | null;

  @CreateDateColumn({ type: dateTimeColumnType() })
  createdAt: Date;
}
