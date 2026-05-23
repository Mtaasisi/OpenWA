import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { Plus, Loader2, Trash2, Pencil, Smartphone, Check, Search } from 'lucide-react';
import {
  productsApi,
  type CrmProduct,
  type CrmProductVariant,
  type ProductVariantType,
} from '../services/api';

function topLevelVariants(variants: CrmProductVariant[]): CrmProductVariant[] {
  return variants.filter((v) => !v.parentVariantId && v.variantType !== 'imei_child');
}

function childVariants(variants: CrmProductVariant[], parentId: string): CrmProductVariant[] {
  return variants.filter((v) => v.parentVariantId === parentId);
}

function variantTypeLabel(t: (k: string) => string, type: ProductVariantType): string {
  if (type === 'parent') return t('products.variants.types.parent');
  if (type === 'imei_child') return t('products.variants.types.imei');
  return t('products.variants.types.standard');
}

function unitRows(v: CrmProductVariant, all: CrmProductVariant[]): CrmProductVariant[] {
  const children = childVariants(all, v.id);
  return children.length > 0 ? children : [v];
}

function availableCount(v: CrmProductVariant, all: CrmProductVariant[]): number {
  const rows = unitRows(v, all);
  return rows.filter((r) => r.quantity > 0).length;
}

function totalUnits(v: CrmProductVariant, all: CrmProductVariant[]): number {
  const rows = unitRows(v, all);
  return rows.reduce((sum, r) => sum + r.quantity, 0);
}

type VariantFormState = {
  name: string;
  sku: string;
  sellingPrice: string;
  quantity: string;
  variantType: ProductVariantType;
  parentVariantId: string;
  imei: string;
  condition: string;
};

type InlineImeiFormState = {
  parentVariantId: string;
  imei: string;
  condition: string;
  sellingPrice: string;
};

const emptyInlineImeiForm = (parentVariantId: string, sellingPrice = ''): InlineImeiFormState => ({
  parentVariantId,
  imei: '',
  condition: '',
  sellingPrice,
});

function isParentGroup(v: CrmProductVariant): boolean {
  return v.isParent || v.variantType === 'parent';
}

type VariantEditFormState = {
  name: string;
  sellingPrice: string;
  quantity: string;
  condition: string;
};

const emptyVariantForm = (): VariantFormState => ({
  name: '',
  sku: '',
  sellingPrice: '',
  quantity: '1',
  variantType: 'standard',
  parentVariantId: '',
  imei: '',
  condition: '',
});

const emptyVariantEditForm = (): VariantEditFormState => ({
  name: '',
  sellingPrice: '',
  quantity: '0',
  condition: '',
});

interface Props {
  product: CrmProduct;
  canWrite: boolean;
  onUpdated: (product: CrmProduct) => void;
}

export function ProductVariantsPanel({ product, canWrite, onUpdated }: Props) {
  const { t } = useTranslation();
  const [variantSearch, setVariantSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [variantForm, setVariantForm] = useState<VariantFormState>(emptyVariantForm);
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [variantEditForm, setVariantEditForm] = useState<VariantEditFormState>(emptyVariantEditForm);
  const [variantError, setVariantError] = useState<string | null>(null);
  const [deleteVariantId, setDeleteVariantId] = useState<string | null>(null);
  const [inlineImeiForm, setInlineImeiForm] = useState<InlineImeiFormState | null>(null);

  const parents = topLevelVariants(product.variants).filter(
    (v) => v.isParent || v.variantType === 'parent',
  );
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
      if (variantForm.imei.trim()) attrs.imei = variantForm.imei.trim();
      if (variantForm.condition.trim()) attrs.condition = variantForm.condition.trim();
      const name =
        variantForm.variantType === 'imei_child' && variantForm.imei.trim()
          ? variantForm.imei.trim()
          : variantForm.name.trim();

      return productsApi.addVariant(product.id, {
        name,
        sku: variantForm.sku.trim() || null,
        sellingPrice: variantForm.sellingPrice ? Number(variantForm.sellingPrice) : null,
        quantity: Number(variantForm.quantity) || 0,
        variantType: variantForm.variantType,
        isParent: variantForm.variantType === 'parent',
        parentVariantId: variantForm.parentVariantId || null,
        attributes: Object.keys(attrs).length > 0 ? attrs : null,
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

      return productsApi.updateVariant(product.id, variantId, {
        name: variantEditForm.name.trim(),
        sellingPrice: variantEditForm.sellingPrice ? Number(variantEditForm.sellingPrice) : null,
        quantity: Number(variantEditForm.quantity) || 0,
        attributes: Object.keys(attrs).length > 0 ? attrs : null,
      });
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

  const addInlineImei = useMutation({
    mutationFn: (form: InlineImeiFormState) => {
      const imei = form.imei.trim();
      const attrs: Record<string, string> = { imei };
      if (form.condition.trim()) attrs.condition = form.condition.trim();
      return productsApi.addVariant(product.id, {
        name: imei,
        sellingPrice: form.sellingPrice ? Number(form.sellingPrice) : null,
        quantity: 1,
        variantType: 'imei_child',
        isParent: false,
        parentVariantId: form.parentVariantId,
        attributes: attrs,
      });
    },
    onSuccess: (updated, form) => {
      onUpdated(updated);
      setVariantError(null);
      setInlineImeiForm(emptyInlineImeiForm(form.parentVariantId, form.sellingPrice));
    },
    onError: (err: Error) => setVariantError(err.message),
  });

  const startAddImeiToParent = (parent: CrmProductVariant) => {
    setShowAddForm(false);
    setVariantForm(emptyVariantForm());
    const defaultPrice = parent.sellingPrice != null ? String(parent.sellingPrice) : '';
    setInlineImeiForm(emptyInlineImeiForm(parent.id, defaultPrice));
    setVariantError(null);
  };

  const canAddVariant =
    variantForm.variantType === 'imei_child'
      ? !!variantForm.imei.trim() && !!variantForm.parentVariantId
      : !!variantForm.name.trim();

  const startEditVariant = (v: CrmProductVariant) => {
    setInlineImeiForm(null);
    setEditingVariantId(v.id);
    setVariantEditForm({
      name: v.name,
      sellingPrice: v.sellingPrice != null ? String(v.sellingPrice) : '',
      quantity: String(v.quantity),
      condition: String(v.attributes?.condition ?? ''),
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
            onChange={(e) => setVariantEditForm({ ...variantEditForm, quantity: e.target.value })}
          />
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
      <div
        className="product-editor__variant-types"
        role="group"
        aria-label={t('products.variants.type')}
      >
        {(['standard', 'parent', 'imei_child'] as const).map((type) => (
          <button
            key={type}
            type="button"
            className={`product-editor__variant-type-btn ${variantForm.variantType === type ? 'active' : ''}`}
            onClick={() =>
              setVariantForm({
                ...variantForm,
                variantType: type,
                quantity: type === 'imei_child' ? '1' : variantForm.quantity,
              })
            }
          >
            {variantTypeLabel(t, type)}
          </button>
        ))}
      </div>
      <div className="product-editor__row">
        {variantForm.variantType !== 'imei_child' && (
          <div className="product-editor__field">
            <label>{t('common.name')}</label>
            <input
              value={variantForm.name}
              onChange={(e) => setVariantForm({ ...variantForm, name: e.target.value })}
              placeholder={
                variantForm.variantType === 'parent'
                  ? t('products.editor.parentNamePlaceholder')
                  : t('products.editor.variantNamePlaceholder')
              }
            />
          </div>
        )}
        {variantForm.variantType === 'imei_child' && (
          <>
            <div className="product-editor__field">
              <label>{t('products.variants.parent')}</label>
              <select
                value={variantForm.parentVariantId}
                onChange={(e) =>
                  setVariantForm({ ...variantForm, parentVariantId: e.target.value })
                }
              >
                <option value="">{t('products.variants.selectParent')}</option>
                {parents.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="product-editor__field">
              <label>IMEI</label>
              <input
                value={variantForm.imei}
                onChange={(e) => setVariantForm({ ...variantForm, imei: e.target.value })}
                placeholder="356789012345678"
              />
            </div>
            <div className="product-editor__field">
              <label>{t('products.variants.condition')}</label>
              <input
                value={variantForm.condition}
                onChange={(e) =>
                  setVariantForm({ ...variantForm, condition: e.target.value })
                }
                placeholder={t('products.editor.conditionPlaceholder')}
              />
            </div>
          </>
        )}
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
        {variantForm.variantType !== 'imei_child' && (
          <div className="product-editor__field">
            <label>{t('products.variants.quantity')}</label>
            <input
              type="number"
              min={0}
              value={variantForm.quantity}
              onChange={(e) => setVariantForm({ ...variantForm, quantity: e.target.value })}
            />
          </div>
        )}
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

  const renderInlineImeiForm = (parentId: string) => {
    if (!inlineImeiForm || inlineImeiForm.parentVariantId !== parentId) return null;
    const form = inlineImeiForm;
    return (
      <div className="variant-group-card__add-imei">
        <p className="variant-group-card__add-imei-label">{t('products.variants.addDeviceHint')}</p>
        <div className="product-editor__row">
          <div className="product-editor__field">
            <label>IMEI</label>
            <input
              value={form.imei}
              onChange={(e) => setInlineImeiForm({ ...form, imei: e.target.value })}
              placeholder="356789012345678"
              autoFocus
            />
          </div>
          <div className="product-editor__field">
            <label>{t('products.variants.condition')}</label>
            <input
              value={form.condition}
              onChange={(e) => setInlineImeiForm({ ...form, condition: e.target.value })}
              placeholder={t('products.editor.conditionPlaceholder')}
            />
          </div>
          <div className="product-editor__field">
            <label>{t('products.fields.price')}</label>
            <input
              type="number"
              min={0}
              value={form.sellingPrice}
              onChange={(e) => setInlineImeiForm({ ...form, sellingPrice: e.target.value })}
            />
          </div>
        </div>
        <div className="product-editor__variant-edit-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setInlineImeiForm(null)}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={addInlineImei.isPending || !form.imei.trim()}
            onClick={() => addInlineImei.mutate(form)}
          >
            {addInlineImei.isPending ? (
              <Loader2 className="animate-spin" size={14} />
            ) : (
              <Plus size={14} />
            )}
            {t('products.variants.addDeviceBtn')}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="variants-layout">
      {variantError && <p className="product-editor__variant-error">{variantError}</p>}
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
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                setInlineImeiForm(null);
                setShowAddForm((open) => !open);
              }}
            >
              <Plus size={16} aria-hidden />
              {t('products.variants.add')}
            </button>
          )}
        </div>

        {showAddForm && canWrite && addVariantForm}

        {filteredGroups.length === 0 ? (
          <p className="product-editor__variants-empty">{t('products.editor.noVariants')}</p>
        ) : (
          <div className="variant-groups">
            {filteredGroups.map((v) => {
              const rows = unitRows(v, product.variants);
              const avail = availableCount(v, product.variants);
              const total = totalUnits(v, product.variants);
              return (
                <article key={v.id} className="variant-group-card">
                  <header className="variant-group-card__head">
                    <div>
                      <div className="variant-group-card__title-row">
                        <h3 className="variant-group-card__title">{v.name}</h3>
                        <span
                          className={`product-editor__variant-badge product-editor__variant-badge--${v.variantType}`}
                        >
                          {variantTypeLabel(t, v.variantType)}
                        </span>
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
                        {isParentGroup(v) && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm variant-group-card__add-device"
                            onClick={() => startAddImeiToParent(v)}
                          >
                            <Smartphone size={14} aria-hidden />
                            {t('products.variants.addDevice')}
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

                  {renderInlineImeiForm(v.id)}
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
        <div className="products-delete-overlay" onClick={() => setDeleteVariantId(null)}>
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
        </div>
      )}
    </div>
  );
}
