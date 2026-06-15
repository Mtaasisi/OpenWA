import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
import { migDateTime, migNowDefault, migPrimaryUuidColumn } from '../migration-utils';

export class AddInboxSavedViews1781110000000 implements MigrationInterface {
  name = 'AddInboxSavedViews1781110000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('inbox_saved_views')) return;

    const dt = migDateTime(queryRunner);
    const now = migNowDefault(queryRunner);

    await queryRunner.createTable(
      new Table({
        name: 'inbox_saved_views',
        columns: [
          migPrimaryUuidColumn(queryRunner),
          { name: 'staffId', type: 'varchar', length: '36' },
          { name: 'name', type: 'varchar', length: '80' },
          { name: 'configJson', type: 'text' },
          { name: 'sortOrder', type: 'int', default: 0 },
          { name: 'createdAt', type: dt, default: now },
          { name: 'updatedAt', type: dt, default: now },
        ],
      }),
    );

    await queryRunner.createIndex(
      'inbox_saved_views',
      new TableIndex({
        name: 'IDX_inbox_saved_views_staff_sort',
        columnNames: ['staffId', 'sortOrder'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('inbox_saved_views', true);
  }
}
