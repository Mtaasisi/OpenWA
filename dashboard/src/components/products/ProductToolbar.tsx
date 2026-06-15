import { LayoutGrid, List } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import './products-management.css';

export type ProductViewMode = 'table' | 'grid';
export type StockFilter = 'all' | 'in_stock' | 'low' | 'out';

type Props = {
  categories: string[];
  brands: string[];
  categoryFilter: string;
  brandFilter: string;
  stockFilter: StockFilter;
  viewMode: ProductViewMode;
  onCategoryChange: (v: string) => void;
  onBrandChange: (v: string) => void;
  onStockFilterChange: (v: StockFilter) => void;
  onViewModeChange: (v: ProductViewMode) => void;
  hideCategoryFilter?: boolean;
};

export function ProductToolbar({
  categories,
  brands,
  categoryFilter,
  brandFilter,
  stockFilter,
  viewMode,
  onCategoryChange,
  onBrandChange,
  onStockFilterChange,
  onViewModeChange,
  hideCategoryFilter = false,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="products-toolbar">
      {!hideCategoryFilter ? (
      <select
        className="products-toolbar__select"
        value={categoryFilter}
        onChange={(e) => onCategoryChange(e.target.value)}
        aria-label={t('products.filters.category', { defaultValue: 'Category' })}
      >
        <option value="all">{t('products.filters.allCategories', { defaultValue: 'All categories' })}</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      ) : null}

      <select
        className="products-toolbar__select"
        value={brandFilter}
        onChange={(e) => onBrandChange(e.target.value)}
        aria-label={t('products.filters.brand', { defaultValue: 'Brand' })}
      >
        <option value="all">{t('products.filters.allBrands', { defaultValue: 'All brands' })}</option>
        {brands.map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
      </select>

      <select
        className="products-toolbar__select"
        value={stockFilter}
        onChange={(e) => onStockFilterChange(e.target.value as StockFilter)}
        aria-label={t('products.filters.stock', { defaultValue: 'Stock status' })}
      >
        <option value="all">{t('products.filters.allStock', { defaultValue: 'All stock' })}</option>
        <option value="in_stock">{t('products.filters.inStock', { defaultValue: 'In stock' })}</option>
        <option value="low">{t('products.filters.lowStock', { defaultValue: 'Low stock' })}</option>
        <option value="out">{t('products.filters.outOfStock', { defaultValue: 'Out of stock' })}</option>
      </select>

      <div className="products-toolbar__view-toggle" role="group">
        <button
          type="button"
          className={viewMode === 'table' ? 'is-active' : ''}
          onClick={() => onViewModeChange('table')}
          title={t('products.view.table', { defaultValue: 'Table view' })}
        >
          <List size={16} />
        </button>
        <button
          type="button"
          className={viewMode === 'grid' ? 'is-active' : ''}
          onClick={() => onViewModeChange('grid')}
          title={t('products.view.grid', { defaultValue: 'Grid view' })}
        >
          <LayoutGrid size={16} />
        </button>
      </div>
    </div>
  );
}
