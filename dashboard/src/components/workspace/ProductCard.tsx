import type { ReactNode } from 'react';
import { Package } from 'lucide-react';

type ProductCardProps = {
  name: string;
  category?: string | null;
  /** Alias for category — subtitle line under the name */
  meta?: string | null;
  price?: string | null;
  stockLabel?: string;
  stockLevel?: 'out' | 'low' | 'ok';
  imageUrl?: string | null;
  onClick?: () => void;
  onDoubleClick?: () => void;
  actions?: ReactNode;
  overlay?: ReactNode;
  className?: string;
  disabled?: boolean;
  selected?: boolean;
  inactive?: boolean;
  layout?: 'grid' | 'row';
};

export function ProductCard({
  name,
  category,
  meta,
  price,
  stockLabel,
  stockLevel = 'ok',
  imageUrl,
  onClick,
  onDoubleClick,
  actions,
  overlay,
  className = '',
  disabled = false,
  selected = false,
  inactive = false,
  layout = 'grid',
}: ProductCardProps) {
  const subtitle = meta ?? category;
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      className={[
        'ws-product-card',
        layout === 'row' ? 'ws-product-card--row' : '',
        selected ? 'is-selected' : '',
        inactive ? 'is-inactive' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      disabled={disabled}
    >
      <div className="ws-product-card__media">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="ws-product-card__img" />
        ) : (
          <div className="ws-product-card__img ws-product-card__img--empty">
            <Package size={layout === 'row' ? 20 : 24} />
          </div>
        )}
      </div>
      <div className="ws-product-card__body">
        <div className="ws-product-card__title-row">
          <p className="ws-product-card__name">{name}</p>
          {stockLabel && layout === 'grid' && (
            <span className={`ws-product-card__stock ws-product-card__stock--${stockLevel}`}>
              {stockLabel}
            </span>
          )}
        </div>
        {subtitle && <p className="ws-product-card__meta">{subtitle}</p>}
        {price && <p className="ws-product-card__price">{price}</p>}
        {stockLabel && layout === 'row' && (
          <span className={`ws-product-card__stock ws-product-card__stock--${stockLevel}`}>
            {stockLabel}
          </span>
        )}
      </div>
      {actions && <div className="ws-product-card__actions">{actions}</div>}
      {overlay}
    </Wrapper>
  );
}
