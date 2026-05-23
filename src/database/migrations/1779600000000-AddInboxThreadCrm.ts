import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AddInboxThreadCrm1779600000000 implements MigrationInterface {
  name = 'AddInboxThreadCrm1779600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'inbox_thread_crm',
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
          { name: 'resolved', type: 'boolean', default: false, isNullable: false },
          { name: 'resolvedAt', type: 'datetime', isNullable: true },
          { name: 'internalNote', type: 'text', isNullable: true },
          { name: 'followUpAt', type: 'datetime', isNullable: true },
          { name: 'customerName', type: 'varchar', isNullable: true },
          { name: 'customerPhone', type: 'varchar', isNullable: true },
          { name: 'linkedExternalId', type: 'varchar', isNullable: true },
          { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP', isNullable: false },
          { name: 'updatedAt', type: 'datetime', default: 'CURRENT_TIMESTAMP', isNullable: false },
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
