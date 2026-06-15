import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2, X } from 'lucide-react';
import { productsApi } from '../../services/api';
import { ModalOverlay } from '../ModalOverlay';

type Props = {
  productId: string;
  productSku: string | null;
  isOpen: boolean;
  onClose: () => void;
  onGenerated: () => void;
};

export function ProductVariantMatrixModal({
  productId,
  productSku,
  isOpen,
  onClose,
  onGenerated,
}: Props) {
  const [storage, setStorage] = useState('64GB, 128GB, 256GB');
  const [colors, setColors] = useState('Black, White, Blue');
  const [basePrice, setBasePrice] = useState('');
  const [preview, setPreview] = useState<string[] | null>(null);

  const generate = useMutation({
    mutationFn: () =>
      productsApi.generateVariants(productId, {
        storageOptions: splitList(storage),
        colorOptions: splitList(colors),
        basePrice: basePrice ? Number(basePrice) : undefined,
        skuPattern: '{PRODUCT_SKU}-{STORAGE}-{COLOR}',
      }),
    onSuccess: (res) => {
      setPreview(res.created);
      onGenerated();
    },
  });

  if (!isOpen) return null;

  return (
    <ModalOverlay onClose={onClose}>
      <div className="fu-modal" data-testid="product-variant-matrix-modal" onClick={(e) => e.stopPropagation()} style={{ width: 'min(520px, 94vw)' }}>
        <header className="products-inauzwa-dialog__header">
          <h3>Generate variants</h3>
          <button type="button" className="products-inauzwa-dialog__close" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div style={{ padding: 20 }}>
          <p className="products-table__meta">SKU base: {productSku ?? 'auto from product name'}</p>
          <label>
            Storage options (comma separated)
            <input value={storage} onChange={(e) => setStorage(e.target.value)} style={{ width: '100%' }} />
          </label>
          <label style={{ display: 'block', marginTop: 10 }}>
            Color options
            <input value={colors} onChange={(e) => setColors(e.target.value)} style={{ width: '100%' }} />
          </label>
          <label style={{ display: 'block', marginTop: 10 }}>
            Base price
            <input value={basePrice} onChange={(e) => setBasePrice(e.target.value)} style={{ width: '100%' }} />
          </label>
          <button
            type="button"
            className="fu-btn fu-btn--primary"
            style={{ marginTop: 16 }}
            disabled={generate.isPending}
            onClick={() => generate.mutate()}
          >
            {generate.isPending ? <Loader2 className="spin" size={14} /> : null}
            Preview & create
          </button>
          {preview?.length ? (
            <ul style={{ marginTop: 12, maxHeight: 180, overflow: 'auto' }}>
              {preview.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </ModalOverlay>
  );
}

function splitList(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
