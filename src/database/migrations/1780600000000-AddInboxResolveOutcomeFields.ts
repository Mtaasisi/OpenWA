import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddInboxResolveOutcomeFields1780600000000 implements MigrationInterface {
  name = 'AddInboxResolveOutcomeFields1780600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('inbox_thread_crm');
    if (!table) return;

    if (!table.findColumnByName('outcome')) {
      await queryRunner.addColumn(
        'inbox_thread_crm',
        new TableColumn({ name: 'outcome', type: 'varchar', length: '64', isNullable: true }),
      );
    }
    if (!table.findColumnByName('resolvedByStaffId')) {
      await queryRunner.addColumn(
        'inbox_thread_crm',
        new TableColumn({ name: 'resolvedByStaffId', type: 'varchar', length: '36', isNullable: true }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('inbox_thread_crm');
    if (!table) return;
    if (table.findColumnByName('resolvedByStaffId')) {
      await queryRunner.dropColumn('inbox_thread_crm', 'resolvedByStaffId');
    }
    if (table.findColumnByName('outcome')) {
      await queryRunner.dropColumn('inbox_thread_crm', 'outcome');
    }
  }
}
