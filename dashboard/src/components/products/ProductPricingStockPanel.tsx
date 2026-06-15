import { useTranslation } from 'react-i18next';
import type { CrmProduct, CrmProductVariant } from '../../services/api';

function sellableVariants(variants: CrmProductVariant[]): CrmProductVariant[] {
  return variants.filter((v) => !v.parentVariantId && v.variantType !== 'imei_child');
}

function isTracked(v: CrmProductVariant): boolean {
  return !!(v.trackInventoryItems || v.isParent || v.variantType === 'parent');
}

type Props = {
  product: CrmProduct;
};

export function ProductPricingStockPanel({ product }: Props) {
  const { t } = useTranslation();
  const variants = sellableVariants(product.variants ?? []);

  return (
    <div className="products-pricing-panel" data-testid="product-pricing-panel">
      <section>
        <h3>{t('products.pricing.productDefault', { defaultValue: 'Product default price' })}</h3>
        <p>
          {product.currency ?? ''} {product.sellingPrice?.toLocaleString() ?? '—'}
          {product.costPrice != null ? (
            <span className="products-table__meta">
              {' '}
              · Cost {product.costPrice.toLocaleString()} · Margin{' '}
              {product.sellingPrice != null
                ? Math.round(((product.sellingPrice - product.costPrice) / product.sellingPrice) * 100)
                : 0}
              %
            </span>
          ) : null}
        </p>
      </section>

      <table className="products-inventory-table">
        <thead>
          <tr>
            <th>{t('products.pricing.variant', { defaultValue: 'Variant' })}</th>
            <th>{t('products.pricing.price', { defaultValue: 'Price' })}</th>
            <th>{t('products.pricing.cost', { defaultValue: 'Cost' })}</th>
            <th>{t('products.pricing.stock', { defaultValue: 'Stock' })}</th>
            <th>{t('products.pricing.tracked', { defaultValue: 'IMEI tracked' })}</th>
          </tr>
        </thead>
        <tbody>
          {variants.map((v) => (
            <tr key={v.id}>
              <td>{v.name}</td>
              <td>{v.sellingPrice?.toLocaleString() ?? product.sellingPrice?.toLocaleString() ?? '—'}</td>
              <td>{v.costPrice?.toLocaleString() ?? '—'}</td>
              <td>
                {v.quantity}
                {isTracked(v) ? (
                  <span className="products-table__meta"> (from items)</span>
                ) : null}
              </td>
              <td>{isTracked(v) ? 'Yes' : 'No'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {product.totalStock <= (variants[0]?.lowStockThreshold ?? 10) && product.totalStock > 0 ? (
        <p className="product-editor-helper">{t('products.pricing.lowStockAlert', { defaultValue: 'Low stock alert active' })}</p>
      ) : null}
    </div>
  );
}
