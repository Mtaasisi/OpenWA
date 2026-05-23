import { Entity, PrimaryGeneratedColumn, Column, Index, UpdateDateColumn, CreateDateColumn } from 'typeorm';

@Entity('inbox_thread_crm')
@Index(['sessionId', 'chatId'], { unique: true })
export class InboxThreadCrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  sessionId: string;

  @Column()
  chatId: string;

  @Column({ default: false })
  resolved: boolean;

  @Column({ type: 'datetime', nullable: true })
  resolvedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  internalNote: string | null;

  @Column({ type: 'datetime', nullable: true })
  followUpAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  customerName: string | null;

  @Column({ type: 'varchar', nullable: true })
  customerPhone: string | null;

  /** External CRM / ERP customer id or reference */
  @Column({ type: 'varchar', nullable: true })
  linkedExternalId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
