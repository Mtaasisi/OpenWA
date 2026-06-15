import { ForbiddenException } from '@nestjs/common';
import { AiTrainingApprovalService } from './ai-training-approval.service';
import { AiTrainingRouterService } from './ai-training-router.service';
import { AiLearningItemStatus } from '../ai/ai-learning.enums';
import { ApiKeyRole } from '../auth/entities/api-key.entity';
import { AiTrainingSuggestionActionType, AiTrainingUpdateMode, AiTrainingApprovalStatus } from './ai-training.types';
import { itemRequiresAdminApproval } from './utils/ai-training-risk.util';

describe('itemRequiresAdminApproval', () => {
  it('flags customer care questions', () => {
    expect(
      itemRequiresAdminApproval({
        question: 'Naomba namba ya customer care',
        issueType: 'customer_service_request',
        targetFile: 'AI_REPLY_RULES.md',
      }),
    ).toBe(true);
  });

  it('allows generic FAQ items', () => {
    expect(
      itemRequiresAdminApproval({
        question: 'Mko wapi?',
        issueType: 'no_answer',
        targetFile: 'FAQ.md',
      }),
    ).toBe(false);
  });
});

describe('AiTrainingApprovalService', () => {
  const router = new AiTrainingRouterService();

  function createService() {
    const approvalRepo = {
      create: jest.fn((v: unknown) => v),
      save: jest.fn(async (v: unknown) => v),
      findOne: jest.fn(),
    };
    const suggestionRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
    };
    const items = {
      getItem: jest.fn(),
      updateItem: jest.fn(async (id: string, patch: unknown) => ({ id, ...(patch as object) })),
      rejectItem: jest.fn(),
    };
    const settings = {
      getSettings: jest.fn().mockResolvedValue({
        trainingCenterEnabled: true,
        requireAdminApproval: true,
        allowMarkdownWrites: true,
        allowMemoryWrites: true,
        maskPrivateDataInExports: true,
        autoReindexAfterApproval: false,
        autoReindexSmallUpdatesOnly: true,
      }),
    };
    const knowledge = { appendApprovedAnswer: jest.fn(), createFromApproval: jest.fn() };
    const audit = { log: jest.fn() };
    const knowledgeWriter = {
      buildPreview: jest.fn().mockReturnValue({
        oldContent: 'old',
        newContent: 'new',
        skippedDuplicate: false,
      }),
      writeApprovedKnowledge: jest.fn(),
    };
    const memoryWriter = { appendApprovedMemory: jest.fn() };
    const reindex = { maybeAutoReindex: jest.fn().mockResolvedValue(false), markStale: jest.fn() };
    const suggestions = { listForItem: jest.fn(), generateSuggestions: jest.fn() };

    const svc = new AiTrainingApprovalService(
      approvalRepo as never,
      suggestionRepo as never,
      items as never,
      knowledge as never,
      settings as never,
      audit as never,
      knowledgeWriter as never,
      memoryWriter as never,
      reindex as never,
      router,
      suggestions as never,
    );

    return { svc, items, suggestionRepo, settings, approvalRepo, audit, knowledgeWriter, knowledge };
  }

  it('blocks operator approval for high-risk training', async () => {
    const { svc, items, suggestionRepo } = createService();
    items.getItem.mockResolvedValue({
      id: 'i1',
      question: 'Naomba namba ya customer care',
      issueType: 'customer_service_request',
      status: AiLearningItemStatus.PENDING_REVIEW,
    });
    suggestionRepo.findOne.mockResolvedValue({
      id: 's1',
      trainingItemId: 'i1',
      actionType: AiTrainingSuggestionActionType.CREATE_TOOL_RULE,
      responseText: 'Upo branch gani?',
      targetFile: 'BRANCH_PROFILE_AND_PAYMENT_SETTINGS.md',
    });

    await expect(
      svc.approve({
        trainingItemId: 'i1',
        selectedSuggestionId: 's1',
        approvedBy: 'operator-1',
        approvedByRole: ApiKeyRole.OPERATOR,
        applyNow: false,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows admin approval for high-risk training without applying', async () => {
    const { svc, items, suggestionRepo, approvalRepo } = createService();
    items.getItem.mockResolvedValue({
      id: 'i1',
      question: 'Naomba namba ya customer care',
      issueType: 'customer_service_request',
      status: AiLearningItemStatus.PENDING_REVIEW,
      targetFile: 'AI_REPLY_RULES.md',
    });
    suggestionRepo.findOne.mockResolvedValue({
      id: 's1',
      trainingItemId: 'i1',
      actionType: AiTrainingSuggestionActionType.CREATE_TOOL_RULE,
      responseText: 'Upo branch gani?',
      targetFile: 'BRANCH_PROFILE_AND_PAYMENT_SETTINGS.md',
    });

    const result = await svc.approve({
      trainingItemId: 'i1',
      selectedSuggestionId: 's1',
      approvedBy: 'admin-1',
      approvedByRole: ApiKeyRole.ADMIN,
      applyNow: false,
    });

    expect(result.item.status).toBe(AiLearningItemStatus.APPROVED);
    expect(approvalRepo.save).toHaveBeenCalled();
  });

  it('preview marks customer care training as admin-required', async () => {
    const { svc, items, suggestionRepo } = createService();
    items.getItem.mockResolvedValue({
      id: 'i1',
      question: 'Naomba namba ya customer care',
      issueType: 'customer_service_request',
      targetFile: 'AI_REPLY_RULES.md',
    });
    suggestionRepo.findOne.mockResolvedValue({
      id: 's1',
      trainingItemId: 'i1',
      actionType: AiTrainingSuggestionActionType.UPDATE_RULE,
      responseText: 'Upo branch gani?',
      targetFile: 'AI_REPLY_RULES.md',
    });

    const preview = await svc.previewApproval({
      trainingItemId: 'i1',
      selectedSuggestionId: 's1',
    });

    expect(preview.requiresAdmin).toBe(true);
  });

  it('bulkApprove skips operator-forbidden items and approves safe ones', async () => {
    const { svc, items, suggestionRepo } = createService();

    items.getItem.mockImplementation(async (id: string) => {
      if (id === 'risky') {
        return {
          id: 'risky',
          question: 'Naomba namba ya customer care',
          issueType: 'customer_service_request',
          status: AiLearningItemStatus.PENDING_REVIEW,
        };
      }
      return {
        id: 'safe',
        question: 'Mko wapi?',
        issueType: 'no_answer',
        status: AiLearningItemStatus.PENDING_REVIEW,
        targetFile: 'FAQ.md',
      };
    });

    suggestionRepo.find
      .mockResolvedValueOnce([
        {
          id: 's-risky',
          trainingItemId: 'risky',
          isRecommended: true,
          actionType: AiTrainingSuggestionActionType.CREATE_TOOL_RULE,
          responseText: 'Upo branch gani?',
          targetFile: 'BRANCH_PROFILE_AND_PAYMENT_SETTINGS.md',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 's-safe',
          trainingItemId: 'safe',
          isRecommended: true,
          actionType: AiTrainingSuggestionActionType.UPDATE_FAQ,
          responseText: 'Tupo Dar es Salaam.',
          targetFile: 'FAQ.md',
        },
      ]);

    suggestionRepo.findOne.mockImplementation(async ({ where }: { where: { id: string } }) => {
      if (where.id === 's-risky') {
        return {
          id: 's-risky',
          trainingItemId: 'risky',
          actionType: AiTrainingSuggestionActionType.CREATE_TOOL_RULE,
          responseText: 'Upo branch gani?',
          targetFile: 'BRANCH_PROFILE_AND_PAYMENT_SETTINGS.md',
        };
      }
      return {
        id: 's-safe',
        trainingItemId: 'safe',
        actionType: AiTrainingSuggestionActionType.UPDATE_FAQ,
        responseText: 'Tupo Dar es Salaam.',
        targetFile: 'FAQ.md',
      };
    });

    const result = await svc.bulkApprove({
      ids: ['risky', 'safe'],
      approvedBy: 'operator-1',
      approvedByRole: ApiKeyRole.OPERATOR,
      applyNow: false,
    });

    expect(result.approved).toEqual(['safe']);
    expect(result.skipped).toEqual([
      expect.objectContaining({ id: 'risky', reason: expect.stringContaining('admin') }),
    ]);
    expect(result.failed).toEqual([]);
  });

  it('bulkApprove prefers staff draft answer over MCQ suggestion text', async () => {
    const { svc, items, suggestionRepo, approvalRepo } = createService();

    items.getItem.mockResolvedValue({
      id: 'draft-item',
      question: 'Mko wapi?',
      issueType: 'no_answer',
      status: AiLearningItemStatus.PENDING_REVIEW,
      targetFile: 'FAQ.md',
      aiDraftAnswer: 'Tupo Kariakoo Boss.',
    });

    suggestionRepo.find.mockResolvedValue([
      {
        id: 's-mcq',
        trainingItemId: 'draft-item',
        isRecommended: true,
        actionType: AiTrainingSuggestionActionType.UPDATE_FAQ,
        responseText: 'Tupo Dar es Salaam.',
        targetFile: 'FAQ.md',
      },
    ]);
    suggestionRepo.findOne.mockResolvedValue({
      id: 's-mcq',
      trainingItemId: 'draft-item',
      actionType: AiTrainingSuggestionActionType.UPDATE_FAQ,
      responseText: 'Tupo Dar es Salaam.',
      targetFile: 'FAQ.md',
    });

    const result = await svc.bulkApprove({
      ids: ['draft-item'],
      approvedBy: 'admin-1',
      approvedByRole: ApiKeyRole.ADMIN,
      applyNow: false,
    });

    expect(result.approved).toEqual(['draft-item']);
    expect(approvalRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ customAnswer: 'Tupo Kariakoo Boss.' }),
    );
  });

  it('bulkApprove applies per-item customAnswer overrides', async () => {
    const { svc, items, suggestionRepo, approvalRepo } = createService();

    items.getItem.mockResolvedValue({
      id: 'override-item',
      question: 'Mko wapi?',
      issueType: 'no_answer',
      status: AiLearningItemStatus.PENDING_REVIEW,
      targetFile: 'FAQ.md',
      aiDraftAnswer: 'Old draft',
    });

    suggestionRepo.find.mockResolvedValue([
      {
        id: 's-mcq',
        trainingItemId: 'override-item',
        isRecommended: true,
        actionType: AiTrainingSuggestionActionType.UPDATE_FAQ,
        responseText: 'Tupo Dar.',
        targetFile: 'FAQ.md',
      },
    ]);
    suggestionRepo.findOne.mockResolvedValue({
      id: 's-mcq',
      trainingItemId: 'override-item',
      actionType: AiTrainingSuggestionActionType.UPDATE_FAQ,
      responseText: 'Tupo Dar.',
      targetFile: 'FAQ.md',
    });

    const result = await svc.bulkApprove({
      ids: ['override-item'],
      approvedBy: 'admin-1',
      approvedByRole: ApiKeyRole.ADMIN,
      applyNow: false,
      overrides: [{ id: 'override-item', customAnswer: 'Tupo Sinza leo.' }],
    });

    expect(result.approved).toEqual(['override-item']);
    expect(approvalRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ customAnswer: 'Tupo Sinza leo.' }),
    );
  });

  it('apply stores backup path from knowledge writer', async () => {
    const { svc, items, approvalRepo, knowledgeWriter, knowledge } = createService();
    approvalRepo.findOne.mockResolvedValue({
      id: 'ap1',
      trainingItemId: 'i1',
      customAnswer: 'Tupo Dar es Salaam Boss.',
      targetFile: 'FAQ.md',
      updateMode: AiTrainingUpdateMode.APPEND,
      status: AiTrainingApprovalStatus.APPROVED,
    });
    items.getItem.mockResolvedValue({
      id: 'i1',
      question: 'Mko wapi?',
      status: AiLearningItemStatus.APPROVED,
    });
    knowledgeWriter.writeApprovedKnowledge.mockReturnValue({
      path: 'FAQ.md',
      backupPath: 'backups/FAQ.md.bak',
      oldContent: '# FAQ',
      newContent: '# FAQ\n\nLearned',
      skippedDuplicate: false,
    });

    const result = await svc.apply('ap1', 'admin-1', ApiKeyRole.ADMIN);

    expect(result.approval.fileBackupPath).toBe('backups/FAQ.md.bak');
    expect(result.item.status).toBe(AiLearningItemStatus.APPLIED);
    expect(knowledge.createFromApproval).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceItemId: 'i1',
        approvedAnswer: 'Tupo Dar es Salaam Boss.',
        questionPattern: 'Mko wapi?',
      }),
    );
  });
});
