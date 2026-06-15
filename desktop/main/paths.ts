import * as path from 'path';

/** OpenWA repo root when Electron main runs from desktop/dist/main. */
export function resolveRepoRoot(): string {
  return path.resolve(__dirname, '..', '..', '..');
}

/** desktop/ package root (assets, runtimes, renderer). */
export function resolveDesktopRoot(): string {
  return path.resolve(__dirname, '..', '..');
}

/** Local CRM data SQLite file under app userData. */
export function getEmbeddedDataSqlitePath(appDataRoot: string): string {
  return path.join(appDataRoot, 'config', 'openwa.sqlite');
}
