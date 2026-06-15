import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Align packaged AI human-timing defaults with balanced preset (first-message delay + active fast reply).
 * Only updates rows that still match the original migration defaults — preserves custom tuning.
 */
export class UpdateAiHumanTimingBalancedDefaults1780990000000 implements MigrationInterface {
  name = 'UpdateAiHumanTimingBalancedDefaults1780990000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE ai_config
      SET
        activeChatWaitMinMs = 800,
        activeChatWaitMaxMs = 2500,
        warmChatWaitMinMs = 2500,
        warmChatWaitMaxMs = 6000,
        burstPauseMinMs = 6000
      WHERE
        humanReplyStyle = 'balanced'
        AND activeChatWaitMinMs = 1500
        AND activeChatWaitMaxMs = 4000
        AND warmChatWaitMinMs = 3500
        AND warmChatWaitMaxMs = 7000
        AND burstPauseMinMs = 5000
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Non-destructive data migration — no down.
  }
}
