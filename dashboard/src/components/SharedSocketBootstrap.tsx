import { useEffect } from 'react';
import { ensureSocketConnection } from '../lib/socket-manager';

/** Keeps one Socket.IO connection alive for the authenticated app shell. */
export function SharedSocketBootstrap() {
  useEffect(() => {
    ensureSocketConnection();
  }, []);

  return null;
}
