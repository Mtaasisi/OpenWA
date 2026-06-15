import * as fs from 'fs';
import * as path from 'path';

export const DESKTOP_SUBDIRS = [
  'config',
  'sessions',
  'media',
  'backups',
  'logs',
  'ai-knowledge',
  'ai-memory',
  'temp',
  'cache',
] as const;

export type DesktopSubdir = (typeof DESKTOP_SUBDIRS)[number];

export function isDesktopMode(): boolean {
  return process.env.APP_DESKTOP_MODE === 'true';
}

export function getDesktopDataRoot(): string | null {
  if (!isDesktopMode()) return null;
  const root = process.env.OPENWA_DATA_ROOT?.trim();
  return root || null;
}

export function resolveDesktopPath(subdir: DesktopSubdir): string {
  const root = getDesktopDataRoot();
  if (!root) {
    throw new Error('OPENWA_DATA_ROOT is required in desktop mode');
  }
  return path.join(root, subdir);
}

/** Create all desktop app-data subfolders if missing. */
export function ensureDesktopDirectories(): void {
  const root = getDesktopDataRoot();
  if (!root) return;

  if (!fs.existsSync(root)) {
    fs.mkdirSync(root, { recursive: true });
  }
  for (const sub of DESKTOP_SUBDIRS) {
    const dir = path.join(root, sub);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

export function getDesktopGeneratedEnvPath(): string {
  return path.join(resolveDesktopPath('config'), 'app.env');
}

export function getDesktopMainSqlitePath(): string {
  return path.join(resolveDesktopPath('config'), 'main.sqlite');
}

export function getDesktopDataSqlitePath(): string {
  return path.join(resolveDesktopPath('config'), 'openwa.sqlite');
}

export function applyDesktopPathEnvDefaults(): void {
  if (!isDesktopMode()) return;

  ensureDesktopDirectories();

  if (!process.env.SESSION_DATA_PATH) {
    process.env.SESSION_DATA_PATH = resolveDesktopPath('sessions');
  }
  if (!process.env.STORAGE_LOCAL_PATH) {
    process.env.STORAGE_LOCAL_PATH = resolveDesktopPath('media');
  }
  if (!process.env.STORAGE_PATH) {
    process.env.STORAGE_PATH = resolveDesktopPath('media');
  }
  if (!process.env.AI_KNOWLEDGE_PATH) {
    process.env.AI_KNOWLEDGE_PATH = resolveDesktopPath('ai-knowledge');
  }
  if (!process.env.AI_MEMORY_PATH) {
    process.env.AI_MEMORY_PATH = resolveDesktopPath('ai-memory');
  }
  if (!process.env.LOG_DIR) {
    process.env.LOG_DIR = resolveDesktopPath('logs');
  }
  if (!process.env.DATABASE_TYPE) {
    process.env.DATABASE_TYPE = 'sqlite';
  }
  if (
    (process.env.DATABASE_TYPE || 'sqlite') === 'sqlite' &&
    !process.env.DATABASE_NAME
  ) {
    process.env.DATABASE_NAME = getDesktopDataSqlitePath();
  }
}

export function pathExistsAndWritable(dirPath: string): boolean {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    const testFile = path.join(dirPath, `.write-test-${Date.now()}`);
    fs.writeFileSync(testFile, 'ok');
    fs.unlinkSync(testFile);
    return true;
  } catch {
    return false;
  }
}

export function getDesktopPathStatus(): Record<string, { path: string; ok: boolean }> {
  if (!isDesktopMode()) return {};
  const result: Record<string, { path: string; ok: boolean }> = {};
  for (const sub of DESKTOP_SUBDIRS) {
    const p = resolveDesktopPath(sub);
    result[sub] = { path: p, ok: pathExistsAndWritable(p) };
  }
  return result;
}
