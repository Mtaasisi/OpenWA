import { Injectable } from '@nestjs/common';
import {
  AiTrainingIssueType,
  AiTrainingSourceType,
  AiTrainingSuggestionActionType,
  TRAINING_KNOWLEDGE_TARGETS,
} from './ai-training.types';

export interface RoutingResult {
  targetFiles: string[];
  actionType: AiTrainingSuggestionActionType;
  targetSection?: string;
  targetKey?: string;
  useMemory: boolean;
  useDbTool: boolean;
  blockGlobalWrite?: boolean;
}

@Injectable()
export class AiTrainingRouterService {
  route(input: {
    question: string;
    issueType?: string | null;
    sourceType?: string | null;
    detectedIntent?: string | null;
    actionType?: AiTrainingSuggestionActionType;
  }): RoutingResult {
    const q = input.question.toLowerCase();
    const intent = (input.detectedIntent ?? '').toLowerCase();

    if (input.actionType) {
      return this.routeByActionType(input.actionType);
    }

    if (
      intent.includes('customer_care') ||
      /customer care|namba ya (customer care|kupiga|dukani)|namba ya kupiga/.test(q)
    ) {
      return {
        targetFiles: ['AI_REPLY_RULES.md', 'BRANCH_PROFILE_AND_PAYMENT_SETTINGS.md'],
        actionType: AiTrainingSuggestionActionType.UPDATE_RULE,
        targetKey: 'customer_care_number_request',
        useMemory: false,
        useDbTool: true,
      };
    }

    if (/installment|kidogo kidogo|malipo ya polepole/.test(q) || intent.includes('installment')) {
      return {
        targetFiles: ['INSTALLMENT_PRODUCT_RULES.md'],
        actionType: AiTrainingSuggestionActionType.UPDATE_INSTALLMENT_RULE,
        useMemory: false,
        useDbTool: false,
      };
    }

    if (/malipo|payment|lipa|namba ya malipo|paybill|till/.test(q) || intent.includes('payment')) {
      return {
        targetFiles: ['BRANCH_PROFILE_AND_PAYMENT_SETTINGS.md', 'PAYMENT_RULES.md'],
        actionType: AiTrainingSuggestionActionType.CREATE_TOOL_RULE,
        useMemory: false,
        useDbTool: true,
      };
    }

    if (/warranty|dhamana|garansi/.test(q) || intent.includes('warranty')) {
      return {
        targetFiles: ['WARRANTY_RULES.md'],
        actionType: AiTrainingSuggestionActionType.UPDATE_WARRANTY_RULE,
        useMemory: false,
        useDbTool: false,
      };
    }

    if (/discount|punguzo|bei kidogo/.test(q) || intent.includes('discount')) {
      return {
        targetFiles: ['DISCOUNT_ESCALATION_RULES.md'],
        actionType: AiTrainingSuggestionActionType.UPDATE_DISCOUNT_RULE,
        useMemory: false,
        useDbTool: false,
      };
    }

    if (
      input.sourceType === AiTrainingSourceType.PRODUCT_QUESTION ||
      input.issueType === AiTrainingIssueType.MISSING_PRODUCT_KNOWLEDGE ||
      /bei ya|price of|product|simu|laptop/.test(q)
    ) {
      return {
        targetFiles: ['PRODUCT_QA.md'],
        actionType: AiTrainingSuggestionActionType.UPDATE_PRODUCT_QA,
        useMemory: false,
        useDbTool: false,
      };
    }

    if (input.sourceType === AiTrainingSourceType.AGENT_ACTION) {
      return {
        targetFiles: ['AGENT_ACTION_RULES.md'],
        actionType: AiTrainingSuggestionActionType.UPDATE_AGENT_ACTION_RULE,
        useMemory: false,
        useDbTool: false,
      };
    }

    if (/delivery|usafiri|mikoani|tuma/.test(q)) {
      return {
        targetFiles: ['DELIVERY_RULES.md', 'FAQ.md'],
        actionType: AiTrainingSuggestionActionType.UPDATE_FAQ,
        useMemory: false,
        useDbTool: false,
      };
    }

    if (input.issueType === AiTrainingIssueType.NEW_BUSINESS_RULE) {
      return {
        targetFiles: ['AI_REPLY_RULES.md'],
        actionType: AiTrainingSuggestionActionType.UPDATE_RULE,
        useMemory: true,
        useDbTool: false,
      };
    }

    return {
      targetFiles: ['FAQ.md'],
      actionType: AiTrainingSuggestionActionType.UPDATE_FAQ,
      useMemory: false,
      useDbTool: false,
    };
  }

  resolveTargetFile(preferred?: string | null): string {
    const t = (preferred ?? 'FAQ.md').trim();
    if ((TRAINING_KNOWLEDGE_TARGETS as readonly string[]).includes(t)) return t;
    if (t === 'FAQ_KNOWLEDGE.md') return 'FAQ.md';
    return 'FAQ.md';
  }

  private routeByActionType(actionType: AiTrainingSuggestionActionType): RoutingResult {
    const map: Partial<Record<AiTrainingSuggestionActionType, RoutingResult>> = {
      [AiTrainingSuggestionActionType.UPDATE_FAQ]: {
        targetFiles: ['FAQ.md'],
        actionType,
        useMemory: false,
        useDbTool: false,
      },
      [AiTrainingSuggestionActionType.UPDATE_PRODUCT_QA]: {
        targetFiles: ['PRODUCT_QA.md'],
        actionType,
        useMemory: false,
        useDbTool: false,
      },
      [AiTrainingSuggestionActionType.UPDATE_WARRANTY_RULE]: {
        targetFiles: ['WARRANTY_RULES.md'],
        actionType,
        useMemory: false,
        useDbTool: false,
      },
      [AiTrainingSuggestionActionType.UPDATE_DISCOUNT_RULE]: {
        targetFiles: ['DISCOUNT_ESCALATION_RULES.md'],
        actionType,
        useMemory: false,
        useDbTool: false,
      },
      [AiTrainingSuggestionActionType.UPDATE_INSTALLMENT_RULE]: {
        targetFiles: ['INSTALLMENT_PRODUCT_RULES.md'],
        actionType,
        useMemory: false,
        useDbTool: false,
      },
      [AiTrainingSuggestionActionType.UPDATE_AGENT_ACTION_RULE]: {
        targetFiles: ['AGENT_ACTION_RULES.md'],
        actionType,
        useMemory: false,
        useDbTool: false,
      },
      [AiTrainingSuggestionActionType.UPDATE_MEMORY]: {
        targetFiles: [],
        actionType,
        useMemory: true,
        useDbTool: false,
      },
      [AiTrainingSuggestionActionType.UPDATE_RULE]: {
        targetFiles: ['AI_REPLY_RULES.md'],
        actionType,
        useMemory: false,
        useDbTool: false,
      },
      [AiTrainingSuggestionActionType.CREATE_TOOL_RULE]: {
        targetFiles: ['BRANCH_PROFILE_AND_PAYMENT_SETTINGS.md'],
        actionType,
        useMemory: false,
        useDbTool: true,
      },
      [AiTrainingSuggestionActionType.ESCALATE_TO_HUMAN]: {
        targetFiles: ['AI_REPLY_RULES.md'],
        actionType,
        useMemory: false,
        useDbTool: false,
      },
      [AiTrainingSuggestionActionType.REPLY_TEXT]: {
        targetFiles: ['AI_REPLY_EXAMPLES.md'],
        actionType,
        useMemory: false,
        useDbTool: false,
      },
    };
    return (
      map[actionType] ?? {
        targetFiles: ['FAQ.md'],
        actionType,
        useMemory: false,
        useDbTool: false,
      }
    );
  }
}
