import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Loader2, RotateCcw, X } from 'lucide-react';
import { productsApi } from '../../services/api';
import { ModalOverlay } from '../ModalOverlay';
import './products-management.css';

export type ProductImportBatchSummary = {
  id: string;
  fileName: string;
  importType: string;
  mode: string;
  status: string;
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  createdAt: string;
  completedAt?: string | null;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export function ProductImportHistoryPanel({ isOpen, onClose }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: batches = [], isLoading } = useQuery({
    queryKey: ['products', 'import-history'],
    queryFn: () => productsApi.importHistory() as Promise<ProductImportBatchSummary[]>,
    enabled: isOpen,
  });

  const rollback = useMutation({
    mutationFn: (batchId: string) => productsApi.importRollback(batchId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['products', 'import-history'] });
    },
  });

  if (!isOpen) return null;

  return (
    <ModalOverlay onClose={onClose}>
      <div
        className="products-import-wizard"
        data-testid="product-import-history"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <header className="products-inauzwa-dialog__header" style={{ padding: '16px 20px' }}>
          <h3>{t('products.importHistory', { defaultValue: 'Import history' })}</h3>
          <button type="button" className="products-inauzwa-dialog__close" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="products-import-wizard__body">
          {isLoading ? (
            <Loader2 className="spin" size={20} />
          ) : batches.length === 0 ? (
            <p className="products-table__meta">{t('products.importWizard.noImports', { defaultValue: 'No imports yet.' })}</p>
          ) : (
            <table className="products-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>{t('products.importWizard.table.file', { defaultValue: 'File' })}</th>
                  <th>{t('products.importWizard.table.type', { defaultValue: 'Type' })}</th>
                  <th>{t('products.importWizard.table.status', { defaultValue: 'Status' })}</th>
                  <th>{t('products.importWizard.table.created', { defaultValue: 'Created' })}</th>
                  <th>{t('products.importWizard.table.updated', { defaultValue: 'Updated' })}</th>
                  <th>{t('products.importWizard.table.when', { defaultValue: 'When' })}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => (
                  <tr key={batch.id}>
                    <td>{batch.fileName}</td>
                    <td>{batch.importType}</td>
                    <td>{batch.status}</td>
                    <td>{batch.createdCount}</td>
                    <td>{batch.updatedCount}</td>
                    <td>{new Date(batch.completedAt ?? batch.createdAt).toLocaleString()}</td>
                    <td>
                      {batch.status === 'completed' ? (
                        <button
                          type="button"
                          className="fu-btn fu-btn--ghost"
                          disabled={rollback.isPending}
                          onClick={() => rollback.mutate(batch.id)}
                        >
                          <RotateCcw size={14} /> {t('products.importWizard.rollback', { defaultValue: 'Rollback' })}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </ModalOverlay>
  );
}
