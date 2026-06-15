import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { productsApi, type CrmProductListItem } from '../../../services/api';

type Props = {
  value: string;
  onSelect: (product: CrmProductListItem) => void;
  placeholder?: string;
};

export function AiProductSearchField({ value, onSelect, placeholder }: Props) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const searchPlaceholder = placeholder ?? t('ai.learning.modals.searchProducts');
  const debounced = useDebouncedValue(q, 300);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['products', 'ail-search', debounced],
    queryFn: () => productsApi.list({ q: debounced, limit: 12, activeOnly: true }),
    enabled: debounced.trim().length >= 2,
  });

  const selected = value ? `Selected: ${value.slice(0, 8)}…` : null;

  return (
    <div className="ail-product-search">
      <input
        className="settings-int-input"
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder={searchPlaceholder}
      />
      {isFetching && <Loader2 className="spin" size={14} />}
      {selected && <p className="ail-muted">{selected}</p>}
      {results.length > 0 && (
        <ul className="ail-product-search__list">
          {results.map(p => (
            <li key={p.id}>
              <button type="button" className="ail-btn" onClick={() => onSelect(p)}>
                {p.name}
                {p.category ? ` · ${p.category}` : ''}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
