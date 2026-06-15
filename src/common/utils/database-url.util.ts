export interface ParsedDatabaseUrl {
  type: 'postgres';
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  ssl: boolean;
  sslRejectUnauthorized: boolean;
}

/** Mask a database URL for logs and UI (never expose password). */
export function maskDatabaseUrl(url: string): string {
  if (!url?.trim()) return '';
  try {
    const parsed = new URL(url);
    const user = parsed.username || 'user';
    const host = parsed.hostname;
    const port = parsed.port ? `:${parsed.port}` : '';
    const db = parsed.pathname.replace(/^\//, '') || 'db';
    return `postgresql://${user}:****@${host}${port}/${db}`;
  } catch {
    return 'postgresql://****';
  }
}

/**
 * Parse a Neon/PostgreSQL connection URL into DATABASE_* env fields.
 * Supports postgresql:// and postgres:// schemes with sslmode=require.
 */
export function parseDatabaseUrl(url: string): ParsedDatabaseUrl {
  const trimmed = url?.trim();
  if (!trimmed) {
    throw new Error('Database URL is required');
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Invalid database URL format');
  }

  const protocol = parsed.protocol.replace(':', '');
  if (protocol !== 'postgresql' && protocol !== 'postgres') {
    throw new Error('Only PostgreSQL connection URLs are supported');
  }

  const sslMode = parsed.searchParams.get('sslmode')?.toLowerCase();
  const ssl =
    sslMode === 'require' ||
    sslMode === 'verify-full' ||
    sslMode === 'verify-ca' ||
    parsed.searchParams.get('ssl') === 'true';

  return {
    type: 'postgres',
    host: parsed.hostname,
    port: parsed.port ? parseInt(parsed.port, 10) : 5432,
    username: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, '') || 'neondb',
    ssl,
    sslRejectUnauthorized: sslMode !== 'require',
  };
}

/** Apply parsed URL fields to process.env (does not log secrets). */
export function applyDatabaseUrlToEnv(url: string): ParsedDatabaseUrl {
  const parsed = parseDatabaseUrl(url);
  process.env.DATABASE_TYPE = 'postgres';
  process.env.DATABASE_HOST = parsed.host;
  process.env.DATABASE_PORT = String(parsed.port);
  process.env.DATABASE_USERNAME = parsed.username;
  process.env.DATABASE_PASSWORD = parsed.password;
  process.env.DATABASE_NAME = parsed.database;
  process.env.DATABASE_SSL = parsed.ssl ? 'true' : 'false';
  process.env.DATABASE_SSL_REJECT_UNAUTHORIZED = parsed.sslRejectUnauthorized ? 'true' : 'false';
  process.env.DATABASE_SYNCHRONIZE = 'false';
  return parsed;
}

/** True when URL targets Neon's connection pooler (startup `options` are rejected). */
export function isNeonPoolerDatabaseUrl(url: string): boolean {
  if (!url?.trim()) return false;
  try {
    const host = new URL(url.trim()).hostname.toLowerCase();
    return host.includes('-pooler.');
  } catch {
    return url.includes('-pooler.');
  }
}
