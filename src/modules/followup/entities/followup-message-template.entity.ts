import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TemplateCategory, WhatsAppTemplateStatus } from '../followup.enums';

@Entity('followup_message_templates')
@Index(['branchId'])
@Index(['category'])
export class FollowupMessageTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'varchar' })
  category: TemplateCategory;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'text', nullable: true })
  smsBody: string | null;

  @Column({ type: 'varchar', default: 'whatsapp' })
  channel: string;

  @Column({ type: 'varchar', default: 'en' })
  language: string;

  @Column({ default: false })
  requiresWhatsappApproval: boolean;

  @Column({ type: 'varchar', nullable: true })
  whatsappTemplateName: string | null;

  @Column({ type: 'varchar', default: WhatsAppTemplateStatus.NOT_REQUIRED })
  whatsappTemplateStatus: WhatsAppTemplateStatus;

  @Column({ type: 'varchar', nullable: true })
  branchId: string | null;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
