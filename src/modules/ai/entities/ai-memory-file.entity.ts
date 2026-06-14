import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { AiMemoryChunk } from './ai-memory-chunk.entity';

@Entity('ai_memory_files')
export class AiMemoryFile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  path: string;

  @Column({ type: 'varchar', length: 64 })
  contentHash: string;

  @Column({ type: 'text' })
  content: string;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => AiMemoryChunk, chunk => chunk.file)
  chunks?: AiMemoryChunk[];
}
