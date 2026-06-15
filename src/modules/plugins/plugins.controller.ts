import { Controller, Get, Post, Put, Param, Body, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { PluginsService } from './plugins.service';
import { PluginDto, PluginConfigDto } from './dto/plugin.dto';
import { RequireRole } from '../auth/decorators/auth.decorators';
import { ApiKey, ApiKeyRole } from '../auth/entities/api-key.entity';
import { assertValidPluginId } from '../../common/utils/plugin-security.util';

type AuthedRequest = Request & { apiKey?: ApiKey };

@ApiTags('plugins')
@ApiBearerAuth()
@Controller('plugins')
export class PluginsController {
  constructor(private readonly pluginsService: PluginsService) {}

  @Get()
  @ApiOperation({ summary: 'List all plugins' })
  @ApiResponse({ status: 200, description: 'List of all plugins' })
  findAll(): PluginDto[] {
    return this.pluginsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get plugin by ID' })
  @ApiResponse({ status: 200, description: 'Plugin details' })
  @ApiResponse({ status: 404, description: 'Plugin not found' })
  findOne(@Param('id') id: string): PluginDto {
    assertValidPluginId(id);
    return this.pluginsService.findOne(id);
  }

  @Post(':id/enable')
  @RequireRole(ApiKeyRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enable a plugin' })
  @ApiResponse({ status: 200, description: 'Plugin enabled successfully' })
  async enable(
    @Param('id') id: string,
    @Req() req: AuthedRequest,
  ): Promise<{ success: boolean; message: string }> {
    assertValidPluginId(id);
    return await this.pluginsService.enable(id, req.apiKey);
  }

  @Post(':id/disable')
  @RequireRole(ApiKeyRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable a plugin' })
  @ApiResponse({ status: 200, description: 'Plugin disabled successfully' })
  async disable(
    @Param('id') id: string,
    @Req() req: AuthedRequest,
  ): Promise<{ success: boolean; message: string }> {
    assertValidPluginId(id);
    return await this.pluginsService.disable(id, req.apiKey);
  }

  @Put(':id/config')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Update plugin configuration' })
  @ApiResponse({ status: 200, description: 'Plugin configuration updated' })
  updateConfig(
    @Param('id') id: string,
    @Body() configDto: PluginConfigDto,
    @Req() req: AuthedRequest,
  ): { success: boolean; message: string } {
    assertValidPluginId(id);
    return this.pluginsService.updateConfig(id, configDto.config, req.apiKey);
  }

  @Get(':id/health')
  @ApiOperation({ summary: 'Check plugin health' })
  @ApiResponse({ status: 200, description: 'Plugin health status' })
  async healthCheck(@Param('id') id: string): Promise<{ healthy: boolean; message?: string }> {
    return await this.pluginsService.healthCheck(id);
  }
}
