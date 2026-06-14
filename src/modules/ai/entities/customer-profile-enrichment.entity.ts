import { dateTimeColumnType } from '../../../common/utils/column-types';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ProfileConversationFlow, ProfileQuestionKind } from '../customer-profile.enums';

@Entity('customer_profile_enrichment')
@Index(['sessionId', 'chatId'], { unique: true })
export class CustomerProfileEnrichment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  sessionId: string;

  @Column()
  chatId: string;

  @Column({ type: 'varchar', nullable: true })
  preferredName: string | null;

  @Column({ type: 'varchar', nullable: true })
  fullName: string | null;

  @Column({ type: 'real', nullable: true })
  nameConfidenceScore: number | null;

  @Column({ type: 'varchar', nullable: true })
  nameSourceMessageId: string | null;

  @Column({ type: 'varchar', nullable: true })
  nameSourceConversationId: string | null;

  @Column({ type: dateTimeColumnType(), nullable: true })
  nameLastConfirmedAt: Date | null;

  @Column({ default: false })
  nameNeedsReview: boolean;

  @Column({ type: 'varchar', length: 64, nullable: true })
  lastProfileQuestionAsked: ProfileQuestionKind | string | null;

  @Column({ type: dateTimeColumnType(), nullable: true })
  lastProfileQuestionAskedAt: Date | null;

  @Column({ type: 'real', nullable: true })
  profileCompleteness: number | null;

  @Column({ type: 'varchar', nullable: true })
  wantedProduct: string | null;

  @Column({ type: 'varchar', nullable: true })
  wantedVariant: string | null;

  @Column({ type: 'varchar', nullable: true })
  budgetRange: string | null;

  @Column({ type: 'varchar', nullable: true })
  customerUseCase: string | null;

  @Column({ type: 'varchar', nullable: true })
  deliveryPreference: string | null;

  @Column({ type: 'varchar', nullable: true })
  paymentPreference: string | null;

  @Column({ default: false })
  notifyWhenAvailable: boolean;

  @Column({ type: 'varchar', length: 64, default: ProfileConversationFlow.IDLE })
  conversationFlow: ProfileConversationFlow | string;

  @Column({ type: dateTimeColumnType(), nullable: true })
  lastProfileUpdatedByAiAt: Date | null;

  @Column({ type: 'simple-json', nullable: true })
  aiProfileNotes: Record<string, unknown> | null;

  @Column({ default: false })
  profileLearningPaused: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
