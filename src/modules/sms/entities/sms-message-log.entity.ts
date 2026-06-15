import { dateTimeColumnType } from '../../../common/utils/column-types';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { SmsMessageStatus, SmsProvider } from '../sms.enums';

@Entity('sms_message_logs')
@Index(['normalizedPhone'])
@Index(['status'])
@Index(['sentBy'])
@Index(['createdAt'])
export class SmsMessageLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', default: SmsProvider.MOBISHASTRA })
  provider: SmsProvider;

  @Column({ type: 'varchar' })
  toPhone: string;

  @Column({ type: 'varchar' })
  normalizedPhone: string;

  @Column({ type: 'varchar', nullable: true })
  customerId: string | null;

  @Column({ type: 'varchar', nullable: true })
  conversationId: string | null;

  @Column({ type: 'varchar', nullable: true })
  relatedType: string | null;

  @Column({ type: 'varchar', nullable: true })
  relatedId: string | null;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'int', default: 1 })
  smsCount: number;

  @Column({ type: 'varchar', default: SmsMessageStatus.QUEUED })
  status: SmsMessageStatus;

  @Column({ type: 'varchar', nullable: true })
  providerMessageId: string | null;

  @Column({ type: 'text', nullable: true })
  providerResponse: string | null;

  @Column({ type: 'varchar', nullable: true })
  errorCode: string | null;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'varchar', nullable: true })
  sentBy: string | null;

  @Column({ type: dateTimeColumnType(), nullable: true })
  sentAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
