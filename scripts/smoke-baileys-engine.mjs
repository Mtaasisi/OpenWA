#!/usr/bin/env node
/**
 * Smoke test: Baileys + mixed per-session engines (no WhatsApp link required).
 */
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EngineFactory } from '../dist/engine/engine.factory.js';
import { BaileysAdapter } from '../dist/engine/adapters/baileys.adapter.js';
import { WhatsAppWebJsAdapter } from '../dist/engine/adapters/whatsapp-web-js.adapter.js';
import { WhatsAppWebJsPlugin } from '../dist/plugins/engines/whatsapp-web-js/index.js';
import { BaileysPlugin } from '../dist/plugins/engines/baileys/index.js';
import { PluginType } from '../dist/core/plugins/plugin.interfaces.js';

const engineConfig = {
  sessionDataPath: './data/sessions',
  headless: true,
  puppeteerArgs: ['--no-sandbox'],
  syncWindowMs: 300_000,
};

function createMockPluginLoader() {
  const plugins = new Map();
  const enabled = new Set();

  return {
    registerBuiltInPlugin(manifest, instance) {
      plugins.set(manifest.id, { manifest, instance, status: 'disabled' });
    },
    async enablePlugin(id) {
      const plugin = plugins.get(id);
      if (!plugin) throw new Error(`Plugin ${id} not found`);
      plugin.status = 'enabled';
      plugin.config = { ...engineConfig };
      enabled.add(id);
    },
    updatePluginConfig(id, config) {
      const plugin = plugins.get(id);
      if (plugin) plugin.config = { ...plugin.config, ...config };
    },
    getPlugin(id) {
      const plugin = plugins.get(id);
      if (!plugin) return undefined;
      return {
        ...plugin,
        instance: plugin.instance,
      };
    },
    getPluginsByType(type) {
      return [...plugins.values()].filter(p => p.manifest.type === type);
    },
    isPluginEnabled(id) {
      return enabled.has(id);
    },
  };
}

const mockPluginLoader = createMockPluginLoader();
mockPluginLoader.registerBuiltInPlugin(
  {
    id: 'whatsapp-web.js',
    name: 'WhatsApp Web.js Engine',
    version: '1.0.0',
    type: PluginType.ENGINE,
    main: 'index.ts',
    provides: ['whatsapp-engine'],
  },
  new WhatsAppWebJsPlugin(),
);
mockPluginLoader.registerBuiltInPlugin(
  {
    id: 'baileys',
    name: 'Baileys Engine',
    version: '1.0.0',
    type: PluginType.ENGINE,
    main: 'index.ts',
    provides: ['whatsapp-engine'],
  },
  new BaileysPlugin(),
);

const moduleRef = await Test.createTestingModule({
  providers: [
    EngineFactory,
    {
      provide: (await import('../dist/core/plugins/index.js')).PluginLoaderService,
      useValue: mockPluginLoader,
    },
    {
      provide: ConfigService,
      useValue: {
        get: (key, fallback) => {
          const map = {
            'engine.type': 'whatsapp-web.js',
            'engine.sessionDataPath': engineConfig.sessionDataPath,
            'engine.puppeteer.headless': engineConfig.headless,
            'engine.puppeteer.args': engineConfig.puppeteerArgs,
            'engine.wa.syncWindowMs': engineConfig.syncWindowMs,
          };
          return map[key] ?? fallback;
        },
      },
    },
  ],
}).compile();

const factory = moduleRef.get(EngineFactory);
await factory.onModuleInit();

const engines = factory.getAvailableEngines();
const ids = engines.map(e => e.id);
if (!ids.includes('baileys') || !ids.includes('whatsapp-web.js')) {
  console.error('FAIL: missing built-in engines', ids);
  process.exit(1);
}

const wwjsDefault = factory.create({ sessionId: `smoke-wwjs-${Date.now()}` });
if (!(wwjsDefault instanceof WhatsAppWebJsAdapter)) {
  console.error('FAIL: default create() did not return WhatsAppWebJsAdapter', wwjsDefault.constructor.name);
  process.exit(1);
}

const baileysOverride = factory.create({
  sessionId: `smoke-baileys-${Date.now()}`,
  engineType: 'baileys',
});
if (!(baileysOverride instanceof BaileysAdapter)) {
  console.error('FAIL: per-session baileys create() did not return BaileysAdapter', baileysOverride.constructor.name);
  process.exit(1);
}

let qrReceived = false;
const stateChanges = [];

await baileysOverride.initialize({
  onStateChanged: state => stateChanges.push(state),
  onQRCode: () => {
    qrReceived = true;
  },
});

await new Promise(r => setTimeout(r, 3000));
await baileysOverride.destroy();
if (typeof wwjsDefault.destroy === 'function') {
  await wwjsDefault.destroy().catch(() => undefined);
}

console.log('engines:', ids.join(', '));
console.log('default:', factory.getCurrentEngine());
console.log('mixed wwjs:', wwjsDefault.constructor.name);
console.log('mixed baileys:', baileysOverride.constructor.name);
console.log('baileys state trail:', stateChanges.join(' -> ') || '(none yet)');
console.log('baileys qr event:', qrReceived ? 'received' : 'not yet (ok for smoke)');
console.log('smoke-baileys-engine:ok');
