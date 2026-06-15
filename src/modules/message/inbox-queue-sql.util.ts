import { Brackets } from 'typeorm';
import type { InboxWorkQueue } from './inbox-thread-state.types';
import { MessageDirection, MessageStatus } from './entities/message.entity';
import type { InboxThreadSummary } from './entities/inbox-thread-summary.entity';
import type { Repository } from 'typeorm';

type SummaryQueryBuilder = ReturnType<Repository<InboxThreadSummary>['createQueryBuilder']>;

const OPEN_THREAD = '(crm.resolved IS NULL OR crm.resolved = false)';
const NOT_SPAM =
  '(fc.stage IS NULL OR fc.stage != :spamStage) AND (crm.outcome IS NULL OR crm.outcome != :spamOutcome)';

/** SQL pre-filter for work-queue tabs — refined in memory by InboxThreadStateService. */
export function applyInboxQueueSqlFilter(
  qb: SummaryQueryBuilder,
  queue: InboxWorkQueue,
  viewerStaffId?: string | null,
): void {
  qb.setParameter('spamStage', 'spam');
  qb.setParameter('spamOutcome', 'spam');

  switch (queue) {
    case 'all':
      qb.andWhere(OPEN_THREAD);
      qb.andWhere(NOT_SPAM);
      return;
    case 'resolved':
      qb.andWhere('crm.resolved = :resolvedTrue', { resolvedTrue: true });
      return;
    case 'groups':
      qb.andWhere('s.chatId LIKE :groupSuffix', { groupSuffix: '%@g.us' });
      return;
    case 'unassigned':
      qb.andWhere('fc.assignedStaffId IS NULL');
      qb.andWhere('s.chatId NOT LIKE :groupSuffix', { groupSuffix: '%@g.us' });
      qb.andWhere(OPEN_THREAD);
      return;
    case 'assigned_to_me':
      if (!viewerStaffId) return;
      qb.andWhere('fc.assignedStaffId = :queueViewerStaffId', {
        queueViewerStaffId: viewerStaffId,
      });
      return;
    case 'my_work':
      if (!viewerStaffId) return;
      qb.andWhere('fc.assignedStaffId = :queueViewerStaffId', {
        queueViewerStaffId: viewerStaffId,
      });
      qb.andWhere(OPEN_THREAD);
      qb.andWhere(NOT_SPAM);
      qb.andWhere('s.lastDirection = :incomingDir', {
        incomingDir: MessageDirection.INCOMING,
      });
      return;
    case 'needs_reply':
      qb.andWhere(OPEN_THREAD);
      qb.andWhere('s.chatId NOT LIKE :groupSuffix', { groupSuffix: '%@g.us' });
      qb.andWhere('(crm.aiOptOut IS NULL OR crm.aiOptOut = false)');
      qb.andWhere(
        new Brackets(sub => {
          sub
            .where(
              new Brackets(inner => {
                inner
                  .where('s.lastDirection = :needsReplyIncoming', {
                    needsReplyIncoming: MessageDirection.INCOMING,
                  })
                  .andWhere(
                    '(crm.aiHandlingState IS NULL OR crm.aiHandlingState NOT IN (:...aiBusyStates))',
                    { aiBusyStates: ['waiting_human', 'human_handling'] },
                  )
                  .andWhere('(crm.aiAutoReplyPaused IS NULL OR crm.aiAutoReplyPaused = false)');
              }),
            )
            .orWhere(
              new Brackets(inner => {
                inner
                  .where('fc.priority IN (:...hotPriorities)', {
                    hotPriorities: ['hot', 'high'],
                  })
                  .andWhere('s.lastDirection = :hotIncoming', {
                    hotIncoming: MessageDirection.INCOMING,
                  });
              }),
            );
        }),
      );
      return;
    case 'ai_needs_human':
      qb.andWhere(
        new Brackets(sub => {
          sub
            .where('crm.aiHandlingState IN (:...humanAiStates)', {
              humanAiStates: ['waiting_human', 'human_handling'],
            })
            .orWhere('crm.aiAutoReplyPaused = true');
        }),
      );
      return;
    case 'hot_leads':
      qb.andWhere('(fc.priority IN (:...hotPriorities) OR fc.stage = :hotStage)', {
        hotPriorities: ['hot', 'high'],
        hotStage: 'hot_lead',
      });
      qb.andWhere('s.lastDirection = :hotLeadIncoming', {
        hotLeadIncoming: MessageDirection.INCOMING,
      });
      qb.andWhere(OPEN_THREAD);
      return;
    case 'waiting_payment':
      qb.andWhere(
        new Brackets(sub => {
          sub
            .where('crm.paymentReadiness = :waitingPayment', { waitingPayment: 'waiting' })
            .orWhere('crm.outcome = :waitingPaymentOutcome', {
              waitingPaymentOutcome: 'waiting_payment',
            })
            .orWhere('fc.stage = :negotiationStage', { negotiationStage: 'negotiation' });
        }),
      );
      return;
    case 'waiting_stock':
      qb.andWhere(
        new Brackets(sub => {
          sub
            .where('crm.outcome = :waitingStockOutcome', { waitingStockOutcome: 'waiting_stock' })
            .orWhere('fc.lostReason = :noStockReason', { noStockReason: 'no_stock' });
        }),
      );
      return;
    case 'followup_due':
      qb.andWhere('fc.nextFollowupAt IS NOT NULL');
      qb.andWhere(OPEN_THREAD);
      return;
    case 'failed_sends':
      qb.andWhere(
        new Brackets(sub => {
          sub.where(
            `EXISTS (
              SELECT 1 FROM messages m
              WHERE m."sessionId" = s."sessionId"
                AND m."chatId" = s."chatId"
                AND m.direction = :failedDir
                AND m.status IN (:...failedStatuses)
            )`,
            {
              failedDir: MessageDirection.OUTGOING,
              failedStatuses: [MessageStatus.FAILED, MessageStatus.PENDING],
            },
          );
        }),
      );
      return;
    default:
      return;
  }
}
