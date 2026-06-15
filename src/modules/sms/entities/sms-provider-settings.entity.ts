import { dateTimeColumnType } from '../../../common/utils/column-types';
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SmsProvider, SmsProviderStatus } from '../sms.enums';

@Entity('sms_provider_settings')
export class SmsProviderSettings {
  @PrimaryColumn({ default: 'default' })
  id: string;

  @Column({ type: 'varchar', default: SmsProvider.MOBISHASTRA })
  provider: SmsProvider;

  @Column({ default: false })
  isEnabled: boolean;

  @Column({ type: 'varchar', default: SmsProviderStatus.NOT_CONNECTED })
  status: SmsProviderStatus;

  @Column({ type: 'varchar', nullable: true })
  profileId: string | null;

  @Column({ type: 'text', nullable: true })
  passwordEncrypted: string | null;

  @Column({ type: 'varchar', nullable: true })
  senderId: string | null;

  @Column({ type: 'varchar', default: 'ALL' })
  countryCode: string;

  @Column({ type: 'varchar', default: 'High' })
  priority: string;

  @Column({ type: 'real', nullable: true })
  lastBalance: number | null;

  @Column({ type: dateTimeColumnType(), nullable: true })
  lastTestAt: Date | null;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @Column({ type: 'varchar', nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar', nullable: true })
  updatedBy: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
