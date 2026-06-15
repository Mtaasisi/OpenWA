import { ProductImportParserService } from './product-import-parser.service';

describe('ProductImportParserService', () => {
  let parser: ProductImportParserService;

  beforeEach(() => {
    parser = new ProductImportParserService();
  });

  it('parses CSV headers and rows', () => {
    const csv = [
      'product name,sku,price',
      'iPhone 13,IPH13,850000',
      'MacBook Air,MBA-M1,1200000',
    ].join('\n');

    const result = parser.parseCsv(csv);
    expect(result.headers).toEqual(['product name', 'sku', 'price']);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].data['product name']).toBe('iPhone 13');
    expect(result.rows[0].rowNumber).toBe(2);
  });

  it('handles quoted CSV fields with commas', () => {
    const csv = 'name,description\n"Phone, Pro","Big, fast"';
    const result = parser.parseCsv(csv);
    expect(result.rows[0].data.name).toBe('Phone, Pro');
    expect(result.rows[0].data.description).toBe('Big, fast');
  });

  it('returns empty result for blank CSV', () => {
    expect(parser.parseCsv('   \n  ')).toEqual({ headers: [], rows: [] });
  });

  it('ships a template with expected columns', () => {
    const template = parser.getTemplateCsv();
    expect(template).toContain('product name');
    expect(template).toContain('variant name');
    expect(template.split('\n').length).toBeGreaterThanOrEqual(3);
  });

  it('parses XLSX base64 when xlsx is installed', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require('xlsx');
    const sheet = XLSX.utils.aoa_to_sheet([
      ['product name', 'sku', 'price'],
      ['Galaxy S24', 'GS24', '900000'],
    ]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Products');
    const base64 = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }).toString('base64');

    const result = parser.parseXlsxBase64(base64);
    expect(result.headers).toContain('product name');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].data['product name']).toBe('Galaxy S24');
  });
});
