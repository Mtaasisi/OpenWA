import { BadRequestException, Inject, Injectable, NotFoundException, forwardRef } from '@nestjs/common';
import { PluginLoaderService, PluginStatus, PluginType } from '../../core/plugins';
import { persistEngineType } from '../../common/utils/env-file.util';
import { PluginDto } from './dto/plugin.dto';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { ApiKey } from '../auth/entities/api-key.entity';
import { assertValidPluginId } from '../../common/utils/plugin-security.util';
import { createLogger } from '../../common/services/logger.service';
import { SessionService } from '../session/session.service';

@Injectable()
export class PluginsService {
  private readonly logger = createLogger('PluginsService');

  constructor(
    private readonly pluginLoader: PluginLoaderService,
    private readonly auditService: AuditService,
    @Inject(forwardRef(() => SessionService))
    private readonly sessionService: SessionService,
  ) {}

  findAll(): PluginDto[] {
    const plugins = this.pluginLoader.getAllPlugins();

    return plugins.map(plugin => ({
      id: plugin.manifest.id,
      name: plugin.manifest.name,
      version: plugin.manifest.version,
      type: plugin.manifest.type,
      description: plugin.manifest.description,
      author: plugin.manifest.author,
      status: plugin.status,
      config: plugin.config,
      builtIn: plugin.manifest.id === 'whatsapp-web.js' || plugin.manifest.id === 'baileys',
      provides: plugin.manifest.provides ?? [],
      configSchema: plugin.manifest.configSchema,
      loadedAt: plugin.loadedAt?.toISOString(),
      enabledAt: plugin.enabledAt?.toISOString(),
      error: plugin.error,
    }));
  }

  findOne(id: string): PluginDto {
    assertValidPluginId(id);
    const plugin = this.pluginLoader.getPlugin(id);

    if (!plugin) {
      throw new NotFoundException(`Plugin ${id} not found`);
    }

    return {
      id: plugin.manifest.id,
      name: plugin.manifest.name,
      version: plugin.manifest.version,
      type: plugin.manifest.type,
      description: plugin.manifest.description,
      author: plugin.manifest.author,
      status: plugin.status,
      config: plugin.config,
      builtIn: plugin.manifest.id === 'whatsapp-web.js' || plugin.manifest.id === 'baileys',
      provides: plugin.manifest.provides ?? [],
      configSchema: plugin.manifest.configSchema,
      loadedAt: plugin.loadedAt?.toISOString(),
      enabledAt: plugin.enabledAt?.toISOString(),
      error: plugin.error,
    };
  }

  async enable(
    id: string,
    apiKey?: ApiKey,
  ): Promise<{ success: boolean; message: string; restartRequired?: boolean }> {
    assertValidPluginId(id);
    const plugin = this.pluginLoader.getPlugin(id);

    if (!plugin) {
      throw new NotFoundException(`Plugin ${id} not found`);
    }

    if (plugin.status === PluginStatus.ENABLED) {
      return {
        success: true,
        message: `Plugin ${id} is already enabled`,
        restartRequired: plugin.manifest.type === PluginType.ENGINE,
      };
    }

    try {
      if (plugin.manifest.type === PluginType.ENGINE) {
        for (const other of this.pluginLoader.getPluginsByType(PluginType.ENGINE)) {
          if (other.manifest.id !== id && other.status === PluginStatus.ENABLED) {
            await this.pluginLoader.disablePlugin(other.manifest.id);
          }
        }
      }

      await this.pluginLoader.enablePlugin(id);

      if (plugin.manifest.type === PluginType.ENGINE) {
        persistEngineType(id);
        const cleared = await this.sessionService.clearAllEngineOverrides();
        if (cleared > 0) {
          this.logger.log(`Cleared engine override on ${cleared} session(s)`, {
            action: 'session_engine_overrides_cleared',
            engineType: id,
          });
        }
      }

      this.logger.log(`Plugin enabled: ${id}`, { pluginId: id, action: 'plugin_enabled' });
      void this.auditService.logInfo(AuditAction.PLUGIN_ENABLED, {
        apiKey,
        metadata: { pluginId: id },
      });
      const restartRequired = plugin.manifest.type === PluginType.ENGINE;
      return {
        success: true,
        message: restartRequired
          ? `Engine switched to ${id}. Restart the API to apply, then re-link sessions with QR.`
          : `Plugin ${id} enabled successfully`,
        restartRequired,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async disable(id: string, apiKey?: ApiKey): Promise<{ success: boolean; message: string }> {
    assertValidPluginId(id);
    const plugin = this.pluginLoader.getPlugin(id);

    if (!plugin) {
      throw new NotFoundException(`Plugin ${id} not found`);
    }

    if (plugin.status !== PluginStatus.ENABLED) {
      return { success: true, message: `Plugin ${id} is not enabled` };
    }

    if (plugin.manifest.type === PluginType.ENGINE) {
      throw new BadRequestException('Activate another engine plugin instead of disabling the active engine.');
    }

    try {
      await this.pluginLoader.disablePlugin(id);
      this.logger.log(`Plugin disabled: ${id}`, { pluginId: id, action: 'plugin_disabled' });
      void this.auditService.logInfo(AuditAction.PLUGIN_DISABLED, {
        apiKey,
        metadata: { pluginId: id },
      });
      return { success: true, message: `Plugin ${id} disabled successfully` };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  updateConfig(
    id: string,
    config: Record<string, unknown>,
    apiKey?: ApiKey,
  ): { success: boolean; message: string } {
    assertValidPluginId(id);
    const plugin = this.pluginLoader.getPlugin(id);

    if (!plugin) {
      throw new NotFoundException(`Plugin ${id} not found`);
    }

    try {
      this.pluginLoader.updatePluginConfig(id, config);
      this.logger.log(`Plugin config updated: ${id}`, { pluginId: id, action: 'plugin_config_updated' });
      void this.auditService.logInfo(AuditAction.PLUGIN_CONFIG_UPDATED, {
        apiKey,
        metadata: { pluginId: id, configKeys: Object.keys(config) },
      });
      return { success: true, message: `Plugin ${id} configuration updated` };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async healthCheck(id: string): Promise<{ healthy: boolean; message?: string }> {
    const plugin = this.pluginLoader.getPlugin(id);

    if (!plugin) {
      throw new NotFoundException(`Plugin ${id} not found`);
    }

    if (!plugin.instance?.healthCheck) {
      return { healthy: true, message: 'Plugin does not implement health check' };
    }

    try {
      return await plugin.instance.healthCheck();
    } catch (error) {
      return {
        healthy: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
