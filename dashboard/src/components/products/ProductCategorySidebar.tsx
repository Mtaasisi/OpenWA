import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { CrmProductListItem } from '../../services/api';

type Props = {
  products: CrmProductListItem[];
  categoryFilter: string;
  onCategoryFilterChange: (category: string) => void;
};

export function ProductCategorySidebar({
  products,
  categoryFilter,
  onCategoryFilterChange,
}: Props) {
  const { t } = useTranslation();

  const { total, categories } = useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of products) {
      const name = product.category?.trim();
      if (!name) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return {
      total: products.length,
      categories: [...counts.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, count]) => ({ name, count })),
    };
  }, [products]);

  return (
    <aside className="products-category-sidebar" aria-label={t('products.filters.category', { defaultValue: 'Category' })}>
      <div className="products-category-sidebar__panel">
        <div className="products-category-sidebar__header">
          <h3 className="products-category-sidebar__title">
            {t('products.sidebar.categories', { defaultValue: 'Categories' })}
          </h3>
        </div>
        <nav className="products-category-sidebar__nav">
          <button
            type="button"
            className={`products-category-sidebar__item${categoryFilter === 'all' ? ' is-active' : ''}`}
            onClick={() => onCategoryFilterChange('all')}
          >
            <span>{t('products.inbox.allItems')}</span>
            <span className="products-category-sidebar__count">{total}</span>
          </button>
          {categories.map(({ name, count }) => (
            <button
              key={name}
              type="button"
              className={`products-category-sidebar__item${categoryFilter === name ? ' is-active' : ''}`}
              onClick={() => onCategoryFilterChange(name)}
            >
              <span>{name}</span>
              <span className="products-category-sidebar__count">{count}</span>
            </button>
          ))}
        </nav>
      </div>
    </aside>
  );
}
