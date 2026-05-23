import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddInauzwaLoginEmail1779960000000 implements MigrationInterface {
  name = 'AddInauzwaLoginEmail1779960000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'crm_inauzwa_sync_settings',
      new TableColumn({ name: 'loginEmail', type: 'varchar', isNullable: true }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('crm_inauzwa_sync_settings', 'loginEmail');
  }
}
