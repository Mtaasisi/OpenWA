import { BadRequestException } from '@nestjs/common';
import { AiTrainingMemoryWriterService } from './ai-training-memory-writer.service';

describe('AiTrainingMemoryWriterService', () => {
  it('appends a masked training line to memory', () => {
    const memory = { appendToMemoryDoc: jest.fn() };
    const writer = new AiTrainingMemoryWriterService(memory as never);

    writer.appendApprovedMemory({
      fact: 'Customer care is 0712345678',
      approvedBy: 'admin-1',
      sourceItemId: 'train-1',
      maskPrivate: true,
    });

    expect(memory.appendToMemoryDoc).toHaveBeenCalledWith(
      expect.stringMatching(/^\[training \d{4}-\d{2}-\d{2} by admin-1 item:train-1\]/),
    );
    expect(memory.appendToMemoryDoc.mock.calls[0][0]).not.toContain('0712345678');
  });

  it('blocks customer-specific facts from global memory', () => {
    const writer = new AiTrainingMemoryWriterService({ appendToMemoryDoc: jest.fn() } as never);

    expect(() =>
      writer.appendApprovedMemory({
        fact: 'Customer Asha prefers blue phones',
        approvedBy: 'admin-1',
        isCustomerSpecific: true,
      }),
    ).toThrow(BadRequestException);
  });
});
