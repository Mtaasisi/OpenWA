import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class McheleAiReplyFixes1781060000000 implements MigrationInterface {
  name = 'McheleAiReplyFixes1781060000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('ai_config', 'replyWhenProductNotFound'))) {
      await queryRunner.addColumn(
        'ai_config',
        new TableColumn({
          name: 'replyWhenProductNotFound',
          type: 'boolean',
          default: true,
        }),
      );
    }
    if (!(await queryRunner.hasColumn('ai_config', 'manualTakeoverMinutes'))) {
      await queryRunner.addColumn(
        'ai_config',
        new TableColumn({
          name: 'manualTakeoverMinutes',
          type: 'int',
          default: 15,
        }),
      );
    }
    if (!(await queryRunner.hasColumn('ai_config', 'aiFailedSendMaxRetries'))) {
      await queryRunner.addColumn(
        'ai_config',
        new TableColumn({
          name: 'aiFailedSendMaxRetries',
          type: 'int',
          default: 3,
        }),
      );
    }
    if (!(await queryRunner.hasColumn('inbox_thread_crm', 'manualTakeoverUntil'))) {
      await queryRunner.addColumn(
        'inbox_thread_crm',
        new TableColumn({
          name: 'manualTakeoverUntil',
          type: 'datetime',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('inbox_thread_crm', 'manualTakeoverUntil')) {
      await queryRunner.dropColumn('inbox_thread_crm', 'manualTakeoverUntil');
    }
    if (await queryRunner.hasColumn('ai_config', 'aiFailedSendMaxRetries')) {
      await queryRunner.dropColumn('ai_config', 'aiFailedSendMaxRetries');
    }
    if (await queryRunner.hasColumn('ai_config', 'manualTakeoverMinutes')) {
      await queryRunner.dropColumn('ai_config', 'manualTakeoverMinutes');
    }
    if (await queryRunner.hasColumn('ai_config', 'replyWhenProductNotFound')) {
      await queryRunner.dropColumn('ai_config', 'replyWhenProductNotFound');
    }
  }
}
