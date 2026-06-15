import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
import { migDateTime, migNowDefault, migPrimaryUuidColumn } from '../migration-utils';

export class AddInboxThreadEvents1781060000000 implements MigrationInterface {
  name = 'AddInboxThreadEvents1781060000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('inbox_thread_events')) return;

    const dt = migDateTime(queryRunner);
    const now = migNowDefault(queryRunner);

    await queryRunner.createTable(
      new Table({
        name: 'inbox_thread_events',
        columns: [
          migPrimaryUuidColumn(queryRunner),
          { name: 'sessionId', type: 'varchar', length: '36' },
          { name: 'chatId', type: 'varchar', length: '128' },
          { name: 'eventType', type: 'varchar', length: '64' },
          { name: 'actorType', type: 'varchar', length: '16', default: "'system'" },
          { name: 'actorId', type: 'varchar', length: '36', isNullable: true },
          { name: 'actorName', type: 'varchar', length: '128', isNullable: true },
          { name: 'summary', type: 'text', isNullable: true },
          { name: 'metadataJson', type: 'text', isNullable: true },
          { name: 'createdAt', type: dt, default: now },
        ],
      }),
    );

    await queryRunner.createIndex(
      'inbox_thread_events',
      new TableIndex({
        name: 'IDX_inbox_thread_events_thread',
        columnNames: ['sessionId', 'chatId', 'createdAt'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('inbox_thread_events', true);
  }
}
