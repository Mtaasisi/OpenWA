import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { dateTimeColumnType } from '../../../common/utils/column-types';

export type DesktopDeviceStatus = 'active' | 'inactive' | 'revoked';

@Entity('desktop_devices')
@Index(['deviceId'], { unique: true })
export class DesktopDevice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64 })
  deviceId: string;

  @Column({ type: 'varchar', length: 255 })
  deviceName: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  businessId: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  branchId: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  appVersion: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  os: string | null;

  @Column({ type: 'varchar', length: 16, default: 'active' })
  status: DesktopDeviceStatus;

  @Column({ type: dateTimeColumnType(), nullable: true })
  lastSeenAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
