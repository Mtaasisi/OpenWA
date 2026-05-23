import type { Product } from '../entities/product.entity';
import type { ProductVariant } from '../entities/product-variant.entity';

export interface ProductStockSummary {
  variant: ProductVariant;
  available: number;
  imeiChildren?: ProductVariant[];
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

/** Only surface stock when one or two units remain (low-stock nudge). */
function formatLowStockLabel(available: number, variant: ProductVariant): string {
  if (available !== 1 && available !== 2) return '';
  if (variant.isParent || variant.variantType === 'parent') {
    return ` (${available} device${available === 1 ? '' : 's'} available)`;
  }
  return ` (${available} in stock)`;
}

function isTopLevelVariant(v: ProductVariant): boolean {
  return !v.parentVariantId && v.variantType !== 'imei_child';
}

function countAvailable(variant: ProductVariant, children: ProductVariant[]): number {
  if (variant.isParent || variant.variantType === 'parent') {
    return children.filter((c) => c.isActive && (c.quantity ?? 0) > 0).length;
  }
  return variant.isActive ? Math.max(0, variant.quantity ?? 0) : 0;
}

export function buildProductStockSummaries(
  variants: ProductVariant[],
): ProductStockSummary[] {
  const active = variants.filter((v) => v.isActive);
  const childrenByParent = new Map<string, ProductVariant[]>();
  for (const v of active) {
    if (v.variantType === 'imei_child' && v.parentVariantId) {
      const list = childrenByParent.get(v.parentVariantId) ?? [];
      list.push(v);
      childrenByParent.set(v.parentVariantId, list);
    }
  }

  return active
    .filter(isTopLevelVariant)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map((variant) => {
      const children = (childrenByParent.get(variant.id) ?? []).sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
      );
      return {
        variant,
        available: countAvailable(variant, children),
        imeiChildren: children.length > 0 ? children : undefined,
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
  },
): string {
  const lines: string[] = [];
  const currency = product.currency;

  lines.push(`📦 *${product.name.trim()}*`);

  if (product.category?.trim()) {
    lines.push(`_${product.category.trim()}_`);
  }

  if (product.description?.trim()) {
    lines.push('');
    lines.push(product.description.trim());
  }

  let rows = summaries;
  if (options?.variantId) {
    rows = summaries.filter((s) => s.variant.id === options.variantId);
  }
  if (options?.inStockOnly) {
    rows = rows.filter((s) => s.available > 0);
  }

  if (rows.length === 0 && product.sellingPrice != null) {
    lines.push('');
    lines.push(`Price: *${formatMoney(product.sellingPrice, currency)}*`);
    return lines.join('\n');
  }

  if (rows.length > 0) {
    lines.push('');
    const showAll = options?.includeAllVariants !== false && !options?.variantId;
    const list = showAll ? rows : rows.slice(0, 1);

    for (const { variant, available } of list) {
      const price = effectivePrice(variant.sellingPrice, product.sellingPrice);
      const priceStr = price != null ? ` — *${formatMoney(price, currency)}*` : '';
      const stockLabel = formatLowStockLabel(available, variant);

      if (available > 0 || !options?.inStockOnly) {
        lines.push(`• *${variant.name.trim()}*${priceStr}${stockLabel}`);
      }
    }
  } else if (product.sellingPrice != null) {
    lines.push('');
    lines.push(`Price: *${formatMoney(product.sellingPrice, currency)}*`);
  }

  return lines.join('\n').trim();
}
