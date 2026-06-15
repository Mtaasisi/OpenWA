/**
 * Cross-database column type helpers.
 *
 * SQLite lacks native JSON and timestamp types, so we use `simple-json`
 * (JSON.stringify stored as TEXT) and `text` with DateTransformer.
 *
 * PostgreSQL has native `jsonb` and `timestamp` types with better
 * indexing and query performance.
 */

const isPostgres = (): boolean => process.env.DATABASE_TYPE === 'postgres';

/**
 * Returns 'jsonb' for PostgreSQL, 'simple-json' for SQLite.
 */
export const jsonColumnType = (): 'jsonb' | 'simple-json' => (isPostgres() ? 'jsonb' : 'simple-json');

/**
 * Returns 'timestamp' for PostgreSQL, 'text' for SQLite.
 * Use with DateTransformer for SQLite compatibility.
 */
export const dateColumnType = (): 'timestamp' | 'text' => (isPostgres() ? 'timestamp' : 'text');

/**
 * Returns 'timestamp' for PostgreSQL, 'datetime' for SQLite.
 * Use only on entities in the pluggable **data** database — not on main SQLite (auth/audit).
 */
export const dateTimeColumnType = (): 'timestamp' | 'datetime' =>
  isPostgres() ? 'timestamp' : 'datetime';
