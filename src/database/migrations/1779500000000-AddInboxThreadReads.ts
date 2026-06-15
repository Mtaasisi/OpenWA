import { migPrimaryUuidColumn, migDateTime, migNowDefault } from '../migration-utils';
import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AddInboxThreadReads1779500000000 implements MigrationInterface {
  name = 'AddInboxThreadReads1779500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'inbox_thread_reads',
        columns: [
          migPrimaryUuidColumn(queryRunner),
          { name: 'sessionId', type: 'varchar', isNullable: false },
          { name: 'chatId', type: 'varchar', isNullable: false },
          { name: 'lastReadAt', type: migDateTime(queryRunner), isNullable: false },
          { name: 'updatedAt', type: migDateTime(queryRunner), default: migNowDefault(queryRunner), isNullable: false },
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
