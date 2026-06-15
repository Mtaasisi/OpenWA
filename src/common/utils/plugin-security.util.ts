import { BadRequestException } from '@nestjs/common';

/** Safe plugin identifiers: alphanumeric, dots, dashes, underscores; no path separators. */
const PLUGIN_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;

/** Storage keys: single path segment only (no directories). */
const PLUGIN_STORAGE_KEY_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,255}$/;

export function assertValidPluginId(pluginId: string): void {
  const id = pluginId?.trim();
  if (!id || !PLUGIN_ID_PATTERN.test(id)) {
    throw new BadRequestException('Invalid plugin id');
  }
  if (id.includes('..') || id.includes('/') || id.includes('\\')) {
    throw new BadRequestException('Invalid plugin id');
  }
}

export function assertValidPluginStorageKey(key: string): void {
  const k = key?.trim();
  if (!k || !PLUGIN_STORAGE_KEY_PATTERN.test(k)) {
    throw new BadRequestException('Invalid plugin storage key');
  }
  if (k.includes('..') || k.includes('/') || k.includes('\\') || pathLooksAbsolute(k)) {
    throw new BadRequestException('Invalid plugin storage key');
  }
}

function pathLooksAbsolute(value: string): boolean {
  return value.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(value);
}
