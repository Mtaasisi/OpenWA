import * as fs from 'fs';
import * as path from 'path';
import { getDesktopGeneratedEnvPath, isDesktopMode } from './desktop-paths.util';

export function getGeneratedEnvPath(): string {
  if (isDesktopMode()) {
    return getDesktopGeneratedEnvPath();
  }
  return path.resolve(process.cwd(), 'data', '.env.generated');
}

export function getProjectEnvPath(): string {
  return path.resolve(process.cwd(), '.env');
}

/** Parse KEY=VALUE lines (ignores comments and blanks). */
export function parseEnvFile(content: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    map.set(trimmed.slice(0, eq).trim(), trimmed.slice(eq + 1));
  }
  return map;
}

/** Apply parsed env entries without overriding keys already set in process.env. */
export function applyEnvFileToProcess(
  filePath: string,
  options?: { override?: boolean },
): void {
  if (!fs.existsSync(filePath)) return;
  const override = options?.override ?? false;
  for (const [key, value] of parseEnvFile(fs.readFileSync(filePath, 'utf8'))) {
    if (override || process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

/**
 * Merge env updates into a file, preserving unrelated keys and comments.
 * New keys are appended under a short dashboard marker section.
 */
export function applyEnvUpdates(filePath: string, updates: Record<string, string | undefined>): void {
  const pending = new Map<string, string>();
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) pending.set(key, value);
  }
  if (pending.size === 0) return;

  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const lines = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8').split('\n') : [];
  const out: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      out.push(line);
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq <= 0) {
      out.push(line);
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    if (pending.has(key)) {
      out.push(`${key}=${pending.get(key)}`);
      pending.delete(key);
    } else {
      out.push(line);
    }
  }

  if (pending.size > 0) {
    if (out.length > 0 && out[out.length - 1] !== '') out.push('');
    out.push('# Dashboard updates');
    for (const [key, value] of pending) {
      out.push(`${key}=${value}`);
    }
  }

  fs.writeFileSync(filePath, out.join('\n').replace(/\n*$/, '\n'), 'utf8');
}

/** Write dashboard-managed keys to generated env and project .env when writable. */
export function persistDashboardEnvUpdates(updates: Record<string, string | undefined>): string {
  const generatedPath = getGeneratedEnvPath();
  applyEnvUpdates(generatedPath, updates);

  const projectEnvPath = getProjectEnvPath();
  if (fs.existsSync(projectEnvPath)) {
    try {
      applyEnvUpdates(projectEnvPath, updates);
    } catch {
      // Host .env may be read-only inside Docker — generated file is enough when compose allows it.
    }
  }

  return generatedPath;
}

/** Persist ENGINE_TYPE to generated env (and project .env when writable). */
export function persistEngineType(engineType: string): string {
  return persistDashboardEnvUpdates({ ENGINE_TYPE: engineType });
}
