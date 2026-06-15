import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IWhatsAppEngine } from './interfaces/whatsapp-engine.interface';
import { WhatsAppWebJsAdapter } from './adapters/whatsapp-web-js.adapter';
import { PluginLoaderService, PluginType, IEnginePlugin, PluginManifest } from '../core/plugins';
import { WhatsAppWebJsPlugin } from '../plugins/engines/whatsapp-web-js';
import { BaileysPlugin } from '../plugins/engines/baileys';
import { BaileysAdapter } from './adapters/baileys.adapter';
import { WHATSAPP_ENGINE_IDS } from '../common/utils/session-engine.util';
import { createLogger } from '../common/services/logger.service';

export interface EngineCreateOptions {
  sessionId: string;
  /** Per-session engine; defaults to global ENGINE_TYPE when omitted. */
  engineType?: string;
  proxyUrl?: string;
  proxyType?: 'http' | 'https' | 'socks4' | 'socks5';
}

@Injectable()
export class EngineFactory implements OnModuleInit {
  private readonly logger = createLogger('EngineFactory');
  private readonly engineType: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly pluginLoader: PluginLoaderService,
  ) {
    this.engineType = this.configService.get<string>('engine.type') ?? 'whatsapp-web.js';
  }

  async onModuleInit(): Promise<void> {
    // Register built-in engine plugins
    await this.registerBuiltInEngines();
  }

  private async registerBuiltInEngines(): Promise<void> {
    // Register WhatsApp-web.js as built-in plugin
    const wwjsManifest: PluginManifest = {
      id: 'whatsapp-web.js',
      name: 'WhatsApp Web.js Engine',
      version: '1.0.0',
      type: PluginType.ENGINE,
      description: 'Official WhatsApp-web.js engine adapter',
      main: 'index.ts',
      provides: ['whatsapp-engine'],
    };

    const wwjsPlugin = new WhatsAppWebJsPlugin();
    this.pluginLoader.registerBuiltInPlugin(wwjsManifest, wwjsPlugin);

    const baileysManifest: PluginManifest = {
      id: 'baileys',
      name: 'Baileys Engine',
      version: '1.0.0',
      type: PluginType.ENGINE,
      description: 'WebSocket-based WhatsApp engine (no Puppeteer)',
      main: 'index.ts',
      provides: ['whatsapp-engine'],
    };

    const baileysPlugin = new BaileysPlugin();
    this.pluginLoader.registerBuiltInPlugin(baileysManifest, baileysPlugin);

    const sessionDataPath =
      this.configService.get<string>('engine.sessionDataPath') ?? './data/sessions';
    const engineConfig = {
      sessionDataPath,
      headless: this.configService.get<boolean>('engine.puppeteer.headless') ?? true,
      puppeteerArgs: this.configService.get<string[]>('engine.puppeteer.args') ?? [
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
      syncWindowMs: this.configService.get<number>('engine.wa.syncWindowMs', 300_000),
    };

    const activeEngine = WHATSAPP_ENGINE_IDS.includes(this.engineType as (typeof WHATSAPP_ENGINE_IDS)[number])
      ? this.engineType
      : 'whatsapp-web.js';

    for (const engineId of WHATSAPP_ENGINE_IDS) {
      if (engineId === activeEngine) continue;
      try {
        if (this.pluginLoader.isPluginEnabled(engineId)) {
          await this.pluginLoader.disablePlugin(engineId);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to disable inactive engine plugin: ${engineId}`,
          {
            action: 'engine_disable_failed',
            engineType: engineId,
            error: error instanceof Error ? error.message : String(error),
          },
        );
      }
    }

    try {
      this.pluginLoader.updatePluginConfig(activeEngine, engineConfig);
      await this.pluginLoader.enablePlugin(activeEngine);
      this.logger.log(`Engine plugin enabled: ${activeEngine}`, {
        action: 'engine_enabled',
        engineType: activeEngine,
      });
    } catch (error) {
      this.logger.error(
        `Failed to enable engine plugin: ${activeEngine}`,
        error instanceof Error ? error.message : String(error),
        { action: 'engine_enable_failed', engineType: activeEngine },
      );
    }

    this.logger.log(`Default ENGINE_TYPE: ${this.engineType}`, {
      action: 'engine_default',
      engineType: this.engineType,
    });
  }

  private getEngineRuntimeConfig(): {
    sessionDataPath: string;
    headless: boolean;
    puppeteerArgs: string[];
    syncWindowMs: number;
  } {
    return {
      sessionDataPath:
        this.configService.get<string>('engine.sessionDataPath') ?? './data/sessions',
      headless: this.configService.get<boolean>('engine.puppeteer.headless') ?? true,
      puppeteerArgs: this.configService.get<string[]>('engine.puppeteer.args') ?? [
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
      syncWindowMs: this.configService.get<number>('engine.wa.syncWindowMs', 300_000),
    };
  }

  create(options: EngineCreateOptions): IWhatsAppEngine {
    const engineType = options.engineType?.trim() || this.engineType;
    const runtimeConfig = this.getEngineRuntimeConfig();

    // Try to get engine from plugin system
    const enginePlugin = this.pluginLoader.getPlugin(engineType);

    if (enginePlugin?.instance && this.isEnginePlugin(enginePlugin.instance)) {
      return enginePlugin.instance.createEngine({
        sessionId: options.sessionId,
        sessionDataPath: runtimeConfig.sessionDataPath,
        headless: runtimeConfig.headless,
        puppeteerArgs: runtimeConfig.puppeteerArgs,
        syncWindowMs: runtimeConfig.syncWindowMs,
        proxyUrl: options.proxyUrl,
        proxyType: options.proxyType,
      }) as IWhatsAppEngine;
    }

    // Fallback to direct adapter creation (legacy support)
    this.logger.warn(`Engine plugin ${engineType} not available, using fallback`, {
      action: 'engine_fallback',
      engineType,
    });

    return this.createFallbackEngine(options, engineType);
  }

  private isEnginePlugin(instance: unknown): instance is IEnginePlugin {
    return (
      typeof instance === 'object' &&
      instance !== null &&
      'type' in instance &&
      (instance as { type: unknown }).type === PluginType.ENGINE &&
      'createEngine' in instance &&
      typeof (instance as { createEngine: unknown }).createEngine === 'function'
    );
  }

  private createFallbackEngine(options: EngineCreateOptions, engineType: string): IWhatsAppEngine {
    if (engineType === 'baileys') {
      return new BaileysAdapter({
        sessionId: options.sessionId,
        sessionDataPath: this.configService.get<string>('engine.sessionDataPath') ?? './data/sessions',
        proxy: options.proxyUrl
          ? {
              url: options.proxyUrl,
              type: options.proxyType ?? 'http',
            }
          : undefined,
      });
    }

    // Legacy direct creation (fallback)
    return new WhatsAppWebJsAdapter({
      sessionId: options.sessionId,
      sessionDataPath: this.configService.get<string>('engine.sessionDataPath') ?? './data/sessions',
      syncWindowMs: this.configService.get<number>('engine.wa.syncWindowMs', 300_000),
      puppeteer: {
        headless: this.configService.get<boolean>('engine.puppeteer.headless') ?? true,
        args: this.configService.get<string[]>('engine.puppeteer.args') ?? ['--no-sandbox', '--disable-setuid-sandbox'],
      },
      proxy: options.proxyUrl
        ? {
            url: options.proxyUrl,
            type: options.proxyType ?? 'http',
          }
        : undefined,
    });
  }

  // ============================================================================
  // Query Methods for API/Dashboard
  // ============================================================================

  getAvailableEngines(): Array<{ id: string; name: string; enabled: boolean; features: string[] }> {
    const enginePlugins = this.pluginLoader.getPluginsByType(PluginType.ENGINE);

    return enginePlugins.map(plugin => {
      const features = plugin.instance && this.isEnginePlugin(plugin.instance) ? plugin.instance.getFeatures() : [];

      return {
        id: plugin.manifest.id,
        name: plugin.manifest.name,
        enabled: this.pluginLoader.isPluginEnabled(plugin.manifest.id),
        features,
      };
    });
  }

  getCurrentEngine(): string {
    return this.engineType;
  }
}
