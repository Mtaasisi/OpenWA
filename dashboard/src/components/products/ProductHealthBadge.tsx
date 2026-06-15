import type { ProductHealthIssue } from '../../services/api';
import { healthLabel } from '../../lib/product-health-utils';
import './ProductHealthBadge.css';

type Props = {
  issues: ProductHealthIssue[];
  compact?: boolean;
};

export function ProductHealthBadge({ issues, compact }: Props) {
  if (!issues.length) {
    return <span className="product-health-badge product-health-badge--ok">OK</span>;
  }

  const primary = issues[0];
  const severity =
    issues.includes('duplicate_imei') ||
    issues.includes('duplicate_sku') ||
    issues.includes('installment_invalid')
      ? 'error'
      : issues.includes('out_of_stock') || issues.includes('missing_price')
        ? 'warning'
        : 'muted';

  return (
    <span
      className={`product-health-badge product-health-badge--${severity}`}
      title={issues.map(healthLabel).join(', ')}
    >
      {compact ? issues.length : healthLabel(primary)}
      {issues.length > 1 && compact ? ` +${issues.length - 1}` : null}
    </span>
  );
}
