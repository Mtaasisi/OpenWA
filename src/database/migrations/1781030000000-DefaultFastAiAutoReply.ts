import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Default AI auto-reply to fast/instant: unrestricted mode on, zero pacing delays.
 * Only updates rows still on legacy slow pacing — preserves custom tuning.
 */
export class DefaultFastAiAutoReply1781030000000 implements MigrationInterface {
  name = 'DefaultFastAiAutoReply1781030000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isPg = queryRunner.connection.options.type === 'postgres';
    const b = (value: boolean) => (isPg ? (value ? 'TRUE' : 'FALSE') : value ? '1' : '0');

    const hasUnrestricted = await queryRunner.hasColumn('ai_config', 'aiUnrestrictedMode');
    if (hasUnrestricted) {
      await queryRunner.query(`
        UPDATE ai_config
        SET
          aiUnrestrictedMode = ${b(true)},
          humanTimingEnabled = ${b(false)},
          autoReplyCooldownMinutes = 0
        WHERE id = 'default'
      `);
    }

    const table = await queryRunner.getTable('whatsapp_safety_settings');
    if (!table) return;

    await queryRunner.query(`
      UPDATE whatsapp_safety_settings
      SET
        minAiReplyDelayMs = 0,
        maxAiReplyDelayMs = 0,
        minDelayBetweenMessagesMs = 500,
        perContactCooldownMinutes = 0,
        maxAutoRepliesPerCustomerPerDay = 999,
        riskyIntentRequiresApproval = ${b(false)},
        unknownQuestionRequiresApproval = ${b(false)},
        aiAutoReplyEnabled = ${b(true)}
      WHERE
        id = 'default'
        AND minAiReplyDelayMs >= 15000
        AND maxAiReplyDelayMs >= 90000
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Non-destructive data migration — no down.
  }
}
