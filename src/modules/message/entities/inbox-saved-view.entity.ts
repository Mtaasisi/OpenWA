import { dateTimeColumnType } from '../../../common/utils/column-types';
import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('inbox_saved_views')
@Index(['staffId', 'sortOrder'])
export class InboxSavedView {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  staffId: string;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ type: 'text' })
  configJson: string;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ type: dateTimeColumnType() })
  createdAt: Date;

  @UpdateDateColumn({ type: dateTimeColumnType() })
  updatedAt: Date;
}
