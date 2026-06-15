import { Injectable } from '@nestjs/common';

export interface ParsedImportRow {
  rowNumber: number;
  data: Record<string, string>;
}

@Injectable()
export class ProductImportParserService {
  parseCsv(content: string): { headers: string[]; rows: ParsedImportRow[] } {
    const lines = content.split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length) return { headers: [], rows: [] };

    const headers = this.splitCsvLine(lines[0]);
    const rows: ParsedImportRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = this.splitCsvLine(lines[i]);
      const data: Record<string, string> = {};
      headers.forEach((h, idx) => {
        data[h] = cols[idx]?.trim() ?? '';
      });
      rows.push({ rowNumber: i + 1, data });
    }
    return { headers, rows };
  }

  parseXlsxBase64(base64: string): { headers: string[]; rows: ParsedImportRow[] } {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const XLSX = require('xlsx');
      const buffer = Buffer.from(base64, 'base64');
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, string>[];
      if (!json.length) return { headers: [], rows: [] };
      const headers = Object.keys(json[0]);
      const rows = json.map((row: Record<string, string>, idx: number) => ({
        rowNumber: idx + 2,
        data: Object.fromEntries(
          Object.entries(row).map(([k, v]) => [k, String(v ?? '').trim()]),
        ),
      }));
      return { headers, rows };
    } catch {
      return { headers: [], rows: [] };
    }
  }

  getTemplateCsv(): string {
    return [
      'product name,sku,category,brand,model,description,price,cost,stock,variant name,variant sku,color,storage,ram,condition,imei,serial,branch',
      'iPhone 13,IPH13,Phones,Apple,iPhone 13,Latest Apple phone,850000,750000,0,128GB Black,IPH13-128-BLK,Black,128GB,,New,,,',
      'MacBook Air M1,MBA-M1,Laptops,Apple,MacBook Air,8GB 256GB,1200000,1050000,2,8GB/256GB,MBA-M1-8-256,,256GB,8GB,New,,,',
    ].join('\n');
  }

  private splitCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (ch === ',' && !inQuotes) {
        result.push(current);
        current = '';
        continue;
      }
      current += ch;
    }
    result.push(current);
    return result;
  }
}
