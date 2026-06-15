import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  clearEngineAuth,
  clearAllSessionAuth,
  hasBaileysAuth,
  hasEngineAuth,
  hasWwjsAuth,
  migrateSessionAuthFromLegacy,
  sessionRequiresEngineRelink,
  sessionRelinkReason,
} from './engine-auth.util';

describe('engine-auth.util', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openwa-engine-auth-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('detects baileys creds.json', () => {
    const authDir = path.join(tmpDir, 'baileys', 'demo');
    fs.mkdirSync(authDir, { recursive: true });
    fs.writeFileSync(path.join(authDir, 'creds.json'), '{"registered":true}', 'utf8');
    expect(hasBaileysAuth(tmpDir, 'demo')).toBe(true);
    expect(hasEngineAuth('baileys', tmpDir, 'demo')).toBe(true);
  });

  it('treats Baileys 7 QR-linked creds as auth even when registered is false', () => {
    const authDir = path.join(tmpDir, 'baileys', 'demo');
    fs.mkdirSync(authDir, { recursive: true });
    fs.writeFileSync(
      path.join(authDir, 'creds.json'),
      '{"registered":false,"me":{"id":"255700000000:41@s.whatsapp.net"},"noiseKey":{"private":{"type":"Buffer","data":[1]}}}',
      'utf8',
    );
    expect(hasBaileysAuth(tmpDir, 'demo')).toBe(true);
    expect(hasEngineAuth('baileys', tmpDir, 'demo')).toBe(true);
    expect(sessionRequiresEngineRelink('baileys', tmpDir, 'demo', '255700000000')).toBe(false);
  });

  it('treats incomplete baileys creds as no auth', () => {
    const authDir = path.join(tmpDir, 'baileys', 'demo');
    fs.mkdirSync(authDir, { recursive: true });
    fs.writeFileSync(
      path.join(authDir, 'creds.json'),
      '{"registered":false,"pairingEphemeralKeyPair":{"private":{"type":"Buffer","data":[1]}}}',
      'utf8',
    );
    expect(hasBaileysAuth(tmpDir, 'demo')).toBe(false);
    expect(hasEngineAuth('baileys', tmpDir, 'demo')).toBe(false);
    expect(sessionRequiresEngineRelink('baileys', tmpDir, 'demo', '255700000000')).toBe(true);
  });

  it('detects wwjs session folder', () => {
    const authDir = path.join(tmpDir, 'session-demo');
    fs.mkdirSync(authDir, { recursive: true });
    fs.writeFileSync(path.join(authDir, 'Default'), '', 'utf8');
    expect(hasWwjsAuth(tmpDir, 'demo')).toBe(true);
    expect(hasEngineAuth('whatsapp-web.js', tmpDir, 'demo')).toBe(true);
  });

  it('requires relink when phone exists but engine auth is missing', () => {
    expect(sessionRequiresEngineRelink('baileys', tmpDir, 'demo', '255700000000')).toBe(true);
    expect(sessionRequiresEngineRelink('baileys', tmpDir, 'demo', null)).toBe(false);
  });

  it('distinguishes alternate engine auth from missing auth', () => {
    const wwjsDir = path.join(tmpDir, 'session-demo');
    fs.mkdirSync(wwjsDir, { recursive: true });
    fs.writeFileSync(path.join(wwjsDir, 'Default'), 'ok', 'utf8');
    expect(sessionRelinkReason('baileys', tmpDir, 'demo', '255700000000')).toBe('alternate_engine');
    expect(sessionRelinkReason('baileys', tmpDir, 'demo', null)).toBe(null);
  });

  it('clearEngineAuth removes baileys and wwjs auth folders', () => {
    const baileysDir = path.join(tmpDir, 'baileys', 'demo');
    fs.mkdirSync(baileysDir, { recursive: true });
    fs.writeFileSync(path.join(baileysDir, 'creds.json'), '{}', 'utf8');
    const wwjsDir = path.join(tmpDir, 'session-demo');
    fs.mkdirSync(wwjsDir, { recursive: true });
    fs.writeFileSync(path.join(wwjsDir, 'Default'), '', 'utf8');

    clearEngineAuth('baileys', tmpDir, 'demo');
    expect(hasBaileysAuth(tmpDir, 'demo')).toBe(false);
    expect(hasWwjsAuth(tmpDir, 'demo')).toBe(true);

    clearEngineAuth('whatsapp-web.js', tmpDir, 'demo');
    expect(hasWwjsAuth(tmpDir, 'demo')).toBe(false);
  });

  it('clearAllSessionAuth removes both baileys and wwjs auth folders', () => {
    const baileysDir = path.join(tmpDir, 'baileys', 'demo');
    fs.mkdirSync(baileysDir, { recursive: true });
    fs.writeFileSync(path.join(baileysDir, 'creds.json'), '{"registered":true}', 'utf8');
    const wwjsDir = path.join(tmpDir, 'session-demo');
    fs.mkdirSync(wwjsDir, { recursive: true });
    fs.writeFileSync(path.join(wwjsDir, 'Default'), '', 'utf8');

    clearAllSessionAuth(tmpDir, 'demo');
    expect(hasBaileysAuth(tmpDir, 'demo')).toBe(false);
    expect(hasWwjsAuth(tmpDir, 'demo')).toBe(false);
  });

  it('migrateSessionAuthFromLegacy copies wwjs auth from legacy path', () => {
    const legacy = path.join(tmpDir, 'legacy');
    const target = path.join(tmpDir, 'target');
    const authDir = path.join(legacy, 'session-demo');
    fs.mkdirSync(authDir, { recursive: true });
    fs.writeFileSync(path.join(authDir, 'Default'), 'ok', 'utf8');

    expect(migrateSessionAuthFromLegacy('whatsapp-web.js', target, 'demo', [legacy])).toBe(true);
    expect(hasEngineAuth('whatsapp-web.js', target, 'demo')).toBe(true);
  });
});
