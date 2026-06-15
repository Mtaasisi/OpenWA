import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PluginLoaderService } from '../core/plugins';

jest.mock('./adapters/baileys.adapter', () => ({
  BaileysAdapter: class MockBaileysAdapter {
    initialize = jest.fn();
  },
}));

jest.mock('./adapters/whatsapp-web-js.adapter', () => ({
  WhatsAppWebJsAdapter: class MockWhatsAppWebJsAdapter {
    initialize = jest.fn();
  },
}));

import { EngineFactory } from './engine.factory';
import { BaileysAdapter } from './adapters/baileys.adapter';
import { WhatsAppWebJsAdapter } from './adapters/whatsapp-web-js.adapter';

describe('EngineFactory', () => {
  const mockPluginLoader = {
    registerBuiltInPlugin: jest.fn(),
    enablePlugin: jest.fn().mockResolvedValue(undefined),
    disablePlugin: jest.fn().mockResolvedValue(undefined),
    updatePluginConfig: jest.fn(),
    getPlugin: jest.fn(),
    getPluginsByType: jest.fn(),
    isPluginEnabled: jest.fn(),
  };

  const createFactory = async (engineType: string) => {
    const module = await Test.createTestingModule({
      providers: [
        EngineFactory,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback?: unknown) => {
              const map: Record<string, unknown> = {
                'engine.type': engineType,
                'engine.sessionDataPath': './data/sessions',
                'engine.puppeteer.headless': true,
                'engine.puppeteer.args': ['--no-sandbox'],
                'engine.wa.syncWindowMs': 300_000,
              };
              return map[key] ?? fallback;
            },
          },
        },
        { provide: PluginLoaderService, useValue: mockPluginLoader },
      ],
    }).compile();

    const factory = module.get(EngineFactory);
    await factory.onModuleInit();
    return factory;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPluginLoader.getPluginsByType.mockReturnValue([
      { manifest: { id: 'whatsapp-web.js', name: 'WWJS' }, instance: null, status: 'enabled' },
      { manifest: { id: 'baileys', name: 'Baileys' }, instance: null, status: 'disabled' },
    ]);
    mockPluginLoader.isPluginEnabled.mockImplementation((id: string) => id === 'whatsapp-web.js');
  });

  it('registers whatsapp-web.js and baileys built-in plugins', async () => {
    await createFactory('whatsapp-web.js');
    const ids = mockPluginLoader.registerBuiltInPlugin.mock.calls.map((c: unknown[]) => (c[0] as { id: string }).id);
    expect(ids).toContain('whatsapp-web.js');
    expect(ids).toContain('baileys');
  });

  it('enables only ENGINE_TYPE on boot', async () => {
    await createFactory('baileys');
    expect(mockPluginLoader.updatePluginConfig).toHaveBeenCalledWith('baileys', expect.any(Object));
    expect(mockPluginLoader.enablePlugin).toHaveBeenCalledWith('baileys');
    expect(mockPluginLoader.enablePlugin).not.toHaveBeenCalledWith('whatsapp-web.js');
  });

  it('disables the inactive engine on boot when it was previously enabled', async () => {
    mockPluginLoader.isPluginEnabled.mockImplementation((id: string) => id === 'whatsapp-web.js');
    await createFactory('baileys');
    expect(mockPluginLoader.disablePlugin).toHaveBeenCalledWith('whatsapp-web.js');
  });

  it('create() falls back to BaileysAdapter when baileys plugin unavailable', async () => {
    mockPluginLoader.getPlugin.mockReturnValue(null);
    const factory = await createFactory('baileys');
    const engine = factory.create({ sessionId: 'test-session' });
    expect(engine).toBeInstanceOf(BaileysAdapter);
  });

  it('create() falls back to WhatsAppWebJsAdapter for whatsapp-web.js', async () => {
    mockPluginLoader.getPlugin.mockReturnValue(null);
    const factory = await createFactory('whatsapp-web.js');
    const engine = factory.create({ sessionId: 'test-session' });
    expect(engine).toBeInstanceOf(WhatsAppWebJsAdapter);
  });

  it('create() honors per-session engineType override', async () => {
    mockPluginLoader.getPlugin.mockReturnValue(null);
    const factory = await createFactory('whatsapp-web.js');
    const engine = factory.create({ sessionId: 'test-session', engineType: 'baileys' });
    expect(engine).toBeInstanceOf(BaileysAdapter);
  });

  it('getAvailableEngines lists both engines', async () => {
    const factory = await createFactory('whatsapp-web.js');
    const engines = factory.getAvailableEngines();
    expect(engines.map(e => e.id)).toEqual(expect.arrayContaining(['whatsapp-web.js', 'baileys']));
  });
});
