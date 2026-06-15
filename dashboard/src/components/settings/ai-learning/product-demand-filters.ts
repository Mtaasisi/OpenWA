import type { ProductDemandFilters } from './ProductDemandFilterBar';

export function filtersToQueryParams(filters: ProductDemandFilters): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.matched) params.matched = filters.matched;
  if (filters.category?.trim()) params.category = filters.category.trim();
  if (filters.brand?.trim()) params.brand = filters.brand.trim();
  if (filters.installmentOnly) params.installmentOnly = 'true';
  if (filters.discountOnly) params.discountOnly = 'true';
  if (filters.paymentReadyOnly) params.paymentReadyOnly = 'true';
  if (filters.trendingOnly) params.trendingOnly = 'true';
  if (filters.from) params.from = filters.from;
  if (filters.to) {
    params.to = filters.to.includes('T') ? filters.to : `${filters.to}T23:59:59.999Z`;
  }
  return params;
}
