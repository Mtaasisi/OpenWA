import { resolveSessionEngineType, isSupportedEngineType } from './session-engine.util';

describe('session-engine.util', () => {
  it('resolves override when set', () => {
    expect(resolveSessionEngineType({ engineType: 'baileys' }, 'whatsapp-web.js')).toBe('baileys');
  });

  it('falls back to default when override is null', () => {
    expect(resolveSessionEngineType({ engineType: null }, 'baileys')).toBe('baileys');
  });

  it('ignores invalid override', () => {
    expect(resolveSessionEngineType({ engineType: 'unknown' }, 'baileys')).toBe('baileys');
  });

  it('validates supported engine ids', () => {
    expect(isSupportedEngineType('baileys')).toBe(true);
    expect(isSupportedEngineType('telegram')).toBe(false);
  });
});
