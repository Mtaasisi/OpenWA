/** Clear client auth and reload so App shows login. */
export function performLogout(): void {
  sessionStorage.removeItem('openwa_api_key');
  localStorage.removeItem('openwa_user_role');
  window.location.assign('/');
}
