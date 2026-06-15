import { useQuery } from '@tanstack/react-query';
import { productsApi } from '../../services/api';
import './products-management.css';

type Props = {
  productId: string;
};

export function ProductHistoryPanel({ productId }: Props) {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['products', productId, 'history'],
    queryFn: () => productsApi.productHistory(productId),
  });

  if (isLoading) return <p>Loading history…</p>;
  if (!events.length) return <p>No history recorded yet.</p>;

  return (
    <div className="products-history-panel">
      <ul>
        {events.map((ev) => (
          <li key={ev.id} style={{ marginBottom: 10 }}>
            <strong>{ev.action.replace(/_/g, ' ')}</strong>
            <div className="products-table__meta">
              {new Date(ev.createdAt).toLocaleString()}
              {ev.variantId ? ` · variant ${ev.variantId.slice(0, 8)}` : ''}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
