import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
import { migDateTime, migNowDefault, migPrimaryUuidColumn } from '../migration-utils';

export class AddInboxThreadPins1781100000000 implements MigrationInterface {
  name = 'AddInboxThreadPins1781100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('inbox_thread_pins')) return;

    const dt = migDateTime(queryRunner);
    const now = migNowDefault(queryRunner);

    await queryRunner.createTable(
      new Table({
        name: 'inbox_thread_pins',
        columns: [
          migPrimaryUuidColumn(queryRunner),
          { name: 'staffId', type: 'varchar', length: '36' },
          { name: 'sessionId', type: 'varchar', length: '36' },
          { name: 'chatId', type: 'varchar', length: '128' },
          { name: 'label', type: 'varchar', length: '256', isNullable: true },
          { name: 'pinnedAt', type: dt, default: now },
        ],
      }),
    );

    await queryRunner.createIndex(
      'inbox_thread_pins',
      new TableIndex({
        name: 'IDX_inbox_thread_pins_staff_thread',
        columnNames: ['staffId', 'sessionId', 'chatId'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'inbox_thread_pins',
      new TableIndex({
        name: 'IDX_inbox_thread_pins_staff_pinned_at',
        columnNames: ['staffId', 'pinnedAt'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('inbox_thread_pins', true);
  }
}
