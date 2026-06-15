import type { CrmProductListItem } from '../services/api';

const LOW_STOCK_THRESHOLD = 10;

export type ProductStockBadge = 'inStock' | 'lowStock' | 'outOfStock';

export function productThumbUrl(product: CrmProductListItem): string | null {
  const gallery = (product.imageUrls ?? [])
    .map((url) => url?.trim())
    .filter((url): url is string => Boolean(url));
  if (gallery.length > 0) return gallery[0];
  const single = product.imageUrl?.trim();
  return single || null;
}

export function productStockBadge(product: CrmProductListItem): ProductStockBadge {
  if (product.totalStock <= 0) return 'outOfStock';
  if (product.totalStock < LOW_STOCK_THRESHOLD) return 'lowStock';
  return 'inStock';
}

export function productCatalogSubtitle(product: CrmProductListItem): string {
  const desc = product.description?.trim();
  if (desc) return desc.length > 64 ? `${desc.slice(0, 61)}…` : desc;
  const parts = [product.sku?.trim(), product.category?.trim()].filter(Boolean);
  return parts.join(' · ');
}

export function formatProductPrice(product: CrmProductListItem): string {
  if (product.sellingPrice == null) return '';
  const cur = product.currency?.trim();
  return cur
    ? `${cur} ${product.sellingPrice.toLocaleString()}`
    : product.sellingPrice.toLocaleString();
}

export function productCatalogCategories(products: CrmProductListItem[]): string[] {
  const cats = new Set<string>();
  for (const p of products) {
    const c = p.category?.trim();
    if (c) cats.add(c);
  }
  return [...cats].sort((a, b) => a.localeCompare(b));
}

export function filterProductsByCategory(
  products: CrmProductListItem[],
  categoryFilter: string,
): CrmProductListItem[] {
  if (categoryFilter === 'all') return products;
  return products.filter((p) => (p.category?.trim() ?? '') === categoryFilter);
}

export function productStockLevel(badge: ProductStockBadge): 'ok' | 'low' | 'out' {
  if (badge === 'outOfStock') return 'out';
  if (badge === 'lowStock') return 'low';
  return 'ok';
}

export function productCardFields(
  product: CrmProductListItem,
  stockLabel: (key: ProductStockBadge) => string,
) {
  const badge = productStockBadge(product);
  return {
    name: product.name,
    meta: productCatalogSubtitle(product) || product.category?.trim() || null,
    price: formatProductPrice(product) || null,
    stockLabel: stockLabel(badge),
    stockLevel: productStockLevel(badge),
    imageUrl: productThumbUrl(product),
  };
}
