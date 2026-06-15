import type { UserRole } from '../types/role';

export type DashboardScope = 'admin' | 'staff';

export function getDashboardScope(
  role: UserRole | null,
  roleValidated: boolean,
): DashboardScope {
  if (roleValidated && role === 'admin') return 'admin';
  return 'staff';
}

export function getDashboardStaffId(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  return sessionStorage.getItem('openwa_key_id');
}
