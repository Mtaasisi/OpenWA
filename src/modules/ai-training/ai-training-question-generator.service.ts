import { Injectable } from '@nestjs/common';
import { AiLearningItem } from '../ai/entities/ai-learning-item.entity';
import { AiTrainingIssueType } from './ai-training.types';

@Injectable()
export class AiTrainingQuestionGeneratorService {
  generateQuestion(item: AiLearningItem): string {
    const q = item.question.trim();
    const intent = item.detectedIntent ?? item.issueType ?? '';

    if (/customer care|namba ya customer care|namba ya kupiga/i.test(q)) {
      return 'Customer asked for customer care number. What should AI do next time?';
    }
    if (/kidogo kidogo|installment|malipo ya polepole/i.test(q)) {
      return 'Customer asked about installment. How should AI answer next time?';
    }
    if (/warranty|dhamana|garansi/i.test(q)) {
      return 'Customer asked about warranty. What should AI say?';
    }
    if (/namba ya malipo|payment number|lipa/i.test(q)) {
      return 'Customer requested payment number. What should AI do?';
    }
    if (/discount|punguzo/i.test(q)) {
      return 'Customer asked about discount. How should AI respond?';
    }
    if (/delivery|usafiri|mikoani/i.test(q)) {
      return 'Customer asked about delivery. What should AI say next time?';
    }
    if (item.issueType === AiTrainingIssueType.HUMAN_TAKEOVER) {
      return `Staff answered after AI paused. Should AI learn this answer for: "${q.slice(0, 80)}"?`;
    }
    if (item.issueType === AiTrainingIssueType.LOW_CONFIDENCE) {
      return `AI was unsure how to answer: "${q.slice(0, 80)}". What should it do next time?`;
    }
    if (item.issueType === AiTrainingIssueType.REPEATED_QUESTION) {
      return `Customers keep asking (${item.timesAsked}x): "${q.slice(0, 80)}". What rule should AI follow?`;
    }
    if (intent) {
      return `Training: how should AI handle "${intent}" when customer asks "${q.slice(0, 80)}"?`;
    }
    return `How should AI answer next time when customer asks: "${q.slice(0, 100)}"?`;
  }

  generateTitle(item: AiLearningItem): string {
    return item.title ?? item.question.slice(0, 120);
  }
}
