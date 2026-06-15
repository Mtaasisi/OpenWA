import { ProductImportMappingService } from './product-import-mapping.service';

describe('ProductImportMappingService', () => {
  let mapping: ProductImportMappingService;

  beforeEach(() => {
    mapping = new ProductImportMappingService();
  });

  it('auto-maps common English headers', () => {
    const result = mapping.autoMap(['product name', 'sku', 'price', 'stock']);
    expect(result.name).toBe('product name');
    expect(result.sku).toBe('sku');
    expect(result.sellingPrice).toBe('price');
    expect(result.stockQuantity).toBe('stock');
  });

  it('auto-maps Swahili aliases', () => {
    const result = mapping.autoMap(['jina', 'bei', 'aina']);
    expect(result.name).toBe('jina');
    expect(result.sellingPrice).toBe('bei');
    expect(result.category).toBe('aina');
  });

  it('maps variant and IMEI columns', () => {
    const result = mapping.autoMap(['variant name', 'imei', 'serial number']);
    expect(result.variantName).toBe('variant name');
    expect(result.imei).toBe('imei');
    expect(result.serialNumber).toBe('serial number');
  });
});
