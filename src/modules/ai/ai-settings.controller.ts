import {
  Controller,
  Get,
  Put,
  Patch,
  Post,
  Delete,
  Body,
  Query,
  Param,
  ParseIntPipe,
  ParseEnumPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RequireRole } from '../auth/decorators/auth.decorators';
import { ApiKeyRole } from '../auth/entities/api-key.entity';
import { AiSettingsService } from './ai-settings.service';
import { AiChatService } from './ai-chat.service';
import { AiStatusService } from './ai-status.service';
import { UpsertAiConfigDto, FallbackModelDto, AiAutoReplyPreviewDto } from './dto/ai.dto';
import { AiProvider, AI_PROVIDER_VALUES } from './ai.enums';
import { PROVIDER_LABELS } from './ai-provider-catalog';
import { AiAutoReplyMasterService } from './ai-auto-reply-master.service';
import { AUTO_REPLY_PRESETS } from './ai-auto-reply-presets';

@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings/ai')
export class AiSettingsController {
  constructor(
    private readonly svc: AiSettingsService,
    private readonly chatService: AiChatService,
    private readonly aiStatus: AiStatusService,
    private readonly autoReplyMaster: AiAutoReplyMasterService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'AI feature status (config + search indexes)' })
  getStatus() {
    return this.aiStatus.getStatus();
  }

  @Get('providers')
  @ApiOperation({ summary: 'List supported AI providers' })
  listProviders() {
    return Object.entries(PROVIDER_LABELS).map(([value, label]) => ({ value, label }));
  }

  @Get('auto-reply/presets')
  @ApiOperation({ summary: 'List inbox auto-reply prompt presets' })
  listAutoReplyPresets() {
    return [{ id: 'custom', label: 'Custom', tone: '', prompt: '' }, ...AUTO_REPLY_PRESETS];
  }

  @Get('auto-reply/health')
  @ApiOperation({ summary: 'Auto-reply readiness checklist (master switch + gates)' })
  getAutoReplyHealth() {
    return this.autoReplyMaster.getHealth();
  }

  @Patch('auto-reply/master')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Master auto-reply switch — syncs AI config, safety, and all sessions' })
  setAutoReplyMaster(@Body() body: { enabled: boolean }) {
    return this.autoReplyMaster.setMasterEnabled(body.enabled === true);
  }

  @Post('auto-reply/unrestricted/apply')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Enable unrestricted fast auto-reply with instant pacing and resume paused chats' })
  applyUnrestrictedAutoReply() {
    return this.autoReplyMaster.applyUnrestrictedMode();
  }

  @Get()
  @ApiOperation({ summary: 'Get AI configuration' })
  get() {
    return this.svc.get();
  }

  @Put()
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Save AI configuration' })
  upsert(@Body() body: UpsertAiConfigDto) {
    return this.svc.upsert(body);
  }

  @Post('test')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Test AI provider connection' })
  test() {
    return this.svc.test();
  }

  @Post('auto-reply/preview')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Preview AI inbox auto-reply for a sample customer message' })
  async previewAutoReply(@Body() body: AiAutoReplyPreviewDto) {
    const sample = body.sampleMessage?.trim() || 'Hello, I am interested in your products.';
    const reply = await this.chatService.generateInboxAutoReply({
      thread: [{ role: 'user', content: sample }],
    });
    if (!reply) {
      return { ok: false, error: 'AI is disabled or returned an empty reply. Check AI settings.' };
    }
    return { ok: true, reply };
  }

  @Delete('api-key')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Remove stored AI API key' })
  clearApiKey() {
    return this.svc.clearApiKey();
  }

  @Get('models')
  @ApiOperation({ summary: 'Models for a provider' })
  models(@Query('provider', new ParseEnumPipe(AI_PROVIDER_VALUES)) provider: AiProvider) {
    return this.svc.getProviderModels(provider);
  }

  @Get('fallbacks')
  getFallbacks() {
    return this.svc.getFallbacks();
  }

  @Post('fallbacks')
  @RequireRole(ApiKeyRole.ADMIN)
  addFallback(@Body() body: FallbackModelDto) {
    return this.svc.addFallback(body);
  }

  @Delete('fallbacks/:index')
  @RequireRole(ApiKeyRole.ADMIN)
  removeFallback(@Param('index', ParseIntPipe) index: number) {
    return this.svc.removeFallback(index);
  }
}
