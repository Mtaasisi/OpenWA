import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Default AI reply timing to instant (humanTimingEnabled off) with fast preset stored for opt-in.
 * Only updates rows still on packaged balanced defaults — preserves custom tuning.
 */
export class DefaultAiInstantReplyTiming1781010000000 implements MigrationInterface {
  name = 'DefaultAiInstantReplyTiming1781010000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isPg = queryRunner.connection.options.type === 'postgres';
    const b = (value: boolean) => (isPg ? (value ? 'TRUE' : 'FALSE') : value ? '1' : '0');

    const fastPreset = `
      humanTimingEnabled = ${b(false)},
      humanReplyStyle = 'fast',
      activeChatWaitMinMs = 500,
      activeChatWaitMaxMs = 1500,
      warmChatWaitMinMs = 1500,
      warmChatWaitMaxMs = 4000,
      coldChatWaitMinMs = 5000,
      coldChatWaitMaxMs = 9000,
      burstPauseMinMs = 4500,
      burstPauseMaxMs = 7500
    `;

    await queryRunner.query(`
      UPDATE ai_config
      SET ${fastPreset}
      WHERE
        humanReplyStyle = 'balanced'
        AND activeChatWaitMinMs = 800
        AND activeChatWaitMaxMs = 2500
        AND warmChatWaitMinMs = 2500
        AND warmChatWaitMaxMs = 6000
        AND coldChatWaitMinMs = 7000
        AND coldChatWaitMaxMs = 12000
        AND burstPauseMinMs = 6000
    `);

    await queryRunner.query(`
      UPDATE ai_config
      SET ${fastPreset}
      WHERE
        humanReplyStyle = 'balanced'
        AND activeChatWaitMinMs = 1500
        AND activeChatWaitMaxMs = 4000
        AND warmChatWaitMinMs = 3500
        AND warmChatWaitMaxMs = 7000
        AND coldChatWaitMinMs = 7000
        AND coldChatWaitMaxMs = 12000
        AND burstPauseMinMs = 5000
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Non-destructive data migration — no down.
  }
}
