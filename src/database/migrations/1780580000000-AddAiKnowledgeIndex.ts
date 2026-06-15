import { migPrimaryUuidColumn, migUuidFkColumn, migDateTime, migNowDefault } from '../migration-utils';
import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class AddAiKnowledgeIndex1780580000000 implements MigrationInterface {
  name = 'AddAiKnowledgeIndex1780580000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'ai_knowledge_files',
        columns: [
          migPrimaryUuidColumn(queryRunner),
          { name: 'path', type: 'varchar', isUnique: true },
          { name: 'contentHash', type: 'varchar', length: '64' },
          { name: 'content', type: 'text' },
          { name: 'updatedAt', type: migDateTime(queryRunner), default: migNowDefault(queryRunner) },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'ai_knowledge_chunks',
        columns: [
          migPrimaryUuidColumn(queryRunner),
          migUuidFkColumn(queryRunner, 'fileId'),
          { name: 'path', type: 'varchar' },
          { name: 'startLine', type: 'int' },
          { name: 'endLine', type: 'int' },
          { name: 'text', type: 'text' },
          { name: 'embeddingJson', type: 'text', isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'ai_knowledge_chunks',
      new TableForeignKey({
        columnNames: ['fileId'],
        referencedTableName: 'ai_knowledge_files',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'ai_knowledge_chunks',
      new TableIndex({ name: 'IDX_ai_knowledge_chunks_fileId', columnNames: ['fileId'] }),
    );

    if (queryRunner.connection.options.type === 'postgres') {
      await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);
      await queryRunner.query(
        `ALTER TABLE ai_knowledge_chunks ADD COLUMN IF NOT EXISTS embedding vector(1536)`,
      );
      try {
        await queryRunner.query(`
          CREATE INDEX IF NOT EXISTS idx_ai_knowledge_chunks_embedding
          ON ai_knowledge_chunks USING hnsw (embedding vector_cosine_ops)
        `);
      } catch {
        /* optional */
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type === 'postgres') {
      await queryRunner.query(`DROP INDEX IF EXISTS idx_ai_knowledge_chunks_embedding`);
      await queryRunner.query(`ALTER TABLE ai_knowledge_chunks DROP COLUMN IF EXISTS embedding`);
    }
    await queryRunner.dropTable('ai_knowledge_chunks', true);
    await queryRunner.dropTable('ai_knowledge_files', true);
  }
}
