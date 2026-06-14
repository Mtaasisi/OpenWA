import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AiLearningItemsService } from './ai-learning-items.service';
import { ProductDemandService } from './product-demand.service';
import { ProductDemandCampaignService } from './product-demand-campaign.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { AiLearningItem } from './entities/ai-learning-item.entity';
import {
  AiLearningItemSource,
  AiLearningItemStatus,
} from './ai-learning.enums';
import { InboxThreadCrm } from '../message/entities/inbox-thread-crm.entity';
import { InboxAiHandlingState } from './inbox-ai-handling.enum';
import { ProductDemandCampaignStatus } from './product-demand.enums';
import { CustomerProfileEnrichmentService } from './customer-profile-enrichment.service';

@ApiTags('dashboard')
@Controller('dashboard')
export class AiLearningDashboardController {
  constructor(
    private readonly items: AiLearningItemsService,
    private readonly demand: ProductDemandService,
    private readonly demandCampaigns: ProductDemandCampaignService,
    private readonly profileEnrichment: CustomerProfileEnrichmentService,
    @InjectRepository(AiLearningItem, 'data')
    private readonly itemRepo: Repository<AiLearningItem>,
    @InjectRepository(InboxThreadCrm, 'data')
    private readonly crmRepo: Repository<InboxThreadCrm>,
  ) {}

  @Get('ai-learning-demand-alerts')
  @ApiOperation({ summary: 'Merged AI learning and product demand dashboard alerts' })
  async alerts() {
    const [overview, learningOverview, demandCounts, demandOverview, campaignMetrics, campaigns] =
      await Promise.all([
        this.items.getOverview(),
        this.itemRepo.find({
          where: {
            status: In([AiLearningItemStatus.PENDING_REVIEW, AiLearningItemStatus.SUGGESTED]),
          },
          order: { timesAsked: 'DESC' },
          take: 10,
        }),
        this.demand.getDashboardCounts(),
        this.demand.getOverview(),
        this.demandCampaigns.getCampaignMetrics(),
        this.demandCampaigns.listCampaigns(),
      ]);

    const topDraftCampaigns = campaigns
      .filter(c => c.status === ProductDemandCampaignStatus.DRAFT)
      .slice(0, 5)
      .map(c => ({
        id: c.id,
        title: c.title,
        recipientCount: c.recipientCount ?? 0,
        channel: c.channel,
      }));

    const repeatedUnknown = learningOverview.filter(i => i.timesAsked >= 3);
    const staffCorrections = await this.itemRepo.count({
      where: {
        source: AiLearningItemSource.STAFF_CORRECTION,
        status: AiLearningItemStatus.SUGGESTED,
      },
    });
    const urgentWaiting = await this.crmRepo.count({
      where: { aiHandlingState: InboxAiHandlingState.WAITING_HUMAN },
    });

    const profileCounts = await this.profileEnrichment.getDashboardCounts();

    return {
      learning: {
        pendingCount: overview.pendingLearning,
        unknownToday: overview.unknownQuestionsToday,
        repeatedUnknownCount: repeatedUnknown.length,
        staffCorrectionsWaiting: staffCorrections,
        urgentWaitingCustomers: urgentWaiting,
        aiPausedChats: overview.aiPausedChats,
        topPending: learningOverview.slice(0, 5),
      },
      demand: {
        ...demandCounts,
        ...demandOverview,
        mostAskedProduct: demandOverview.mostAskedProduct,
        draftCampaignsCount: campaignMetrics.draft,
        approvedCampaignsCount: campaignMetrics.approved,
        topDraftCampaigns,
      },
      profile: profileCounts,
    };
  }
}
