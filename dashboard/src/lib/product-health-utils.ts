import type { CrmProductListItem, ProductHealthIssue, CrmProduct } from '../services/api';

export function healthLabel(issue: ProductHealthIssue): string {
  const labels: Record<ProductHealthIssue, string> = {
    missing_image: 'Missing image',
    missing_price: 'Missing price',
    missing_category: 'Missing category',
    missing_sku: 'Missing SKU',
    duplicate_sku: 'Duplicate SKU',
    invalid_image: 'Invalid image',
    no_variants: 'No variants',
    variant_missing_price: 'Variant missing price',
    variant_missing_stock: 'Variant out of stock',
    imei_zero_available: 'No IMEI items',
    duplicate_imei: 'Duplicate IMEI',
    low_stock: 'Low stock',
    out_of_stock: 'Out of stock',
    installment_invalid: 'Installment misconfigured',
    inactive_with_active_variants: 'Inactive with active variants',
  };
  return labels[issue] ?? issue;
}

export function clientSideHealthChecks(product: CrmProductListItem | CrmProduct): ProductHealthIssue[] {
  const issues: ProductHealthIssue[] = [];
  if (!product.imageUrl?.trim()) issues.push('missing_image');
  if (product.sellingPrice == null) issues.push('missing_price');
  if (!product.category?.trim()) issues.push('missing_category');
  if (!product.sku?.trim()) issues.push('missing_sku');
  if (product.totalStock === 0) issues.push('out_of_stock');
  else if (product.totalStock > 0 && product.totalStock < 10) issues.push('low_stock');
  if (product.installmentEnabled) {
    if (!product.installmentMinDeposit || !product.installmentDurationDays) {
      issues.push('installment_invalid');
    }
  }
  return issues;
}

export function mergeHealthIssues(
  product: CrmProductListItem | CrmProduct,
): ProductHealthIssue[] {
  const fromApi = product.health?.issues ?? [];
  const local = clientSideHealthChecks(product);
  return [...new Set([...fromApi, ...local])];
}
