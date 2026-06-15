import * as fs from 'fs';
import * as path from 'path';

const CHROMIUM_LOCK_FILES = new Set(['SingletonLock', 'SingletonSocket', 'SingletonCookie']);

function dirHasAuthContent(dir: string): boolean {
  if (!fs.existsSync(dir)) return false;
  try {
    const entries = fs.readdirSync(dir);
    return entries.some(name => !CHROMIUM_LOCK_FILES.has(name) && !name.startsWith('.'));
  } catch {
    return false;
  }
}

export function baileysAuthDir(sessionDataPath: string, sessionName: string): string {
  return path.join(path.resolve(sessionDataPath), 'baileys', sessionName);
}

export function wwjsAuthDirs(sessionDataPath: string, sessionName: string): string[] {
  const base = path.resolve(sessionDataPath);
  return [
    path.join(base, '.wwebjs_auth', `session-${sessionName}`),
    path.join(base, `session-${sessionName}`),
  ];
}

export function readBaileysCreds(
  sessionDataPath: string,
  sessionName: string,
): Record<string, unknown> | null {
  const credsPath = path.join(baileysAuthDir(sessionDataPath, sessionName), 'creds.json');
  try {
    if (!fs.existsSync(credsPath) || fs.statSync(credsPath).size <= 10) return null;
    return JSON.parse(fs.readFileSync(credsPath, 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function hasBaileysAuth(sessionDataPath: string, sessionName: string): boolean {
  const creds = readBaileysCreds(sessionDataPath, sessionName);
  if (!creds) return false;
  if (creds.registered === true) return true;
  // Baileys 7 QR linking can leave registered=false while me + identity keys are saved.
  const me = creds.me as { id?: string } | undefined;
  const meId = me?.id?.trim();
  if (meId?.includes('@s.whatsapp.net')) {
    return Boolean(creds.signedIdentityKey || creds.noiseKey);
  }
  return false;
}

/** Partial pairing state left after a failed QR scan — must be cleared before retrying. */
export function hasIncompleteBaileysAuth(sessionDataPath: string, sessionName: string): boolean {
  const creds = readBaileysCreds(sessionDataPath, sessionName);
  if (creds == null || hasBaileysAuth(sessionDataPath, sessionName)) return false;
  return Boolean(creds.noiseKey || creds.pairingEphemeralKeyPair);
}

export function hasWwjsAuth(sessionDataPath: string, sessionName: string): boolean {
  return wwjsAuthDirs(sessionDataPath, sessionName).some(dirHasAuthContent);
}

/** Auth folder exists for the non-active engine (e.g. wwjs creds while Baileys is active). */
export function hasAlternateEngineAuth(
  engineType: string,
  sessionDataPath: string,
  sessionName: string,
): boolean {
  if (engineType === 'baileys') return hasWwjsAuth(sessionDataPath, sessionName);
  return hasBaileysAuth(sessionDataPath, sessionName);
}

export type SessionRelinkReason = 'alternate_engine' | 'auth_missing';

export function sessionRelinkReason(
  engineType: string,
  sessionDataPath: string,
  sessionName: string,
  phone?: string | null,
): SessionRelinkReason | null {
  if (!sessionRequiresEngineRelink(engineType, sessionDataPath, sessionName, phone)) {
    return null;
  }
  return hasAlternateEngineAuth(engineType, sessionDataPath, sessionName)
    ? 'alternate_engine'
    : 'auth_missing';
}

export function hasEngineAuth(engineType: string, sessionDataPath: string, sessionName: string): boolean {
  if (engineType === 'baileys') return hasBaileysAuth(sessionDataPath, sessionName);
  return hasWwjsAuth(sessionDataPath, sessionName);
}

export function sessionRequiresEngineRelink(
  engineType: string,
  sessionDataPath: string,
  sessionName: string,
  phone?: string | null,
): boolean {
  return Boolean(phone?.trim()) && !hasEngineAuth(engineType, sessionDataPath, sessionName);
}

/** Remove on-disk auth for the active engine (user must scan QR again). */
export function clearEngineAuth(engineType: string, sessionDataPath: string, sessionName: string): void {
  if (engineType === 'baileys') {
    fs.rmSync(baileysAuthDir(sessionDataPath, sessionName), { recursive: true, force: true });
    return;
  }
  for (const dir of wwjsAuthDirs(sessionDataPath, sessionName)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Remove Baileys and whatsapp-web.js auth folders (used when deleting a session entirely). */
export function clearAllSessionAuth(sessionDataPath: string, sessionName: string): void {
  clearEngineAuth('baileys', sessionDataPath, sessionName);
  clearEngineAuth('whatsapp-web.js', sessionDataPath, sessionName);
}

/** Dev/desktop orphan backends may write auth under cwd/data/sessions instead of OPENWA_DATA_ROOT. */
export function listLegacySessionDataPaths(currentSessionDataPath: string): string[] {
  const resolvedCurrent = path.resolve(currentSessionDataPath);
  const candidates = [path.resolve(process.cwd(), 'data', 'sessions')];
  return candidates.filter(
    candidate => candidate !== resolvedCurrent && fs.existsSync(candidate),
  );
}

export function migrateSessionAuthFromLegacy(
  engineType: string,
  targetSessionDataPath: string,
  sessionName: string,
  legacyPaths?: string[],
): boolean {
  const target = path.resolve(targetSessionDataPath);
  if (hasEngineAuth(engineType, target, sessionName)) return false;

  const sources = legacyPaths ?? listLegacySessionDataPaths(target);
  let migrated = false;

  for (const legacyBase of sources) {
    if (engineType === 'baileys') {
      const src = baileysAuthDir(legacyBase, sessionName);
      const dest = baileysAuthDir(target, sessionName);
      if (!hasBaileysAuth(legacyBase, sessionName) || fs.existsSync(dest)) continue;
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.cpSync(src, dest, { recursive: true });
      migrated = true;
      continue;
    }

    for (const src of wwjsAuthDirs(legacyBase, sessionName)) {
      if (!dirHasAuthContent(src)) continue;
      const rel = path.relative(legacyBase, src);
      const dest = path.join(target, rel);
      if (fs.existsSync(dest)) continue;
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.cpSync(src, dest, { recursive: true });
      migrated = true;
    }
  }

  return migrated;
}
