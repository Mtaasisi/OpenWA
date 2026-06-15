import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddMessageAiMetadataAndAiTone1780540000000 implements MigrationInterface {
  name = 'AddMessageAiMetadataAndAiTone1780540000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'messages',
      new TableColumn({
        name: 'isAiGenerated',
        type: 'boolean',
        default: false,
        isNullable: false,
      }),
    );
    await queryRunner.addColumn(
      'messages',
      new TableColumn({
        name: 'aiProvider',
        type: 'varchar',
        length: '32',
        isNullable: true,
      }),
    );
    await queryRunner.addColumn(
      'messages',
      new TableColumn({
        name: 'aiModel',
        type: 'varchar',
        length: '128',
        isNullable: true,
      }),
    );
    await queryRunner.addColumn(
      'messages',
      new TableColumn({
        name: 'aiTokensUsed',
        type: 'integer',
        isNullable: true,
      }),
    );
    await queryRunner.addColumn(
      'messages',
      new TableColumn({
        name: 'aiLatencyMs',
        type: 'integer',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'ai_config',
      new TableColumn({
        name: 'autoReplyTone',
        type: 'varchar',
        length: '32',
        isNullable: true,
      }),
    );
    await queryRunner.addColumn(
      'ai_config',
      new TableColumn({
        name: 'autoReplyPreset',
        type: 'varchar',
        length: '64',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('ai_config', 'autoReplyPreset');
    await queryRunner.dropColumn('ai_config', 'autoReplyTone');
    await queryRunner.dropColumn('messages', 'aiLatencyMs');
    await queryRunner.dropColumn('messages', 'aiTokensUsed');
    await queryRunner.dropColumn('messages', 'aiModel');
    await queryRunner.dropColumn('messages', 'aiProvider');
    await queryRunner.dropColumn('messages', 'isAiGenerated');
  }
}
