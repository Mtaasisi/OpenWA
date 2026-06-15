import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('followup_staff_kpi')
@Index(['staffId', 'periodStart'], { unique: true })
export class FollowupStaffKpi {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  staffId: string;

  @Column({ type: 'varchar', nullable: true })
  branchId: string | null;

  @Column({ type: 'date' })
  periodStart: string;

  @Column({ type: 'date' })
  periodEnd: string;

  @Column({ type: 'int', default: 0 })
  followupsDue: number;

  @Column({ type: 'int', default: 0 })
  followupsCompletedOnTime: number;

  @Column({ type: 'int', default: 0 })
  followupsCompletedLate: number;

  @Column({ type: 'int', default: 0 })
  followupsMissed: number;

  @Column({ type: 'int', default: 0 })
  overdueFollowups: number;

  @Column({ type: 'int', default: 0 })
  conversionsAfterFollowup: number;

  @Column({ type: 'int', default: 0 })
  lostLeadsWithoutFollowup: number;

  @Column({ type: 'int', default: 0 })
  averageResponseTimeMs: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
