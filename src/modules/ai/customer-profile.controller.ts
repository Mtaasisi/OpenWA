import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CustomerProfileEnrichmentService } from './customer-profile-enrichment.service';

@ApiTags('customers')
@Controller()
export class CustomerProfileController {
  constructor(private readonly profiles: CustomerProfileEnrichmentService) {}

  @Get('customers/profile-enrichment')
  @ApiOperation({ summary: 'Get AI profile enrichment for a thread' })
  getByThread(
    @Query('sessionId') sessionId: string,
    @Query('chatId') chatId: string,
  ) {
    return this.profiles.getEnrichmentByThread(sessionId, chatId);
  }

  @Patch('customers/profile-enrichment/:id')
  update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.profiles.updateEnrichment(id, body as never);
  }

  @Get('customers/profile-learning-events')
  listEvents(
    @Query('sessionId') sessionId: string,
    @Query('chatId') chatId: string,
  ) {
    return this.profiles.listLearningEvents(sessionId, chatId);
  }

  @Post('customers/profile-learning-events/:eventId/approve')
  approveEvent(@Param('eventId') eventId: string) {
    return this.profiles.approveEvent(eventId);
  }

  @Post('customers/profile-learning-events/:eventId/reject')
  rejectEvent(@Param('eventId') eventId: string) {
    return this.profiles.rejectEvent(eventId);
  }

  @Post('customers/profile-enrichment/:id/name/approve')
  approveName(@Param('id') id: string) {
    return this.profiles.updateEnrichment(id, { nameNeedsReview: false });
  }

  @Post('customers/profile-enrichment/:id/name/reject')
  rejectName(@Param('id') id: string) {
    return this.profiles.updateEnrichment(id, { nameNeedsReview: false, preferredName: null });
  }

  @Get('lost-demand-followups')
  listLostDemand(@Query('status') status?: string) {
    return this.profiles.listLostDemand(status);
  }

  @Get('lost-demand-followups/:id')
  getLostDemand(@Param('id') id: string) {
    return this.profiles.getLostDemand(id);
  }

  @Patch('lost-demand-followups/:id')
  patchLostDemand(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.profiles.updateLostDemand(id, body as never);
  }

  @Post('lost-demand-followups/:id/close')
  closeLostDemand(@Param('id') id: string) {
    return this.profiles.updateLostDemand(id, { status: 'closed' });
  }
}
