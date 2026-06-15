import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddInboxThreadFollowUpNote1780820000000 implements MigrationInterface {
  name = 'AddInboxThreadFollowUpNote1780820000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('inbox_thread_crm', [
      new TableColumn({
        name: 'followUpReason',
        type: 'varchar',
        length: '64',
        isNullable: true,
      }),
      new TableColumn({
        name: 'followUpNote',
        type: 'text',
        isNullable: true,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('inbox_thread_crm', 'followUpNote');
    await queryRunner.dropColumn('inbox_thread_crm', 'followUpReason');
  }
}
