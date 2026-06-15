import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddInauzwaFetchToggles1780310000000 implements MigrationInterface {
  name = 'AddInauzwaFetchToggles1780310000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = 'crm_inauzwa_sync_settings';
    const cols = [
      new TableColumn({ name: 'syncProducts', type: 'boolean', default: true }),
      new TableColumn({ name: 'syncCustomers', type: 'boolean', default: false }),
      new TableColumn({ name: 'syncProformas', type: 'boolean', default: false }),
      new TableColumn({ name: 'syncRecentSales', type: 'boolean', default: false }),
      new TableColumn({ name: 'syncCategories', type: 'boolean', default: false }),
      new TableColumn({ name: 'pushSalesToInauzwa', type: 'boolean', default: false }),
      new TableColumn({ name: 'businessName', type: 'varchar', isNullable: true }),
      new TableColumn({ name: 'defaultPaymentInstructions', type: 'text', isNullable: true }),
      new TableColumn({ name: 'defaultBranchPickupInfo', type: 'text', isNullable: true }),
    ];
    for (const col of cols) {
      const has = await queryRunner.hasColumn(table, col.name);
      if (!has) await queryRunner.addColumn(table, col);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = 'crm_inauzwa_sync_settings';
    for (const name of [
      'syncProducts',
      'syncCustomers',
      'syncProformas',
      'syncRecentSales',
      'syncCategories',
      'pushSalesToInauzwa',
      'businessName',
      'defaultPaymentInstructions',
      'defaultBranchPickupInfo',
    ]) {
      const has = await queryRunner.hasColumn(table, name);
      if (has) await queryRunner.dropColumn(table, name);
    }
  }
}
