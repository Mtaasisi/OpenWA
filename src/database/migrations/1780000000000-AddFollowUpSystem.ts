import { migPrimaryUuidColumn, migDateTime, migNowDefault } from '../migration-utils';
import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AddFollowUpSystem1780000000000 implements MigrationInterface {
  name = 'AddFollowUpSystem1780000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const uuidCol = () => migPrimaryUuidColumn(queryRunner);
    const tsCols = [
      { name: 'createdAt', type: migDateTime(queryRunner), default: migNowDefault(queryRunner), isNullable: false },
      { name: 'updatedAt', type: migDateTime(queryRunner), default: migNowDefault(queryRunner), isNullable: false },
    ];

    await queryRunner.createTable(
      new Table({
        name: 'followup_conversations',
        columns: [
          uuidCol(),
          { name: 'sessionId', type: 'varchar', isNullable: false },
          { name: 'chatId', type: 'varchar', isNullable: false },
          { name: 'customerName', type: 'varchar', isNullable: true },
          { name: 'customerPhone', type: 'varchar', isNullable: true },
          { name: 'source', type: 'varchar', default: "'whatsapp'", isNullable: false },
          { name: 'assignedStaffId', type: 'varchar', isNullable: true },
          { name: 'branchId', type: 'varchar', isNullable: true },
          { name: 'stage', type: 'varchar', default: "'new_lead'", isNullable: false },
          { name: 'productInterest', type: 'varchar', isNullable: true },
          { name: 'productId', type: 'varchar', isNullable: true },
          { name: 'budget', type: 'decimal', precision: 12, scale: 2, isNullable: true },
          { name: 'lastCustomerMessageAt', type: migDateTime(queryRunner), isNullable: true },
          { name: 'lastStaffMessageAt', type: migDateTime(queryRunner), isNullable: true },
          { name: 'lastFollowupAt', type: migDateTime(queryRunner), isNullable: true },
          { name: 'nextFollowupAt', type: migDateTime(queryRunner), isNullable: true },
          { name: 'linkedSaleId', type: 'varchar', isNullable: true },
          { name: 'outcome', type: 'varchar', isNullable: true },
          { name: 'lostReason', type: 'varchar', isNullable: true },
          { name: 'lostNotes', type: 'text', isNullable: true },
          { name: 'alternativeOffered', type: 'boolean', default: false, isNullable: false },
          { name: 'followupCompletedBeforeClose', type: 'boolean', default: false, isNullable: false },
          { name: 'internalNote', type: 'text', isNullable: true },
          ...tsCols,
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'followup_conversations',
      new TableIndex({ name: 'IDX_followup_conv_session_chat', columnNames: ['sessionId', 'chatId'], isUnique: true }),
    );
    await queryRunner.createIndex(
      'followup_conversations',
      new TableIndex({ name: 'IDX_followup_conv_stage', columnNames: ['stage'] }),
    );
    await queryRunner.createIndex(
      'followup_conversations',
      new TableIndex({ name: 'IDX_followup_conv_next', columnNames: ['nextFollowupAt'] }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'followup_message_templates',
        columns: [
          uuidCol(),
          { name: 'name', type: 'varchar', length: '200', isNullable: false },
          { name: 'category', type: 'varchar', isNullable: false },
          { name: 'body', type: 'text', isNullable: false },
          { name: 'channel', type: 'varchar', default: "'whatsapp'", isNullable: false },
          { name: 'language', type: 'varchar', default: "'en'", isNullable: false },
          { name: 'requiresWhatsappApproval', type: 'boolean', default: false, isNullable: false },
          { name: 'whatsappTemplateName', type: 'varchar', isNullable: true },
          { name: 'whatsappTemplateStatus', type: 'varchar', default: "'not_required'", isNullable: false },
          { name: 'branchId', type: 'varchar', isNullable: true },
          { name: 'isActive', type: 'boolean', default: true, isNullable: false },
          ...tsCols,
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'followup_rules',
        columns: [
          uuidCol(),
          { name: 'name', type: 'varchar', length: '200', isNullable: false },
          { name: 'triggerEvent', type: 'varchar', isNullable: false },
          { name: 'stage', type: 'varchar', isNullable: true },
          { name: 'condition', type: 'text', isNullable: true },
          { name: 'delayMinutes', type: 'int', default: 0, isNullable: false },
          { name: 'templateId', type: 'varchar', isNullable: true },
          { name: 'mode', type: 'varchar', default: "'create_task'", isNullable: false },
          { name: 'maxAttempts', type: 'int', default: 3, isNullable: false },
          { name: 'stopIfCustomerReplied', type: 'boolean', default: true, isNullable: false },
          { name: 'stopIfSaleLinked', type: 'boolean', default: true, isNullable: false },
          { name: 'active', type: 'boolean', default: true, isNullable: false },
          { name: 'branchId', type: 'varchar', isNullable: true },
          ...tsCols,
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'followup_queue',
        columns: [
          uuidCol(),
          { name: 'conversationId', type: 'varchar', isNullable: false },
          { name: 'ruleId', type: 'varchar', isNullable: true },
          { name: 'templateId', type: 'varchar', isNullable: true },
          { name: 'assignedStaffId', type: 'varchar', isNullable: true },
          { name: 'branchId', type: 'varchar', isNullable: true },
          { name: 'dueAt', type: migDateTime(queryRunner), isNullable: false },
          { name: 'status', type: 'varchar', default: "'pending'", isNullable: false },
          { name: 'recommendedAction', type: 'varchar', isNullable: true },
          { name: 'attemptNumber', type: 'int', default: 1, isNullable: false },
          { name: 'warningAt', type: migDateTime(queryRunner), isNullable: true },
          { name: 'escalatedAt', type: migDateTime(queryRunner), isNullable: true },
          { name: 'kpiPenaltyAt', type: migDateTime(queryRunner), isNullable: true },
          { name: 'kpiPenaltyFlag', type: 'boolean', default: false, isNullable: false },
          { name: 'notes', type: 'text', isNullable: true },
          ...tsCols,
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'followup_queue',
      new TableIndex({ name: 'IDX_followup_queue_due', columnNames: ['dueAt'] }),
    );
    await queryRunner.createIndex(
      'followup_queue',
      new TableIndex({ name: 'IDX_followup_queue_status', columnNames: ['status'] }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'followup_attempts',
        columns: [
          uuidCol(),
          { name: 'followupId', type: 'varchar', isNullable: false },
          { name: 'conversationId', type: 'varchar', isNullable: false },
          { name: 'staffId', type: 'varchar', isNullable: true },
          { name: 'sentAt', type: migDateTime(queryRunner), isNullable: true },
          { name: 'mode', type: 'varchar', isNullable: false },
          { name: 'templateId', type: 'varchar', isNullable: true },
          { name: 'messageBody', type: 'text', isNullable: true },
          { name: 'deliveryStatus', type: 'varchar', isNullable: true },
          { name: 'customerReplied', type: 'boolean', default: false, isNullable: false },
          { name: 'outcome', type: 'varchar', isNullable: true },
          { name: 'createdAt', type: migDateTime(queryRunner), default: migNowDefault(queryRunner), isNullable: false },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'followup_staff_kpi',
        columns: [
          uuidCol(),
          { name: 'staffId', type: 'varchar', isNullable: false },
          { name: 'branchId', type: 'varchar', isNullable: true },
          { name: 'periodStart', type: 'date', isNullable: false },
          { name: 'periodEnd', type: 'date', isNullable: false },
          { name: 'followupsDue', type: 'int', default: 0, isNullable: false },
          { name: 'followupsCompletedOnTime', type: 'int', default: 0, isNullable: false },
          { name: 'followupsCompletedLate', type: 'int', default: 0, isNullable: false },
          { name: 'followupsMissed', type: 'int', default: 0, isNullable: false },
          { name: 'overdueFollowups', type: 'int', default: 0, isNullable: false },
          { name: 'conversionsAfterFollowup', type: 'int', default: 0, isNullable: false },
          { name: 'lostLeadsWithoutFollowup', type: 'int', default: 0, isNullable: false },
          { name: 'averageResponseTimeMs', type: 'int', default: 0, isNullable: false },
          ...tsCols,
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'followup_staff_kpi',
      new TableIndex({
        name: 'IDX_followup_kpi_staff_period',
        columnNames: ['staffId', 'periodStart'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('followup_staff_kpi');
    await queryRunner.dropTable('followup_attempts');
    await queryRunner.dropTable('followup_queue');
    await queryRunner.dropTable('followup_rules');
    await queryRunner.dropTable('followup_message_templates');
    await queryRunner.dropTable('followup_conversations');
  }
}
