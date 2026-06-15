import { InventoryItemService } from './inventory-item.service';

describe('InventoryItemService', () => {
  it('parses bulk paste lines with imei and serial', () => {
    const service = new InventoryItemService({} as never, {} as never, {
      resolveEffectiveBranchId: async () => 'default',
    } as never);

    const result = service.parseBulkPaste(
      '123456789012345, SN-001\n987654321098765',
      'default',
    );

    expect(result.valid).toHaveLength(2);
    expect(result.valid[0]?.imei).toBe('123456789012345');
    expect(result.valid[0]?.serialNumber).toBe('SN-001');
  });
});
