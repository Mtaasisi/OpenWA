import type { UserRole } from '../types/role';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  staffId: string | null;
  isActive: boolean;
};

const ACCESS_TOKEN_KEY = 'openwa_access_token';
const REFRESH_TOKEN_KEY = 'openwa_refresh_token';
const USER_KEY = 'openwa_user';

/** Fired when tokens are cleared (logout or failed refresh). App.tsx listens to return to login. */
export const AUTH_SESSION_CLEARED_EVENT = 'openwa:auth-cleared';

export function getAccessToken(): string | null {
  return sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return sessionStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  const raw = sessionStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setAuthSession(accessToken: string, refreshToken: string, user: AuthUser): void {
  sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  sessionStorage.setItem('openwa_key_id', user.staffId ?? '');
  sessionStorage.setItem('openwa_key_name', user.name);
  localStorage.setItem('openwa_user_role', user.role);
}

export function clearAuthSession(): void {
  const hadSession = !!sessionStorage.getItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  sessionStorage.removeItem('openwa_api_key');
  sessionStorage.removeItem('openwa_key_id');
  sessionStorage.removeItem('openwa_key_name');
  localStorage.removeItem('openwa_user_role');
  if (hadSession && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_SESSION_CLEARED_EVENT));
  }
}

export function getAuthHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Stable per-user key for client-side prefs (e.g. quick-reply favorites). */
export function getClientUserKey(): string {
  const user = getStoredUser();
  return user?.staffId ?? user?.id ?? 'anon';
}

export function hasAuthSession(): boolean {
  return !!getAccessToken();
}
