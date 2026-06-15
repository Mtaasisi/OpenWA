import { migPrimaryUuidColumn, migUuidFkColumn, migDateTime, migNowDefault } from '../migration-utils';
import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class AddAiMemoryIndex1780560000000 implements MigrationInterface {
  name = 'AddAiMemoryIndex1780560000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'ai_memory_files',
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
        name: 'ai_memory_chunks',
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
      'ai_memory_chunks',
      new TableForeignKey({
        columnNames: ['fileId'],
        referencedTableName: 'ai_memory_files',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'ai_memory_chunks',
      new TableIndex({ name: 'IDX_ai_memory_chunks_fileId', columnNames: ['fileId'] }),
    );

    if (queryRunner.connection.options.type === 'postgres') {
      await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);
      await queryRunner.query(
        `ALTER TABLE ai_memory_chunks ADD COLUMN IF NOT EXISTS embedding vector(1536)`,
      );
      try {
        await queryRunner.query(`
          CREATE INDEX IF NOT EXISTS idx_ai_memory_chunks_embedding
          ON ai_memory_chunks USING hnsw (embedding vector_cosine_ops)
        `);
      } catch {
        /* HNSW may be unavailable until pgvector is installed — search still works via sequential scan */
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type === 'postgres') {
      await queryRunner.query(`DROP INDEX IF EXISTS idx_ai_memory_chunks_embedding`);
      await queryRunner.query(`ALTER TABLE ai_memory_chunks DROP COLUMN IF EXISTS embedding`);
    }
    await queryRunner.dropTable('ai_memory_chunks', true);
    await queryRunner.dropTable('ai_memory_files', true);
  }
}
