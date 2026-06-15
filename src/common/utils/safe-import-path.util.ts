import * as fs from 'fs';
import * as path from 'path';
import { BadRequestException } from '@nestjs/common';

/**
 * Resolve a user-supplied filename to a path inside a controlled import directory.
 * Rejects absolute paths, `..`, and path separators in the filename.
 */
export function resolveControlledImportFile(
  fileName: string,
  importDir = path.resolve(process.cwd(), 'data', 'imports'),
): string {
  const base = path.basename(fileName?.trim() ?? '');
  if (!base || base !== fileName.trim()) {
    throw new BadRequestException('Invalid import file name');
  }
  if (base.includes('..') || base.includes('/') || base.includes('\\')) {
    throw new BadRequestException('Invalid import file name');
  }

  if (!fs.existsSync(importDir)) {
    fs.mkdirSync(importDir, { recursive: true });
  }

  const resolved = path.resolve(importDir, base);
  const relative = path.relative(importDir, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new BadRequestException('Import path escapes controlled directory');
  }
  return resolved;
}

export function toRelativeDataPath(absolutePath: string): string {
  const dataRoot = path.resolve(process.cwd(), 'data');
  const rel = path.relative(dataRoot, absolutePath);
  if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
    return rel.split(path.sep).join('/');
  }
  return path.basename(absolutePath);
}
