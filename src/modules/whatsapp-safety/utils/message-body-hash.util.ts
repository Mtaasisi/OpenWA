import { createHash } from 'crypto';

/** Normalized short hash for duplicate outbound body detection. */
export function hashMessageBody(body: string): string {
  return createHash('sha256').update(body.trim().toLowerCase()).digest('hex').slice(0, 16);
}
