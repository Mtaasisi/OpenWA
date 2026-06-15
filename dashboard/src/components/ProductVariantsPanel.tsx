import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { Plus, Loader2, Trash2, Pencil, Smartphone, Check, Search, Grid3X3 } from 'lucide-react';
import {
  productsApi,
  type CrmProduct,
  type CrmProductVariant,
  type ProductVariantType,
} from '../services/api';
import { ModalOverlay } from './ModalOverlay';
import { ProductVariantMatrixModal } from './products/ProductVariantMatrixModal';

function topLevelVariants(variants: CrmProductVariant[]): CrmProductVariant[] {
  return variants.filter((v) => !v.parentVariantId && v.variantType !== 'imei_child');
}

function childVariants(variants: CrmProductVariant[], parentId: string): CrmProductVariant[] {
  return variants.filter((v) => v.parentVariantId === parentId);
}

function unitRows(v: CrmProductVariant, all: CrmProductVariant[]): CrmProductVariant[] {
  const children = childVariants(all, v.id);
  return children.length > 0 ? children : [v];
}

function availableCount(v: CrmProductVariant, all: CrmProductVariant[]): number {
  const rows = unitRows(v, all);
  return rows.filter((r) => r.quantity > 0).length;
}

type VariantFormState = {
  name: string;
  sku: string;
  sellingPrice: string;
  quantity: string;
  trackInventoryItems: boolean;
  variantType: ProductVariantType;
  parentVariantId: string;
  imei: string;
  condition: string;
};

type VariantInstallmentFormState = {
  installmentEnabled: boolean;
  installmentMinDeposit: string;
  installmentDurationDays: string;
  installmentScheduleType: string;
  installmentPolicy: string;
  installmentPenaltyPolicy: string;
  installmentExpiryDays: string;
  installmentRequiresApproval: boolean;
  allowInstallmentWhenOutOfStock: boolean;
  stockingReminderEnabled: boolean;
  installmentNotes: string;
};

type VariantEditFormState = {
  name: string;
  sellingPrice: string;
  quantity: string;
  condition: string;
} & VariantInstallmentFormState;

const emptyVariantForm = (): VariantFormState => ({
  name: '',
  sku: '',
  sellingPrice: '',
  quantity: '1',
  trackInventoryItems: false,
  variantType: 'standard',
  parentVariantId: '',
  imei: '',
  condition: '',
});

const emptyVariantInstallmentForm = (): VariantInstallmentFormState => ({
  installmentEnabled: false,
  installmentMinDeposit: '',
  installmentDurationDays: '',
  installmentScheduleType: 'monthly',
  installmentPolicy: '',
  installmentPenaltyPolicy: '',
  installmentExpiryDays: '',
  installmentRequiresApproval: false,
  allowInstallmentWhenOutOfStock: false,
  stockingReminderEnabled: false,
  installmentNotes: '',
});

const emptyVariantEditForm = (): VariantEditFormState => ({
  name: '',
  sellingPrice: '',
  quantity: '0',
  condition: '',
  ...emptyVariantInstallmentForm(),
});

function installmentFromVariant(v: CrmProductVariant): VariantInstallmentFormState {
  return {
    installmentEnabled: v.installmentEnabled === true,
    installmentMinDeposit:
      v.installmentMinDeposit != null ? String(v.installmentMinDeposit) : '',
    installmentDurationDays:
      v.installmentDurationDays != null ? String(v.installmentDurationDays) : '',
    installmentScheduleType: v.installmentScheduleType ?? 'monthly',
    installmentPolicy: v.installmentPolicy ?? '',
    installmentPenaltyPolicy: v.installmentPenaltyPolicy ?? '',
    installmentExpiryDays:
      v.installmentExpiryDays != null ? String(v.installmentExpiryDays) : '',
    installmentRequiresApproval: v.installmentRequiresApproval === true,
    allowInstallmentWhenOutOfStock: v.allowInstallmentWhenOutOfStock === true,
    stockingReminderEnabled: v.stockingReminderEnabled === true,
    installmentNotes: v.installmentNotes ?? '',
  };
}

interface Props {
  product: CrmProduct;
  canWrite: boolean;
  onOpenInventory?: () => void;
  onUpdated: (product: CrmProduct) => void;
}

export function ProductVariantsPanel({ product, canWrite, onOpenInventory, onUpdated }: Props) {
  const { t } = useTranslation();
  const [variantSearch, setVariantSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [variantForm, setVariantForm] = useState<VariantFormState>(emptyVariantForm);
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [variantEditForm, setVariantEditForm] = useState<VariantEditFormState>(emptyVariantEditForm);
  const [variantError, setVariantError] = useState<string | null>(null);
  const [deleteVariantId, setDeleteVariantId] = useState<string | null>(null);
  const [matrixOpen, setMatrixOpen] = useState(false);

  const _parents = topLevelVariants(product.variants).filter(
    (v) => v.isParent || v.variantType === 'parent',
  );
  void _parents;
  const topLevel = topLevelVariants(product.variants);

  const filteredGroups = useMemo(() => {
    const q = variantSearch.trim().toLowerCase();
    if (!q) return topLevel;
    return topLevel.filter((v) => {
      if (v.name.toLowerCase().includes(q)) return true;
      return childVariants(product.variants, v.id).some((c) => {
        const imei = String(c.attributes?.imei ?? c.name).toLowerCase();
        return imei.includes(q);
      });
    });
  }, [topLevel, product.variants, variantSearch]);

  const inventorySummary = useMemo(() => {
    const withStock = topLevel.filter((v) => availableCount(v, product.variants) > 0).length;
    const utilization = topLevel.length > 0 ? Math.round((withStock / topLevel.length) * 100) : 0;
    return {
      units: product.totalStock,
      inStock: product.totalStock,
      groups: topLevel.length,
      utilization,
    };
  }, [product.totalStock, product.variants, topLevel]);

  const addVariant = useMutation({
    mutationFn: () => {
      const attrs: Record<string, string> = {};
      if (variantForm.condition.trim()) attrs.condition = variantForm.condition.trim();

      return productsApi.addVariant(product.id, {
        name: variantForm.name.trim(),
        sku: variantForm.sku.trim() || null,
        sellingPrice: variantForm.sellingPrice ? Number(variantForm.sellingPrice) : null,
        quantity: variantForm.trackInventoryItems ? 0 : Number(variantForm.quantity) || 0,
        trackInventoryItems: variantForm.trackInventoryItems,
        variantType: 'standard',
        isParent: false,
        attributes: Object.keys(attrs).length ? attrs : null,
      });
    },
    onSuccess: (updated) => {
      onUpdated(updated);
      setVariantForm(emptyVariantForm());
      setShowAddForm(false);
      setVariantError(null);
    },
    onError: (err: Error) => setVariantError(err.message),
  });

  const updateVariant = useMutation({
    mutationFn: (variantId: string) => {
      const existing = product.variants.find((v) => v.id === variantId);
      const attrs =
        existing?.attributes && typeof existing.attributes === 'object'
          ? { ...(existing.attributes as Record<string, string | number | boolean | null>) }
          : {};
      if (variantEditForm.condition.trim()) {
        attrs.condition = variantEditForm.condition.trim();
      } else {
        delete attrs.condition;
      }

      const payload: Partial<CrmProductVariant> = {
        name: variantEditForm.name.trim(),
        sellingPrice: variantEditForm.sellingPrice ? Number(variantEditForm.sellingPrice) : null,
        attributes: Object.keys(attrs).length > 0 ? attrs : null,
      };

      if (existing && !isTrackedVariant(existing)) {
        payload.quantity = Number(variantEditForm.quantity) || 0;
      }

      if (existing && existing.variantType !== 'imei_child') {
        Object.assign(payload, {
          installmentEnabled: variantEditForm.installmentEnabled,
          installmentMinDeposit: variantEditForm.installmentMinDeposit
            ? Number(variantEditForm.installmentMinDeposit)
            : null,
          installmentDurationDays: variantEditForm.installmentDurationDays
            ? Number(variantEditForm.installmentDurationDays)
            : null,
          installmentScheduleType: variantEditForm.installmentScheduleType || null,
          installmentPolicy: variantEditForm.installmentPolicy.trim() || null,
          installmentPenaltyPolicy: variantEditForm.installmentPenaltyPolicy.trim() || null,
          installmentExpiryDays: variantEditForm.installmentExpiryDays
            ? Number(variantEditForm.installmentExpiryDays)
            : null,
          installmentRequiresApproval: variantEditForm.installmentRequiresApproval,
          allowInstallmentWhenOutOfStock: variantEditForm.allowInstallmentWhenOutOfStock,
          stockingReminderEnabled: variantEditForm.stockingReminderEnabled,
          installmentNotes: variantEditForm.installmentNotes.trim() || null,
        });
      }

      return productsApi.updateVariant(product.id, variantId, payload);
    },
    onSuccess: (updated) => {
      onUpdated(updated);
      setEditingVariantId(null);
      setVariantEditForm(emptyVariantEditForm());
      setVariantError(null);
    },
    onError: (err: Error) => setVariantError(err.message),
  });

  const removeVariant = useMutation({
    mutationFn: (variantId: string) => productsApi.removeVariant(product.id, variantId),
    onSuccess: (updated) => {
      onUpdated(updated);
      if (editingVariantId) setEditingVariantId(null);
      setDeleteVariantId(null);
      setVariantError(null);
    },
    onError: (err: Error) => {
      setVariantError(err.message);
      setDeleteVariantId(null);
    },
  });

  const canAddVariant = !!variantForm.name.trim();

  const isTrackedVariant = (v: CrmProductVariant) =>
    !!(v.trackInventoryItems || v.isParent || v.variantType === 'parent');

  const startEditVariant = (v: CrmProductVariant) => {
    setEditingVariantId(v.id);
    setVariantEditForm({
      name: v.name,
      sellingPrice: v.sellingPrice != null ? String(v.sellingPrice) : '',
      quantity: String(v.quantity),
      condition: String(v.attributes?.condition ?? ''),
      ...installmentFromVariant(v),
    });
  };

  const renderStatusBadge = (qty: number) => (
    <span
      className={`variant-unit-status ${qty > 0 ? 'variant-unit-status--available' : 'variant-unit-status--out'}`}
    >
      <span className="variant-unit-status__dot" aria-hidden />
      {qty > 0 ? t('products.variants.statusAvailable') : t('products.variants.statusOut')}
    </span>
  );

  const renderVariantEditForm = (v: CrmProductVariant, isChild: boolean) => (
    <div className="product-editor__variant-edit">
      <div className="product-editor__row">
        {!isChild && v.variantType !== 'imei_child' && (
          <div className="product-editor__field product-editor__field--full">
            <label>{t('common.name')}</label>
            <input
              value={variantEditForm.name}
              onChange={(e) => setVariantEditForm({ ...variantEditForm, name: e.target.value })}
            />
          </div>
        )}
        {(isChild || v.variantType === 'imei_child') && (
          <div className="product-editor__field product-editor__field--full">
            <label>IMEI</label>
            <input value={variantEditForm.name} disabled />
          </div>
        )}
        <div className="product-editor__field">
          <label>{t('products.fields.price')}</label>
          <input
            type="number"
            min={0}
            value={variantEditForm.sellingPrice}
            onChange={(e) =>
              setVariantEditForm({ ...variantEditForm, sellingPrice: e.target.value })
            }
          />
        </div>
        <div className="product-editor__field">
          <label>{t('products.variants.quantity')}</label>
          <input
            type="number"
            min={0}
            value={variantEditForm.quantity}
            disabled={isTrackedVariant(v)}
            onChange={(e) => setVariantEditForm({ ...variantEditForm, quantity: e.target.value })}
          />
          {isTrackedVariant(v) ? (
            <small className="product-editor__hint">
              {t('products.variants.qtyFromInventory', {
                defaultValue: 'Stock is calculated from inventory items.',
              })}
            </small>
          ) : null}
        </div>
        {(isChild || v.variantType === 'imei_child') && (
          <div className="product-editor__field product-editor__field--full">
            <label>{t('products.variants.condition')}</label>
            <input
              value={variantEditForm.condition}
              onChange={(e) =>
                setVariantEditForm({ ...variantEditForm, condition: e.target.value })
              }
              placeholder={t('products.editor.conditionPlaceholder')}
            />
          </div>
        )}
      </div>
      {!isChild && v.variantType !== 'imei_child' && (
        <section className="product-editor__section product-editor__variant-installment">
          <h4 className="product-editor__section-title">{t('products.variants.installmentSection')}</h4>
          <p className="product-editor__hint">{t('products.variants.installmentOverrideHint')}</p>
          <label className="product-editor__toggle">
            <input
              type="checkbox"
              checked={variantEditForm.installmentEnabled}
              onChange={(e) =>
                setVariantEditForm({ ...variantEditForm, installmentEnabled: e.target.checked })
              }
              disabled={!canWrite}
            />
            <span>
              <strong>{t('products.installment.enabled')}</strong>
              <small>{t('products.installment.enabledHint')}</small>
            </span>
          </label>
          <div className="product-editor__row">
            <div className="product-editor__field">
              <label>{t('products.installment.minDeposit')}</label>
              <input
                type="number"
                min={0}
                value={variantEditForm.installmentMinDeposit}
                onChange={(e) =>
                  setVariantEditForm({ ...variantEditForm, installmentMinDeposit: e.target.value })
                }
                disabled={!canWrite}
                placeholder={
                  product.installmentMinDeposit != null
                    ? String(product.installmentMinDeposit)
                    : undefined
                }
              />
            </div>
            <div className="product-editor__field">
              <label>{t('products.installment.durationDays')}</label>
              <input
                type="number"
                min={0}
                value={variantEditForm.installmentDurationDays}
                onChange={(e) =>
                  setVariantEditForm({
                    ...variantEditForm,
                    installmentDurationDays: e.target.value,
                  })
                }
                disabled={!canWrite}
                placeholder={
                  product.installmentDurationDays != null
                    ? String(product.installmentDurationDays)
                    : undefined
                }
              />
            </div>
          </div>
          <div className="product-editor__row">
            <div className="product-editor__field">
              <label>{t('products.installment.scheduleType')}</label>
              <select
                value={variantEditForm.installmentScheduleType}
                onChange={(e) =>
                  setVariantEditForm({
                    ...variantEditForm,
                    installmentScheduleType: e.target.value,
                  })
                }
                disabled={!canWrite}
              >
                <option value="weekly">{t('products.installment.scheduleWeekly')}</option>
                <option value="monthly">{t('products.installment.scheduleMonthly')}</option>
                <option value="custom">{t('products.installment.scheduleCustom')}</option>
              </select>
            </div>
            <div className="product-editor__field">
              <label>{t('products.installment.expiryDays')}</label>
              <input
                type="number"
                min={0}
                value={variantEditForm.installmentExpiryDays}
                onChange={(e) =>
                  setVariantEditForm({
                    ...variantEditForm,
                    installmentExpiryDays: e.target.value,
                  })
                }
                disabled={!canWrite}
              />
            </div>
          </div>
          <div className="product-editor__field product-editor__field--full">
            <label>{t('products.installment.policy')}</label>
            <textarea
              rows={2}
              value={variantEditForm.installmentPolicy}
              onChange={(e) =>
                setVariantEditForm({ ...variantEditForm, installmentPolicy: e.target.value })
              }
              disabled={!canWrite}
              placeholder={product.installmentPolicy ?? undefined}
            />
          </div>
          <label className="product-editor__toggle">
            <input
              type="checkbox"
              checked={variantEditForm.installmentRequiresApproval}
              onChange={(e) =>
                setVariantEditForm({
                  ...variantEditForm,
                  installmentRequiresApproval: e.target.checked,
                })
              }
              disabled={!canWrite}
            />
            <span>{t('products.installment.requiresApproval')}</span>
          </label>
          <label className="product-editor__toggle">
            <input
              type="checkbox"
              checked={variantEditForm.allowInstallmentWhenOutOfStock}
              onChange={(e) =>
                setVariantEditForm({
                  ...variantEditForm,
                  allowInstallmentWhenOutOfStock: e.target.checked,
                })
              }
              disabled={!canWrite}
            />
            <span>{t('products.installment.allowOutOfStock')}</span>
          </label>
          <label className="product-editor__toggle">
            <input
              type="checkbox"
              checked={variantEditForm.stockingReminderEnabled}
              onChange={(e) =>
                setVariantEditForm({
                  ...variantEditForm,
                  stockingReminderEnabled: e.target.checked,
                })
              }
              disabled={!canWrite}
            />
            <span>{t('products.installment.stockingReminder')}</span>
          </label>
        </section>
      )}
      <div className="product-editor__variant-edit-actions">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setEditingVariantId(null)}
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={updateVariant.isPending || !variantEditForm.name.trim()}
          onClick={() => updateVariant.mutate(v.id)}
        >
          {updateVariant.isPending ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
          {t('products.variants.saveVariant')}
        </button>
      </div>
    </div>
  );

  const addVariantForm = (
    <div className="product-editor__add-variant-card">
      <label className="product-editor__toggle">
        <input
          type="checkbox"
          checked={variantForm.trackInventoryItems}
          onChange={(e) =>
            setVariantForm({
              ...variantForm,
              trackInventoryItems: e.target.checked,
              quantity: e.target.checked ? '0' : variantForm.quantity,
            })
          }
        />
        <span>
          <strong>{t('products.variants.trackImei', { defaultValue: 'Track individual items by IMEI/Serial' })}</strong>
          <small>{t('products.variants.trackImeiHint', { defaultValue: 'Stock is calculated from inventory items' })}</small>
        </span>
      </label>
      <div className="product-editor__row">
        <div className="product-editor__field">
          <label>{t('common.name')}</label>
          <input
            value={variantForm.name}
            onChange={(e) => setVariantForm({ ...variantForm, name: e.target.value })}
            placeholder={t('products.editor.variantNamePlaceholder')}
          />
        </div>
        <div className="product-editor__field">
          <label>{t('products.fields.sku')}</label>
          <input
            value={variantForm.sku}
            onChange={(e) => setVariantForm({ ...variantForm, sku: e.target.value })}
          />
        </div>
        <div className="product-editor__field">
          <label>{t('products.fields.price')}</label>
          <input
            type="number"
            min={0}
            value={variantForm.sellingPrice}
            onChange={(e) =>
              setVariantForm({ ...variantForm, sellingPrice: e.target.value })
            }
          />
        </div>
        {!variantForm.trackInventoryItems ? (
          <div className="product-editor__field">
            <label>{t('products.variants.quantity')}</label>
            <input
              type="number"
              min={0}
              value={variantForm.quantity}
              onChange={(e) => setVariantForm({ ...variantForm, quantity: e.target.value })}
            />
          </div>
        ) : null}
      </div>
      <div className="product-editor__variant-edit-actions">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => {
            setShowAddForm(false);
            setVariantForm(emptyVariantForm());
          }}
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={addVariant.isPending || !canAddVariant}
          onClick={() => addVariant.mutate()}
        >
          {addVariant.isPending ? (
            <Loader2 className="animate-spin" size={14} />
          ) : (
            <Plus size={14} />
          )}
          {t('products.variants.addBtn')}
        </button>
      </div>
    </div>
  );

  return (
    <div className="variants-layout" data-testid="product-variants-panel">
      {variantError && <p className="product-editor__variant-error">{variantError}</p>}
      <p className="product-editor-helper">
        {t('products.variants.sellableHelper', {
          defaultValue:
            'Variants are options customers choose. IMEI/Serial items are individual physical devices — manage them in the Inventory / IMEI tab.',
        })}
      </p>
      <div className="variants-layout__main">
        <div className="variants-toolbar">
          <div className="variants-toolbar__filters">
            <div className="variants-search">
              <Search size={16} aria-hidden />
              <input
                type="search"
                value={variantSearch}
                onChange={(e) => setVariantSearch(e.target.value)}
                placeholder={t('products.variants.searchUnits')}
              />
            </div>
          </div>
          {canWrite && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                data-testid="product-generate-matrix-btn"
                onClick={() => setMatrixOpen(true)}
              >
                <Grid3X3 size={16} aria-hidden />
                {t('products.variants.generateMatrix', { defaultValue: 'Generate matrix' })}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setShowAddForm((open) => !open)}
              >
                <Plus size={16} aria-hidden />
                {t('products.variants.add')}
              </button>
            </div>
          )}
        </div>

        {showAddForm && canWrite && addVariantForm}

        {filteredGroups.length === 0 ? (
          <p className="product-editor__variants-empty">{t('products.editor.noVariants')}</p>
        ) : (
          <div className="variant-groups">
            {filteredGroups.map((v) => {
              const rows = [v];
              const avail = v.quantity ?? 0;
              const total = v.quantity ?? 0;
              return (
                <article key={v.id} className="variant-group-card">
                  <header className="variant-group-card__head">
                    <div>
                      <div className="variant-group-card__title-row">
                        <h3 className="variant-group-card__title">{v.name}</h3>
                        <span className="product-editor__variant-badge product-editor__variant-badge--standard">
                          {isTrackedVariant(v)
                            ? t('products.variants.imeiTracked', { defaultValue: 'IMEI tracked' })
                            : t('products.variants.types.standard')}
                        </span>
                        {v.installmentEnabled && (
                          <span className="product-editor__variant-badge product-editor__variant-badge--installment">
                            {t('products.tabs.installment')}
                          </span>
                        )}
                        {v.stockingReminderEnabled && (
                          <span className="product-editor__variant-badge product-editor__variant-badge--stocking">
                            {t('products.variants.stockingBadge')}
                          </span>
                        )}
                      </div>
                      <p className="variant-group-card__stats">
                        {t('products.variants.groupStats', {
                          total,
                          available: avail,
                        })}
                      </p>
                    </div>
                    {canWrite && editingVariantId !== v.id && (
                      <div className="variant-group-card__actions">
                        {isTrackedVariant(v) && onOpenInventory && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm variant-group-card__add-device"
                            onClick={onOpenInventory}
                          >
                            <Smartphone size={14} aria-hidden />
                            {t('products.variants.viewInventory', { defaultValue: 'Inventory items' })}
                          </button>
                        )}
                        <div className="product-editor__variant-actions">
                          <button
                            type="button"
                            className="product-editor__variant-action-btn"
                            aria-label={t('common.edit')}
                            onClick={() => startEditVariant(v)}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            className="product-editor__variant-action-btn product-editor__variant-action-btn--danger"
                            aria-label={t('common.delete')}
                            disabled={removeVariant.isPending}
                            onClick={() => setDeleteVariantId(v.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    )}
                  </header>

                  {editingVariantId === v.id && renderVariantEditForm(v, false)}

                  <div className="variant-units-table-wrap">
                    <table className="variant-units-table">
                      <thead>
                        <tr>
                          <th>{t('products.variants.colUnit')}</th>
                          <th>{t('products.variants.colStatus')}</th>
                          <th className="variant-units-table__num">{t('products.variants.quantity')}</th>
                          <th className="variant-units-table__num">{t('products.fields.price')}</th>
                          {canWrite && <th className="variant-units-table__actions" aria-hidden />}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => {
                          const isChild = row.parentVariantId === v.id;
                          const label =
                            (row.attributes?.imei as string) || row.name;
                          const price =
                            row.sellingPrice != null
                              ? `${product.currency ?? ''} ${row.sellingPrice.toLocaleString()}`.trim()
                              : '—';
                          return (
                            <tr key={row.id}>
                              {editingVariantId === row.id ? (
                                <td colSpan={canWrite ? 5 : 4}>{renderVariantEditForm(row, isChild)}</td>
                              ) : (
                                <>
                                  <td>
                                    <span className="variant-units-table__unit">
                                      {isChild && <Smartphone size={14} aria-hidden />}
                                      {label}
                                    </span>
                                  </td>
                                  <td>{renderStatusBadge(row.quantity)}</td>
                                  <td className="variant-units-table__num">×{row.quantity}</td>
                                  <td className="variant-units-table__num variant-units-table__price">
                                    {price}
                                  </td>
                                  {canWrite && (
                                    <td className="variant-units-table__actions">
                                      <div className="product-editor__variant-actions">
                                        <button
                                          type="button"
                                          className="product-editor__variant-action-btn"
                                          aria-label={t('common.edit')}
                                          onClick={() => startEditVariant(row)}
                                        >
                                          <Pencil size={14} />
                                        </button>
                                        <button
                                          type="button"
                                          className="product-editor__variant-action-btn product-editor__variant-action-btn--danger"
                                          aria-label={t('common.delete')}
                                          disabled={removeVariant.isPending}
                                          onClick={() => setDeleteVariantId(row.id)}
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    </td>
                                  )}
                                </>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <aside className="variants-layout__aside">
        <div className="variants-aside-card">
          <h4>{t('products.variants.inventoryHealth')}</h4>
          <div className="variants-aside-stat">
            <div>
              <span className="variants-aside-stat__label">{t('products.variants.totalUnits')}</span>
              <span className="variants-aside-stat__value">{inventorySummary.units}</span>
            </div>
            <div className="variants-aside-stat__right">
              <span className="variants-aside-stat__label">{t('products.variants.inStock')}</span>
              <span className="variants-aside-stat__value variants-aside-stat__value--ok">
                {inventorySummary.inStock}
              </span>
            </div>
          </div>
          <div className="variants-aside-stat">
            <div>
              <span className="variants-aside-stat__label">{t('products.variants.variantGroups')}</span>
              <span className="variants-aside-stat__value">{inventorySummary.groups}</span>
            </div>
          </div>
          <div className="variants-utilization">
            <div
              className="variants-utilization__bar"
              style={{ width: `${inventorySummary.utilization}%` }}
            />
          </div>
          <p className="variants-utilization__label">
            {t('products.variants.utilization', { percent: inventorySummary.utilization })}
          </p>
        </div>
        <div className="variants-aside-card variants-aside-card--muted">
          <h4>{t('products.variants.quickTips')}</h4>
          <p>{t('products.variants.manageHint')}</p>
        </div>
      </aside>

      {deleteVariantId && (
        <ModalOverlay onClose={() => setDeleteVariantId(null)} className="products-delete-overlay">
          <div
            className="products-delete-dialog"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
          >
            <h3>{t('common.delete')}</h3>
            <p>{t('products.variants.deleteConfirm')}</p>
            <div className="products-delete-dialog__actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeleteVariantId(null)}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={removeVariant.isPending}
                onClick={() => removeVariant.mutate(deleteVariantId)}
              >
                {removeVariant.isPending ? <Loader2 className="animate-spin" size={14} /> : null}
                {t('common.delete')}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      <ProductVariantMatrixModal
        productId={product.id}
        productSku={product.sku}
        isOpen={matrixOpen}
        onClose={() => setMatrixOpen(false)}
        onGenerated={() => {
          void productsApi.get(product.id).then(onUpdated);
        }}
      />
    </div>
  );
}
