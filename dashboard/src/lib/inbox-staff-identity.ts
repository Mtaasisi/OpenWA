import { getDashboardStaffId } from './dashboard-scope';
import { getStoredUser } from './auth-storage';
import { loadUserPreferences } from './user-preferences';

/**
 * Resolve staff identity for inbox assignment filters.
 * Prefers authenticated session staffId; falls back to legacy localStorage override.
 */
export function getInboxStaffId(): string | null {
  const authStaffId = getDashboardStaffId()?.trim();
  if (authStaffId) return authStaffId;

  const userStaffId = getStoredUser()?.staffId?.trim();
  if (userStaffId) return userStaffId;

  const legacy = loadUserPreferences().inboxMyStaffId?.trim();
  return legacy || null;
}
