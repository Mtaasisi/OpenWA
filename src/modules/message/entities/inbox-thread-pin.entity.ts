import { dateTimeColumnType } from '../../../common/utils/column-types';
import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('inbox_thread_pins')
@Index(['staffId', 'sessionId', 'chatId'], { unique: true })
@Index(['staffId', 'pinnedAt'])
export class InboxThreadPin {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  staffId: string;

  @Column()
  sessionId: string;

  @Column()
  chatId: string;

  @Column({ type: 'varchar', nullable: true })
  label: string | null;

  @Column({ type: dateTimeColumnType() })
  pinnedAt: Date;
}
