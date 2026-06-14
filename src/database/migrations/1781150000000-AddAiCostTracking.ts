import { MigrationInterface, QueryRunner, Table, TableColumn, TableIndex } from 'typeorm';
import { migDateTime, migNowDefault, migPrimaryUuidColumn } from '../migration-utils';

export class AddAiCostTracking1781150000000 implements MigrationInterface {
  name = 'AddAiCostTracking1781150000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const dt = migDateTime(queryRunner);
    const now = migNowDefault(queryRunner);

    await queryRunner.createTable(
      new Table({
        name: 'ai_usage_logs',
        columns: [
          migPrimaryUuidColumn(queryRunner),
          { name: 'workspaceId', type: 'varchar', isNullable: true },
          { name: 'branchId', type: 'varchar', isNullable: true },
          { name: 'apiKeyLabel', type: 'varchar', isNullable: true },
          { name: 'provider', type: 'varchar', isNullable: false },
          { name: 'model', type: 'varchar', isNullable: false },
          { name: 'feature', type: 'varchar', isNullable: false },
          { name: 'source', type: 'varchar', isNullable: false },
          { name: 'conversationId', type: 'varchar', isNullable: true },
          { name: 'customerId', type: 'varchar', isNullable: true },
          { name: 'messageId', type: 'varchar', isNullable: true },
          { name: 'requestId', type: 'varchar', isNullable: true },
          { name: 'inputTokens', type: 'int', default: 0 },
          { name: 'outputTokens', type: 'int', default: 0 },
          { name: 'totalTokens', type: 'int', default: 0 },
          { name: 'estimatedCostUsd', type: 'decimal', precision: 18, scale: 6, default: 0 },
          { name: 'actualCostUsd', type: 'decimal', precision: 18, scale: 6, default: 0 },
          { name: 'currency', type: 'varchar', default: "'USD'" },
          { name: 'toolCallsCount', type: 'int', default: 0 },
          { name: 'aiCallsCount', type: 'int', default: 1 },
          { name: 'status', type: 'varchar', default: "'success'" },
          { name: 'errorMessage', type: 'text', isNullable: true },
          { name: 'metadata', type: 'text', isNullable: true },
          { name: 'createdAt', type: dt, default: now },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'ai_usage_logs',
      new TableIndex({ name: 'IDX_ai_usage_logs_createdAt', columnNames: ['createdAt'] }),
    );
    await queryRunner.createIndex(
      'ai_usage_logs',
      new TableIndex({ name: 'IDX_ai_usage_logs_feature', columnNames: ['feature'] }),
    );
    await queryRunner.createIndex(
      'ai_usage_logs',
      new TableIndex({ name: 'IDX_ai_usage_logs_provider', columnNames: ['provider'] }),
    );
    await queryRunner.createIndex(
      'ai_usage_logs',
      new TableIndex({ name: 'IDX_ai_usage_logs_model', columnNames: ['model'] }),
    );
    await queryRunner.createIndex(
      'ai_usage_logs',
      new TableIndex({ name: 'IDX_ai_usage_logs_branchId', columnNames: ['branchId'] }),
    );
    await queryRunner.createIndex(
      'ai_usage_logs',
      new TableIndex({ name: 'IDX_ai_usage_logs_conversationId', columnNames: ['conversationId'] }),
    );
    await queryRunner.createIndex(
      'ai_usage_logs',
      new TableIndex({ name: 'IDX_ai_usage_logs_messageId', columnNames: ['messageId'] }),
    );
    await queryRunner.createIndex(
      'ai_usage_logs',
      new TableIndex({ name: 'IDX_ai_usage_logs_requestId', columnNames: ['requestId'] }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'ai_model_pricing',
        columns: [
          migPrimaryUuidColumn(queryRunner),
          { name: 'provider', type: 'varchar', isNullable: false },
          { name: 'model', type: 'varchar', isNullable: false },
          { name: 'inputCostPer1MTokens', type: 'decimal', precision: 18, scale: 6, default: 0 },
          { name: 'outputCostPer1MTokens', type: 'decimal', precision: 18, scale: 6, default: 0 },
          { name: 'currency', type: 'varchar', default: "'USD'" },
          { name: 'effectiveDate', type: dt, default: now },
          { name: 'isActive', type: 'boolean', default: true },
          { name: 'createdAt', type: dt, default: now },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'ai_model_pricing',
      new TableIndex({
        name: 'IDX_ai_model_pricing_provider_model',
        columnNames: ['provider', 'model'],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'ai_processed_inbound_messages',
        columns: [
          migPrimaryUuidColumn(queryRunner),
          { name: 'sessionId', type: 'varchar', isNullable: false },
          { name: 'messageId', type: 'varchar', isNullable: false },
          { name: 'feature', type: 'varchar', isNullable: false },
          { name: 'requestId', type: 'varchar', isNullable: true },
          { name: 'processedAt', type: dt, default: now },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'ai_processed_inbound_messages',
      new TableIndex({
        name: 'UQ_ai_processed_session_message_feature',
        columnNames: ['sessionId', 'messageId', 'feature'],
        isUnique: true,
      }),
    );

    const configCols: TableColumn[] = [
      new TableColumn({ name: 'autoReplyModelTier', type: 'varchar', length: '16', default: "'cheap_fast'" }),
      new TableColumn({ name: 'inboxAssistantModelTier', type: 'varchar', length: '16', default: "'cheap_fast'" }),
      new TableColumn({ name: 'trainingModelTier', type: 'varchar', length: '16', default: "'balanced'" }),
      new TableColumn({ name: 'adminAssistantModelTier', type: 'varchar', length: '16', default: "'balanced'" }),
      new TableColumn({ name: 'autoReplyModelOverride', type: 'varchar', isNullable: true }),
      new TableColumn({ name: 'inboxAssistantModelOverride', type: 'varchar', isNullable: true }),
      new TableColumn({ name: 'trainingModelOverride', type: 'varchar', isNullable: true }),
      new TableColumn({ name: 'adminAssistantModelOverride', type: 'varchar', isNullable: true }),
      new TableColumn({ name: 'allowPremiumModelForAutoReply', type: 'boolean', default: false }),
      new TableColumn({ name: 'aiDailyBudgetUsd', type: 'decimal', precision: 18, scale: 6, default: 1 }),
      new TableColumn({ name: 'aiMonthlyBudgetUsd', type: 'decimal', precision: 18, scale: 6, default: 20 }),
      new TableColumn({ name: 'autoReplyDailyBudgetUsd', type: 'decimal', precision: 18, scale: 6, default: 0.5 }),
      new TableColumn({ name: 'stopAutoReplyWhenBudgetExceeded', type: 'boolean', default: true }),
      new TableColumn({ name: 'notifyAdminWhenBudgetAtPercent', type: 'int', default: 80 }),
      new TableColumn({ name: 'allowAdminOverrideBudget', type: 'boolean', default: true }),
      new TableColumn({ name: 'aiBudgetPaused', type: 'boolean', default: false }),
      new TableColumn({ name: 'autoReplyPaused', type: 'boolean', default: false }),
      new TableColumn({ name: 'aiFeatureLimits', type: 'text', isNullable: true }),
      new TableColumn({ name: 'autoReplyContextMessagesMax', type: 'int', default: 12 }),
      new TableColumn({ name: 'includeCrmWhenNeeded', type: 'boolean', default: true }),
      new TableColumn({ name: 'includeKnowledgeWhenNeeded', type: 'boolean', default: true }),
      new TableColumn({ name: 'includeCatalogWhenNeeded', type: 'boolean', default: true }),
      new TableColumn({ name: 'includeMemoryWhenNeeded', type: 'boolean', default: true }),
      new TableColumn({ name: 'autoReplyCooldownSeconds', type: 'int', default: 60 }),
      new TableColumn({ name: 'ignoreDuplicateMessageIds', type: 'boolean', default: true }),
      new TableColumn({ name: 'ignorePromotionalMessages', type: 'boolean', default: true }),
      new TableColumn({ name: 'maxCustomerToolIterations', type: 'int', default: 2 }),
      new TableColumn({ name: 'maxAdminToolIterations', type: 'int', default: 5 }),
      new TableColumn({ name: 'maxAiCallsPerInboundMessage', type: 'int', default: 2 }),
    ];

    for (const col of configCols) {
      await queryRunner.addColumn('ai_config', col);
    }

    // Align context default to 8
    await queryRunner.query(`UPDATE ai_config SET autoReplyContextMessages = 8 WHERE id = 'default'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const dropCols = [
      'autoReplyModelTier',
      'inboxAssistantModelTier',
      'trainingModelTier',
      'adminAssistantModelTier',
      'autoReplyModelOverride',
      'inboxAssistantModelOverride',
      'trainingModelOverride',
      'adminAssistantModelOverride',
      'allowPremiumModelForAutoReply',
      'aiDailyBudgetUsd',
      'aiMonthlyBudgetUsd',
      'autoReplyDailyBudgetUsd',
      'stopAutoReplyWhenBudgetExceeded',
      'notifyAdminWhenBudgetAtPercent',
      'allowAdminOverrideBudget',
      'aiBudgetPaused',
      'autoReplyPaused',
      'aiFeatureLimits',
      'autoReplyContextMessagesMax',
      'includeCrmWhenNeeded',
      'includeKnowledgeWhenNeeded',
      'includeCatalogWhenNeeded',
      'includeMemoryWhenNeeded',
      'autoReplyCooldownSeconds',
      'ignoreDuplicateMessageIds',
      'ignorePromotionalMessages',
      'maxCustomerToolIterations',
      'maxAdminToolIterations',
      'maxAiCallsPerInboundMessage',
    ];
    for (const name of dropCols) {
      await queryRunner.dropColumn('ai_config', name);
    }
    await queryRunner.dropTable('ai_processed_inbound_messages');
    await queryRunner.dropTable('ai_model_pricing');
    await queryRunner.dropTable('ai_usage_logs');
  }
}
