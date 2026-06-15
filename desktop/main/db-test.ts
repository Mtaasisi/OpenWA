import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { resolveRepoRoot } from './paths';

export interface DatabaseTestResult {
  ok: boolean;
  message: string;
  maskedUrl?: string;
  pendingMigrations?: number;
  pgvectorInstalled?: boolean;
  pgvectorWarning?: string;
}

function maskDatabaseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const user = parsed.username || 'user';
    const port = parsed.port ? `:${parsed.port}` : '';
    const db = parsed.pathname.replace(/^\//, '') || 'db';
    return `postgresql://${user}:****@${parsed.hostname}${port}/${db}`;
  } catch {
    return 'postgresql://****';
  }
}

function parsePostgresUrl(url: string): {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: boolean | { rejectUnauthorized: boolean };
} {
  const trimmed = url.trim();
  const parsed = new URL(trimmed);
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
    host: parsed.hostname,
    port: parsed.port ? parseInt(parsed.port, 10) : 5432,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, '') || 'neondb',
    ssl: ssl ? { rejectUnauthorized: sslMode !== 'require' } : false,
  };
}

function resolvePgClient(): new (config: Record<string, unknown>) => {
  connect: () => Promise<void>;
  query: (sql: string) => Promise<{ rows: unknown[] }>;
  end: () => Promise<void>;
} {
  const candidates: string[] = [];
  if (!app.isPackaged) {
    candidates.push(path.join(resolveRepoRoot(), 'node_modules', 'pg'));
  } else {
    candidates.push(path.join(process.resourcesPath, 'backend', 'node_modules', 'pg'));
  }
  for (const modPath of candidates) {
    if (fs.existsSync(path.join(modPath, 'package.json'))) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pg = require(modPath) as { Client: new (config: Record<string, unknown>) => {
        connect: () => Promise<void>;
        query: (sql: string) => Promise<{ rows: unknown[] }>;
        end: () => Promise<void>;
      } };
      return pg.Client;
    }
  }
  throw new Error('PostgreSQL client (pg) is not available in this desktop build');
}

/** Test Neon/Postgres without requiring the Nest backend to be running. */
export async function testPostgresDatabaseUrl(databaseUrl: string): Promise<DatabaseTestResult> {
  const maskedUrl = maskDatabaseUrl(databaseUrl);
  let config: ReturnType<typeof parsePostgresUrl>;
  try {
    config = parsePostgresUrl(databaseUrl);
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Invalid database URL',
      maskedUrl,
    };
  }

  const Client = resolvePgClient();
  const client = new Client({
    connectionString: databaseUrl.trim(),
    ssl: config.ssl === false ? false : config.ssl,
  });
  try {
    await client.connect();
    await client.query('SELECT 1');
    const vectorRows = await client.query(
      `SELECT 1 AS ok FROM pg_extension WHERE extname = 'vector' LIMIT 1`,
    );
    const pgvectorInstalled = vectorRows.rows.length > 0;
    await client.end();
    const pgvectorWarning = pgvectorInstalled
      ? undefined
      : 'pgvector extension is not enabled. Enable it in Neon (CREATE EXTENSION vector) for full AI memory search.';
    return {
      ok: true,
      message: pgvectorInstalled
        ? 'Database connection successful'
        : 'Database connected — enable pgvector in Neon for AI memory features',
      maskedUrl,
      pendingMigrations: 0,
      pgvectorInstalled,
      pgvectorWarning,
    };
  } catch (err) {
    try {
      await client.end();
    } catch {
      // ignore
    }
    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : 'Database connection failed. Check internet or Neon settings.',
      maskedUrl,
    };
  }
}

export function formatDesktopFetchError(err: unknown, appPort: number): Error {
  if (err instanceof Error && err.message.includes('fetch failed')) {
    return new Error(
      `Could not reach the local API on port ${appPort}. The backend may have crashed — open Logs from the tray menu and check backend.log. If you just set a Neon URL, rebuild the desktop app after updating.`,
    );
  }
  return err instanceof Error ? err : new Error(String(err));
}
