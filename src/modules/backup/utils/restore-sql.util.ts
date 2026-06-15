import type { DataSource } from 'typeorm';

export type RestoreInsertMode = 'merge' | 'upsert';

export function getDbDriver(dataSource: DataSource): string {
  return String(dataSource.options.type ?? 'sqlite');
}

export function buildMergeInsertSql(table: string, columns: string[]): string {
  const columnList = columns.join(', ');
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');

  return `INSERT INTO ${table} (${columnList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
}

export function buildSqliteMergeInsertSql(table: string, columns: string[]): string {
  const columnList = columns.join(', ');
  const placeholders = columns.map(() => '?').join(', ');
  return `INSERT OR IGNORE INTO ${table} (${columnList}) VALUES (${placeholders})`;
}

export function buildMysqlMergeInsertSql(table: string, columns: string[]): string {
  const columnList = columns.join(', ');
  const placeholders = columns.map(() => '?').join(', ');
  return `INSERT IGNORE INTO ${table} (${columnList}) VALUES (${placeholders})`;
}

function buildPostgresUpsertSql(table: string, columns: string[]): string | null {
  if (!columns.includes('id')) return null;
  const updateColumns = columns.filter(column => column !== 'id');
  if (updateColumns.length === 0) return null;

  const columnList = columns.join(', ');
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
  const updates = updateColumns.map(column => `${column} = EXCLUDED.${column}`).join(', ');
  return `INSERT INTO ${table} (${columnList}) VALUES (${placeholders}) ON CONFLICT (id) DO UPDATE SET ${updates}`;
}

function buildSqliteUpsertSql(table: string, columns: string[]): string | null {
  if (!columns.includes('id')) return null;
  const updateColumns = columns.filter(column => column !== 'id');
  if (updateColumns.length === 0) return null;

  const columnList = columns.join(', ');
  const placeholders = columns.map(() => '?').join(', ');
  const updates = updateColumns.map(column => `${column} = excluded.${column}`).join(', ');
  return `INSERT INTO ${table} (${columnList}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updates}`;
}

function buildMysqlUpsertSql(table: string, columns: string[]): string | null {
  if (!columns.includes('id')) return null;
  const updateColumns = columns.filter(column => column !== 'id');
  if (updateColumns.length === 0) return null;

  const columnList = columns.join(', ');
  const placeholders = columns.map(() => '?').join(', ');
  const updates = updateColumns.map(column => `${column} = VALUES(${column})`).join(', ');
  return `INSERT INTO ${table} (${columnList}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updates}`;
}

export function buildRestoreInsertForDriver(
  dataSource: DataSource,
  table: string,
  columns: string[],
  mode: RestoreInsertMode = 'merge',
): string {
  const driver = getDbDriver(dataSource);

  if (mode === 'upsert') {
    const upsertSql =
      driver === 'postgres'
        ? buildPostgresUpsertSql(table, columns)
        : driver === 'mysql' || driver === 'mariadb'
          ? buildMysqlUpsertSql(table, columns)
          : buildSqliteUpsertSql(table, columns);
    if (upsertSql) return upsertSql;
  }

  if (driver === 'postgres') {
    return buildMergeInsertSql(table, columns);
  }
  if (driver === 'mysql' || driver === 'mariadb') {
    return buildMysqlMergeInsertSql(table, columns);
  }
  return buildSqliteMergeInsertSql(table, columns);
}

/** @deprecated Use buildRestoreInsertForDriver */
export function buildMergeInsertForDriver(
  dataSource: DataSource,
  table: string,
  columns: string[],
): string {
  return buildRestoreInsertForDriver(dataSource, table, columns, 'merge');
}
