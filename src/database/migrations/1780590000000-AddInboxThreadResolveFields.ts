import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddInboxThreadResolveFields1780590000000 implements MigrationInterface {
  name = 'AddInboxThreadResolveFields1780590000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('inbox_thread_crm', [
      new TableColumn({
        name: 'resolvedReason',
        type: 'varchar',
        length: '128',
        isNullable: true,
      }),
      new TableColumn({
        name: 'resolvedNote',
        type: 'text',
        isNullable: true,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('inbox_thread_crm', 'resolvedNote');
    await queryRunner.dropColumn('inbox_thread_crm', 'resolvedReason');
  }
}
