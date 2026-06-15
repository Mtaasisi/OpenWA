import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Loader2, X } from 'lucide-react';
import { productsApi } from '../../services/api';
import { ModalOverlay } from '../ModalOverlay';
import './products-management.css';

type Step = 'upload' | 'preview' | 'result';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  onOpenHistory?: () => void;
};

const IMPORT_TYPE_IDS = [
  'products_only',
  'products_variants',
  'variants_only',
  'imei_only',
  'price_update',
  'stock_update',
] as const;

const MODE_IDS = ['create_update', 'create_only', 'update_only', 'dry_run'] as const;

export function ProductImportWizard({ isOpen, onClose, onComplete, onOpenHistory }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [importType, setImportType] = useState('products_variants');
  const [mode, setMode] = useState('create_update');
  const [preview, setPreview] = useState<{
    summary: { total: number; valid: number; warning: number; error: number };
    rows: Array<{ rowNumber: number; status: string; errors: string[]; warnings: string[] }>;
  } | null>(null);
  const [result, setResult] = useState<{ batchId: string; createdCount: number; updatedCount: number; skippedCount: number } | null>(null);

  const importTypes = useMemo(
    () =>
      IMPORT_TYPE_IDS.map((id) => ({
        id,
        label: t(`products.importWizard.types.${id}`, { defaultValue: id }),
      })),
    [t],
  );

  const modes = useMemo(
    () =>
      MODE_IDS.map((id) => ({
        id,
        label: t(`products.importWizard.modes.${id}`, { defaultValue: id }),
      })),
    [t],
  );

  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('No file');
      const base64 = await fileToBase64(file);
      const fileType = file.name.endsWith('.xlsx') ? 'xlsx' : 'csv';
      return productsApi.importPreview({
        fileName: file.name,
        fileType,
        fileContentBase64: base64,
        importType,
      }) as Promise<typeof preview>;
    },
    onSuccess: (data) => {
      setPreview(data as typeof preview);
      setStep('preview');
    },
  });

  const executeMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('No file');
      const base64 = await fileToBase64(file);
      const fileType = file.name.endsWith('.xlsx') ? 'xlsx' : 'csv';
      return productsApi.importExecute({
        fileName: file.name,
        fileType,
        fileContentBase64: base64,
        importType,
        mode,
      });
    },
    onSuccess: (data) => {
      setResult(data);
      setStep('result');
      onComplete();
    },
  });

  const downloadTemplate = async () => {
    const { csv } = await productsApi.importTemplate();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'PRODUCT_IMPORT_TEMPLATE.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <ModalOverlay onClose={onClose}>
      <div className="products-import-wizard" data-testid="product-import-wizard" onClick={(e) => e.stopPropagation()} role="dialog">
        <header className="products-inauzwa-dialog__header" style={{ padding: '16px 20px' }}>
          <h3>{t('products.importWizard.title', { defaultValue: 'Import products' })}</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {onOpenHistory ? (
              <button type="button" className="fu-btn fu-btn--ghost" onClick={onOpenHistory}>
                {t('products.importHistory', { defaultValue: 'Import history' })}
              </button>
            ) : null}
            <button type="button" className="products-inauzwa-dialog__close" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="products-import-wizard__steps">
          {(['upload', 'preview', 'result'] as Step[]).map((s) => (
            <span key={s} className={`products-import-wizard__step ${step === s ? 'is-active' : ''}`}>
              {t(`products.importWizard.steps.${s}`, { defaultValue: s })}
            </span>
          ))}
        </div>

        <div className="products-import-wizard__body">
          {step === 'upload' ? (
            <>
              <p>{t('products.importWizard.uploadHint', { defaultValue: 'Upload CSV or XLSX. Map columns on the next step.' })}</p>
              <button type="button" className="fu-btn fu-btn--ghost" onClick={() => void downloadTemplate()}>
                {t('products.importWizard.downloadTemplate', { defaultValue: 'Download template' })}
              </button>
              <div style={{ margin: '12px 0' }}>
                <label>
                  {t('products.importWizard.importType', { defaultValue: 'Import type' })}
                  <select value={importType} onChange={(e) => setImportType(e.target.value)}>
                    {importTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div style={{ margin: '12px 0' }}>
                <label>
                  {t('products.importWizard.mode', { defaultValue: 'Mode' })}
                  <select value={mode} onChange={(e) => setMode(e.target.value)}>
                    {modes.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <div style={{ marginTop: 16 }}>
                <button
                  type="button"
                  className="fu-btn fu-btn--primary"
                  disabled={!file || previewMutation.isPending}
                  onClick={() => previewMutation.mutate()}
                >
                  {previewMutation.isPending ? <Loader2 className="spin" size={14} /> : null}
                  {t('products.importWizard.previewValidate', { defaultValue: 'Preview & validate' })}
                </button>
              </div>
            </>
          ) : null}

          {step === 'preview' && preview ? (
            <>
              <p>
                {t('products.importWizard.summary', {
                  valid: preview.summary.valid,
                  warning: preview.summary.warning,
                  error: preview.summary.error,
                  defaultValue: `Valid: ${preview.summary.valid} · Warnings: ${preview.summary.warning} · Errors: ${preview.summary.error}`,
                })}
              </p>
              <table className="products-import-preview-table">
                <thead>
                  <tr>
                    <th>{t('products.importWizard.table.row', { defaultValue: 'Row' })}</th>
                    <th>{t('products.importWizard.table.status', { defaultValue: 'Status' })}</th>
                    <th>{t('products.importWizard.table.issues', { defaultValue: 'Issues' })}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 50).map((row) => (
                    <tr key={row.rowNumber} className={`row-${row.status}`}>
                      <td>{row.rowNumber}</td>
                      <td>{row.status}</td>
                      <td>{[...row.errors, ...row.warnings].join('; ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                <button type="button" className="fu-btn fu-btn--ghost" onClick={() => setStep('upload')}>
                  {t('common.back', { defaultValue: 'Back' })}
                </button>
                <button
                  type="button"
                  className="fu-btn fu-btn--primary"
                  disabled={executeMutation.isPending || preview.summary.error > 0}
                  onClick={() => executeMutation.mutate()}
                >
                  {executeMutation.isPending ? <Loader2 className="spin" size={14} /> : null}
                  {t('products.import', { defaultValue: 'Import' })}
                </button>
              </div>
            </>
          ) : null}

          {step === 'result' && result ? (
            <>
              <p>
                {t('products.importWizard.result', {
                  created: result.createdCount,
                  updated: result.updatedCount,
                  skipped: result.skippedCount,
                  defaultValue: `Created: ${result.createdCount} · Updated: ${result.updatedCount} · Skipped: ${result.skippedCount}`,
                })}
              </p>
              <p className="products-table__meta">
                {t('products.importWizard.batchId', {
                  id: result.batchId,
                  defaultValue: `Batch ID: ${result.batchId}`,
                })}
              </p>
              <button type="button" className="fu-btn fu-btn--primary" onClick={onClose}>
                {t('products.importWizard.done', { defaultValue: 'Done' })}
              </button>
            </>
          ) : null}
        </div>
      </div>
    </ModalOverlay>
  );
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
