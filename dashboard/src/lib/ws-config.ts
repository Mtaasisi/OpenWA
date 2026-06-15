/** Base HTTP origin for Socket.IO (namespace is appended as `/events`). */
export function getWsOrigin(): string {
  return import.meta.env.VITE_WS_URL || window.location.origin;
}

export function getEventsSocketUrl(): string {
  return `${getWsOrigin()}/events`;
}

export function getEventsSocketAuth(accessToken: string) {
  return {
    path: '/socket.io',
    // Auth payload only — avoid putting JWT in query string (breaks WS upgrade URLs).
    auth: { token: accessToken },
  };
}
