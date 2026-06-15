import { clearAuthSession, getAccessToken } from './auth-storage';

/** Clear client auth and reload so App shows login. */
export async function performLogout(): Promise<void> {
  const token = getAccessToken();
  if (token) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // ignore — still clear local session
    }
  }
  clearAuthSession();
  window.location.assign('/');
}
