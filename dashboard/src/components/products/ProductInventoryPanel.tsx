import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Upload } from 'lucide-react';
import {
  productsApi,
  type CrmProduct,
  type CrmInventoryItem,
  type CrmProductVariant,
  type InventoryItemStatus,
} from '../../services/api';
import './products-management.css';

function sellableVariants(variants: CrmProductVariant[]): CrmProductVariant[] {
  return variants.filter((v) => !v.parentVariantId && v.variantType !== 'imei_child');
}

function isTracked(v: CrmProductVariant): boolean {
  return !!(v.trackInventoryItems || v.isParent || v.variantType === 'parent');
}

type Props = {
  product: CrmProduct;
  canWrite: boolean;
  onUpdated: (p: CrmProduct) => void;
};

export function ProductInventoryPanel({ product, canWrite, onUpdated }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const variants = sellableVariants(product.variants ?? []);
  const trackedVariants = variants.filter(isTracked);

  const [variantFilter, setVariantFilter] = useState<string>(
    trackedVariants[0]?.id ?? variants[0]?.id ?? '',
  );
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const [newImei, setNewImei] = useState('');
  const [newSerial, setNewSerial] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['products', product.id, 'inventory', variantFilter, statusFilter, search],
    queryFn: () =>
      productsApi.listInventoryItems(product.id, {
        variantId: variantFilter || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
        q: search || undefined,
      }),
    enabled: !!variantFilter,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['products', product.id] });
  };

  const createItem = useMutation({
    mutationFn: () =>
      productsApi.createInventoryItem(product.id, {
        variantId: variantFilter,
        imei: newImei.trim() || null,
        serialNumber: newSerial.trim() || null,
      }),
    onSuccess: (p) => {
      setNewImei('');
      setNewSerial('');
      setCreateError(null);
      invalidate();
      onUpdated(p);
    },
    onError: (err: Error) => setCreateError(err.message),
  });

  const bulkPaste = useMutation({
    mutationFn: () =>
      productsApi.bulkPasteInventory(product.id, {
        variantId: variantFilter,
        text: pasteText,
      }),
    onSuccess: () => {
      setPasteText('');
      setShowPaste(false);
      invalidate();
      void productsApi.get(product.id).then(onUpdated);
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ itemId, status }: { itemId: string; status: InventoryItemStatus }) =>
      productsApi.updateInventoryItem(product.id, itemId, { status }),
    onSuccess: (p) => {
      invalidate();
      onUpdated(p);
    },
  });

  const counts = useMemo(() => {
    const c = { available: 0, reserved: 0, sold: 0, damaged: 0 };
    for (const item of items) {
      if (item.status === 'available') c.available += 1;
      if (item.status === 'reserved') c.reserved += 1;
      if (item.status === 'sold') c.sold += 1;
      if (item.status === 'damaged') c.damaged += 1;
    }
    return c;
  }, [items]);

  if (!trackedVariants.length) {
    return (
      <p className="product-editor-helper">
        {t('products.inventory.enableTracking', {
          defaultValue:
            'Enable "Track individual items by IMEI/Serial" on a variant in the Variants tab first.',
        })}
      </p>
    );
  }

  return (
    <div className="products-inventory-panel" data-testid="product-inventory-panel">
      <p className="product-editor-helper">
        {t('products.inventory.helper', {
          defaultValue:
            'Inventory items are individual physical devices (IMEI/serial). They are not customer-facing variants.',
        })}
      </p>

      <div className="products-inventory-filters">
        <select value={variantFilter} onChange={(e) => setVariantFilter(e.target.value)}>
          {trackedVariants.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">{t('products.inventory.allStatuses', { defaultValue: 'All statuses' })}</option>
          <option value="available">Available ({counts.available})</option>
          <option value="reserved">Reserved ({counts.reserved})</option>
          <option value="sold">Sold ({counts.sold})</option>
          <option value="damaged">Damaged ({counts.damaged})</option>
        </select>
        <input
          type="search"
          placeholder={t('products.inventory.search', { defaultValue: 'Search IMEI / serial' })}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {canWrite ? (
          <>
            <button type="button" className="fu-btn fu-btn--ghost" onClick={() => setShowPaste((s) => !s)}>
              <Upload size={14} /> {t('products.inventory.bulkPaste', { defaultValue: 'Bulk paste' })}
            </button>
          </>
        ) : null}
      </div>

      {showPaste && canWrite ? (
        <div>
          <textarea
            rows={6}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={'352901234567890\n352901234567891, SN12345'}
          />
          <button
            type="button"
            className="fu-btn fu-btn--primary"
            disabled={bulkPaste.isPending || !pasteText.trim()}
            onClick={() => bulkPaste.mutate()}
          >
            {bulkPaste.isPending ? <Loader2 className="spin" size={14} /> : null}
            {t('products.inventory.importPaste', { defaultValue: 'Import list' })}
          </button>
        </div>
      ) : null}

      {canWrite ? (
        <div className="products-inventory-filters">
          <input
            placeholder={t('products.inventory.imei', { defaultValue: 'IMEI' })}
            value={newImei}
            onChange={(e) => setNewImei(e.target.value)}
          />
          <input
            placeholder={t('products.inventory.serial', { defaultValue: 'Serial' })}
            value={newSerial}
            onChange={(e) => setNewSerial(e.target.value)}
          />
          <button
            type="button"
            className="fu-btn fu-btn--primary"
            disabled={createItem.isPending || (!newImei.trim() && !newSerial.trim())}
            onClick={() => createItem.mutate()}
          >
            {createItem.isPending ? <Loader2 className="spin" size={14} /> : <Plus size={14} />}
            {t('products.inventory.add', { defaultValue: 'Add item' })}
          </button>
        </div>
      ) : null}

      {createError ? <p className="product-editor__variant-error">{createError}</p> : null}

      {isLoading ? (
        <Loader2 className="spin" size={20} />
      ) : (
        <table className="products-inventory-table">
          <thead>
            <tr>
              <th>IMEI / Serial</th>
              <th>Branch</th>
              <th>Status</th>
              <th>Price</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((item: CrmInventoryItem) => (
              <tr key={item.id}>
                <td>
                  {item.imei ?? '—'}
                  {item.serialNumber ? ` / ${item.serialNumber}` : ''}
                </td>
                <td>{item.branchId}</td>
                <td>
                  <span className={`status-pill status-pill--${item.status}`}>{item.status}</span>
                </td>
                <td>{item.sellingPrice ?? '—'}</td>
                <td>
                  <div className="products-inventory-actions">
                    {canWrite && item.status === 'available' ? (
                      <>
                        <button
                          type="button"
                          className="fu-btn fu-btn--ghost"
                          onClick={() => updateStatus.mutate({ itemId: item.id, status: 'reserved' })}
                        >
                          {t('products.inventory.reserve', { defaultValue: 'Reserve' })}
                        </button>
                        <button
                          type="button"
                          className="fu-btn fu-btn--ghost"
                          onClick={() => updateStatus.mutate({ itemId: item.id, status: 'sold' })}
                        >
                          {t('products.inventory.markSold', { defaultValue: 'Mark sold' })}
                        </button>
                      </>
                    ) : null}
                    {canWrite && item.status === 'reserved' ? (
                      <>
                        <button
                          type="button"
                          className="fu-btn fu-btn--ghost"
                          onClick={() => updateStatus.mutate({ itemId: item.id, status: 'available' })}
                        >
                          {t('products.inventory.release', { defaultValue: 'Release' })}
                        </button>
                        <button
                          type="button"
                          className="fu-btn fu-btn--ghost"
                          onClick={() => updateStatus.mutate({ itemId: item.id, status: 'sold' })}
                        >
                          {t('products.inventory.markSold', { defaultValue: 'Mark sold' })}
                        </button>
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
