import {
  clearAllSessionAuth,
  listLegacySessionDataPaths,
} from '../../common/utils/engine-auth.util';
import { removeSessionProfileDir } from '../../common/utils/chromium-profile.util';

/** Remove WhatsApp auth folders and Chromium profiles from primary and legacy session paths. */
export function purgeSessionAuthAndProfiles(
  sessionDataPath: string,
  sessionName: string,
): void {
  const paths = [sessionDataPath, ...listLegacySessionDataPaths(sessionDataPath)];
  for (const base of paths) {
    clearAllSessionAuth(base, sessionName);
    removeSessionProfileDir(base, sessionName);
  }
}
