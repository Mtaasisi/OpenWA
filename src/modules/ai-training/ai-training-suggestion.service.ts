import { Injectable, Inject, forwardRef, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiLearningItem } from '../ai/entities/ai-learning-item.entity';
import { AiLearningSettingsService } from '../ai/ai-learning-settings.service';
import { AiChatService } from '../ai/ai-chat.service';
import { AiUsageFeature, AiUsageSource } from '../ai/cost/ai-cost.types';
import { AiTrainingSuggestion } from './entities/ai-training-suggestion.entity';
import { AiTrainingRouterService } from './ai-training-router.service';
import { AiTrainingQuestionGeneratorService } from './ai-training-question-generator.service';
import {
  AiTrainingSuggestionActionType,
  AiTrainingIssueType,
  TRAINING_KNOWLEDGE_TARGETS,
} from './ai-training.types';
import { toRuleId } from './utils/ai-training-sanitize.util';

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

type HeuristicTemplate = {
  label: string;
  text: string;
  response: string;
  actionType: AiTrainingSuggestionActionType;
  target: string;
  recommended?: boolean;
  risks?: string[];
};

type LlmSuggestionOption = {
  optionText?: string;
  responseText?: string;
  actionType?: string;
  targetFile?: string;
  recommended?: boolean;
  risks?: string[];
};

const VALID_ACTION_TYPES = new Set<string>(Object.values(AiTrainingSuggestionActionType));
const VALID_TARGET_FILES = new Set<string>(TRAINING_KNOWLEDGE_TARGETS);

export function parseLlmTrainingSuggestions(raw: string): LlmSuggestionOption[] {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? trimmed).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) return [];
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1)) as { options?: LlmSuggestionOption[] };
    return Array.isArray(parsed.options) ? parsed.options : [];
  } catch {
    return [];
  }
}

@Injectable()
export class AiTrainingSuggestionService {
  private readonly logger = new Logger(AiTrainingSuggestionService.name);

  constructor(
    @InjectRepository(AiTrainingSuggestion, 'data')
    private readonly repo: Repository<AiTrainingSuggestion>,
    private readonly router: AiTrainingRouterService,
    private readonly questionGen: AiTrainingQuestionGeneratorService,
    private readonly settings: AiLearningSettingsService,
    @Inject(forwardRef(() => AiChatService))
    private readonly aiChat: AiChatService,
  ) {}

  async listForItem(trainingItemId: string): Promise<AiTrainingSuggestion[]> {
    return this.repo.find({
      where: { trainingItemId },
      order: { isRecommended: 'DESC', confidence: 'DESC' },
    });
  }

  async generateSuggestions(item: AiLearningItem): Promise<AiTrainingSuggestion[]> {
    await this.repo.delete({ trainingItemId: item.id });
    const routing = this.router.route({
      question: item.question,
      issueType: item.issueType,
      sourceType: item.sourceType,
      detectedIntent: item.detectedIntent,
    });
    const targetFile = routing.targetFiles[0] ?? 'FAQ.md';
    const settings = await this.settings.getSettings();

    let templates = this.buildHeuristicTemplates(item, targetFile, routing.actionType);

    if (settings.useLlmTrainingSuggestions !== false) {
      const llmTemplates = await this.tryGenerateLlmSuggestions(item, targetFile, routing.actionType);
      if (llmTemplates.length >= 2) {
        templates = llmTemplates;
      }
    }

    const rows = templates.slice(0, 7).map((t, i) =>
      this.repo.create({
        trainingItemId: item.id,
        optionLabel: t.label || OPTION_LABELS[i],
        optionText: t.text,
        responseText: t.response,
        actionType: t.actionType,
        targetFile: t.target || targetFile,
        targetKey: toRuleId(item.detectedIntent ?? item.question),
        confidence: t.recommended ? 0.85 : 0.6,
        reasoning: this.questionGen.generateQuestion(item),
        risks: t.risks ?? null,
        isRecommended: Boolean(t.recommended),
      }),
    );

    return this.repo.save(rows);
  }

  private async tryGenerateLlmSuggestions(
    item: AiLearningItem,
    defaultTarget: string,
    defaultAction: AiTrainingSuggestionActionType,
  ): Promise<HeuristicTemplate[]> {
    const system = [
      'You generate admin training options for OpenWA WhatsApp shop AI (Swahili/English).',
      'Reply with JSON only: {"options":[{"optionText":"...","responseText":"...","actionType":"...","targetFile":"...","recommended":true,"risks":[]}]}',
      'Provide 3-5 distinct options. One should be recommended.',
      `Valid actionType values: ${[...VALID_ACTION_TYPES].join(', ')}`,
      `Valid targetFile values: ${[...VALID_TARGET_FILES].join(', ')}`,
      'Never paste raw payment account numbers. Prefer branch-aware tool rules for payments.',
      'Keep responseText customer-friendly with "Boss" tone when appropriate.',
    ].join('\n');

    const user = JSON.stringify({
      question: item.question,
      issueType: item.issueType,
      aiDraftAnswer: item.aiDraftAnswer,
      staffAnswer: item.adminFinalAnswer,
      detectedIntent: item.detectedIntent,
      defaultTarget,
      defaultAction,
    });

    try {
      const raw = await this.aiChat.completeStructuredPrompt(system, user, 900, {
        feature: AiUsageFeature.TRAINING_CENTER,
        source: AiUsageSource.ADMIN_MANUAL,
      });
      if (!raw) return [];

      const options = parseLlmTrainingSuggestions(raw);
      const mapped: HeuristicTemplate[] = [];

      for (let i = 0; i < options.length && mapped.length < 7; i++) {
        const opt = options[i];
        const actionType = opt.actionType && VALID_ACTION_TYPES.has(opt.actionType)
          ? (opt.actionType as AiTrainingSuggestionActionType)
          : defaultAction;
        const target =
          opt.targetFile && VALID_TARGET_FILES.has(opt.targetFile) ? opt.targetFile : defaultTarget;
        const optionText = String(opt.optionText ?? '').trim();
        const responseText = String(opt.responseText ?? '').trim();
        if (!optionText) continue;

        mapped.push({
          label: OPTION_LABELS[mapped.length] ?? String(mapped.length + 1),
          text: optionText.slice(0, 200),
          response: responseText.slice(0, 1200),
          actionType,
          target,
          recommended: Boolean(opt.recommended) && mapped.every(t => !t.recommended),
          risks: Array.isArray(opt.risks) ? opt.risks.map(r => String(r).slice(0, 120)).slice(0, 3) : undefined,
        });
      }

      if (!mapped.some(t => t.recommended) && mapped.length > 0) {
        mapped[0].recommended = true;
      }

      return mapped;
    } catch (err) {
      this.logger.debug(
        `LLM training suggestions fallback: ${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    }
  }

  private buildHeuristicTemplates(
    item: AiLearningItem,
    targetFile: string,
    defaultAction: AiTrainingSuggestionActionType,
  ): HeuristicTemplate[] {
    const q = item.question.trim();
    const draft = item.aiDraftAnswer ?? item.adminFinalAnswer ?? '';
    const templates: HeuristicTemplate[] = [];

    if (/customer care|namba ya customer care|namba ya kupiga/i.test(q)) {
      templates.push(
        {
          label: 'A',
          text: 'Send default customer care number',
          response: 'Ndiyo Boss 😊 Unaweza kuwasiliana na customer care kupitia namba yetu. Upo branch gani nikutumie namba sahihi?',
          actionType: AiTrainingSuggestionActionType.UPDATE_RULE,
          target: 'AI_REPLY_RULES.md',
          recommended: true,
        },
        {
          label: 'B',
          text: 'Ask which branch they need',
          response: 'Ndiyo Boss 😊 Upo branch gani — Dar au Arusha — nikutumie namba sahihi?',
          actionType: AiTrainingSuggestionActionType.CREATE_TOOL_RULE,
          target: 'BRANCH_PROFILE_AND_PAYMENT_SETTINGS.md',
        },
        {
          label: 'C',
          text: 'Escalate to human',
          response: 'Nimekuelekeza kwa team yetu Boss, watakujibu muda si mrefu 😊',
          actionType: AiTrainingSuggestionActionType.ESCALATE_TO_HUMAN,
          target: 'AI_REPLY_RULES.md',
          risks: ['May delay response'],
        },
        {
          label: 'D',
          text: 'Save as FAQ',
          response: draft || 'Contact customer care via our support line.',
          actionType: AiTrainingSuggestionActionType.UPDATE_FAQ,
          target: 'FAQ.md',
        },
      );
    } else if (/kidogo kidogo|installment/i.test(q)) {
      templates.push(
        {
          label: 'A',
          text: 'Check product installment eligibility first',
          response: 'Ndiyo Boss 😊 Installment inategemea product. Unatafuta simu gani nikuangalie?',
          actionType: AiTrainingSuggestionActionType.UPDATE_INSTALLMENT_RULE,
          target: 'INSTALLMENT_PRODUCT_RULES.md',
          recommended: true,
        },
        {
          label: 'B',
          text: 'Explain general installment policy',
          response: 'Tuna installment kwa baadhi ya products Boss. Niambie product unayotaka.',
          actionType: AiTrainingSuggestionActionType.UPDATE_INSTALLMENT_RULE,
          target: 'INSTALLMENT_PRODUCT_RULES.md',
        },
        {
          label: 'C',
          text: 'Escalate to admin',
          response: 'Nimekuelekeza kwa team yetu kwa maelezo ya installment 😊',
          actionType: AiTrainingSuggestionActionType.ESCALATE_TO_HUMAN,
          target: 'AI_REPLY_RULES.md',
        },
      );
    } else if (/warranty|garansi/i.test(q)) {
      templates.push(
        {
          label: 'A',
          text: 'Use warranty policy from WARRANTY_RULES.md',
          response: draft || 'Warranty inategemea product na condition. Ni product gani Boss?',
          actionType: AiTrainingSuggestionActionType.UPDATE_WARRANTY_RULE,
          target: 'WARRANTY_RULES.md',
          recommended: true,
        },
        {
          label: 'B',
          text: 'Ask product type first',
          response: 'Warranty inategemea product Boss. Unanunua nini?',
          actionType: AiTrainingSuggestionActionType.UPDATE_WARRANTY_RULE,
          target: 'WARRANTY_RULES.md',
        },
        {
          label: 'C',
          text: 'Escalate',
          response: 'Nimekuelekeza kwa team yetu kwa warranty details 😊',
          actionType: AiTrainingSuggestionActionType.ESCALATE_TO_HUMAN,
          target: 'AI_REPLY_RULES.md',
        },
      );
    } else if (/malipo|payment number|namba ya malipo/i.test(q)) {
      templates.push(
        {
          label: 'A',
          text: 'Use get_payment_details tool by branch',
          response: 'Ndiyo Boss 😊 Upo branch gani nikutumie payment details sahihi?',
          actionType: AiTrainingSuggestionActionType.CREATE_TOOL_RULE,
          target: 'BRANCH_PROFILE_AND_PAYMENT_SETTINGS.md',
          recommended: true,
          risks: ['Use live DB payment tools — do not paste raw numbers in markdown'],
        },
        {
          label: 'B',
          text: 'Ask branch first',
          response: 'Upo Dar au Arusha Boss? Nikutumie payment details sahihi.',
          actionType: AiTrainingSuggestionActionType.CREATE_TOOL_RULE,
          target: 'BRANCH_PROFILE_AND_PAYMENT_SETTINGS.md',
        },
        {
          label: 'C',
          text: 'Escalate to admin',
          response: 'Nimekuelekeza kwa team yetu kwa payment details 😊',
          actionType: AiTrainingSuggestionActionType.ESCALATE_TO_HUMAN,
          target: 'AI_REPLY_RULES.md',
        },
      );
    } else if (item.issueType === AiTrainingIssueType.HUMAN_TAKEOVER && item.adminFinalAnswer) {
      templates.push(
        {
          label: 'A',
          text: 'Save staff answer as FAQ',
          response: item.adminFinalAnswer,
          actionType: AiTrainingSuggestionActionType.UPDATE_FAQ,
          target: 'FAQ.md',
          recommended: true,
        },
        {
          label: 'B',
          text: 'Save as reply rule',
          response: item.adminFinalAnswer,
          actionType: AiTrainingSuggestionActionType.UPDATE_RULE,
          target: 'AI_REPLY_RULES.md',
        },
        {
          label: 'C',
          text: 'Do not learn',
          response: '',
          actionType: AiTrainingSuggestionActionType.MARK_UNANSWERABLE,
          target: '',
        },
      );
    } else {
      templates.push(
        {
          label: 'A',
          text: 'Use suggested reply',
          response: draft || `Ndiyo Boss 😊 ${q.slice(0, 60)}`,
          actionType: defaultAction,
          target: targetFile,
          recommended: true,
        },
        {
          label: 'B',
          text: 'Use safer/shorter reply',
          response: 'Ndiyo Boss 😊 Nimekupata — nikutumie taarifa sahihi kidogo tu.',
          actionType: AiTrainingSuggestionActionType.REPLY_TEXT,
          target: 'AI_REPLY_EXAMPLES.md',
        },
        {
          label: 'C',
          text: 'Escalate to human',
          response: 'Nimekuelekeza kwa team yetu Boss, watakujibu muda si mrefu 😊',
          actionType: AiTrainingSuggestionActionType.ESCALATE_TO_HUMAN,
          target: 'AI_REPLY_RULES.md',
        },
        {
          label: 'D',
          text: 'Save as FAQ',
          response: draft || item.question,
          actionType: AiTrainingSuggestionActionType.UPDATE_FAQ,
          target: 'FAQ.md',
        },
        {
          label: 'E',
          text: 'Save as product Q&A',
          response: draft || '',
          actionType: AiTrainingSuggestionActionType.UPDATE_PRODUCT_QA,
          target: 'PRODUCT_QA.md',
        },
        {
          label: 'F',
          text: 'Save as rule/action',
          response: draft || '',
          actionType: AiTrainingSuggestionActionType.UPDATE_RULE,
          target: 'AI_REPLY_RULES.md',
        },
      );
    }

    return templates;
  }
}
