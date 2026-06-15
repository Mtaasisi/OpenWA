import { migDateTime, migNowDefault } from '../migration-utils';
import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AddInboxThreadSummaries1780880000000 implements MigrationInterface {
  name = 'AddInboxThreadSummaries1780880000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'inbox_thread_summaries',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            isPrimary: true,
          },
          { name: 'sessionId', type: 'varchar' },
          { name: 'chatId', type: 'varchar' },
          { name: 'lastMessageAt', type: migDateTime(queryRunner) },
          { name: 'lastTimestamp', type: 'bigint', isNullable: true },
          { name: 'lastPreview', type: 'text', isNullable: true },
          { name: 'lastMessageType', type: 'varchar', isNullable: true },
          { name: 'lastMessageId', type: 'varchar', isNullable: true },
          { name: 'lastDirection', type: 'varchar' },
          { name: 'messageCount', type: 'integer', default: 0 },
          { name: 'displayName', type: 'varchar', isNullable: true },
          { name: 'unreadCount', type: 'integer', default: 0 },
          { name: 'createdAt', type: migDateTime(queryRunner), default: migNowDefault(queryRunner) },
          { name: 'updatedAt', type: migDateTime(queryRunner), default: migNowDefault(queryRunner) },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'inbox_thread_summaries',
      new TableIndex({
        name: 'IDX_inbox_thread_summaries_session_chat',
        columnNames: ['sessionId', 'chatId'],
        isUnique: true,
      }),
    );
    await queryRunner.createIndex(
      'inbox_thread_summaries',
      new TableIndex({
        name: 'IDX_inbox_thread_summaries_session_last',
        columnNames: ['sessionId', 'lastMessageAt'],
      }),
    );
    await queryRunner.createIndex(
      'inbox_thread_summaries',
      new TableIndex({
        name: 'IDX_inbox_thread_summaries_last',
        columnNames: ['lastMessageAt'],
      }),
    );

    const isPostgres = queryRunner.connection.options.type === 'postgres';
    const aggregates = await queryRunner.query(`
      SELECT "sessionId", "chatId", COUNT(*) AS "messageCount"
      FROM "messages"
      GROUP BY "sessionId", "chatId"
    `);

    for (const row of aggregates as Array<{
      sessionId: string;
      chatId: string;
      messageCount: string | number;
    }>) {
      const chatId = row.chatId;
      if (
        !chatId ||
        chatId.toLowerCase() === 'status@broadcast' ||
        chatId.toLowerCase().includes('@broadcast') ||
        chatId.toLowerCase().endsWith('@newsletter')
      ) {
        continue;
      }

      const latestRows = await queryRunner.query(
        isPostgres
          ? `SELECT * FROM "messages" WHERE "sessionId" = $1 AND "chatId" = $2 ORDER BY "timestamp" DESC NULLS LAST, "createdAt" DESC LIMIT 1`
          : `SELECT * FROM "messages" WHERE "sessionId" = ? AND "chatId" = ? ORDER BY "timestamp" DESC, "createdAt" DESC LIMIT 1`,
        [row.sessionId, chatId],
      );
      const latest = latestRows[0] as
        | {
            id: string;
            body: string | null;
            type: string;
            direction: string;
            timestamp: number | null;
            createdAt: string;
            metadata: string | null;
          }
        | undefined;
      if (!latest) continue;

      const readRows = await queryRunner.query(
        isPostgres
          ? `SELECT "lastReadAt" FROM "inbox_thread_reads" WHERE "sessionId" = $1 AND "chatId" = $2 LIMIT 1`
          : `SELECT "lastReadAt" FROM "inbox_thread_reads" WHERE "sessionId" = ? AND "chatId" = ? LIMIT 1`,
        [row.sessionId, chatId],
      );
      const lastReadAt = readRows[0]?.lastReadAt as string | undefined;

      const unreadRows = await queryRunner.query(
        isPostgres
          ? `SELECT COUNT(*) AS "count" FROM "messages"
             WHERE "sessionId" = $1 AND "chatId" = $2 AND "direction" = 'incoming'
             ${lastReadAt ? 'AND "createdAt" > $3' : ''}`
          : `SELECT COUNT(*) AS "count" FROM "messages"
             WHERE "sessionId" = ? AND "chatId" = ? AND "direction" = 'incoming'
             ${lastReadAt ? 'AND "createdAt" > ?' : ''}`,
        lastReadAt ? [row.sessionId, chatId, lastReadAt] : [row.sessionId, chatId],
      );
      const unreadCount = parseInt(String(unreadRows[0]?.count ?? '0'), 10) || 0;

      let displayName: string | null = null;
      try {
        const meta =
          typeof latest.metadata === 'string' ? JSON.parse(latest.metadata) : latest.metadata;
        const chatName = meta?.chatName?.trim?.();
        if (chatName) displayName = chatName;
      } catch {
        /* ignore */
      }

      const ts = latest.timestamp != null ? Number(latest.timestamp) : NaN;
      const lastMessageAt =
        Number.isFinite(ts) && ts > 0
          ? new Date(ts * 1000).toISOString()
          : new Date(latest.createdAt).toISOString();

      const preview =
        latest.body?.trim?.() ||
        (latest.type === 'image'
          ? '📷 Photo'
          : latest.type === 'video'
            ? '🎬 Video'
            : latest.type === 'audio' || latest.type === 'ptt'
              ? '🎵 Audio'
              : latest.type === 'document'
                ? '📄 Document'
                : `[${latest.type}]`);

      await queryRunner.query(
        isPostgres
          ? `INSERT INTO "inbox_thread_summaries"
             ("id", "sessionId", "chatId", "lastMessageAt", "lastTimestamp", "lastPreview", "lastMessageType", "lastMessageId", "lastDirection", "messageCount", "displayName", "unreadCount", "createdAt", "updatedAt")
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
             ON CONFLICT ("sessionId", "chatId") DO NOTHING`
          : `INSERT OR IGNORE INTO "inbox_thread_summaries"
             ("id", "sessionId", "chatId", "lastMessageAt", "lastTimestamp", "lastPreview", "lastMessageType", "lastMessageId", "lastDirection", "messageCount", "displayName", "unreadCount", "createdAt", "updatedAt")
             VALUES (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        isPostgres
          ? [
              row.sessionId,
              chatId,
              lastMessageAt,
              latest.timestamp,
              preview,
              latest.type,
              latest.id,
              latest.direction,
              parseInt(String(row.messageCount), 10) || 0,
              displayName,
              unreadCount,
            ]
          : [
              row.sessionId,
              chatId,
              lastMessageAt,
              latest.timestamp,
              preview,
              latest.type,
              latest.id,
              latest.direction,
              parseInt(String(row.messageCount), 10) || 0,
              displayName,
              unreadCount,
            ],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('inbox_thread_summaries', true);
  }
}
