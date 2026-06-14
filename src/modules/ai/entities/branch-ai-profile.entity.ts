import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { jsonColumnType } from '../../../common/utils/column-types';

@Entity('branch_ai_profiles')
@Index(['branchId'], { unique: true })
export class BranchAiProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  branchId: string;

  @Column({ type: 'varchar', nullable: true })
  businessName: string | null;

  @Column({ type: 'varchar', nullable: true })
  branchName: string | null;

  @Column({ type: 'varchar', nullable: true })
  aiDisplayName: string | null;

  @Column({ type: 'text', nullable: true })
  locationDescription: string | null;

  @Column({ type: 'varchar', nullable: true })
  googleMapsUrl: string | null;

  @Column({ type: 'text', nullable: true })
  nearbyLandmarks: string | null;

  @Column({ type: 'text', nullable: true })
  openingHours: string | null;

  @Column({ type: jsonColumnType(), nullable: true })
  phoneNumbers: string[] | null;

  @Column({ type: 'text', nullable: true })
  deliveryPolicy: string | null;

  @Column({ type: 'text', nullable: true })
  warrantyPolicy: string | null;

  @Column({ type: 'text', nullable: true })
  installmentPolicyDefault: string | null;

  @Column({ type: 'varchar', length: 64, default: 'boss_friendly_mtaani' })
  aiTone: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
