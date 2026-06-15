import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WhatsAppSafetySettingsService } from './services/whatsapp-safety-settings.service';
import { WhatsAppPolicyGuardService } from './services/whatsapp-policy-guard.service';
import { WhatsAppConsentService, WhatsAppServiceWindowService } from './services/whatsapp-consent.service';
import { WhatsAppSendQueueService } from './services/whatsapp-send-queue.service';
import { WhatsAppWarmupService } from './services/whatsapp-warmup.service';
import { WhatsAppSessionHealthService } from './services/whatsapp-session-health.service';
import { WhatsAppSendAuditService } from './services/whatsapp-send-audit.service';
import { WhatsAppOutboundService } from './services/whatsapp-outbound.service';
import { WhatsAppCampaignPreflightService } from './services/whatsapp-campaign-preflight.service';
import { WhatsAppCloudTemplateSyncService } from './services/whatsapp-cloud-template-sync.service';
import { WhatsAppCloudOutboundService } from './services/whatsapp-cloud-outbound.service';
import { WhatsAppLinkPreflightService } from './services/whatsapp-link-preflight.service';
import {
  UpdateWhatsAppSafetySettingsDto,
  CheckSendDto,
  CampaignPreflightDto,
  PatchWarmupDto,
  PatchConsentDto,
  RestoreOptOutDto,
  ApproveQueueDto,
  CloudSendTemplateDto,
} from './dto/whatsapp-safety.dto';
import {
  WhatsAppMessageType,
  WhatsAppQueueStatus,
  WhatsAppSendSource,
} from './enums/whatsapp-safety.enums';
import { RequireRole } from '../auth/decorators/auth.decorators';
import { ApiKeyRole } from '../auth/entities/api-key.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsAppContactConsent } from './entities/whatsapp-contact-consent.entity';

@ApiTags('whatsapp-safety')
@Controller()
export class WhatsAppSafetyController {
  constructor(
    private readonly settingsService: WhatsAppSafetySettingsService,
    private readonly guard: WhatsAppPolicyGuardService,
    private readonly consentService: WhatsAppConsentService,
    private readonly serviceWindowService: WhatsAppServiceWindowService,
    private readonly queueService: WhatsAppSendQueueService,
    private readonly warmupService: WhatsAppWarmupService,
    private readonly healthService: WhatsAppSessionHealthService,
    private readonly auditService: WhatsAppSendAuditService,
    private readonly outboundService: WhatsAppOutboundService,
    private readonly preflightService: WhatsAppCampaignPreflightService,
    private readonly cloudTemplateSync: WhatsAppCloudTemplateSyncService,
    private readonly cloudOutbound: WhatsAppCloudOutboundService,
    private readonly linkPreflightService: WhatsAppLinkPreflightService,
    @InjectRepository(WhatsAppContactConsent, 'data')
    private readonly consentRepo: Repository<WhatsAppContactConsent>,
  ) {}

  @Get('whatsapp-safety/link-preflight')
  @RequireRole(ApiKeyRole.VIEWER)
  @ApiOperation({ summary: 'Pre-link safety checklist before scanning QR' })
  async linkPreflight(@Query('sessionId') sessionId?: string) {
    return this.linkPreflightService.getPreflight(sessionId);
  }

  @Get('whatsapp-safety/link-preflight/summary')
  @RequireRole(ApiKeyRole.VIEWER)
  @ApiOperation({ summary: 'Link readiness summary for sessions that need QR linking' })
  async linkPreflightSummary() {
    return this.linkPreflightService.getSummary();
  }

  @Get('whatsapp-safety/settings')
  @RequireRole(ApiKeyRole.VIEWER)
  @ApiOperation({ summary: 'Get WhatsApp safety settings' })
  async getSettings(@Query('sessionId') sessionId?: string) {
    return sessionId
      ? this.settingsService.getForSession(sessionId)
      : this.settingsService.getGlobal();
  }

  @Patch('whatsapp-safety/settings')
  @RequireRole(ApiKeyRole.ADMIN)
  async patchSettings(
    @Body() dto: UpdateWhatsAppSafetySettingsDto,
    @Query('sessionId') sessionId?: string,
  ) {
    return sessionId
      ? this.settingsService.updateForSession(sessionId, dto as never)
      : this.settingsService.updateGlobal(dto as never);
  }

  @Post('whatsapp-safety/settings/reset-safe-defaults')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Reset global WhatsApp safety settings to safe-by-default values' })
  async resetSafeDefaults() {
    return this.settingsService.resetGlobalToSafeDefaults();
  }

  @Get('whatsapp-safety/overview')
  @RequireRole(ApiKeyRole.VIEWER)
  async overview() {
    const [settings, pendingQueue, blockedToday, optedOut, warmups] = await Promise.all([
      this.settingsService.getGlobal(),
      this.queueService.countPending(),
      this.auditService.countBlockedToday(),
      this.consentService.countOptedOut(),
      this.warmupService.listActive(),
    ]);
    return {
      safetyEnabled: settings.globalEnabled,
      pendingQueue,
      blockedToday,
      optedOutContacts: optedOut,
      accountsInWarmup: warmups.length,
      warmups,
    };
  }

  @Post('whatsapp-safety/check-send')
  @RequireRole(ApiKeyRole.OPERATOR)
  async checkSend(@Body() dto: CheckSendDto) {
    return this.outboundService.checkBeforeSend({
      sessionId: dto.sessionId,
      chatId: dto.chatId,
      body: dto.body,
      options: {
        messageType: dto.messageType as WhatsAppMessageType | undefined,
        source: dto.source as WhatsAppSendSource | undefined,
        isManualStaffSend: dto.isManualStaffSend,
        templateId: dto.templateId,
      },
    });
  }

  @Get('whatsapp-safety/blocked-sends')
  @RequireRole(ApiKeyRole.VIEWER)
  async blockedSends(@Query('sessionId') sessionId?: string) {
    const audits = await this.auditService.recent(100, sessionId);
    return audits.filter(a => a.decision === 'blocked');
  }

  @Get('whatsapp-consent')
  @RequireRole(ApiKeyRole.VIEWER)
  async listConsent(@Query('limit') limit?: string) {
    return this.consentService.listOptedOut(Number(limit) || 100);
  }

  @Get('whatsapp-consent/marketing-gaps')
  @RequireRole(ApiKeyRole.VIEWER)
  async listMarketingGaps(@Query('limit') limit?: string) {
    return this.consentService.listMarketingGaps(Number(limit) || 50);
  }

  @Get('whatsapp-consent/lookup')
  @RequireRole(ApiKeyRole.VIEWER)
  async lookupConsent(@Query('sessionId') sessionId: string, @Query('chatId') chatId: string) {
    const phone = chatId.replace(/@.*$/, '').replace(/\D/g, '') || chatId;
    const consent = await this.consentService.findConsent(sessionId, phone);
    const window = await this.serviceWindowService.getCustomerServiceWindow(sessionId, phone);
    return {
      optInStatus: consent?.optInStatus ?? 'unknown',
      canMarketing: consent?.canMarketing ?? false,
      canFollowup: consent?.canFollowup !== false,
      within24h: window.within24h,
      requiresTemplate: window.requiresTemplate,
      lastCustomerMessageAt: window.lastCustomerMessageAt?.toISOString() ?? null,
    };
  }

  @Patch('whatsapp-consent/:id')
  @RequireRole(ApiKeyRole.ADMIN)
  async patchConsent(@Param('id') id: string, @Body() dto: PatchConsentDto) {
    await this.consentRepo.update(id, dto as never);
    return this.consentRepo.findOne({ where: { id } });
  }

  @Post('whatsapp-consent/:id/opt-out')
  @RequireRole(ApiKeyRole.ADMIN)
  async adminOptOut(@Param('id') id: string) {
    const row = await this.consentRepo.findOne({ where: { id } });
    if (!row) return { ok: false };
    return this.consentService.handleOptOut({
      sessionId: row.sessionId ?? '',
      phone: row.phone,
      reason: 'admin',
    });
  }

  @Get('whatsapp-send-queue')
  @RequireRole(ApiKeyRole.VIEWER)
  async listQueue(
    @Query('status') status?: WhatsAppQueueStatus,
    @Query('sessionId') sessionId?: string,
  ) {
    return this.queueService.list({ status, sessionId });
  }

  @Get('whatsapp-send-queue/stats')
  @RequireRole(ApiKeyRole.VIEWER)
  async queueStats() {
    return this.queueService.stats();
  }

  @Post('whatsapp-send-queue/:id/approve')
  @RequireRole(ApiKeyRole.ADMIN)
  async approveQueue(@Param('id') id: string, @Body() dto: ApproveQueueDto) {
    return this.queueService.approve(id, dto.approvedBy ?? 'admin');
  }

  @Post('whatsapp-send-queue/:id/cancel')
  @RequireRole(ApiKeyRole.ADMIN)
  async cancelQueue(@Param('id') id: string) {
    return { ok: await this.queueService.cancel(id) };
  }

  @Post('whatsapp-send-queue/:id/retry')
  @RequireRole(ApiKeyRole.ADMIN)
  async retryQueue(@Param('id') id: string) {
    return this.queueService.retry(id);
  }

  @Get('whatsapp-warmup')
  @RequireRole(ApiKeyRole.VIEWER)
  async listWarmup() {
    return this.warmupService.listActive();
  }

  @Get('whatsapp-warmup/:sessionId')
  @RequireRole(ApiKeyRole.VIEWER)
  async getWarmup(@Param('sessionId') sessionId: string) {
    return this.warmupService.getOrCreate(sessionId);
  }

  @Patch('whatsapp-warmup/:sessionId')
  @RequireRole(ApiKeyRole.ADMIN)
  async patchWarmup(@Param('sessionId') sessionId: string, @Body() dto: PatchWarmupDto) {
    return this.warmupService.updateWarmup(sessionId, dto as never);
  }

  @Post('whatsapp-warmup/:sessionId/pause')
  @RequireRole(ApiKeyRole.ADMIN)
  async pauseWarmup(@Param('sessionId') sessionId: string) {
    return this.warmupService.pause(sessionId);
  }

  @Post('whatsapp-warmup/:sessionId/resume')
  @RequireRole(ApiKeyRole.ADMIN)
  async resumeWarmup(@Param('sessionId') sessionId: string) {
    return this.warmupService.resume(sessionId);
  }

  @Post('whatsapp-warmup/:sessionId/reset')
  @RequireRole(ApiKeyRole.ADMIN)
  async resetWarmup(@Param('sessionId') sessionId: string) {
    return this.warmupService.resetWarmup(sessionId);
  }

  @Get('whatsapp-safety/opt-outs')
  @RequireRole(ApiKeyRole.VIEWER)
  async listOptOuts(@Query('limit') limit?: string) {
    return this.consentService.listOptedOut(Number(limit) || 100);
  }

  @Post('whatsapp-safety/opt-outs/:id/restore')
  @RequireRole(ApiKeyRole.ADMIN)
  async restoreOptOut(@Param('id') id: string, @Body() dto: RestoreOptOutDto) {
    await this.consentRepo.update(id, {
      optInStatus: 'opted_in' as never,
      optOutAt: null,
      canFollowup: dto.canFollowup ?? true,
      canUtility: true,
      canMarketing: dto.canMarketing ?? false,
    });
    return this.consentRepo.findOne({ where: { id } });
  }

  @Get('whatsapp-session-health')
  @RequireRole(ApiKeyRole.VIEWER)
  async listHealth(@Query('sessionId') sessionId?: string) {
    return this.healthService.recentEvents(sessionId);
  }

  @Get('whatsapp-session-health/:sessionId')
  @RequireRole(ApiKeyRole.VIEWER)
  async sessionHealth(@Param('sessionId') sessionId: string) {
    const [events, paused, safeMode] = await Promise.all([
      this.healthService.recentEvents(sessionId, 20),
      this.healthService.isAutomationPaused(sessionId),
      this.healthService.isStartupSafeMode(sessionId),
    ]);
    const warmup = await this.warmupService.getWarmup(sessionId);
    const pending = await this.queueService.countPending(sessionId);
    return { events, automationPaused: paused, startupSafeMode: safeMode, warmup, queuePending: pending };
  }

  @Post('whatsapp-session-health/:sessionId/pause-automation')
  @RequireRole(ApiKeyRole.ADMIN)
  async pauseAutomation(@Param('sessionId') sessionId: string) {
    await this.healthService.pauseAutomation(sessionId, 'Paused by admin');
    return { ok: true };
  }

  @Post('whatsapp-session-health/:sessionId/resume-automation')
  @RequireRole(ApiKeyRole.ADMIN)
  async resumeAutomation(@Param('sessionId') sessionId: string) {
    await this.healthService.resumeAutomation(sessionId);
    return { ok: true };
  }

  @Post('campaigns/preflight')
  @RequireRole(ApiKeyRole.OPERATOR)
  async campaignPreflight(@Body() dto: CampaignPreflightDto) {
    return this.preflightService.preflight(dto);
  }

  @Get('whatsapp-safety/templates')
  @RequireRole(ApiKeyRole.VIEWER)
  async listApprovalTemplates() {
    return this.cloudTemplateSync.listApprovalTemplates();
  }

  @Get('whatsapp-safety/templates/sync-status')
  @RequireRole(ApiKeyRole.VIEWER)
  async templateSyncStatus() {
    return this.cloudTemplateSync.getSyncStatus();
  }

  @Post('whatsapp-safety/templates/sync-from-cloud')
  @RequireRole(ApiKeyRole.ADMIN)
  async syncTemplatesFromCloud() {
    return this.cloudTemplateSync.syncFromCloud();
  }

  @Get('whatsapp-safety/cloud/connection-test')
  @RequireRole(ApiKeyRole.VIEWER)
  async testCloudConnection() {
    return this.cloudTemplateSync.testCloudConnection();
  }

  @Post('whatsapp-safety/cloud/send-template')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Send approved template via WhatsApp Cloud API (outside 24h compliant)' })
  async sendCloudTemplate(@Body() dto: CloudSendTemplateDto) {
    return this.cloudOutbound.sendTemplate(dto);
  }

  @Get('dashboard/whatsapp-safety-alerts')
  @RequireRole(ApiKeyRole.VIEWER)
  async dashboardAlerts() {
    const [blockedToday, pending, warmups, critical] = await Promise.all([
      this.auditService.countBlockedToday(),
      this.queueService.countPending(),
      this.warmupService.listActive(),
      this.healthService.criticalAlerts(10),
    ]);
    const approvalRequired = await this.queueService.list({
      status: WhatsAppQueueStatus.APPROVAL_REQUIRED,
      limit: 20,
    });
    return {
      blockedToday,
      pendingQueue: pending,
      warmups,
      criticalAlerts: critical,
      approvalRequired,
    };
  }

  @Get('whatsapp-safety/audit-logs')
  @RequireRole(ApiKeyRole.VIEWER)
  async auditLogs(
    @Query('sessionId') sessionId?: string,
    @Query('limit') limit?: string,
    @Query('source') source?: WhatsAppSendSource,
    @Query('decision') decision?: string,
    @Query('riskLevel') riskLevel?: string,
  ) {
    if (source || decision || riskLevel) {
      return this.auditService.recentFiltered({
        sessionId,
        source,
        decision: decision as never,
        riskLevel: riskLevel as never,
        limit: Number(limit) || 50,
      });
    }
    return this.auditService.recent(Number(limit) || 50, sessionId);
  }
}
