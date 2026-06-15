import { migPrimaryUuidColumn, migDateTime, migNowDefault } from '../migration-utils';
import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AddAiLearningProductDemand1780890000000 implements MigrationInterface {
  name = 'AddAiLearningProductDemand1780890000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const dt = migDateTime(queryRunner);
    const now = migNowDefault(queryRunner);

    await queryRunner.createTable(
      new Table({
        name: 'ai_learning_items',
        columns: [
          migPrimaryUuidColumn(queryRunner),
          { name: 'conversationId', type: 'varchar', isNullable: true },
          { name: 'sessionId', type: 'varchar', isNullable: true },
          { name: 'chatId', type: 'varchar', isNullable: true },
          { name: 'customerId', type: 'varchar', isNullable: true },
          { name: 'customerName', type: 'varchar', isNullable: true },
          { name: 'customerPhone', type: 'varchar', isNullable: true },
          { name: 'branchId', type: 'varchar', isNullable: true },
          { name: 'question', type: 'text' },
          { name: 'normalizedQuestion', type: 'varchar', length: '512' },
          { name: 'detectedIntent', type: 'varchar', length: '64', isNullable: true },
          { name: 'detectedProduct', type: 'varchar', isNullable: true },
          { name: 'contextMessages', type: 'text', isNullable: true },
          { name: 'aiDraftAnswer', type: 'text', isNullable: true },
          { name: 'adminFinalAnswer', type: 'text', isNullable: true },
          { name: 'status', type: 'varchar', length: '32', default: "'pending_review'" },
          { name: 'confidenceScore', type: 'real', default: 0 },
          { name: 'whyUnsure', type: 'text', isNullable: true },
          { name: 'source', type: 'varchar', length: '32', default: "'auto_unknown'" },
          { name: 'timesAsked', type: 'int', default: 1 },
          { name: 'priority', type: 'varchar', length: '16', default: "'medium'" },
          { name: 'approvedBy', type: 'varchar', isNullable: true },
          { name: 'approvedAt', type: dt, isNullable: true },
          { name: 'targetFile', type: 'varchar', isNullable: true },
          { name: 'knowledgeCategory', type: 'varchar', isNullable: true },
          { name: 'tone', type: 'varchar', length: '32', isNullable: true },
          { name: 'reviewPeriodDays', type: 'int', isNullable: true },
          { name: 'reviewDate', type: dt, isNullable: true },
          { name: 'internalNote', type: 'text', isNullable: true },
          { name: 'similarGroupId', type: 'varchar', isNullable: true },
          { name: 'outcome', type: 'varchar', length: '32', isNullable: true },
          { name: 'mergedIntoId', type: 'varchar', isNullable: true },
          { name: 'reviewerId', type: 'varchar', isNullable: true },
          { name: 'createdAt', type: dt, default: now },
          { name: 'updatedAt', type: dt, default: now },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'ai_learning_items',
      new TableIndex({ name: 'IDX_ai_learning_items_status', columnNames: ['status', 'createdAt'] }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'ai_learning_knowledge',
        columns: [
          migPrimaryUuidColumn(queryRunner),
          { name: 'questionPattern', type: 'text' },
          { name: 'alternativeQuestions', type: 'text', isNullable: true },
          { name: 'approvedAnswer', type: 'text' },
          { name: 'category', type: 'varchar', isNullable: true },
          { name: 'targetFile', type: 'varchar', isNullable: true },
          { name: 'approvedBy', type: 'varchar', isNullable: true },
          { name: 'approvedAt', type: dt, isNullable: true },
          { name: 'timesUsed', type: 'int', default: 0 },
          { name: 'successRate', type: 'real', isNullable: true },
          { name: 'reviewDate', type: dt, isNullable: true },
          { name: 'status', type: 'varchar', length: '32', default: "'active'" },
          { name: 'sourceItemId', type: 'varchar', isNullable: true },
          { name: 'sessionId', type: 'varchar', isNullable: true },
          { name: 'chatId', type: 'varchar', isNullable: true },
          { name: 'internalNotes', type: 'text', isNullable: true },
          { name: 'lastEditedBy', type: 'varchar', isNullable: true },
          { name: 'lastUsedAt', type: dt, isNullable: true },
          { name: 'createdAt', type: dt, default: now },
          { name: 'updatedAt', type: dt, default: now },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'ai_learning_settings',
        columns: [
          { name: 'id', type: 'varchar', isPrimary: true, default: "'default'" },
          { name: 'enableLearningDetection', type: 'boolean', default: true },
          { name: 'requireAdminApproval', type: 'boolean', default: true },
          { name: 'autoCreatePendingQuestion', type: 'boolean', default: true },
          { name: 'autoSuggestDraftAnswer', type: 'boolean', default: true },
          { name: 'groupSimilarQuestions', type: 'boolean', default: true },
          { name: 'trackRepeatedQuestions', type: 'boolean', default: true },
          { name: 'trackStaffCorrections', type: 'boolean', default: true },
          { name: 'trackCustomerOutcome', type: 'boolean', default: true },
          { name: 'highConfidenceThreshold', type: 'real', default: 0.8 },
          { name: 'mediumConfidenceThreshold', type: 'real', default: 0.5 },
          { name: 'defaultUnknownReply', type: 'text', default: "'Nipe muda kidogo Boss, nikuthibitishie vizuri nitakurudia 😊'" },
          { name: 'trackProductMentions', type: 'boolean', default: true },
          { name: 'trackVariants', type: 'boolean', default: true },
          { name: 'trackUnmatchedProducts', type: 'boolean', default: true },
          { name: 'trackOutOfStockDemand', type: 'boolean', default: true },
          { name: 'trackInstallmentDemand', type: 'boolean', default: true },
          { name: 'trackDiscountPressure', type: 'boolean', default: true },
          { name: 'trackPaymentReadyDemand', type: 'boolean', default: true },
          { name: 'trackCategoryDemand', type: 'boolean', default: true },
          { name: 'trackBrandDemand', type: 'boolean', default: true },
          { name: 'allowedTargetFiles', type: 'text', isNullable: true },
          { name: 'ignoredIntents', type: 'text', isNullable: true },
          { name: 'riskyCategories', type: 'text', isNullable: true },
          { name: 'updatedAt', type: dt, default: now },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'product_demand_events',
        columns: [
          migPrimaryUuidColumn(queryRunner),
          { name: 'conversationId', type: 'varchar', isNullable: true },
          { name: 'sessionId', type: 'varchar', isNullable: true },
          { name: 'chatId', type: 'varchar', isNullable: true },
          { name: 'customerId', type: 'varchar', isNullable: true },
          { name: 'branchId', type: 'varchar', isNullable: true },
          { name: 'messageId', type: 'varchar', isNullable: true },
          { name: 'rawMessage', type: 'text', isNullable: true },
          { name: 'detectedProductName', type: 'varchar' },
          { name: 'matchedProductId', type: 'varchar', isNullable: true },
          { name: 'matchedVariantId', type: 'varchar', isNullable: true },
          { name: 'category', type: 'varchar', isNullable: true },
          { name: 'brand', type: 'varchar', isNullable: true },
          { name: 'intent', type: 'varchar', length: '64', default: "'general'" },
          { name: 'confidenceScore', type: 'real', default: 0 },
          { name: 'stockStatusInternal', type: 'varchar', isNullable: true },
          { name: 'priceMentioned', type: 'real', isNullable: true },
          { name: 'customerBudget', type: 'real', isNullable: true },
          { name: 'customerOffer', type: 'real', isNullable: true },
          { name: 'createdAt', type: dt, default: now },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'product_demand_summary',
        columns: [
          migPrimaryUuidColumn(queryRunner),
          { name: 'branchId', type: 'varchar', isNullable: true },
          { name: 'productId', type: 'varchar', isNullable: true },
          { name: 'variantId', type: 'varchar', isNullable: true },
          { name: 'detectedProductName', type: 'varchar', isNullable: true },
          { name: 'category', type: 'varchar', isNullable: true },
          { name: 'brand', type: 'varchar', isNullable: true },
          { name: 'period', type: 'varchar', length: '16', default: "'week'" },
          { name: 'requestCount', type: 'int', default: 0 },
          { name: 'uniqueCustomers', type: 'int', default: 0 },
          { name: 'priceRequests', type: 'int', default: 0 },
          { name: 'availabilityRequests', type: 'int', default: 0 },
          { name: 'installmentRequests', type: 'int', default: 0 },
          { name: 'discountRequests', type: 'int', default: 0 },
          { name: 'paymentReadyCount', type: 'int', default: 0 },
          { name: 'outOfStockCount', type: 'int', default: 0 },
          { name: 'lastAskedAt', type: dt, isNullable: true },
          { name: 'recommendedAction', type: 'varchar', isNullable: true },
          { name: 'trend', type: 'varchar', length: '16', default: "'stable'" },
          { name: 'markedImportant', type: 'boolean', default: false },
          { name: 'createdAt', type: dt, default: now },
          { name: 'updatedAt', type: dt, default: now },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'product_aliases',
        columns: [
          migPrimaryUuidColumn(queryRunner),
          { name: 'aliasText', type: 'varchar' },
          { name: 'productId', type: 'varchar' },
          { name: 'variantId', type: 'varchar', isNullable: true },
          { name: 'category', type: 'varchar', isNullable: true },
          { name: 'brand', type: 'varchar', isNullable: true },
          { name: 'confidenceScore', type: 'real', default: 0.8 },
          { name: 'createdBy', type: 'varchar', isNullable: true },
          { name: 'createdAt', type: dt, default: now },
          { name: 'updatedAt', type: dt, default: now },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'missing_product_requests',
        columns: [
          migPrimaryUuidColumn(queryRunner),
          { name: 'rawProductName', type: 'varchar' },
          { name: 'possibleCategory', type: 'varchar', isNullable: true },
          { name: 'brand', type: 'varchar', isNullable: true },
          { name: 'timesAsked', type: 'int', default: 1 },
          { name: 'uniqueCustomers', type: 'int', default: 1 },
          { name: 'branchId', type: 'varchar', isNullable: true },
          { name: 'suggestedProductId', type: 'varchar', isNullable: true },
          { name: 'confidenceScore', type: 'real', isNullable: true },
          { name: 'status', type: 'varchar', length: '32', default: "'unmatched'" },
          { name: 'exampleMessages', type: 'text', isNullable: true },
          { name: 'customerIds', type: 'text', isNullable: true },
          { name: 'createdAt', type: dt, default: now },
          { name: 'updatedAt', type: dt, default: now },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'product_demand_recommendations',
        columns: [
          migPrimaryUuidColumn(queryRunner),
          { name: 'title', type: 'varchar' },
          { name: 'reason', type: 'text' },
          { name: 'dataProof', type: 'text', isNullable: true },
          { name: 'expectedImpact', type: 'text', isNullable: true },
          { name: 'priority', type: 'varchar', length: '16', default: "'medium'" },
          { name: 'suggestedAction', type: 'varchar', isNullable: true },
          { name: 'productIds', type: 'text', isNullable: true },
          { name: 'productNames', type: 'text', isNullable: true },
          { name: 'customersAffected', type: 'int', default: 0 },
          { name: 'branchId', type: 'varchar', isNullable: true },
          { name: 'status', type: 'varchar', length: '32', default: "'open'" },
          { name: 'summaryId', type: 'varchar', isNullable: true },
          { name: 'createdAt', type: dt, default: now },
          { name: 'updatedAt', type: dt, default: now },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      'product_demand_recommendations',
      'missing_product_requests',
      'product_aliases',
      'product_demand_summary',
      'product_demand_events',
      'ai_learning_settings',
      'ai_learning_knowledge',
      'ai_learning_items',
    ]) {
      await queryRunner.dropTable(table, true);
    }
  }
}
