import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddInboxThreadAiAutoReplyPaused1780520000000 implements MigrationInterface {
  name = 'AddInboxThreadAiAutoReplyPaused1780520000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'inbox_thread_crm',
      new TableColumn({
        name: 'aiAutoReplyPaused',
        type: 'boolean',
        isNullable: false,
        default: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('inbox_thread_crm', 'aiAutoReplyPaused');
  }
}
