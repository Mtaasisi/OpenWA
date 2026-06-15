import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddWhatsAppStatusPostsSetting1780821000000 implements MigrationInterface {
  name = 'AddWhatsAppStatusPostsSetting1780821000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = 'whatsapp_safety_settings';
    const col = new TableColumn({
      name: 'statusPostsEnabled',
      type: 'boolean',
      default: false,
      isNullable: false,
    });
    if (!(await queryRunner.hasColumn(table, col.name))) {
      await queryRunner.addColumn(table, col);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('whatsapp_safety_settings', 'statusPostsEnabled');
  }
}
