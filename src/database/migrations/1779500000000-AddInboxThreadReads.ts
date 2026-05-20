import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AddInboxThreadReads1779500000000 implements MigrationInterface {
  name = 'AddInboxThreadReads1779500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'inbox_thread_reads',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'sessionId', type: 'varchar', isNullable: false },
          { name: 'chatId', type: 'varchar', isNullable: false },
          { name: 'lastReadAt', type: 'datetime', isNullable: false },
          { name: 'updatedAt', type: 'datetime', default: 'CURRENT_TIMESTAMP', isNullable: false },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'inbox_thread_reads',
      new TableIndex({
        name: 'IDX_inbox_thread_reads_session_chat',
        columnNames: ['sessionId', 'chatId'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'inbox_thread_reads',
      new TableIndex({
        name: 'IDX_inbox_thread_reads_sessionId',
        columnNames: ['sessionId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('inbox_thread_reads');
  }
}
