import { Injectable } from '@nestjs/common';

@Injectable()
export class ProductImportMappingService {
  private readonly aliases: Record<string, string[]> = {
    name: ['name', 'product', 'product name', 'product_name', 'jina', 'item'],
    description: ['description', 'desc', 'maelezo'],
    sku: ['sku', 'product_sku'],
    barcode: ['barcode', 'bar_code'],
    category: ['category', 'cat', 'aina'],
    brand: ['brand', 'manufacturer'],
    model: ['model'],
    sellingPrice: ['price', 'bei', 'selling price', 'selling_price', 'sell_price'],
    costPrice: ['cost', 'cost price', 'cost_price', 'buying price', 'buy_price'],
    stockQuantity: ['stock', 'qty', 'quantity', 'stock_quantity'],
    imageUrl: ['image', 'image_url', 'picha', 'photo'],
    imageUrls: ['images', 'image_urls', 'gallery'],
    variantName: ['variant', 'variant name', 'variant_name'],
    variantSku: ['variant sku', 'variant_sku'],
    color: ['color', 'colour', 'rangi'],
    storage: ['storage', 'capacity'],
    ram: ['ram', 'memory'],
    condition: ['condition'],
    grade: ['grade'],
    imei: ['imei', 'imei_number'],
    serialNumber: ['serial', 'serial number', 'serial_number', 'sn'],
    branch: ['branch', 'branch_id'],
    warranty: ['warranty'],
    installmentEnabled: ['installment enabled', 'installment_enabled'],
    installmentMinDeposit: ['min deposit', 'installment_min_deposit'],
    installmentDurationDays: ['duration', 'installment_duration', 'installment_duration_days'],
  };

  autoMap(headers: string[]): Record<string, string> {
    const mapping: Record<string, string> = {};
    const normalized = headers.map((h) => h.trim().toLowerCase().replace(/\s+/g, ' '));

    for (const [field, aliases] of Object.entries(this.aliases)) {
      for (let i = 0; i < normalized.length; i++) {
        const h = normalized[i];
        if (aliases.some((a) => h === a || h.includes(a))) {
          mapping[field] = headers[i];
          break;
        }
      }
    }
    return mapping;
  }
}
