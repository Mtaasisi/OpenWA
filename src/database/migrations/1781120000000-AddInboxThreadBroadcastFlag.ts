import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddInboxThreadBroadcastFlag1781120000000 implements MigrationInterface {
  name = 'AddInboxThreadBroadcastFlag1781120000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'inbox_thread_summaries',
      new TableColumn({
        name: 'lastInboundBroadcast',
        type: 'boolean',
        default: false,
        isNullable: false,
      }),
    );

    const isPostgres = queryRunner.connection.options.type === 'postgres';
    const broadcastPredicate = isPostgres
      ? `m.metadata::jsonb ->> 'broadcast' = 'true'`
      : `json_extract(m.metadata, '$.broadcast') = 1 OR json_extract(m.metadata, '$.broadcast') = 'true'`;

    await queryRunner.query(`
      UPDATE inbox_thread_summaries AS s
      SET "lastInboundBroadcast" = true
      WHERE EXISTS (
        SELECT 1
        FROM messages AS m
        WHERE m."sessionId" = s."sessionId"
          AND m."chatId" = s."chatId"
          AND m.direction = 'incoming'
          AND ${broadcastPredicate}
          AND NOT EXISTS (
            SELECT 1
            FROM messages AS newer
            WHERE newer."sessionId" = m."sessionId"
              AND newer."chatId" = m."chatId"
              AND newer.direction = 'incoming'
              AND (
                COALESCE(newer.timestamp, 0) > COALESCE(m.timestamp, 0)
                OR (
                  COALESCE(newer.timestamp, 0) = COALESCE(m.timestamp, 0)
                  AND newer."createdAt" > m."createdAt"
                )
              )
          )
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('inbox_thread_summaries', 'lastInboundBroadcast');
  }
}
