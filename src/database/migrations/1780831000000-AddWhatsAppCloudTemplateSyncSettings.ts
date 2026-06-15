import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';
import { migDateTime } from '../migration-utils';

export class AddWhatsAppCloudTemplateSyncSettings1780831000000 implements MigrationInterface {
  name = 'AddWhatsAppCloudTemplateSyncSettings1780831000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const dt = migDateTime(queryRunner);
    const table = 'whatsapp_safety_settings';
    const cols = [
      new TableColumn({
        name: 'whatsappCloudSyncEnabled',
        type: 'boolean',
        default: false,
        isNullable: false,
      }),
      new TableColumn({
        name: 'whatsappCloudWabaId',
        type: 'varchar',
        isNullable: true,
      }),
      new TableColumn({
        name: 'whatsappCloudLastSyncAt',
        type: dt,
        isNullable: true,
      }),
      new TableColumn({
        name: 'whatsappCloudLastSyncSummary',
        type: 'text',
        isNullable: true,
      }),
    ];
    for (const col of cols) {
      if (!(await queryRunner.hasColumn(table, col.name))) {
        await queryRunner.addColumn(table, col);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('whatsapp_safety_settings', 'whatsappCloudLastSyncSummary');
    await queryRunner.dropColumn('whatsapp_safety_settings', 'whatsappCloudLastSyncAt');
    await queryRunner.dropColumn('whatsapp_safety_settings', 'whatsappCloudWabaId');
    await queryRunner.dropColumn('whatsapp_safety_settings', 'whatsappCloudSyncEnabled');
  }
}
