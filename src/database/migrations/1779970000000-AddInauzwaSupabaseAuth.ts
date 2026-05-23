import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddInauzwaSupabaseAuth1779970000000 implements MigrationInterface {
  name = 'AddInauzwaSupabaseAuth1779970000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = 'crm_inauzwa_sync_settings';
    await queryRunner.addColumns(table, [
      new TableColumn({ name: 'useSupabaseAuth', type: 'boolean', default: false }),
      new TableColumn({ name: 'supabaseUrl', type: 'varchar', isNullable: true }),
      new TableColumn({ name: 'supabaseAnonKey', type: 'text', isNullable: true }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = 'crm_inauzwa_sync_settings';
    await queryRunner.dropColumn(table, 'supabaseAnonKey');
    await queryRunner.dropColumn(table, 'supabaseUrl');
    await queryRunner.dropColumn(table, 'useSupabaseAuth');
  }
}
