import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
import { migDateTime, migNowDefault, migPrimaryUuidColumn } from '../migration-utils';

export class AddWhatsAppSafetySystem1780800000000 implements MigrationInterface {
  name = 'AddWhatsAppSafetySystem1780800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const dt = migDateTime(queryRunner);
    const now = migNowDefault(queryRunner);

    await queryRunner.createTable(
      new Table({
        name: 'whatsapp_contact_consent',
        columns: [
          migPrimaryUuidColumn(queryRunner),
          { name: 'customerId', type: 'varchar', isNullable: true },
          { name: 'phone', type: 'varchar', isNullable: false },
          { name: 'normalizedPhone', type: 'varchar', isNullable: false },
          { name: 'sessionId', type: 'varchar', isNullable: true },
          { name: 'optInStatus', type: 'varchar', default: "'unknown'", isNullable: false },
          { name: 'optInSource', type: 'varchar', default: "'unknown'", isNullable: false },
          { name: 'optInCategories', type: 'text', default: "'{}'", isNullable: false },
          { name: 'optInAt', type: dt, isNullable: true },
          { name: 'optOutAt', type: dt, isNullable: true },
          { name: 'optOutReason', type: 'varchar', isNullable: true },
          { name: 'lastUserMessageAt', type: dt, isNullable: true },
          { name: 'lastOutboundMessageAt', type: dt, isNullable: true },
          { name: 'canMarketing', type: 'boolean', default: false, isNullable: false },
          { name: 'canUtility', type: 'boolean', default: true, isNullable: false },
          { name: 'canFollowup', type: 'boolean', default: true, isNullable: false },
          { name: 'optOutAckSent', type: 'boolean', default: false, isNullable: false },
          { name: 'createdAt', type: dt, default: now, isNullable: false },
          { name: 'updatedAt', type: dt, default: now, isNullable: false },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'whatsapp_safety_settings',
        columns: [
          { name: 'id', type: 'varchar', isPrimary: true, default: "'default'" },
          { name: 'sessionId', type: 'varchar', isNullable: true },
          { name: 'globalEnabled', type: 'boolean', default: true, isNullable: false },
          { name: 'warmupEnabled', type: 'boolean', default: true, isNullable: false },
          { name: 'accountAgeDays', type: 'int', isNullable: true },
          { name: 'maxOutboundPerHour', type: 'int', default: 30, isNullable: false },
          { name: 'maxOutboundPerDay', type: 'int', default: 200, isNullable: false },
          { name: 'maxAutoRepliesPerCustomerPerDay', type: 'int', default: 5, isNullable: false },
          { name: 'maxCampaignMessagesPerHour', type: 'int', default: 20, isNullable: false },
          { name: 'maxCampaignMessagesPerDay', type: 'int', default: 100, isNullable: false },
          { name: 'minDelayBetweenMessagesMs', type: 'int', default: 8000, isNullable: false },
          { name: 'maxDelayBetweenMessagesMs', type: 'int', default: 25000, isNullable: false },
          { name: 'perContactCooldownMinutes', type: 'int', default: 10, isNullable: false },
          { name: 'failureRatePauseThreshold', type: 'real', default: 0.15, isNullable: false },
          { name: 'blockRatePauseThreshold', type: 'real', default: 0.05, isNullable: false },
          { name: 'outside24hRequiresTemplate', type: 'boolean', default: true, isNullable: false },
          { name: 'groupsAutoReplyEnabled', type: 'boolean', default: false, isNullable: false },
          { name: 'campaignsEnabled', type: 'boolean', default: false, isNullable: false },
          { name: 'followupAutoSendEnabled', type: 'boolean', default: false, isNullable: false },
          { name: 'aiAutoReplyEnabled', type: 'boolean', default: true, isNullable: false },
          { name: 'startupSafeModeEnabled', type: 'boolean', default: true, isNullable: false },
          { name: 'startupInitialDelayMinutes', type: 'int', default: 5, isNullable: false },
          { name: 'maxChatsToSyncInitially', type: 'int', default: 50, isNullable: false },
          { name: 'syncBatchSize', type: 'int', default: 10, isNullable: false },
          { name: 'syncBatchDelayMs', type: 'int', default: 60000, isNullable: false },
          { name: 'autoDownloadMediaOnStartup', type: 'boolean', default: false, isNullable: false },
          { name: 'fetchGroupInfoOnStartup', type: 'boolean', default: false, isNullable: false },
          { name: 'sendSeenOnStartup', type: 'boolean', default: false, isNullable: false },
          { name: 'optOutKeywords', type: 'text', default: "'[]'", isNullable: false },
          { name: 'createdAt', type: dt, default: now, isNullable: false },
          { name: 'updatedAt', type: dt, default: now, isNullable: false },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'whatsapp_account_warmup',
        columns: [
          migPrimaryUuidColumn(queryRunner),
          { name: 'sessionId', type: 'varchar', isNullable: false },
          { name: 'status', type: 'varchar', default: "'active'", isNullable: false },
          { name: 'startedAt', type: dt, isNullable: false },
          { name: 'dayNumber', type: 'int', default: 1, isNullable: false },
          { name: 'maxOutboundToday', type: 'int', default: 30, isNullable: false },
          { name: 'maxCampaignToday', type: 'int', default: 0, isNullable: false },
          { name: 'repliesOnly', type: 'boolean', default: true, isNullable: false },
          { name: 'allowCampaigns', type: 'boolean', default: false, isNullable: false },
          { name: 'allowFollowupAutoSend', type: 'boolean', default: false, isNullable: false },
          { name: 'allowAiAutoReply', type: 'boolean', default: true, isNullable: false },
          { name: 'outboundSentToday', type: 'int', default: 0, isNullable: false },
          { name: 'notes', type: 'text', isNullable: true },
          { name: 'createdAt', type: dt, default: now, isNullable: false },
          { name: 'updatedAt', type: dt, default: now, isNullable: false },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'whatsapp_send_queue',
        columns: [
          migPrimaryUuidColumn(queryRunner),
          { name: 'sessionId', type: 'varchar', isNullable: false },
          { name: 'conversationId', type: 'varchar', isNullable: true },
          { name: 'customerId', type: 'varchar', isNullable: true },
          { name: 'phone', type: 'varchar', isNullable: true },
          { name: 'chatId', type: 'varchar', isNullable: false },
          { name: 'messageType', type: 'varchar', isNullable: false },
          { name: 'messageBody', type: 'text', isNullable: false },
          { name: 'mediaUrls', type: 'text', isNullable: true },
          { name: 'templateId', type: 'varchar', isNullable: true },
          { name: 'source', type: 'varchar', isNullable: false },
          { name: 'priority', type: 'varchar', default: "'normal'", isNullable: false },
          { name: 'status', type: 'varchar', default: "'pending'", isNullable: false },
          { name: 'riskLevel', type: 'varchar', default: "'low'", isNullable: false },
          { name: 'guardDecision', type: 'text', isNullable: true },
          { name: 'payload', type: 'text', isNullable: true },
          { name: 'scheduledAt', type: dt, isNullable: true },
          { name: 'sentAt', type: dt, isNullable: true },
          { name: 'failedAt', type: dt, isNullable: true },
          { name: 'errorMessage', type: 'text', isNullable: true },
          { name: 'retryCount', type: 'int', default: 0, isNullable: false },
          { name: 'createdBy', type: 'varchar', isNullable: true },
          { name: 'approvedBy', type: 'varchar', isNullable: true },
          { name: 'approvedAt', type: dt, isNullable: true },
          { name: 'createdAt', type: dt, default: now, isNullable: false },
          { name: 'updatedAt', type: dt, default: now, isNullable: false },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'whatsapp_session_health_events',
        columns: [
          migPrimaryUuidColumn(queryRunner),
          { name: 'sessionId', type: 'varchar', isNullable: false },
          { name: 'eventType', type: 'varchar', isNullable: false },
          { name: 'severity', type: 'varchar', default: "'info'", isNullable: false },
          { name: 'message', type: 'text', isNullable: false },
          { name: 'metadata', type: 'text', isNullable: true },
          { name: 'createdAt', type: dt, default: now, isNullable: false },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'whatsapp_session_automation_state',
        columns: [
          { name: 'sessionId', type: 'varchar', isPrimary: true },
          { name: 'automationPaused', type: 'boolean', default: false, isNullable: false },
          { name: 'startupSafeMode', type: 'boolean', default: false, isNullable: false },
          { name: 'startupSafeModeUntil', type: dt, isNullable: true },
          { name: 'sendFailuresRecent', type: 'int', default: 0, isNullable: false },
          { name: 'sendBlockedRecent', type: 'int', default: 0, isNullable: false },
          { name: 'sendsRecentHour', type: 'int', default: 0, isNullable: false },
          { name: 'sendsRecentDay', type: 'int', default: 0, isNullable: false },
          { name: 'countersResetAt', type: dt, isNullable: true },
          { name: 'updatedAt', type: dt, isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'whatsapp_send_audit',
        columns: [
          migPrimaryUuidColumn(queryRunner),
          { name: 'sessionId', type: 'varchar', isNullable: false },
          { name: 'customerId', type: 'varchar', isNullable: true },
          { name: 'phone', type: 'varchar', isNullable: true },
          { name: 'chatId', type: 'varchar', isNullable: true },
          { name: 'source', type: 'varchar', isNullable: false },
          { name: 'messageType', type: 'varchar', isNullable: false },
          { name: 'decision', type: 'varchar', isNullable: false },
          { name: 'reason', type: 'text', isNullable: false },
          { name: 'riskLevel', type: 'varchar', default: "'low'", isNullable: false },
          { name: 'guardChecks', type: 'text', isNullable: true },
          { name: 'queueItemId', type: 'varchar', isNullable: true },
          { name: 'createdAt', type: dt, default: now, isNullable: false },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'whatsapp_contact_consent',
      new TableIndex({ name: 'IDX_wa_consent_phone', columnNames: ['normalizedPhone'] }),
    );
    await queryRunner.createIndex(
      'whatsapp_send_queue',
      new TableIndex({ name: 'IDX_wa_queue_session_status', columnNames: ['sessionId', 'status'] }),
    );

    await queryRunner.query(
      `INSERT INTO whatsapp_safety_settings (id) SELECT 'default' WHERE NOT EXISTS (SELECT 1 FROM whatsapp_safety_settings WHERE id = 'default')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('whatsapp_send_audit');
    await queryRunner.dropTable('whatsapp_session_automation_state');
    await queryRunner.dropTable('whatsapp_session_health_events');
    await queryRunner.dropTable('whatsapp_send_queue');
    await queryRunner.dropTable('whatsapp_account_warmup');
    await queryRunner.dropTable('whatsapp_safety_settings');
    await queryRunner.dropTable('whatsapp_contact_consent');
  }
}
