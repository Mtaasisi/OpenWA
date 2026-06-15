import { migPrimaryUuidColumn, migDateTime, migNowDefault } from '../migration-utils';
import { MigrationInterface, QueryRunner, Table, TableColumn } from 'typeorm';

export class AddFollowupAutopilot1780810000000 implements MigrationInterface {
  name = 'AddFollowupAutopilot1780810000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'followup_autopilot_settings',
        columns: [
          { name: 'id', type: 'varchar', isPrimary: true, default: "'default'" },
          { name: 'enabled', type: 'boolean', default: false },
          { name: 'autopilotMode', type: 'varchar', default: "'auto_send_safe'" },
          { name: 'businessHoursOnly', type: 'boolean', default: true },
          { name: 'quietHoursStart', type: 'varchar', default: "'09:00'" },
          { name: 'quietHoursEnd', type: 'varchar', default: "'17:00'" },
          { name: 'timezone', type: 'varchar', default: "'Africa/Dar_es_Salaam'" },
          { name: 'maxFollowupsPerCustomerPerDay', type: 'int', default: 1 },
          { name: 'maxFollowupsPerLead', type: 'int', default: 3 },
          { name: 'requireApprovalForMediumRisk', type: 'boolean', default: true },
          { name: 'requireApprovalForHighRisk', type: 'boolean', default: true },
          { name: 'allowSmsFallback', type: 'boolean', default: false },
          { name: 'allowWhatsAppSmsBoth', type: 'boolean', default: false },
          { name: 'allowGroupAutopilot', type: 'boolean', default: false },
          { name: 'pauseOnHighFailureRate', type: 'boolean', default: true },
          { name: 'pauseOnCustomerComplaint', type: 'boolean', default: true },
          { name: 'staffTakeoverPauseMinutes', type: 'int', default: 120 },
          { name: 'sessionHealthJson', type: 'text', isNullable: true },
          { name: 'createdAt', type: migDateTime(queryRunner), default: migNowDefault(queryRunner) },
          { name: 'updatedAt', type: migDateTime(queryRunner), default: migNowDefault(queryRunner) },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'followup_autopilot_audit',
        columns: [
          migPrimaryUuidColumn(queryRunner),
          { name: 'followupId', type: 'varchar', isNullable: true },
          { name: 'conversationId', type: 'varchar', isNullable: true },
          { name: 'customerId', type: 'varchar', isNullable: true },
          { name: 'sessionId', type: 'varchar', isNullable: true },
          { name: 'ruleId', type: 'varchar', isNullable: true },
          { name: 'templateId', type: 'varchar', isNullable: true },
          { name: 'aiConfidence', type: 'real', isNullable: true },
          { name: 'riskLevel', type: 'varchar', isNullable: true },
          { name: 'channelUsed', type: 'varchar', isNullable: true },
          { name: 'messageSent', type: 'text', isNullable: true },
          { name: 'decisionReason', type: 'text', isNullable: true },
          { name: 'approvedBy', type: 'varchar', isNullable: true },
          { name: 'sentBy', type: 'varchar', isNullable: true },
          { name: 'resultStatus', type: 'varchar', isNullable: true },
          { name: 'metadataJson', type: 'text', isNullable: true },
          { name: 'createdAt', type: migDateTime(queryRunner), default: migNowDefault(queryRunner) },
        ],
      }),
      true,
    );

    const queueColumns: TableColumn[] = [
      new TableColumn({ name: 'detectedReason', type: 'varchar', isNullable: true }),
      new TableColumn({ name: 'customerMood', type: 'varchar', isNullable: true }),
      new TableColumn({ name: 'riskLevel', type: 'varchar', isNullable: true }),
      new TableColumn({ name: 'confidenceScore', type: 'real', isNullable: true }),
      new TableColumn({ name: 'suggestedChannel', type: 'varchar', isNullable: true }),
      new TableColumn({ name: 'suggestedMessage', type: 'text', isNullable: true }),
      new TableColumn({ name: 'originalCustomerMessage', type: 'text', isNullable: true }),
      new TableColumn({ name: 'lastStaffMessage', type: 'text', isNullable: true }),
      new TableColumn({ name: 'stopReason', type: 'varchar', isNullable: true }),
      new TableColumn({ name: 'stoppedAt', type: migDateTime(queryRunner), isNullable: true }),
      new TableColumn({ name: 'stoppedBy', type: 'varchar', isNullable: true }),
      new TableColumn({ name: 'lastTriggerMessageId', type: 'varchar', isNullable: true }),
      new TableColumn({ name: 'approvedBy', type: 'varchar', isNullable: true }),
      new TableColumn({ name: 'sentBy', type: 'varchar', isNullable: true }),
      new TableColumn({ name: 'channelUsed', type: 'varchar', isNullable: true }),
      new TableColumn({ name: 'failureReason', type: 'varchar', isNullable: true }),
      new TableColumn({ name: 'isAutopilot', type: 'boolean', default: false }),
    ];
    for (const col of queueColumns) {
      await queryRunner.addColumn('followup_queue', col);
    }

    await queryRunner.addColumn(
      'followup_message_templates',
      new TableColumn({ name: 'smsBody', type: 'text', isNullable: true }),
    );

    const crmColumns: TableColumn[] = [
      new TableColumn({ name: 'followupAutopilotPaused', type: 'boolean', default: false }),
      new TableColumn({ name: 'followupAutopilotPausedUntil', type: migDateTime(queryRunner), isNullable: true }),
      new TableColumn({ name: 'followupAutopilotPausedBy', type: 'varchar', isNullable: true }),
    ];
    for (const col of crmColumns) {
      await queryRunner.addColumn('inbox_thread_crm', col);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const col of [
      'followupAutopilotPaused',
      'followupAutopilotPausedUntil',
      'followupAutopilotPausedBy',
    ]) {
      await queryRunner.dropColumn('inbox_thread_crm', col);
    }
    await queryRunner.dropColumn('followup_message_templates', 'smsBody');
    for (const col of [
      'detectedReason',
      'customerMood',
      'riskLevel',
      'confidenceScore',
      'suggestedChannel',
      'suggestedMessage',
      'originalCustomerMessage',
      'lastStaffMessage',
      'stopReason',
      'stoppedAt',
      'stoppedBy',
      'lastTriggerMessageId',
      'approvedBy',
      'sentBy',
      'channelUsed',
      'failureReason',
      'isAutopilot',
    ]) {
      await queryRunner.dropColumn('followup_queue', col);
    }
    await queryRunner.dropTable('followup_autopilot_audit');
    await queryRunner.dropTable('followup_autopilot_settings');
  }
}
