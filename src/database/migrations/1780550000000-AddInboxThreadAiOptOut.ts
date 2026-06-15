import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddInboxThreadAiOptOut1780550000000 implements MigrationInterface {
  name = 'AddInboxThreadAiOptOut1780550000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'inbox_thread_crm',
      new TableColumn({
        name: 'aiOptOut',
        type: 'boolean',
        default: false,
        isNullable: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('inbox_thread_crm', 'aiOptOut');
  }
}
