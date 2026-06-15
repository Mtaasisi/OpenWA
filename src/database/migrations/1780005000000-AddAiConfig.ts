import { migPrimaryUuidColumn, migDateTime, migNowDefault } from '../migration-utils';
import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class AddAiConfig1780005000000 implements MigrationInterface {
  name = 'AddAiConfig1780005000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'ai_config',
        columns: [
          { name: 'id', type: 'varchar', isPrimary: true, default: "'default'" },
          { name: 'provider', type: 'varchar', default: "'OPENAI'", isNullable: false },
          { name: 'model', type: 'varchar', default: "'gpt-4o-mini'", isNullable: false },
          { name: 'apiKeyEncrypted', type: 'text', isNullable: true },
          { name: 'baseUrl', type: 'varchar', isNullable: true },
          { name: 'systemPrompt', type: 'text', isNullable: true },
          { name: 'temperature', type: 'real', default: 0.7, isNullable: false },
          { name: 'maxTokens', type: 'int', default: 4096, isNullable: false },
          { name: 'enabled', type: 'boolean', default: false, isNullable: false },
          { name: 'toolCallingEnabled', type: 'boolean', default: true, isNullable: false },
          { name: 'fallbackModels', type: 'text', isNullable: true },
          { name: 'testStatus', type: 'varchar', isNullable: true },
          { name: 'testError', type: 'text', isNullable: true },
          { name: 'updatedAt', type: migDateTime(queryRunner), default: migNowDefault(queryRunner), isNullable: false },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'ai_chat_conversations',
        columns: [
          migPrimaryUuidColumn(queryRunner),
          { name: 'title', type: 'varchar', default: "'New chat'", isNullable: false },
          { name: 'createdAt', type: migDateTime(queryRunner), default: migNowDefault(queryRunner), isNullable: false },
          { name: 'updatedAt', type: migDateTime(queryRunner), default: migNowDefault(queryRunner), isNullable: false },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'ai_chat_messages',
        columns: [
          migPrimaryUuidColumn(queryRunner),
          { name: 'conversationId', type: 'varchar', isNullable: false },
          { name: 'role', type: 'varchar', isNullable: false },
          { name: 'content', type: 'text', isNullable: false },
          { name: 'toolCallsJson', type: 'text', isNullable: true },
          { name: 'provider', type: 'varchar', isNullable: true },
          { name: 'model', type: 'varchar', isNullable: true },
          { name: 'latencyMs', type: 'int', isNullable: true },
          { name: 'createdAt', type: migDateTime(queryRunner), default: migNowDefault(queryRunner), isNullable: false },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('ai_chat_messages');
    await queryRunner.dropTable('ai_chat_conversations');
    await queryRunner.dropTable('ai_config');
  }
}
