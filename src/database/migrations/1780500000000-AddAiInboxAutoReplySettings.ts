import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddAiInboxAutoReplySettings1780500000000 implements MigrationInterface {
  name = 'AddAiInboxAutoReplySettings1780500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('ai_config', [
      new TableColumn({
        name: 'autoReplyEnabled',
        type: 'boolean',
        isNullable: false,
        default: false,
      }),
      new TableColumn({
        name: 'autoReplyPrivateOnly',
        type: 'boolean',
        isNullable: false,
        default: true,
      }),
      new TableColumn({
        name: 'autoReplyCooldownMinutes',
        type: 'int',
        isNullable: false,
        default: 30,
      }),
      new TableColumn({
        name: 'autoReplyContextMessages',
        type: 'int',
        isNullable: false,
        default: 12,
      }),
      new TableColumn({
        name: 'autoReplyPrompt',
        type: 'text',
        isNullable: true,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('ai_config', 'autoReplyPrompt');
    await queryRunner.dropColumn('ai_config', 'autoReplyContextMessages');
    await queryRunner.dropColumn('ai_config', 'autoReplyCooldownMinutes');
    await queryRunner.dropColumn('ai_config', 'autoReplyPrivateOnly');
    await queryRunner.dropColumn('ai_config', 'autoReplyEnabled');
  }
}
