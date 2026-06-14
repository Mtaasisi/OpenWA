import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('ai_processed_inbound_messages')
@Index(['sessionId', 'messageId', 'feature'], { unique: true })
export class AiProcessedInboundMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  sessionId: string;

  @Column({ type: 'varchar' })
  messageId: string;

  @Column({ type: 'varchar' })
  feature: string;

  @Column({ type: 'varchar', nullable: true })
  requestId: string | null;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  processedAt: Date;
}
