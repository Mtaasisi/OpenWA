import { MigrationInterface, QueryRunner, Table, TableColumn, TableIndex } from 'typeorm';
import { migDateTime, migNowDefault, migPrimaryUuidColumn } from '../migration-utils';

export class AddAiCostOptimizationPhase21811160000000 implements MigrationInterface {
  name = 'AddAiCostOptimizationPhase21811160000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const dt = migDateTime(queryRunner);
    const now = migNowDefault(queryRunner);

    const usageCols: TableColumn[] = [
      new TableColumn({ name: 'modelTier', type: 'varchar', length: '16', isNullable: true }),
      new TableColumn({ name: 'contactId', type: 'varchar', isNullable: true }),
      new TableColumn({ name: 'batchId', type: 'varchar', isNullable: true }),
    ];
    for (const col of usageCols) {
      const has = await queryRunner.hasColumn('ai_usage_logs', col.name);
      if (!has) await queryRunner.addColumn('ai_usage_logs', col);
    }

    const usageIndexes = [
      { name: 'IDX_ai_usage_logs_modelTier', columns: ['modelTier'] },
      { name: 'IDX_ai_usage_logs_status', columns: ['status'] },
      { name: 'IDX_ai_usage_logs_batchId', columns: ['batchId'] },
      { name: 'IDX_ai_usage_logs_contactId', columns: ['contactId'] },
    ];
    for (const idx of usageIndexes) {
      const table = await queryRunner.getTable('ai_usage_logs');
      if (!table?.indices.some(i => i.name === idx.name)) {
        await queryRunner.createIndex(
          'ai_usage_logs',
          new TableIndex({ name: idx.name, columnNames: idx.columns }),
        );
      }
    }

    await queryRunner.createTable(
      new Table({
        name: 'ai_learned_intents',
        columns: [
          migPrimaryUuidColumn(queryRunner),
          { name: 'workspaceId', type: 'varchar', isNullable: true },
          { name: 'branchId', type: 'varchar', isNullable: true },
          { name: 'phrase', type: 'text', isNullable: false },
          { name: 'normalizedPhrase', type: 'text', isNullable: false },
          { name: 'language', type: 'varchar', default: "'sw'" },
          { name: 'intent', type: 'varchar', isNullable: false },
          { name: 'meaning', type: 'text', isNullable: true },
          { name: 'confidence', type: 'decimal', precision: 5, scale: 2, default: 0 },
          { name: 'replyTemplateId', type: 'varchar', isNullable: true },
          { name: 'suggestedReply', type: 'text', isNullable: true },
          { name: 'replyVariations', type: 'text', isNullable: true },
          { name: 'matchType', type: 'varchar', default: "'exact'" },
          { name: 'status', type: 'varchar', default: "'active'" },
          { name: 'autoApproved', type: 'boolean', default: false },
          { name: 'usageCount', type: 'int', default: 0 },
          { name: 'lastUsedAt', type: dt, isNullable: true },
          { name: 'createdFromMessageId', type: 'varchar', isNullable: true },
          { name: 'createdFromConversationId', type: 'varchar', isNullable: true },
          { name: 'approvedBy', type: 'varchar', isNullable: true },
          { name: 'approvedAt', type: dt, isNullable: true },
          { name: 'metadata', type: 'text', isNullable: true },
          { name: 'createdAt', type: dt, default: now },
          { name: 'updatedAt', type: dt, default: now },
        ],
      }),
      true,
    );

    for (const idx of [
      ['IDX_ai_learned_intents_normalizedPhrase', ['normalizedPhrase']],
      ['IDX_ai_learned_intents_intent', ['intent']],
      ['IDX_ai_learned_intents_status', ['status']],
      ['IDX_ai_learned_intents_branchId', ['branchId']],
      ['IDX_ai_learned_intents_usageCount', ['usageCount']],
      ['IDX_ai_learned_intents_lastUsedAt', ['lastUsedAt']],
    ] as Array<[string, string[]]>) {
      await queryRunner.createIndex(
        'ai_learned_intents',
        new TableIndex({ name: idx[0], columnNames: idx[1] }),
      );
    }

    await queryRunner.createTable(
      new Table({
        name: 'ai_unknown_messages',
        columns: [
          migPrimaryUuidColumn(queryRunner),
          { name: 'workspaceId', type: 'varchar', isNullable: true },
          { name: 'branchId', type: 'varchar', isNullable: true },
          { name: 'conversationId', type: 'varchar', isNullable: true },
          { name: 'contactId', type: 'varchar', isNullable: true },
          { name: 'customerId', type: 'varchar', isNullable: true },
          { name: 'messageId', type: 'varchar', isNullable: true },
          { name: 'rawText', type: 'text', isNullable: false },
          { name: 'normalizedText', type: 'text', isNullable: true },
          { name: 'detectedIntent', type: 'varchar', isNullable: true },
          { name: 'aiSuggestedMeaning', type: 'text', isNullable: true },
          { name: 'aiSuggestedReply', type: 'text', isNullable: true },
          { name: 'confidence', type: 'decimal', precision: 5, scale: 2, default: 0 },
          { name: 'frequencyCount', type: 'int', default: 1 },
          { name: 'status', type: 'varchar', default: "'pending_review'" },
          { name: 'reviewedBy', type: 'varchar', isNullable: true },
          { name: 'reviewedAt', type: dt, isNullable: true },
          { name: 'metadata', type: 'text', isNullable: true },
          { name: 'createdAt', type: dt, default: now },
          { name: 'updatedAt', type: dt, default: now },
        ],
      }),
      true,
    );

    for (const idx of [
      ['IDX_ai_unknown_messages_normalizedText', ['normalizedText']],
      ['IDX_ai_unknown_messages_frequencyCount', ['frequencyCount']],
      ['IDX_ai_unknown_messages_status', ['status']],
      ['IDX_ai_unknown_messages_branchId', ['branchId']],
    ] as Array<[string, string[]]>) {
      await queryRunner.createIndex(
        'ai_unknown_messages',
        new TableIndex({ name: idx[0], columnNames: idx[1] }),
      );
    }

    await queryRunner.createTable(
      new Table({
        name: 'ai_message_buffers',
        columns: [
          migPrimaryUuidColumn(queryRunner),
          { name: 'workspaceId', type: 'varchar', isNullable: true },
          { name: 'branchId', type: 'varchar', isNullable: true },
          { name: 'conversationId', type: 'varchar', isNullable: false },
          { name: 'contactId', type: 'varchar', isNullable: true },
          { name: 'customerId', type: 'varchar', isNullable: true },
          { name: 'status', type: 'varchar', default: "'pending'" },
          { name: 'batchId', type: 'varchar', isNullable: false },
          { name: 'messageIds', type: 'text', isNullable: true },
          { name: 'rawMessages', type: 'text', isNullable: true },
          { name: 'combinedText', type: 'text', isNullable: true },
          { name: 'normalizedCombinedText', type: 'text', isNullable: true },
          { name: 'firstMessageAt', type: dt, isNullable: false },
          { name: 'lastMessageAt', type: dt, isNullable: false },
          { name: 'scheduledProcessAt', type: dt, isNullable: false },
          { name: 'processedAt', type: dt, isNullable: true },
          { name: 'replyMessageId', type: 'varchar', isNullable: true },
          { name: 'aiUsageLogId', type: 'varchar', isNullable: true },
          { name: 'metadata', type: 'text', isNullable: true },
          { name: 'createdAt', type: dt, default: now },
          { name: 'updatedAt', type: dt, isNullable: true },
        ],
      }),
      true,
    );

    for (const idx of [
      ['IDX_ai_message_buffers_conversationId', ['conversationId']],
      ['IDX_ai_message_buffers_batchId', ['batchId']],
      ['IDX_ai_message_buffers_status', ['status']],
      ['IDX_ai_message_buffers_scheduledProcessAt', ['scheduledProcessAt']],
    ] as Array<[string, string[]]>) {
      await queryRunner.createIndex(
        'ai_message_buffers',
        new TableIndex({ name: idx[0], columnNames: idx[1] }),
      );
    }

    await queryRunner.createTable(
      new Table({
        name: 'ai_conversation_facts',
        columns: [
          migPrimaryUuidColumn(queryRunner),
          { name: 'workspaceId', type: 'varchar', isNullable: true },
          { name: 'branchId', type: 'varchar', isNullable: true },
          { name: 'conversationId', type: 'varchar', isNullable: false },
          { name: 'contactId', type: 'varchar', isNullable: true },
          { name: 'customerId', type: 'varchar', isNullable: true },
          { name: 'factType', type: 'varchar', isNullable: false },
          { name: 'factKey', type: 'varchar', isNullable: false },
          { name: 'factValue', type: 'text', isNullable: false },
          { name: 'confidence', type: 'decimal', precision: 5, scale: 2, default: 0 },
          { name: 'sourceMessageId', type: 'varchar', isNullable: true },
          { name: 'expiresAt', type: dt, isNullable: true },
          { name: 'metadata', type: 'text', isNullable: true },
          { name: 'createdAt', type: dt, default: now },
          { name: 'updatedAt', type: dt, default: now },
        ],
      }),
      true,
    );

    for (const idx of [
      ['IDX_ai_conversation_facts_conversationId', ['conversationId']],
      ['IDX_ai_conversation_facts_factType', ['factType']],
      ['IDX_ai_conversation_facts_factKey', ['factKey']],
    ] as Array<[string, string[]]>) {
      await queryRunner.createIndex(
        'ai_conversation_facts',
        new TableIndex({ name: idx[0], columnNames: idx[1] }),
      );
    }

    const configCols: TableColumn[] = [
      new TableColumn({ name: 'messageBufferEnabled', type: 'boolean', default: true }),
      new TableColumn({ name: 'messageBufferDebounceSeconds', type: 'int', default: 10 }),
      new TableColumn({ name: 'messageBufferMaxWaitSeconds', type: 'int', default: 30 }),
      new TableColumn({ name: 'messageBufferMaxMessages', type: 'int', default: 10 }),
      new TableColumn({ name: 'messageBufferMaxCharacters', type: 'int', default: 4000 }),
      new TableColumn({ name: 'oneReplyPerMessageBurst', type: 'boolean', default: true }),
      new TableColumn({ name: 'learnedReplyCacheEnabled', type: 'boolean', default: true }),
      new TableColumn({ name: 'autoLearnSafeIntents', type: 'boolean', default: true }),
      new TableColumn({ name: 'autoApproveConfidenceThreshold', type: 'int', default: 90 }),
      new TableColumn({ name: 'pendingReviewThreshold', type: 'int', default: 60 }),
      new TableColumn({ name: 'disableLearningForSensitive', type: 'boolean', default: true }),
      new TableColumn({ name: 'replyVariationRotation', type: 'boolean', default: true }),
      new TableColumn({ name: 'ignoreGroupMessages', type: 'boolean', default: true }),
      new TableColumn({ name: 'ignoreSelfMessages', type: 'boolean', default: true }),
      new TableColumn({ name: 'autoReplyPromptBudgetTokens', type: 'int', default: 1500 }),
      new TableColumn({ name: 'autoReplySimplePromptBudgetTokens', type: 'int', default: 500 }),
      new TableColumn({ name: 'knowledgeMaxChunks', type: 'int', default: 2 }),
      new TableColumn({ name: 'knowledgeMaxCharsPerChunk', type: 'int', default: 600 }),
      new TableColumn({ name: 'knowledgeMaxTotalChars', type: 'int', default: 1200 }),
    ];

    for (const col of configCols) {
      const has = await queryRunner.hasColumn('ai_config', col.name);
      if (!has) await queryRunner.addColumn('ai_config', col);
    }

    await queryRunner.query(
      `UPDATE ai_config SET "autoReplyContextMessages" = 3 WHERE id = 'default' AND "autoReplyContextMessages" > 5`,
    );
    await queryRunner.query(
      `UPDATE ai_config SET "autoReplyContextMessagesMax" = 5 WHERE id = 'default' AND "autoReplyContextMessagesMax" > 5`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const dropCols = [
      'messageBufferEnabled',
      'messageBufferDebounceSeconds',
      'messageBufferMaxWaitSeconds',
      'messageBufferMaxMessages',
      'messageBufferMaxCharacters',
      'oneReplyPerMessageBurst',
      'learnedReplyCacheEnabled',
      'autoLearnSafeIntents',
      'autoApproveConfidenceThreshold',
      'pendingReviewThreshold',
      'disableLearningForSensitive',
      'replyVariationRotation',
      'ignoreGroupMessages',
      'ignoreSelfMessages',
      'autoReplyPromptBudgetTokens',
      'autoReplySimplePromptBudgetTokens',
      'knowledgeMaxChunks',
      'knowledgeMaxCharsPerChunk',
      'knowledgeMaxTotalChars',
    ];
    for (const name of dropCols) {
      const has = await queryRunner.hasColumn('ai_config', name);
      if (has) await queryRunner.dropColumn('ai_config', name);
    }

    await queryRunner.dropTable('ai_conversation_facts', true);
    await queryRunner.dropTable('ai_message_buffers', true);
    await queryRunner.dropTable('ai_unknown_messages', true);
    await queryRunner.dropTable('ai_learned_intents', true);

    for (const col of ['modelTier', 'contactId', 'batchId']) {
      const has = await queryRunner.hasColumn('ai_usage_logs', col);
      if (has) await queryRunner.dropColumn('ai_usage_logs', col);
    }
  }
}
