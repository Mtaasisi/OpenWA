import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { RequireRole } from '../auth/decorators/auth.decorators';
import { CurrentApiKey } from '../auth/decorators/auth.decorators';
import { ApiKey, ApiKeyRole } from '../auth/entities/api-key.entity';
import { FollowupConversationService } from './followup-conversation.service';
import { FollowupTemplateService } from './followup-template.service';
import { FollowupRuleService } from './followup-rule.service';
import { FollowupQueueService } from './followup-queue.service';
import {
  UpdateConversationDto,
  CloseLostDto,
  SetStageDto,
  CreateTemplateDto,
  UpdateTemplateDto,
  CreateRuleDto,
  UpdateRuleDto,
  CompleteFollowupDto,
  RescheduleDto,
  SendFollowupDto,
  MarkWonDto,
  AssignFollowupDto,
  PreviewTemplateDto,
  CreateManualLeadDto,
  LinkSaleDto,
  AssignConversationDto,
  SetLeadSourceDto,
  UpdateAutopilotSettingsDto,
  ApproveAutopilotDto,
  RejectAutopilotDto,
} from './dto/followup.dto';
import { FollowupKpiService } from './followup-kpi.service';
import { FollowupHookService } from './followup-hook.service';
import { PipelineService } from './pipeline.service';
import { SaleAttributionService } from './sale-attribution.service';
import { AuthService } from '../auth/auth.service';
import { FollowupAutopilotSettingsService } from './followup-autopilot-settings.service';
import { FollowupAutopilotReportService } from './followup-autopilot-report.service';
import { FollowupAutopilotAuditService } from './followup-autopilot-audit.service';
import { InboxCrmService } from '../message/inbox-crm.service';
import { EventsGateway } from '../events/events.gateway';
import {
  ConversationStage,
  FollowUpQueueFilter,
  FollowUpPermission,
  PipelineBucket,
} from './followup.enums';
import {
  FollowUpPermissionGuard,
  RequireFollowUpPermission,
} from './guards/followup-permission.guard';
import { getEffectivePermissions } from './utils/permissions.util';

@ApiTags('followup')
@ApiBearerAuth()
@Controller('followup')
@UseGuards(FollowUpPermissionGuard)
export class FollowupController {
  constructor(
    private readonly conversationService: FollowupConversationService,
    private readonly templateService: FollowupTemplateService,
    private readonly ruleService: FollowupRuleService,
    private readonly queueService: FollowupQueueService,
    private readonly kpiService: FollowupKpiService,
    private readonly hookService: FollowupHookService,
    private readonly pipelineService: PipelineService,
    private readonly saleAttributionService: SaleAttributionService,
    private readonly authService: AuthService,
    private readonly autopilotSettings: FollowupAutopilotSettingsService,
    private readonly autopilotReport: FollowupAutopilotReportService,
    private readonly autopilotAudit: FollowupAutopilotAuditService,
    @Inject(forwardRef(() => InboxCrmService))
    private readonly inboxCrmService: InboxCrmService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  @Get('permissions')
  getPermissions(@CurrentApiKey() apiKey: ApiKey) {
    return { permissions: getEffectivePermissions(apiKey) };
  }

  @Get('staff')
  @RequireFollowUpPermission(FollowUpPermission.VIEW_FOLLOWUP_QUEUE)
  async listStaff() {
    const keys = await this.authService.findAll();
    return keys.map(k => ({ id: k.id, name: k.name, role: k.role }));
  }

  // --- Conversations ---
  // Static / :id/* routes must be registered before conversations/:sessionId/:chatId
  // so paths like .../id/<uuid> and .../<uuid>/history are not parsed as session + chatId.

  @Get('conversations/id/:id')
  @RequireFollowUpPermission(FollowUpPermission.VIEW_CONVERSATION_PIPELINE)
  async getConversationById(@Param('id') id: string) {
    const conv = await this.conversationService.findById(id);
    return this.conversationService.enrichConversationForApi(conv);
  }

  @Get('conversations/id/:id/history')
  @RequireFollowUpPermission(FollowUpPermission.VIEW_FOLLOWUP_QUEUE)
  async getHistoryById(@Param('id') id: string) {
    return this.queueService.getHistory(id);
  }

  /** @deprecated Prefer GET conversations/id/:id/history — kept for older clients */
  @Get('conversations/:id/history')
  @RequireFollowUpPermission(FollowUpPermission.VIEW_FOLLOWUP_QUEUE)
  async getHistory(@Param('id') id: string) {
    return this.queueService.getHistory(id);
  }

  @Post('conversations/manual')
  @RequireRole(ApiKeyRole.OPERATOR)
  @RequireFollowUpPermission(FollowUpPermission.MANAGE_CONVERSATION_PIPELINE)
  async createManualLead(@CurrentApiKey() apiKey: ApiKey, @Body() dto: CreateManualLeadDto) {
    return this.conversationService.createManualLead(dto, apiKey.id);
  }

  @Patch('conversations/:id')
  @RequireRole(ApiKeyRole.OPERATOR)
  @RequireFollowUpPermission(FollowUpPermission.UPDATE_CONVERSATION_STAGE)
  async updateConversation(@Param('id') id: string, @Body() dto: UpdateConversationDto) {
    const conv = await this.conversationService.update(id, dto);
    return this.conversationService.enrichConversationForApi(conv);
  }

  @Patch('conversations/:id/source')
  @RequireRole(ApiKeyRole.OPERATOR)
  @RequireFollowUpPermission(FollowUpPermission.EDIT_LEAD_SOURCE)
  async setLeadSource(@Param('id') id: string, @Body() dto: SetLeadSourceDto) {
    const conv = await this.conversationService.updateLeadSource(id, dto.source);
    return this.conversationService.enrichConversationForApi(conv);
  }

  @Post('conversations/:id/stage')
  @RequireRole(ApiKeyRole.OPERATOR)
  @RequireFollowUpPermission(FollowUpPermission.UPDATE_CONVERSATION_STAGE)
  async setStage(@Param('id') id: string, @Body() body: SetStageDto) {
    await this.hookService.handleStageChange(body.sessionId, body.chatId, body.stage);
    const conv = await this.conversationService.findById(id);
    return this.conversationService.enrichConversationForApi(conv);
  }

  @Post('conversations/:id/close-lost')
  @RequireRole(ApiKeyRole.OPERATOR)
  @RequireFollowUpPermission(FollowUpPermission.CLOSE_CONVERSATION)
  async closeLost(@Param('id') id: string, @Body() dto: CloseLostDto) {
    const conv = await this.conversationService.closeAsLost(id, dto);
    return this.conversationService.enrichConversationForApi(conv);
  }

  @Post('conversations/:id/won')
  @RequireRole(ApiKeyRole.OPERATOR)
  @RequireFollowUpPermission(FollowUpPermission.LINK_SALE_TO_CONVERSATION)
  async markWon(@Param('id') id: string, @Body() body: MarkWonDto) {
    const conv = await this.conversationService.markWon(id, body.linkedSaleId);
    return this.conversationService.enrichConversationForApi(conv);
  }

  @Post('conversations/:id/link-sale')
  @RequireRole(ApiKeyRole.OPERATOR)
  @RequireFollowUpPermission(FollowUpPermission.LINK_SALE_TO_CONVERSATION)
  async linkSale(@Param('id') id: string, @Body() dto: LinkSaleDto) {
    const conv = await this.conversationService.linkSale(id, dto);
    return this.conversationService.enrichConversationForApi(conv);
  }

  @Post('conversations/:id/assign')
  @RequireRole(ApiKeyRole.OPERATOR)
  @RequireFollowUpPermission(FollowUpPermission.ASSIGN_CONVERSATIONS)
  async assignConversation(@Param('id') id: string, @Body() body: AssignConversationDto) {
    const conv = await this.conversationService.update(id, { assignedStaffId: body.staffId ?? null });
    const enriched = await this.conversationService.enrichConversationForApi(conv);
    if (body.staffId) {
      this.eventsGateway.emitInboxChatAssigned(conv.sessionId, {
        chatId: conv.chatId,
        assignedStaffId: body.staffId,
        customerName: enriched.customerName,
        customerPhone: enriched.customerPhone,
      });
    }
    return enriched;
  }

  @Get('conversations/:sessionId/:chatId')
  @RequireFollowUpPermission(FollowUpPermission.VIEW_FOLLOWUP_QUEUE)
  async getConversation(@Param('sessionId') sessionId: string, @Param('chatId') chatId: string) {
    const conv = await this.conversationService.getOrCreate(sessionId, decodeURIComponent(chatId));
    return this.conversationService.enrichConversationForApi(conv);
  }

  // --- Pipeline ---

  @Get('customers')
  @RequireFollowUpPermission(FollowUpPermission.VIEW_CONVERSATION_PIPELINE)
  async listCustomers(
    @Query('q') q?: string,
    @Query('stage') stage?: string,
    @Query('branchId') branchId?: string,
    @Query('staffId') staffId?: string,
    @Query('source') source?: string,
    @Query('unidentifiedOnly') unidentifiedOnly?: string,
    @Query('resolvedOnly') resolvedOnly?: string,
    @Query('followUpDueOnly') followUpDueOnly?: string,
    @Query('multiThreadOnly') multiThreadOnly?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.pipelineService.listCustomers({
      q,
      stage: stage || undefined,
      branchId,
      staffId,
      source,
      unidentifiedOnly: unidentifiedOnly === 'true' || unidentifiedOnly === '1',
      resolvedOnly: resolvedOnly === 'true' || resolvedOnly === '1',
      followUpDueOnly: followUpDueOnly === 'true' || followUpDueOnly === '1',
      multiThreadOnly: multiThreadOnly === 'true' || multiThreadOnly === '1',
      limit: limit ? Number.parseInt(limit, 10) : undefined,
      offset: offset ? Number.parseInt(offset, 10) : undefined,
    });
  }

  @Get('customers/:id/profile')
  @RequireFollowUpPermission(FollowUpPermission.VIEW_CONVERSATION_PIPELINE)
  async getCustomerProfile(@Param('id') id: string) {
    return this.pipelineService.getCustomerProfile(id);
  }

  @Get('customers/:id/related')
  @RequireFollowUpPermission(FollowUpPermission.VIEW_CONVERSATION_PIPELINE)
  async listCustomerRelated(@Param('id') id: string) {
    return this.pipelineService.listRelatedByPhone(id);
  }

  @Get('pipeline/search')
  @RequireFollowUpPermission(FollowUpPermission.VIEW_CONVERSATION_PIPELINE)
  async searchPipeline(
    @Query('q') q: string,
    @Query('branchId') branchId?: string,
    @Query('staffId') staffId?: string,
    @Query('source') source?: string,
  ) {
    return this.pipelineService.searchLeads(q ?? '', branchId, staffId, source);
  }

  @Get('pipeline/counts')
  @RequireFollowUpPermission(FollowUpPermission.VIEW_CONVERSATION_PIPELINE)
  async getPipelineCounts(
    @Query('branchId') branchId?: string,
    @Query('staffId') staffId?: string,
    @Query('source') source?: string,
  ) {
    return this.pipelineService.getBucketCounts(branchId, staffId, source);
  }

  @Get('pipeline/reports/payment-pending')
  @RequireFollowUpPermission(FollowUpPermission.VIEW_CONVERSION_REPORTS)
  async getPaymentPendingReport(@Query('branchId') branchId?: string) {
    return this.pipelineService.listBucket(PipelineBucket.PAYMENT_PENDING, branchId);
  }

  @Get('pipeline')
  @RequireFollowUpPermission(FollowUpPermission.VIEW_CONVERSATION_PIPELINE)
  async getPipeline(
    @Query('bucket') bucket: PipelineBucket = PipelineBucket.NEW_LEADS,
    @Query('branchId') branchId?: string,
    @Query('staffId') staffId?: string,
    @Query('source') source?: string,
  ) {
    return this.pipelineService.listBucket(bucket, branchId, staffId, source);
  }

  @Get('pipeline/dashboard')
  @RequireFollowUpPermission(FollowUpPermission.VIEW_CONVERSION_REPORTS)
  async getPipelineDashboard(@Query('branchId') branchId?: string) {
    return this.pipelineService.getDashboardStats(branchId);
  }

  @Get('pipeline/reports/conversion')
  @RequireFollowUpPermission(FollowUpPermission.VIEW_CONVERSION_REPORTS)
  async getConversionReport(
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.pipelineService.getConversionReport(branchId, from, to);
  }

  @Get('pipeline/reports/lead-sources')
  @RequireFollowUpPermission(FollowUpPermission.VIEW_LEAD_SOURCE_REPORTS)
  async getLeadSourceReport(
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.pipelineService.getLeadSourceReport(branchId, from, to);
  }

  @Post('admin/backfill-sale-attributions')
  @RequireRole(ApiKeyRole.ADMIN)
  async backfillSaleAttributions(@Query('dryRun') dryRun?: string) {
    return this.saleAttributionService.backfillMissing({
      dryRun: dryRun === 'true' || dryRun === '1',
    });
  }

  @Post('admin/backfill-identity')
  @RequireRole(ApiKeyRole.ADMIN)
  async backfillIdentity(@Query('dryRun') dryRun?: string) {
    return this.conversationService.backfillIdentity({
      dryRun: dryRun === 'true' || dryRun === '1',
    });
  }

  @Get('pipeline/reports/abandoned')
  @RequireFollowUpPermission(FollowUpPermission.VIEW_CONVERSION_REPORTS)
  async getAbandonedReport(@Query('branchId') branchId?: string) {
    return this.pipelineService.getAbandonedReport(branchId);
  }

  @Get('pipeline/reports/lost-reasons')
  @RequireFollowUpPermission(FollowUpPermission.VIEW_LOST_LEADS)
  async getLostReasonReport(@Query('branchId') branchId?: string) {
    const stats = await this.pipelineService.getDashboardStats(branchId);
    return stats.lostReasonBreakdown;
  }

  @Get('pipeline/reports/response-time')
  @RequireFollowUpPermission(FollowUpPermission.VIEW_CONVERSION_REPORTS)
  async getResponseTimeReport(@Query('branchId') branchId?: string) {
    const stats = await this.pipelineService.getDashboardStats(branchId);
    return { averageResponseTimeSeconds: stats.averageResponseTimeSeconds };
  }

  // --- Queue ---

  @Get('queue/counts')
  @RequireFollowUpPermission(FollowUpPermission.VIEW_FOLLOWUP_QUEUE)
  async getQueueCounts(
    @Query('branchId') branchId?: string,
    @Query('staffId') staffId?: string,
  ) {
    return this.queueService.getFilterCounts(branchId, staffId);
  }

  @Get('queue')
  @RequireFollowUpPermission(FollowUpPermission.VIEW_FOLLOWUP_QUEUE)
  async getQueue(
    @Query('filter') filter: FollowUpQueueFilter = FollowUpQueueFilter.DUE_NOW,
    @Query('branchId') branchId?: string,
    @Query('staffId') staffId?: string,
  ) {
    return this.queueService.getQueue(filter, branchId, staffId);
  }

  @Post('queue/:id/send')
  @RequireRole(ApiKeyRole.OPERATOR)
  @RequireFollowUpPermission(FollowUpPermission.COMPLETE_FOLLOWUPS)
  async sendFollowup(
    @Param('id') id: string,
    @CurrentApiKey() apiKey: ApiKey,
    @Body() body: SendFollowupDto,
  ) {
    return this.queueService.sendMessage(id, apiKey.id, body.variables, body.channel ?? 'whatsapp', apiKey);
  }

  @Post('queue/:id/complete')
  @RequireRole(ApiKeyRole.OPERATOR)
  @RequireFollowUpPermission(FollowUpPermission.COMPLETE_FOLLOWUPS)
  async completeFollowup(
    @Param('id') id: string,
    @CurrentApiKey() apiKey: ApiKey,
    @Body() dto: CompleteFollowupDto,
  ) {
    return this.queueService.complete(id, apiKey.id, dto);
  }

  @Post('queue/:id/reschedule')
  @RequireRole(ApiKeyRole.OPERATOR)
  @RequireFollowUpPermission(FollowUpPermission.COMPLETE_FOLLOWUPS)
  async reschedule(@Param('id') id: string, @Body() dto: RescheduleDto) {
    return this.queueService.reschedule(id, dto);
  }

  @Post('queue/:id/assign')
  @RequireRole(ApiKeyRole.OPERATOR)
  @RequireFollowUpPermission(FollowUpPermission.ASSIGN_FOLLOWUPS)
  async assign(@Param('id') id: string, @Body() body: AssignFollowupDto) {
    return this.queueService.assign(id, body.staffId);
  }

  @Post('queue/:id/approve')
  @RequireRole(ApiKeyRole.OPERATOR)
  @RequireFollowUpPermission(FollowUpPermission.APPROVE_AUTOPILOT_FOLLOWUPS)
  async approveAutopilot(
    @Param('id') id: string,
    @CurrentApiKey() apiKey: ApiKey,
    @Body() body: ApproveAutopilotDto,
  ) {
    return this.queueService.approveAndSend(id, apiKey.id, body.message);
  }

  @Post('queue/:id/reject')
  @RequireRole(ApiKeyRole.OPERATOR)
  @RequireFollowUpPermission(FollowUpPermission.APPROVE_AUTOPILOT_FOLLOWUPS)
  async rejectAutopilot(
    @Param('id') id: string,
    @CurrentApiKey() apiKey: ApiKey,
    @Body() body: RejectAutopilotDto,
  ) {
    return this.queueService.rejectAutopilot(id, apiKey.id, body.reason);
  }

  @Post('queue/:id/schedule-autopilot')
  @RequireRole(ApiKeyRole.OPERATOR)
  @RequireFollowUpPermission(FollowUpPermission.APPROVE_AUTOPILOT_FOLLOWUPS)
  async scheduleAutopilot(@Param('id') id: string, @Body() dto: RescheduleDto) {
    return this.queueService.scheduleAutopilotLater(id, dto.dueAt);
  }

  @Get('autopilot/settings')
  @RequireFollowUpPermission(FollowUpPermission.MANAGE_FOLLOWUP_AUTOPILOT)
  async getAutopilotSettings() {
    return this.autopilotSettings.getSettings();
  }

  @Patch('autopilot/settings')
  @RequireRole(ApiKeyRole.ADMIN)
  @RequireFollowUpPermission(FollowUpPermission.MANAGE_FOLLOWUP_AUTOPILOT)
  async updateAutopilotSettings(@Body() dto: UpdateAutopilotSettingsDto) {
    return this.autopilotSettings.updateSettings(dto);
  }

  @Post('autopilot/sessions/:sessionId/unpause')
  @RequireRole(ApiKeyRole.ADMIN)
  @RequireFollowUpPermission(FollowUpPermission.MANAGE_FOLLOWUP_AUTOPILOT)
  async unpauseAutopilotSession(@Param('sessionId') sessionId: string) {
    await this.autopilotSettings.unpauseSession(sessionId);
    this.eventsGateway.emitFollowupAlert('followup.autopilot_updated', sessionId, {
      action: 'session_unpaused',
    });
    return { ok: true };
  }

  @Get('autopilot/dashboard')
  @RequireFollowUpPermission(FollowUpPermission.VIEW_FOLLOWUP_QUEUE)
  async getAutopilotDashboard() {
    const [summary, settings] = await Promise.all([
      this.autopilotReport.getDashboardSummary(),
      this.autopilotSettings.getSettings(),
    ]);
    const health = this.autopilotSettings.getSessionHealthSummary(settings);
    return { ...summary, pausedAccounts: health.pausedAccounts, enabled: settings.enabled, mode: settings.autopilotMode };
  }

  @Get('autopilot/audit')
  @RequireFollowUpPermission(FollowUpPermission.VIEW_FOLLOWUP_REPORTS)
  async getAutopilotAudit(
    @Query('limit') limit?: string,
    @Query('sessionId') sessionId?: string,
  ) {
    const parsedLimit = limit ? Number.parseInt(limit, 10) : 50;
    return this.autopilotAudit.listRecent(Number.isFinite(parsedLimit) ? parsedLimit : 50, sessionId);
  }

  @Get('reports/autopilot')
  @RequireFollowUpPermission(FollowUpPermission.VIEW_FOLLOWUP_REPORTS)
  async getAutopilotReport(
    @Query('staffId') staffId?: string,
    @Query('sessionId') sessionId?: string,
    @Query('channel') channel?: string,
    @Query('reason') reason?: string,
    @Query('riskLevel') riskLevel?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.autopilotReport.getReport({ staffId, sessionId, channel, reason, riskLevel, from, to });
  }

  @Post('conversations/:sessionId/:chatId/autopilot/pause')
  @RequireRole(ApiKeyRole.OPERATOR)
  @RequireFollowUpPermission(FollowUpPermission.COMPLETE_FOLLOWUPS)
  async pauseAutopilot(
    @Param('sessionId') sessionId: string,
    @Param('chatId') chatId: string,
    @CurrentApiKey() apiKey: ApiKey,
    @Query('minutes') minutes?: string,
  ) {
    return this.inboxCrmService.pauseFollowupAutopilot(
      sessionId,
      decodeURIComponent(chatId),
      apiKey.id,
      minutes ? Number.parseInt(minutes, 10) : undefined,
    ).then(dto => {
      this.eventsGateway.emitFollowupAlert('followup.autopilot_paused', sessionId, {
        chatId: decodeURIComponent(chatId),
        paused: true,
        until: dto.followupAutopilotPausedUntil,
      });
      return dto;
    });
  }

  @Post('conversations/:sessionId/:chatId/autopilot/resume')
  @RequireRole(ApiKeyRole.OPERATOR)
  @RequireFollowUpPermission(FollowUpPermission.COMPLETE_FOLLOWUPS)
  async resumeAutopilot(
    @Param('sessionId') sessionId: string,
    @Param('chatId') chatId: string,
  ) {
    return this.inboxCrmService.resumeFollowupAutopilot(sessionId, decodeURIComponent(chatId)).then(dto => {
      this.eventsGateway.emitFollowupAlert('followup.autopilot_paused', sessionId, {
        chatId: decodeURIComponent(chatId),
        paused: false,
      });
      return dto;
    });
  }

  // --- Templates ---

  @Get('templates')
  @RequireFollowUpPermission(FollowUpPermission.VIEW_FOLLOWUP_QUEUE)
  async listTemplates(@Query('branchId') branchId?: string) {
    return this.templateService.findAll(branchId);
  }

  @Post('templates')
  @RequireRole(ApiKeyRole.ADMIN)
  @RequireFollowUpPermission(FollowUpPermission.MANAGE_MESSAGE_TEMPLATES)
  async createTemplate(@Body() dto: CreateTemplateDto) {
    return this.templateService.create(dto);
  }

  @Patch('templates/:id')
  @RequireRole(ApiKeyRole.ADMIN)
  @RequireFollowUpPermission(FollowUpPermission.MANAGE_MESSAGE_TEMPLATES)
  async updateTemplate(@Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return this.templateService.update(id, dto);
  }

  @Delete('templates/:id')
  @RequireRole(ApiKeyRole.ADMIN)
  @RequireFollowUpPermission(FollowUpPermission.MANAGE_MESSAGE_TEMPLATES)
  async deleteTemplate(@Param('id') id: string) {
    await this.templateService.remove(id);
    return { ok: true };
  }

  @Post('templates/:id/preview')
  @RequireFollowUpPermission(FollowUpPermission.VIEW_FOLLOWUP_QUEUE)
  async previewTemplate(@Param('id') id: string, @Body() variables: PreviewTemplateDto) {
    return this.templateService.preview(id, variables);
  }

  // --- Rules ---

  @Get('rules')
  @RequireFollowUpPermission(FollowUpPermission.MANAGE_FOLLOWUP_RULES)
  async listRules(@Query('branchId') branchId?: string) {
    return this.ruleService.findAll(branchId);
  }

  @Post('rules')
  @RequireRole(ApiKeyRole.ADMIN)
  @RequireFollowUpPermission(FollowUpPermission.MANAGE_FOLLOWUP_RULES)
  async createRule(@Body() dto: CreateRuleDto) {
    return this.ruleService.create(dto);
  }

  @Patch('rules/:id')
  @RequireRole(ApiKeyRole.ADMIN)
  @RequireFollowUpPermission(FollowUpPermission.MANAGE_FOLLOWUP_RULES)
  async updateRule(@Param('id') id: string, @Body() dto: UpdateRuleDto) {
    return this.ruleService.update(id, dto);
  }

  @Delete('rules/:id')
  @RequireRole(ApiKeyRole.ADMIN)
  @RequireFollowUpPermission(FollowUpPermission.MANAGE_FOLLOWUP_RULES)
  async deleteRule(@Param('id') id: string) {
    await this.ruleService.remove(id);
    return { ok: true };
  }

  // --- Reports ---

  @Get('reports')
  @RequireFollowUpPermission(FollowUpPermission.VIEW_FOLLOWUP_REPORTS)
  async getReports(
    @Query('branchId') branchId?: string,
    @Query('periodStart') periodStart?: string,
  ) {
    return this.kpiService.getReports(branchId, periodStart);
  }
}
