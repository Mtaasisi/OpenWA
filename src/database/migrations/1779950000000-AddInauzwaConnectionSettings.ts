import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddInauzwaConnectionSettings1779950000000 implements MigrationInterface {
  name = 'AddInauzwaConnectionSettings1779950000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = 'crm_inauzwa_sync_settings';
  await queryRunner.addColumns(table, [
    new TableColumn({ name: 'databaseUrl', type: 'text', isNullable: true }),
    new TableColumn({ name: 'apiUrl', type: 'varchar', isNullable: true }),
    new TableColumn({ name: 'apiToken', type: 'text', isNullable: true }),
    new TableColumn({ name: 'currency', type: 'varchar', isNullable: true }),
  ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = 'crm_inauzwa_sync_settings';
    await queryRunner.dropColumn(table, 'currency');
    await queryRunner.dropColumn(table, 'apiToken');
    await queryRunner.dropColumn(table, 'apiUrl');
    await queryRunner.dropColumn(table, 'databaseUrl');
  }
}
