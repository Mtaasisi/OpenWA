import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddStockingReminderReason1780840000000 implements MigrationInterface {
  name = 'AddStockingReminderReason1780840000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('stocking_reminders');
    if (table && !table.findColumnByName('reason')) {
      await queryRunner.addColumn(
        'stocking_reminders',
        new TableColumn({
          name: 'reason',
          type: 'varchar',
          length: '64',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('stocking_reminders');
    if (table?.findColumnByName('reason')) {
      await queryRunner.dropColumn('stocking_reminders', 'reason');
    }
  }
}
