import { migPrimaryUuidColumn, migDateTime, migNowDefault } from '../migration-utils';
import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AddInboxThreadCrm1779600000000 implements MigrationInterface {
  name = 'AddInboxThreadCrm1779600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'inbox_thread_crm',
        columns: [
          migPrimaryUuidColumn(queryRunner),
          { name: 'sessionId', type: 'varchar', isNullable: false },
          { name: 'chatId', type: 'varchar', isNullable: false },
          { name: 'resolved', type: 'boolean', default: false, isNullable: false },
          { name: 'resolvedAt', type: migDateTime(queryRunner), isNullable: true },
          { name: 'internalNote', type: 'text', isNullable: true },
          { name: 'followUpAt', type: migDateTime(queryRunner), isNullable: true },
          { name: 'customerName', type: 'varchar', isNullable: true },
          { name: 'customerPhone', type: 'varchar', isNullable: true },
          { name: 'linkedExternalId', type: 'varchar', isNullable: true },
          { name: 'createdAt', type: migDateTime(queryRunner), default: migNowDefault(queryRunner), isNullable: false },
          { name: 'updatedAt', type: migDateTime(queryRunner), default: migNowDefault(queryRunner), isNullable: false },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'inbox_thread_crm',
      new TableIndex({
        name: 'IDX_inbox_thread_crm_session_chat',
        columnNames: ['sessionId', 'chatId'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('inbox_thread_crm');
  }
}
