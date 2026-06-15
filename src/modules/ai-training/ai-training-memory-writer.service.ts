import { Injectable, BadRequestException } from '@nestjs/common';
import { AiMemoryService } from '../ai/ai-memory.service';
import { maskPrivateData } from './utils/ai-training-sanitize.util';

@Injectable()
export class AiTrainingMemoryWriterService {
  constructor(private readonly memory: AiMemoryService) {}

  appendApprovedMemory(input: {
    fact: string;
    approvedBy: string;
    sourceItemId?: string;
    maskPrivate?: boolean;
    isCustomerSpecific?: boolean;
  }): void {
    if (input.isCustomerSpecific) {
      throw new BadRequestException(
        'Customer-specific info must not be saved to global AI memory.',
      );
    }
    const fact = input.maskPrivate !== false ? maskPrivateData(input.fact) : input.fact;
    const date = new Date().toISOString().slice(0, 10);
    const line = `[training ${date} by ${input.approvedBy}${input.sourceItemId ? ` item:${input.sourceItemId}` : ''}] ${fact}`;
    this.memory.appendToMemoryDoc(line);
  }
}
