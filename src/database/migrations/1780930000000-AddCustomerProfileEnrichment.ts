import { migPrimaryUuidColumn, migDateTime, migNowDefault } from '../migration-utils';
import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AddCustomerProfileEnrichment1780930000000 implements MigrationInterface {
  name = 'AddCustomerProfileEnrichment1780930000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const dt = migDateTime(queryRunner);
    const now = migNowDefault(queryRunner);

    await queryRunner.createTable(
      new Table({
        name: 'customer_profile_enrichment',
        columns: [
          migPrimaryUuidColumn(queryRunner),
          { name: 'sessionId', type: 'varchar' },
          { name: 'chatId', type: 'varchar' },
          { name: 'preferredName', type: 'varchar', isNullable: true },
          { name: 'fullName', type: 'varchar', isNullable: true },
          { name: 'nameConfidenceScore', type: 'real', isNullable: true },
          { name: 'nameSourceMessageId', type: 'varchar', isNullable: true },
          { name: 'nameSourceConversationId', type: 'varchar', isNullable: true },
          { name: 'nameLastConfirmedAt', type: dt, isNullable: true },
          { name: 'nameNeedsReview', type: 'boolean', default: false },
          { name: 'lastProfileQuestionAsked', type: 'varchar', length: '64', isNullable: true },
          { name: 'lastProfileQuestionAskedAt', type: dt, isNullable: true },
          { name: 'profileCompleteness', type: 'real', isNullable: true },
          { name: 'wantedProduct', type: 'varchar', isNullable: true },
          { name: 'wantedVariant', type: 'varchar', isNullable: true },
          { name: 'budgetRange', type: 'varchar', isNullable: true },
          { name: 'customerUseCase', type: 'varchar', isNullable: true },
          { name: 'deliveryPreference', type: 'varchar', isNullable: true },
          { name: 'paymentPreference', type: 'varchar', isNullable: true },
          { name: 'notifyWhenAvailable', type: 'boolean', default: false },
          { name: 'conversationFlow', type: 'varchar', length: '64', default: "'idle'" },
          { name: 'lastProfileUpdatedByAiAt', type: dt, isNullable: true },
          { name: 'aiProfileNotes', type: 'text', isNullable: true },
          { name: 'profileLearningPaused', type: 'boolean', default: false },
          { name: 'createdAt', type: dt, default: now },
          { name: 'updatedAt', type: dt, default: now },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'customer_profile_enrichment',
      new TableIndex({
        name: 'IDX_customer_profile_enrichment_session_chat',
        columnNames: ['sessionId', 'chatId'],
        isUnique: true,
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'customer_profile_learning_events',
        columns: [
          migPrimaryUuidColumn(queryRunner),
          { name: 'sessionId', type: 'varchar' },
          { name: 'chatId', type: 'varchar' },
          { name: 'conversationId', type: 'varchar', isNullable: true },
          { name: 'messageId', type: 'varchar', isNullable: true },
          { name: 'fieldName', type: 'varchar' },
          { name: 'oldValue', type: 'text', isNullable: true },
          { name: 'newValue', type: 'text', isNullable: true },
          { name: 'confidenceScore', type: 'real', isNullable: true },
          { name: 'source', type: 'varchar', length: '64', isNullable: true },
          { name: 'status', type: 'varchar', length: '32', default: "'auto_saved'" },
          { name: 'createdByAi', type: 'boolean', default: true },
          { name: 'reviewedBy', type: 'varchar', isNullable: true },
          { name: 'reviewedAt', type: dt, isNullable: true },
          { name: 'createdAt', type: dt, default: now },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'lost_demand_followups',
        columns: [
          migPrimaryUuidColumn(queryRunner),
          { name: 'sessionId', type: 'varchar' },
          { name: 'chatId', type: 'varchar' },
          { name: 'conversationId', type: 'varchar', isNullable: true },
          { name: 'branchId', type: 'varchar', isNullable: true },
          { name: 'wantedProduct', type: 'varchar' },
          { name: 'wantedVariant', type: 'varchar', isNullable: true },
          { name: 'matchedProductId', type: 'varchar', isNullable: true },
          { name: 'matchedVariantId', type: 'varchar', isNullable: true },
          { name: 'reason', type: 'varchar', length: '64', default: "'product_unavailable'" },
          { name: 'alternativeOffered', type: 'boolean', default: false },
          { name: 'alternativeAccepted', type: 'boolean', isNullable: true },
          { name: 'notifyWhenAvailable', type: 'boolean', default: false },
          { name: 'customerNameAtTime', type: 'varchar', isNullable: true },
          { name: 'customerPhone', type: 'varchar', isNullable: true },
          { name: 'priority', type: 'varchar', length: '16', default: "'normal'" },
          { name: 'status', type: 'varchar', length: '32', default: "'open'" },
          { name: 'followUpDate', type: dt, isNullable: true },
          { name: 'createdAt', type: dt, default: now },
          { name: 'updatedAt', type: dt, default: now },
        ],
      }),
      true,
    );

    const aiConfigTable = await queryRunner.getTable('ai_config');
    if (aiConfigTable) {
      const addCol = async (name: string, sql: string) => {
        if (!aiConfigTable.findColumnByName(name)) {
          await queryRunner.query(`ALTER TABLE ai_config ADD COLUMN "${name}" ${sql}`);
        }
      };
      await addCol('progressiveProfilingEnabled', 'boolean DEFAULT true');
      await addCol('profilingMaxQuestionsPerReply', 'integer DEFAULT 1');
      await addCol('profilingAutoSaveHighConfidenceNames', 'boolean DEFAULT true');
      await addCol('profilingRequireReviewMediumConfidence', 'boolean DEFAULT true');
      await addCol('profilingDetectNameCorrections', 'boolean DEFAULT true');
      await addCol('profilingSilentSaveFields', 'boolean DEFAULT true');
      await addCol('profilingCreateLostDemandFollowups', 'boolean DEFAULT true');
      await addCol('profilingAskNameImmediately', 'boolean DEFAULT false');
      await addCol('profilingDisabledInGroups', 'boolean DEFAULT true');
      await addCol('profilingHighConfidenceThreshold', 'real DEFAULT 0.9');
      await addCol('profilingMediumConfidenceThreshold', 'real DEFAULT 0.6');
      await addCol('profilingNameSaveReplyTemplate', 'text');
      await addCol('profilingNameCorrectionReply', 'text');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('lost_demand_followups', true);
    await queryRunner.dropTable('customer_profile_learning_events', true);
    await queryRunner.dropTable('customer_profile_enrichment', true);
  }
}
