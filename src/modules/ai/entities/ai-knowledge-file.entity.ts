import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { AiKnowledgeChunk } from './ai-knowledge-chunk.entity';

@Entity('ai_knowledge_files')
export class AiKnowledgeFile {
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

  @OneToMany(() => AiKnowledgeChunk, chunk => chunk.file)
  chunks?: AiKnowledgeChunk[];
}
