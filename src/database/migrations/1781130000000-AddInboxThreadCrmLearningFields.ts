import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddInboxThreadCrmLearningFields1781130000000 implements MigrationInterface {
  name = 'AddInboxThreadCrmLearningFields1781130000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'inbox_thread_crm',
      new TableColumn({
        name: 'buyingPreferences',
        type: 'text',
        isNullable: true,
      }),
    );
    await queryRunner.addColumn(
      'inbox_thread_crm',
      new TableColumn({
        name: 'discountNegotiationMarked',
        type: 'boolean',
        default: false,
        isNullable: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('inbox_thread_crm', 'discountNegotiationMarked');
    await queryRunner.dropColumn('inbox_thread_crm', 'buyingPreferences');
  }
}
