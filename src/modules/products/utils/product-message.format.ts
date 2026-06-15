import type { Product } from '../entities/product.entity';
import type { ProductVariant } from '../entities/product-variant.entity';
import type { InventoryItem } from '../entities/inventory-item.entity';

export interface ProductStockSummary {
  variant: ProductVariant;
  available: number;
  imeiChildren?: ProductVariant[];
  inventoryItems?: InventoryItem[];
}

function formatMoney(amount: number | null | undefined, currency?: string | null): string {
  if (amount == null || Number.isNaN(amount)) return '';
  const cur = (currency || '').trim();
  const formatted = Number.isInteger(amount)
    ? amount.toLocaleString('en-US')
    : amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return cur ? `${cur} ${formatted}` : formatted;
}

function effectivePrice(
  variantPrice: number | null | undefined,
  productPrice: number | null | undefined,
): number | null {
  if (variantPrice != null && variantPrice > 0) return variantPrice;
  if (productPrice != null && productPrice > 0) return productPrice;
  return variantPrice ?? productPrice ?? null;
}

function formatLowStockLabel(available: number, variant: ProductVariant): string {
  if (available !== 1 && available !== 2) return '';
  const tracked =
    variant.trackInventoryItems || variant.isParent || variant.variantType === 'parent';
  if (tracked) {
    return ` (${available} device${available === 1 ? '' : 's'} available)`;
  }
  return ` (${available} in stock)`;
}

function isTopLevelVariant(v: ProductVariant): boolean {
  return !v.parentVariantId && v.variantType !== 'imei_child';
}

const GENERIC_VARIANT_NAME = /^(default variant|variant)$/i;

function isGenericVariantName(name: string): boolean {
  return GENERIC_VARIANT_NAME.test(name.trim());
}

function splitDescriptionLines(description: string | null | undefined): string[] {
  if (!description?.trim()) return [];
  return description
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function resolveVariantDisplayName(
  variant: ProductVariant,
  index: number,
  descriptionLines: string[],
  useDescriptionAsNames: boolean,
): string {
  if (useDescriptionAsNames && descriptionLines[index]) {
    return descriptionLines[index];
  }
  const name = variant.name.trim();
  if (isGenericVariantName(name) && descriptionLines[index]) {
    return descriptionLines[index];
  }
  return name;
}

function shouldUseDescriptionAsVariantNames(
  rows: ProductStockSummary[],
  descriptionLines: string[],
): boolean {
  if (descriptionLines.length === 0 || rows.length === 0) return false;
  const allStandardGeneric = rows.every(
    (s) => isGenericVariantName(s.variant.name) && s.variant.variantType === 'standard',
  );
  return allStandardGeneric && descriptionLines.length >= rows.length;
}

function countAvailable(
  variant: ProductVariant,
  legacyChildren: ProductVariant[],
  inventoryItems?: InventoryItem[],
): number {
  const tracked =
    variant.trackInventoryItems || variant.isParent || variant.variantType === 'parent';

  if (inventoryItems?.length) {
    return inventoryItems.filter((i) => i.status === 'available').length;
  }

  if (tracked) {
    if (legacyChildren.length) {
      return legacyChildren.filter((c) => c.isActive && (c.quantity ?? 0) > 0).length;
    }
    return variant.isActive ? Math.max(0, variant.quantity ?? 0) : 0;
  }
  return variant.isActive ? Math.max(0, variant.quantity ?? 0) : 0;
}

export function buildProductStockSummaries(
  variants: ProductVariant[],
  inventoryByVariant?: Map<string, InventoryItem[]>,
): ProductStockSummary[] {
  const active = variants.filter((v) => v.isActive);
  const legacyChildrenByParent = new Map<string, ProductVariant[]>();
  for (const v of active) {
    if (v.variantType === 'imei_child' && v.parentVariantId) {
      const list = legacyChildrenByParent.get(v.parentVariantId) ?? [];
      list.push(v);
      legacyChildrenByParent.set(v.parentVariantId, list);
    }
  }

  return active
    .filter(isTopLevelVariant)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map((variant) => {
      const legacyChildren = (legacyChildrenByParent.get(variant.id) ?? []).sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
      );
      const inventoryItems = inventoryByVariant?.get(variant.id);
      return {
        variant,
        available: countAvailable(variant, legacyChildren, inventoryItems),
        imeiChildren: legacyChildren.length > 0 ? legacyChildren : undefined,
        inventoryItems,
      };
    });
}

export function formatProductWhatsAppMessage(
  product: Product,
  summaries: ProductStockSummary[],
  options?: {
    variantId?: string;
    includeAllVariants?: boolean;
    includeAvailableDevices?: boolean;
    inStockOnly?: boolean;
    /** Customer WhatsApp sends must not expose stock counts (staff preview may opt in). */
    customerFacing?: boolean;
    includeStockLabels?: boolean;
  },
): string {
  const lines: string[] = [];
  const currency = product.currency;
  const descriptionLines = splitDescriptionLines(product.description);

  lines.push(`📦 *${product.name.trim()}*`);

  let rows = summaries;
  if (options?.variantId) {
    rows = summaries.filter((s) => s.variant.id === options.variantId);
  }
  if (options?.inStockOnly) {
    rows = rows.filter((s) => s.available > 0);
  }

  const useDescriptionAsNames = shouldUseDescriptionAsVariantNames(rows, descriptionLines);

  if (product.description?.trim() && !useDescriptionAsNames) {
    lines.push('');
    lines.push(product.description.trim());
  }

  if (rows.length === 0 && product.sellingPrice != null) {
    lines.push('');
    lines.push(`Price: *${formatMoney(product.sellingPrice, currency)}*`);
    return lines.join('\n');
  }

  const showStockLabels =
    options?.includeStockLabels === true && options?.customerFacing !== true;

  if (rows.length > 0) {
    lines.push('');
    const showAll = options?.includeAllVariants !== false && !options?.variantId;
    const list = showAll ? rows : rows.slice(0, 1);
    const seenLines = new Set<string>();

    for (const [index, { variant, available, inventoryItems, imeiChildren }] of list.entries()) {
      const price = effectivePrice(variant.sellingPrice, product.sellingPrice);
      const priceStr = price != null ? ` — *${formatMoney(price, currency)}*` : '';
      const stockLabel = showStockLabels ? formatLowStockLabel(available, variant) : '';
      const displayName = resolveVariantDisplayName(
        variant,
        index,
        descriptionLines,
        useDescriptionAsNames,
      );

      if (available > 0 || !options?.inStockOnly) {
        const line = `• *${displayName}*${priceStr}${stockLabel}`;
        if (seenLines.has(line)) continue;
        seenLines.add(line);
        lines.push(line);

        if (options?.includeAvailableDevices) {
          const devices =
            inventoryItems?.filter((i) => i.status === 'available') ??
            imeiChildren?.filter((c) => c.isActive && (c.quantity ?? 0) > 0) ??
            [];
          for (const d of devices.slice(0, 10)) {
            const label =
              ('imei' in d && d.imei) ||
              ('attributes' in d && (d as ProductVariant).attributes?.imei) ||
              ('name' in d && (d as ProductVariant).name) ||
              ('serialNumber' in d && d.serialNumber);
            if (label) lines.push(`  └ ${String(label)}`);
          }
          if (devices.length > 10) {
            lines.push(`  └ +${devices.length - 10} more`);
          }
        }
      }
    }
  } else if (product.sellingPrice != null) {
    lines.push('');
    lines.push(`Price: *${formatMoney(product.sellingPrice, currency)}*`);
  }

  return lines.join('\n').trim();
}
