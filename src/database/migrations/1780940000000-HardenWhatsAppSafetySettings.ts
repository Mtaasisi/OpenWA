import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class HardenWhatsAppSafetySettings1780940000000 implements MigrationInterface {
  name = 'HardenWhatsAppSafetySettings1780940000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const settingsTable = await queryRunner.getTable('whatsapp_safety_settings');
    if (settingsTable) {
      const addSettingCol = async (name: string, type: string, defaultVal?: string | number | boolean) => {
        if (!settingsTable.findColumnByName(name)) {
          await queryRunner.addColumn(
            'whatsapp_safety_settings',
            new TableColumn({
              name,
              type,
              default: defaultVal !== undefined ? String(defaultVal) : undefined,
              isNullable: false,
            }),
          );
        }
      };
      await addSettingCol('aiSafetyEnabled', 'boolean', true);
      await addSettingCol('productBulkSendEnabled', 'boolean', false);
      await addSettingCol('maxAutoRepliesPerHour', 'int', 15);
      await addSettingCol('minAiReplyDelayMs', 'int', 15000);
      await addSettingCol('maxAiReplyDelayMs', 'int', 90000);
      await addSettingCol('riskyIntentRequiresApproval', 'boolean', true);
      await addSettingCol('unknownQuestionRequiresApproval', 'boolean', true);
    }

    const warmupTable = await queryRunner.getTable('whatsapp_account_warmup');
    if (warmupTable) {
      const addWarmupCol = async (name: string, type: string, defaultVal: number) => {
        if (!warmupTable.findColumnByName(name)) {
          await queryRunner.addColumn(
            'whatsapp_account_warmup',
            new TableColumn({ name, type, default: defaultVal, isNullable: false }),
          );
        }
      };
      await addWarmupCol('autoReplySentToday', 'int', 0);
      await addWarmupCol('followupSentToday', 'int', 0);
      await addWarmupCol('campaignSentToday', 'int', 0);
      await addWarmupCol('maxAutoRepliesToday', 'int', 10);
      await addWarmupCol('maxFollowupsToday', 'int', 0);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const col of [
      'aiSafetyEnabled',
      'productBulkSendEnabled',
      'maxAutoRepliesPerHour',
      'minAiReplyDelayMs',
      'maxAiReplyDelayMs',
      'riskyIntentRequiresApproval',
      'unknownQuestionRequiresApproval',
    ]) {
      const t = await queryRunner.getTable('whatsapp_safety_settings');
      if (t?.findColumnByName(col)) await queryRunner.dropColumn('whatsapp_safety_settings', col);
    }
    for (const col of [
      'autoReplySentToday',
      'followupSentToday',
      'campaignSentToday',
      'maxAutoRepliesToday',
      'maxFollowupsToday',
    ]) {
      const t = await queryRunner.getTable('whatsapp_account_warmup');
      if (t?.findColumnByName(col)) await queryRunner.dropColumn('whatsapp_account_warmup', col);
    }
  }
}
