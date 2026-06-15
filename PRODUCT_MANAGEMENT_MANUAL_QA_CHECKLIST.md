# Product Management Manual QA Checklist

Use a staging or local environment with admin access, migrations applied, and at least one WhatsApp session connected for send tests.

**Preflight**

- [ ] `npm run migration:run` completed without errors
- [ ] `npm run verify:inventory-cutover` reports **PASS**
- [ ] Dashboard loads `/products` with summary cards and management table

---

## 1. Add product without variants

1. Open **Products** → **Add product**.
2. Fill name, category, price, currency; leave variants empty.
3. Save on **General info**.

**Expected:** Product appears in table; stock shows 0; editor opens on Overview.

---

## 2. Add product with variants

1. Create or open a product → **Variants & stock** tab.
2. Add a standard variant (e.g. `128GB Black`) with SKU, price, quantity.

**Expected:** Variant row saved; table shows variant count ≥ 1; stock reflects variant quantity.

---

## 3. Turn on IMEI tracking for a variant

1. On **Variants & stock**, enable **Track individual items by IMEI/Serial** on a variant.
2. Save the variant.

**Expected:** Stock label indicates IMEI tracked; **Inventory / IMEI** tab becomes usable for that variant.

---

## 4. Add IMEI items manually

1. Open product → **Inventory / IMEI**.
2. Select the tracked variant; add IMEI `352901234567890` (and optional serial).

**Expected:** Item listed as **available**; variant stock increments from inventory count.

---

## 5. Bulk paste IMEI list

1. On **Inventory / IMEI**, use **Bulk paste** or **Import list**.
2. Paste 3+ IMEIs (one per line); submit.

**Expected:** All valid rows created; duplicates rejected with clear error.

---

## 6. Import CSV with products + variants

1. **Products** → **Import** → type **Products + variants**.
2. Upload `PRODUCT_IMPORT_TEMPLATE.csv` (or sample with 2 products, 2 variants each).
3. **Preview & validate** → **Import**.

**Expected:** Preview shows valid rows; result shows created/updated counts; products appear in table.

---

## 7. Import IMEI list

1. **Import** → type **IMEI / serial only**.
2. Upload CSV mapping variant SKU + IMEI columns.

**Expected:** Inventory items linked to correct variant; stock recalculated.

---

## 8. Search product by IMEI

1. On **Products** page, use search or inventory filter (if available).
2. Search for a known IMEI from step 4.

**Expected:** Parent product found; IMEI visible in expanded row or inventory panel.

---

## 9. Reserve IMEI item

1. Open product → **Inventory / IMEI** → **Reserve** on an available item.

**Expected:** Status → **reserved**; available count decreases.

---

## 10. Confirm reserved item is not available

1. Open inbox product picker (or send flow) with **List available IMEI/serial devices** on.
2. Select the product/variant with reserved IMEI.

**Expected:** Reserved IMEI not offered for send; only available units listed.

---

## 11. Mark item sold

1. Mark reserved or available item as **sold** (or via API if UI action is staff-only).

**Expected:** Status → **sold**; no longer available for send or reservation.

---

## 12. Check history tab

1. Open product editor → **History** tab.
2. Perform a save on Overview or add an IMEI; refresh history.

**Expected:** Audit events for create/update/inventory changes with timestamps.

---

## 13. Try duplicate SKU

1. Create variant or product with SKU `TEST-DUP-001`.
2. Attempt second product/variant with same SKU.

**Expected:** Save blocked or error toast; health badge may show duplicate SKU warning.

---

## 14. Try duplicate IMEI

1. Add IMEI `352909999999999` to variant A.
2. Attempt same IMEI on variant B (same branch).

**Expected:** Rejected with duplicate IMEI message; cutover verify script shows 0 duplicate groups.

---

## 15. Check branch stock isolation

1. If multi-branch: add inventory item on branch A only.
2. Switch effective branch or filter to branch B.

**Expected:** Branch B does not see branch A stock; duplicate IMEI allowed across branches if configured.

---

## 16. Check WhatsApp preview for selected variant

1. Product editor → **WhatsApp** tab.
2. Select a variant; tap preview.

**Expected:** Message includes variant name, price, and optional image; matches inbox send format.

---

## 17. Check product health warnings

1. Create product missing image, zero stock, or duplicate SKU (staging only).
2. View **Health** column on products table and product detail health.

**Expected:** Badges/warnings match `ProductHealthService` rules; AI health summary tool returns consistent counts.

---

## Import rollback (bonus)

1. **Import history** → open a completed batch → **Rollback**.

**Expected:** Created rows removed; updated rows restored from `previousValues`; sold/reserved items skipped with warning.

---

## Sign-off

| Area | Tester | Date | Pass |
|------|--------|------|------|
| Catalog CRUD | | | |
| IMEI / inventory | | | |
| Import / rollback | | | |
| WhatsApp send | | | |
| Health / conflicts | | | |

**Automated coverage:** see `PRODUCT_MANAGEMENT_UI_VARIANTS_IMEI_IMPORT_POLISH_REPORT.md` → Verification run.
