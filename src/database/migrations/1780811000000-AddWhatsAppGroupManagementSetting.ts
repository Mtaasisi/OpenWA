import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddWhatsAppGroupManagementSetting1780811000000 implements MigrationInterface {
  name = 'AddWhatsAppGroupManagementSetting1780811000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = 'whatsapp_safety_settings';
    const col = new TableColumn({
      name: 'groupManagementEnabled',
      type: 'boolean',
      default: false,
      isNullable: false,
    });
    if (!(await queryRunner.hasColumn(table, col.name))) {
      await queryRunner.addColumn(table, col);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('whatsapp_safety_settings', 'groupManagementEnabled');
  }
}
