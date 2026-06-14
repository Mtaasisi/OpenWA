import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { AiKnowledgeFile } from './ai-knowledge-file.entity';

@Entity('ai_knowledge_chunks')
export class AiKnowledgeChunk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar' })
  fileId: string;

  @ManyToOne(() => AiKnowledgeFile, file => file.chunks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fileId' })
  file?: AiKnowledgeFile;

  @Column({ type: 'varchar' })
  path: string;

  @Column({ type: 'int' })
  startLine: number;

  @Column({ type: 'int' })
  endLine: number;

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'text', nullable: true })
  embeddingJson: string | null;
}
