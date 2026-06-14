import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { AiMemoryFile } from './ai-memory-file.entity';

@Entity('ai_memory_chunks')
export class AiMemoryChunk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar' })
  fileId: string;

  @ManyToOne(() => AiMemoryFile, file => file.chunks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fileId' })
  file?: AiMemoryFile;

  @Column({ type: 'varchar' })
  path: string;

  @Column({ type: 'int' })
  startLine: number;

  @Column({ type: 'int' })
  endLine: number;

  @Column({ type: 'text' })
  text: string;

  /** JSON-serialized embedding (fallback / non-pgvector). */
  @Column({ type: 'text', nullable: true })
  embeddingJson: string | null;
}
