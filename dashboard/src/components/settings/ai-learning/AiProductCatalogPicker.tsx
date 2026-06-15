import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ModalOverlay } from '../../ModalOverlay';
import { ProductCatalogView } from '../../ProductCatalogView';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { productsApi, type CrmProductListItem } from '../../../services/api';

type Props = {
  onSelect: (product: CrmProductListItem) => void;
  buttonClassName?: string;
};

export function AiProductCatalogPicker({ onSelect, buttonClassName = 'ail-btn' }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search, 300);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', 'ail-catalog', debouncedSearch, categoryFilter],
    queryFn: () =>
      productsApi.list({
        q: debouncedSearch || undefined,
        activeOnly: true,
        limit: 80,
      }),
    enabled: open,
  });

  const selected = products.find(p => p.id === selectedProductId) ?? null;

  const confirm = () => {
    if (!selected) return;
    onSelect(selected);
    setOpen(false);
    setSelectedProductId(null);
    setSearch('');
  };

  return (
    <>
      <button type="button" className={buttonClassName} onClick={() => setOpen(true)}>
        {t('ai.learning.mapMissing.browseCatalog')}
      </button>
      {open && (
        <ModalOverlay onClose={() => setOpen(false)}>
          <div className="ail-catalog-picker" onClick={e => e.stopPropagation()}>
            <ProductCatalogView
              variant="modal"
              title={t('ai.learning.mapMissing.selectProduct')}
              search={search}
              onSearchChange={setSearch}
              products={products}
              isLoading={isLoading}
              categoryFilter={categoryFilter}
              onCategoryFilterChange={setCategoryFilter}
              selectedProductId={selectedProductId}
              onSelectProduct={setSelectedProductId}
              onClose={() => setOpen(false)}
              footer={
                <div className="ail-modal__actions">
                  <button
                    type="button"
                    className="ail-btn ail-btn--primary"
                    disabled={!selected}
                    onClick={confirm}
                  >
                    {t('ai.learning.mapMissing.selectProduct')}
                  </button>
                  <button type="button" className="ail-btn" onClick={() => setOpen(false)}>
                    {t('common.cancel', 'Cancel')}
                  </button>
                </div>
              }
            />
          </div>
        </ModalOverlay>
      )}
    </>
  );
}
