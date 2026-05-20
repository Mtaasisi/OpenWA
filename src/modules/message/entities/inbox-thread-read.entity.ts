import { Entity, PrimaryGeneratedColumn, Column, Index, UpdateDateColumn } from 'typeorm';

@Entity('inbox_thread_reads')
@Index(['sessionId', 'chatId'], { unique: true })
export class InboxThreadRead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  sessionId: string;

  @Column()
  chatId: string;

  @Column({ type: 'datetime' })
  lastReadAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
