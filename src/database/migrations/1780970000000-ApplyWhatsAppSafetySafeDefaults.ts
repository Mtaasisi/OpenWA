import { MigrationInterface, QueryRunner } from 'typeorm';

export class ApplyWhatsAppSafetySafeDefaults1780970000000 implements MigrationInterface {
  name = 'ApplyWhatsAppSafetySafeDefaults1780970000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('whatsapp_safety_settings');
    if (!table) return;

    const isPg = queryRunner.connection.options.type === 'postgres';
    const b = (value: boolean) => (isPg ? (value ? 'TRUE' : 'FALSE') : value ? '1' : '0');

    await queryRunner.query(`
      UPDATE whatsapp_safety_settings SET
        globalEnabled = ${b(true)},
        warmupEnabled = ${b(true)},
        aiSafetyEnabled = ${b(true)},
        startupSafeModeEnabled = ${b(true)},
        outside24hRequiresTemplate = ${b(true)},
        riskyIntentRequiresApproval = ${b(true)},
        unknownQuestionRequiresApproval = ${b(true)},
        campaignsEnabled = ${b(false)},
        followupAutoSendEnabled = ${b(false)},
        groupsAutoReplyEnabled = ${b(false)},
        groupManagementEnabled = ${b(false)},
        productBulkSendEnabled = ${b(false)},
        statusPostsEnabled = ${b(false)},
        autoDownloadMediaOnStartup = ${b(false)},
        fetchGroupInfoOnStartup = ${b(false)},
        sendSeenOnStartup = ${b(false)},
        maxOutboundPerDay = CASE WHEN maxOutboundPerDay > 200 THEN 200 ELSE maxOutboundPerDay END,
        minDelayBetweenMessagesMs = CASE WHEN minDelayBetweenMessagesMs < 8000 THEN 8000 ELSE minDelayBetweenMessagesMs END
      WHERE id = 'default'
    `);
  }

  public async down(): Promise<void> {
    // Non-destructive: prior values are not restored.
  }
}
