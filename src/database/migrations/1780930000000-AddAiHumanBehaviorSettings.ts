import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddAiHumanBehaviorSettings1780930000000 implements MigrationInterface {
  name = 'AddAiHumanBehaviorSettings1780930000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const columns: TableColumn[] = [
      new TableColumn({ name: 'humanTimingEnabled', type: 'boolean', default: true }),
      new TableColumn({ name: 'activeChatWaitMinMs', type: 'int', default: 1500 }),
      new TableColumn({ name: 'activeChatWaitMaxMs', type: 'int', default: 4000 }),
      new TableColumn({ name: 'warmChatWaitMinMs', type: 'int', default: 3500 }),
      new TableColumn({ name: 'warmChatWaitMaxMs', type: 'int', default: 7000 }),
      new TableColumn({ name: 'coldChatWaitMinMs', type: 'int', default: 7000 }),
      new TableColumn({ name: 'coldChatWaitMaxMs', type: 'int', default: 12000 }),
      new TableColumn({ name: 'burstPauseMinMs', type: 'int', default: 5000 }),
      new TableColumn({ name: 'burstPauseMaxMs', type: 'int', default: 9000 }),
      new TableColumn({ name: 'maxBurstWaitMs', type: 'int', default: 30000 }),
      new TableColumn({ name: 'typingMinMs', type: 'int', default: 1200 }),
      new TableColumn({ name: 'typingMaxMs', type: 'int', default: 14000 }),
      new TableColumn({ name: 'typingCharsPerSecondMin', type: 'int', default: 18 }),
      new TableColumn({ name: 'typingCharsPerSecondMax', type: 'int', default: 35 }),
      new TableColumn({ name: 'typingComplexityExtraMs', type: 'int', default: 2500 }),
      new TableColumn({ name: 'greetingRepeatCooldownMinutes', type: 'int', default: 240 }),
      new TableColumn({ name: 'presenceIntentEnabled', type: 'boolean', default: true }),
      new TableColumn({ name: 'suspiciousNameConfirmationEnabled', type: 'boolean', default: true }),
      new TableColumn({ name: 'autoReplyUseQuotedReply', type: 'boolean', default: true }),
      new TableColumn({ name: 'replyToBurstLatestMessage', type: 'boolean', default: true }),
      new TableColumn({ name: 'noTypingDuringDebounce', type: 'boolean', default: true }),
      new TableColumn({ name: 'humanReplyStyle', type: 'varchar', length: '16', default: "'balanced'" }),
    ];

    for (const col of columns) {
      const has = await queryRunner.hasColumn('ai_config', col.name);
      if (!has) {
        await queryRunner.addColumn('ai_config', col);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const names = [
      'humanReplyStyle',
      'noTypingDuringDebounce',
      'replyToBurstLatestMessage',
      'autoReplyUseQuotedReply',
      'suspiciousNameConfirmationEnabled',
      'presenceIntentEnabled',
      'greetingRepeatCooldownMinutes',
      'typingComplexityExtraMs',
      'typingCharsPerSecondMax',
      'typingCharsPerSecondMin',
      'typingMaxMs',
      'typingMinMs',
      'maxBurstWaitMs',
      'burstPauseMaxMs',
      'burstPauseMinMs',
      'coldChatWaitMaxMs',
      'coldChatWaitMinMs',
      'warmChatWaitMaxMs',
      'warmChatWaitMinMs',
      'activeChatWaitMaxMs',
      'activeChatWaitMinMs',
      'humanTimingEnabled',
    ];
    for (const name of names) {
      const has = await queryRunner.hasColumn('ai_config', name);
      if (has) await queryRunner.dropColumn('ai_config', name);
    }
  }
}
