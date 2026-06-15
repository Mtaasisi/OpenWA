import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import type { CrmProductListItem } from '../services/api';
import { MaterialSymbol } from './MaterialSymbol';
import { ProductCard } from './workspace';
import {
  filterProductsByCategory,
  productCardFields,
  productCatalogCategories,
} from '../lib/product-catalog-utils';

export type ProductCatalogViewProps = {
  variant?: 'modal' | 'page';
  title: string;
  titleId?: string;
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  products: CrmProductListItem[];
  isLoading?: boolean;
  categoryFilter: string;
  onCategoryFilterChange: (category: string) => void;
  selectedProductId: string | null;
  onSelectProduct: (productId: string) => void;
  footer?: ReactNode;
  onClose?: () => void;
  showClose?: boolean;
  headerExtra?: ReactNode;
  status?: string | null;
  statusIsError?: boolean;
  offlineBanner?: ReactNode;
  emptyLabel?: string;
  cardDisabled?: boolean;
  onCardDoubleClick?: (product: CrmProductListItem) => void;
  /** When set, card click opens this handler instead of selection (e.g. Products page edit). */
  onProductClick?: (product: CrmProductListItem) => void;
  leadingTabs?: Array<{ id: string; label: string }>;
  leadingTab?: string;
  onLeadingTabChange?: (tabId: string) => void;
  /** Hide inbox modal header — parent provides WorkspacePageHeader */
  hideHeader?: boolean;
  /** Hide inbox modal footer — actions live in page header */
  hideFooter?: boolean;
  /** Use fu-chip tab styling (workspace pages) */
  workspaceTabs?: boolean;
};

export function ProductCatalogView({
  variant = 'modal',
  title,
  titleId = 'product-catalog-title',
  search,
  onSearchChange,
  searchPlaceholder,
  products,
  isLoading = false,
  categoryFilter,
  onCategoryFilterChange,
  selectedProductId,
  onSelectProduct,
  footer,
  onClose,
  showClose = variant === 'modal',
  headerExtra,
  status,
  statusIsError = false,
  offlineBanner,
  emptyLabel,
  cardDisabled = false,
  onCardDoubleClick,
  onProductClick,
  leadingTabs,
  leadingTab,
  onLeadingTabChange,
  hideHeader = false,
  hideFooter = false,
  workspaceTabs = false,
}: ProductCatalogViewProps) {
  const { t } = useTranslation();
  const categories = useMemo(() => productCatalogCategories(products), [products]);
  const filteredProducts = useMemo(
    () => filterProductsByCategory(products, categoryFilter),
    [products, categoryFilter],
  );

  return (
    <div
      className={[
        'inbox-interakt-catalog-modal',
        variant === 'page' ? 'inbox-interakt-catalog-modal--page' : '',
        workspaceTabs ? 'inbox-interakt-catalog-modal--workspace' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role={variant === 'modal' ? 'dialog' : 'region'}
      aria-labelledby={titleId}
    >
      {!hideHeader && (
        <header className="inbox-interakt-catalog-modal__header">
          <div className="inbox-interakt-catalog-modal__header-start">
            {showClose && onClose && (
              <button
                type="button"
                className="inbox-interakt-catalog-modal__close"
                onClick={onClose}
                aria-label={t('common.close')}
              >
                <MaterialSymbol name="close" size={20} />
              </button>
            )}
            <h2 id={titleId} className="inbox-interakt-catalog-modal__title">
              {title}
            </h2>
            {headerExtra ? (
              <div className="inbox-interakt-catalog-modal__header-extra">{headerExtra}</div>
            ) : null}
          </div>
          <div className="inbox-interakt-catalog-modal__search-wrap">
            <MaterialSymbol name="search" size={18} className="inbox-interakt-catalog-modal__search-icon" />
            <input
              type="search"
              className="inbox-interakt-catalog-modal__search"
              placeholder={searchPlaceholder ?? t('products.inbox.searchCatalog')}
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        </header>
      )}

      <div
        className={
          workspaceTabs ? 'fu-view-row products-catalog-categories' : 'inbox-interakt-catalog-modal__tabs'
        }
        role="tablist"
      >
        {!workspaceTabs &&
          leadingTabs?.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={leadingTab === tab.id}
              className={`inbox-interakt-catalog-modal__tab inbox-interakt-catalog-modal__tab--leading${
                leadingTab === tab.id ? ' is-active' : ''
              }`}
              onClick={() => onLeadingTabChange?.(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        {!workspaceTabs && leadingTabs && leadingTabs.length > 0 ? (
          <span className="inbox-interakt-catalog-modal__tab-divider" aria-hidden />
        ) : null}
        {workspaceTabs ? (
          <div className="fu-chips">
            <button
              type="button"
              role="tab"
              aria-selected={categoryFilter === 'all'}
              className={['fu-chip', categoryFilter === 'all' ? 'fu-chip--active' : ''].join(' ')}
              onClick={() => onCategoryFilterChange('all')}
            >
              {t('products.inbox.allItems')}
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={categoryFilter === cat}
                className={['fu-chip', categoryFilter === cat ? 'fu-chip--active' : ''].join(' ')}
                onClick={() => onCategoryFilterChange(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        ) : (
          <>
            <button
              type="button"
              role="tab"
              aria-selected={categoryFilter === 'all'}
              className={`inbox-interakt-catalog-modal__tab${categoryFilter === 'all' ? ' is-active' : ''}`}
              onClick={() => onCategoryFilterChange('all')}
            >
              {t('products.inbox.allItems')}
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={categoryFilter === cat}
                className={`inbox-interakt-catalog-modal__tab${categoryFilter === cat ? ' is-active' : ''}`}
                onClick={() => onCategoryFilterChange(cat)}
              >
                {cat}
              </button>
            ))}
          </>
        )}
      </div>

      <div className="inbox-interakt-catalog-modal__body">
        {offlineBanner}

        {isLoading ? (
          <div className="inbox-interakt-catalog-modal__empty">
            <Loader2 className="animate-spin" size={24} />
          </div>
        ) : filteredProducts.length === 0 ? (
          <p className="inbox-interakt-catalog-modal__empty">
            {emptyLabel ?? t('products.inbox.empty')}
          </p>
        ) : (
          <div className="inbox-interakt-catalog-modal__grid ws-product-grid">
            {filteredProducts.map((p) => {
              const isSelected = selectedProductId === p.id;
              const fields = productCardFields(p, badge => t(`products.inbox.${badge}`));

              return (
                <ProductCard
                  key={p.id}
                  className="inbox-interakt-catalog-modal__card"
                  {...fields}
                  selected={isSelected}
                  inactive={!p.isActive}
                  disabled={cardDisabled}
                  onClick={() => (onProductClick ? onProductClick(p) : onSelectProduct(p.id))}
                  onDoubleClick={() => onCardDoubleClick?.(p)}
                  overlay={
                    isSelected ? (
                      <span className="inbox-interakt-catalog-modal__check" aria-hidden>
                        <MaterialSymbol name="check" size={16} />
                      </span>
                    ) : undefined
                  }
                />
              );
            })}
          </div>
        )}

        {status && (
          <p
            className={`inbox-interakt-catalog-modal__status${
              statusIsError ? ' inbox-interakt-catalog-modal__status--error' : ''
            }`}
          >
            {status}
          </p>
        )}
      </div>

      {!hideFooter && footer ? (
        <footer className="inbox-interakt-catalog-modal__footer">{footer}</footer>
      ) : null}
    </div>
  );
}
