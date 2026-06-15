import { migPrimaryUuidColumn, migDateTime, migNowDefault } from '../migration-utils';
import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AddSmsProvider1780710000000 implements MigrationInterface {
  name = 'AddSmsProvider1780710000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'sms_provider_settings',
        columns: [
          { name: 'id', type: 'varchar', isPrimary: true, default: "'default'" },
          { name: 'provider', type: 'varchar', default: "'mobishastra'", isNullable: false },
          { name: 'isEnabled', type: 'boolean', default: false, isNullable: false },
          { name: 'status', type: 'varchar', default: "'not_connected'", isNullable: false },
          { name: 'profileId', type: 'varchar', isNullable: true },
          { name: 'passwordEncrypted', type: 'text', isNullable: true },
          { name: 'senderId', type: 'varchar', isNullable: true },
          { name: 'countryCode', type: 'varchar', default: "'ALL'", isNullable: false },
          { name: 'priority', type: 'varchar', default: "'High'", isNullable: false },
          { name: 'lastBalance', type: 'real', isNullable: true },
          { name: 'lastTestAt', type: migDateTime(queryRunner), isNullable: true },
          { name: 'lastError', type: 'text', isNullable: true },
          { name: 'createdBy', type: 'varchar', isNullable: true },
          { name: 'updatedBy', type: 'varchar', isNullable: true },
          { name: 'createdAt', type: migDateTime(queryRunner), default: migNowDefault(queryRunner), isNullable: false },
          { name: 'updatedAt', type: migDateTime(queryRunner), default: migNowDefault(queryRunner), isNullable: false },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'sms_message_logs',
        columns: [
          migPrimaryUuidColumn(queryRunner),
          { name: 'provider', type: 'varchar', default: "'mobishastra'", isNullable: false },
          { name: 'toPhone', type: 'varchar', isNullable: false },
          { name: 'normalizedPhone', type: 'varchar', isNullable: false },
          { name: 'customerId', type: 'varchar', isNullable: true },
          { name: 'conversationId', type: 'varchar', isNullable: true },
          { name: 'relatedType', type: 'varchar', isNullable: true },
          { name: 'relatedId', type: 'varchar', isNullable: true },
          { name: 'message', type: 'text', isNullable: false },
          { name: 'smsCount', type: 'int', default: 1, isNullable: false },
          { name: 'status', type: 'varchar', default: "'queued'", isNullable: false },
          { name: 'providerMessageId', type: 'varchar', isNullable: true },
          { name: 'providerResponse', type: 'text', isNullable: true },
          { name: 'errorCode', type: 'varchar', isNullable: true },
          { name: 'errorMessage', type: 'text', isNullable: true },
          { name: 'sentBy', type: 'varchar', isNullable: true },
          { name: 'sentAt', type: migDateTime(queryRunner), isNullable: true },
          { name: 'createdAt', type: migDateTime(queryRunner), default: migNowDefault(queryRunner), isNullable: false },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'sms_message_logs',
      new TableIndex({ name: 'IDX_sms_logs_normalized_phone', columnNames: ['normalizedPhone'] }),
    );
    await queryRunner.createIndex(
      'sms_message_logs',
      new TableIndex({ name: 'IDX_sms_logs_status', columnNames: ['status'] }),
    );
    await queryRunner.createIndex(
      'sms_message_logs',
      new TableIndex({ name: 'IDX_sms_logs_sent_by', columnNames: ['sentBy'] }),
    );
    await queryRunner.createIndex(
      'sms_message_logs',
      new TableIndex({ name: 'IDX_sms_logs_created_at', columnNames: ['createdAt'] }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('sms_message_logs');
    await queryRunner.dropTable('sms_provider_settings');
  }
}
