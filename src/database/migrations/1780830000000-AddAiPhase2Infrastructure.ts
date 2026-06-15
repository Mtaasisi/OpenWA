import { migPrimaryUuidColumn, migDateTime, migNowDefault } from '../migration-utils';
import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AddAiPhase2Infrastructure1780830000000 implements MigrationInterface {
  name = 'AddAiPhase2Infrastructure1780830000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'branch_ai_profiles',
        columns: [
          migPrimaryUuidColumn(queryRunner),
          { name: 'branchId', type: 'varchar', isUnique: true },
          { name: 'businessName', type: 'varchar', isNullable: true },
          { name: 'branchName', type: 'varchar', isNullable: true },
          { name: 'aiDisplayName', type: 'varchar', isNullable: true },
          { name: 'locationDescription', type: 'text', isNullable: true },
          { name: 'googleMapsUrl', type: 'varchar', isNullable: true },
          { name: 'nearbyLandmarks', type: 'text', isNullable: true },
          { name: 'openingHours', type: 'text', isNullable: true },
          { name: 'phoneNumbers', type: 'text', isNullable: true },
          { name: 'deliveryPolicy', type: 'text', isNullable: true },
          { name: 'warrantyPolicy', type: 'text', isNullable: true },
          { name: 'installmentPolicyDefault', type: 'text', isNullable: true },
          { name: 'aiTone', type: 'varchar', length: '64', default: "'boss_friendly_mtaani'" },
          { name: 'createdAt', type: migDateTime(queryRunner), default: migNowDefault(queryRunner) },
          { name: 'updatedAt', type: migDateTime(queryRunner), default: migNowDefault(queryRunner) },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'branch_payment_accounts',
        columns: [
          migPrimaryUuidColumn(queryRunner),
          { name: 'branchId', type: 'varchar' },
          { name: 'methodType', type: 'varchar', length: '32', default: "'mobile_money'" },
          { name: 'providerName', type: 'varchar', isNullable: true },
          { name: 'accountName', type: 'varchar', isNullable: true },
          { name: 'accountNumber', type: 'varchar', isNullable: true },
          { name: 'instructions', type: 'text', isNullable: true },
          { name: 'isActive', type: 'boolean', default: true },
          { name: 'isDefault', type: 'boolean', default: false },
          { name: 'createdAt', type: migDateTime(queryRunner), default: migNowDefault(queryRunner) },
          { name: 'updatedAt', type: migDateTime(queryRunner), default: migNowDefault(queryRunner) },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'branch_payment_accounts',
      new TableIndex({ name: 'IDX_branch_payment_accounts_branch_active', columnNames: ['branchId', 'isActive'] }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'ai_escalations',
        columns: [
          migPrimaryUuidColumn(queryRunner),
          { name: 'sessionId', type: 'varchar' },
          { name: 'chatId', type: 'varchar' },
          { name: 'reason', type: 'varchar', length: '64' },
          { name: 'detail', type: 'text', isNullable: true },
          { name: 'status', type: 'varchar', length: '32', default: "'open'" },
          { name: 'assignedStaffId', type: 'varchar', isNullable: true },
          { name: 'branchId', type: 'varchar', isNullable: true },
          { name: 'resolvedAt', type: migDateTime(queryRunner), isNullable: true },
          { name: 'createdAt', type: migDateTime(queryRunner), default: migNowDefault(queryRunner) },
          { name: 'updatedAt', type: migDateTime(queryRunner), default: migNowDefault(queryRunner) },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'ai_escalations',
      new TableIndex({ name: 'IDX_ai_escalations_thread', columnNames: ['sessionId', 'chatId'] }),
    );
    await queryRunner.createIndex(
      'ai_escalations',
      new TableIndex({ name: 'IDX_ai_escalations_status', columnNames: ['status', 'createdAt'] }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'stocking_reminders',
        columns: [
          migPrimaryUuidColumn(queryRunner),
          { name: 'productId', type: 'varchar', isNullable: true },
          { name: 'variantId', type: 'varchar', isNullable: true },
          { name: 'productName', type: 'varchar', isNullable: true },
          { name: 'sessionId', type: 'varchar', isNullable: true },
          { name: 'chatId', type: 'varchar', isNullable: true },
          { name: 'branchId', type: 'varchar', isNullable: true },
          { name: 'note', type: 'text', isNullable: true },
          { name: 'status', type: 'varchar', length: '32', default: "'open'" },
          { name: 'assignedStaffId', type: 'varchar', isNullable: true },
          { name: 'createdAt', type: migDateTime(queryRunner), default: migNowDefault(queryRunner) },
          { name: 'updatedAt', type: migDateTime(queryRunner), default: migNowDefault(queryRunner) },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'stocking_reminders',
      new TableIndex({ name: 'IDX_stocking_reminders_status', columnNames: ['status', 'createdAt'] }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'ai_reply_events',
        columns: [
          migPrimaryUuidColumn(queryRunner),
          { name: 'sessionId', type: 'varchar' },
          { name: 'chatId', type: 'varchar' },
          { name: 'signalType', type: 'varchar', length: '64', isNullable: true },
          { name: 'detectedIntent', type: 'varchar', length: '64', isNullable: true },
          { name: 'incomingText', type: 'text', isNullable: true },
          { name: 'replyText', type: 'text', isNullable: true },
          { name: 'escalated', type: 'boolean', default: false },
          { name: 'branchId', type: 'varchar', isNullable: true },
          { name: 'productId', type: 'varchar', isNullable: true },
          { name: 'createdAt', type: migDateTime(queryRunner), default: migNowDefault(queryRunner) },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'ai_reply_events',
      new TableIndex({ name: 'IDX_ai_reply_events_thread', columnNames: ['sessionId', 'chatId', 'createdAt'] }),
    );
    await queryRunner.createIndex(
      'ai_reply_events',
      new TableIndex({ name: 'IDX_ai_reply_events_signal', columnNames: ['signalType', 'createdAt'] }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'ai_learning_imports',
        columns: [
          migPrimaryUuidColumn(queryRunner),
          { name: 'sourceName', type: 'varchar' },
          { name: 'status', type: 'varchar', length: '32', default: "'pending'" },
          { name: 'totalRows', type: 'int', default: 0 },
          { name: 'importedRows', type: 'int', default: 0 },
          { name: 'questionCount', type: 'int', default: 0 },
          { name: 'topQuestions', type: 'text', isNullable: true },
          { name: 'errorMessage', type: 'text', isNullable: true },
          { name: 'createdAt', type: migDateTime(queryRunner), default: migNowDefault(queryRunner) },
          { name: 'updatedAt', type: migDateTime(queryRunner), default: migNowDefault(queryRunner) },
        ],
      }),
      true,
    );

    const productInstallmentCols = [
      { name: 'installmentEnabled', type: 'boolean', default: false },
      { name: 'installmentMinDeposit', type: 'real', isNullable: true },
      { name: 'installmentDurationDays', type: 'int', isNullable: true },
      { name: 'installmentScheduleType', type: 'varchar', isNullable: true },
      { name: 'installmentPolicy', type: 'text', isNullable: true },
      { name: 'installmentPenaltyPolicy', type: 'text', isNullable: true },
      { name: 'installmentExpiryDays', type: 'int', isNullable: true },
      { name: 'installmentRequiresApproval', type: 'boolean', default: false },
      { name: 'allowInstallmentWhenOutOfStock', type: 'boolean', default: false },
      { name: 'stockingReminderEnabled', type: 'boolean', default: false },
      { name: 'installmentNotes', type: 'text', isNullable: true },
    ];
    for (const col of productInstallmentCols) {
      await queryRunner.query(
        `ALTER TABLE "crm_products" ADD COLUMN "${col.name}" ${col.type}${col.default !== undefined ? ` DEFAULT ${col.default}` : ''}${col.isNullable ? '' : ' NOT NULL'}`,
      );
      await queryRunner.query(
        `ALTER TABLE "crm_product_variants" ADD COLUMN "${col.name}" ${col.type}${col.default !== undefined ? ` DEFAULT ${col.default}` : ''}${col.isNullable ? '' : ' NOT NULL'}`,
      );
    }

    const crmCols = [
      { name: 'preferredBranchId', type: 'varchar', isNullable: true },
      { name: 'inferredCity', type: 'varchar', isNullable: true },
      { name: 'confirmedCity', type: 'varchar', isNullable: true },
      { name: 'locationConfidence', type: 'real', isNullable: true },
      { name: 'lastLocationConfirmedAt', type: migDateTime(queryRunner), isNullable: true },
      { name: 'lastProductInterest', type: 'varchar', isNullable: true },
      { name: 'lastIntent', type: 'varchar', length: '64', isNullable: true },
      { name: 'discountRequestCount', type: 'int', default: 0 },
      { name: 'installmentInterest', type: 'boolean', default: false },
      { name: 'paymentReadiness', type: 'varchar', length: '32', isNullable: true },
      { name: 'aiNotes', type: 'text', isNullable: true },
      { name: 'autopilotPauseReason', type: 'varchar', isNullable: true },
    ];
    for (const col of crmCols) {
      const nullable = col.isNullable ? '' : ' NOT NULL';
      const defaultClause =
        col.default !== undefined ? ` DEFAULT ${col.default}` : col.isNullable ? '' : '';
      await queryRunner.query(
        `ALTER TABLE "inbox_thread_crm" ADD COLUMN "${col.name}" ${col.type}${defaultClause}${nullable}`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const crmCols = [
      'preferredBranchId',
      'inferredCity',
      'confirmedCity',
      'locationConfidence',
      'lastLocationConfirmedAt',
      'lastProductInterest',
      'lastIntent',
      'discountRequestCount',
      'installmentInterest',
      'paymentReadiness',
      'aiNotes',
      'autopilotPauseReason',
    ];
    for (const col of crmCols) {
      await queryRunner.query(`ALTER TABLE "inbox_thread_crm" DROP COLUMN "${col}"`);
    }

    const installmentCols = [
      'installmentEnabled',
      'installmentMinDeposit',
      'installmentDurationDays',
      'installmentScheduleType',
      'installmentPolicy',
      'installmentPenaltyPolicy',
      'installmentExpiryDays',
      'installmentRequiresApproval',
      'allowInstallmentWhenOutOfStock',
      'stockingReminderEnabled',
      'installmentNotes',
    ];
    for (const col of installmentCols) {
      await queryRunner.query(`ALTER TABLE "crm_products" DROP COLUMN "${col}"`);
      await queryRunner.query(`ALTER TABLE "crm_product_variants" DROP COLUMN "${col}"`);
    }

    await queryRunner.dropTable('ai_learning_imports', true);
    await queryRunner.dropTable('ai_reply_events', true);
    await queryRunner.dropTable('stocking_reminders', true);
    await queryRunner.dropTable('ai_escalations', true);
    await queryRunner.dropTable('branch_payment_accounts', true);
    await queryRunner.dropTable('branch_ai_profiles', true);
  }
}
