import type { Page } from '@playwright/test';
import { installDashboardMocks } from './dashboard-mocks';

const PRODUCT_LIST = [
  {
    id: 'prod-1',
    name: 'iPhone 13',
    sku: 'IPH13',
    category: 'Phones',
    brand: 'Apple',
    isActive: true,
    totalStock: 2,
    variantCount: 1,
    sellingPrice: 850000,
    currency: 'TZS',
    createdAt: '2026-06-01T10:00:00.000Z',
    updatedAt: '2026-06-12T10:00:00.000Z',
  },
];

const CATALOG_STATS = {
  total: 1,
  lowStock: 0,
  outOfStock: 0,
  inventoryValue: 1700000,
  scaleMax: 1700000,
  currencyHint: 'TZS',
};

const HEALTH_SUMMARY = {
  totalProducts: 1,
  activeProducts: 1,
  lowStock: 0,
  outOfStock: 0,
  missingImages: 0,
  importIssues: 0,
  duplicateSkus: 0,
  duplicateImeis: 0,
  installmentMisconfigured: 0,
};

const PRODUCT_VARIANT = {
  id: 'var-1',
  productId: 'prod-1',
  name: '128GB Black',
  sku: 'IPH13-128-BLK',
  barcode: null,
  costPrice: 750000,
  sellingPrice: 850000,
  quantity: 2,
  variantType: 'standard',
  isParent: false,
  trackInventoryItems: true,
  lowStockThreshold: 10,
  parentVariantId: null,
  attributes: { storage: '128GB', color: 'Black' },
  isActive: true,
  sortOrder: 0,
  createdAt: '2026-06-01T10:00:00.000Z',
  updatedAt: '2026-06-12T10:00:00.000Z',
};

export const PRODUCT_DETAIL = {
  id: 'prod-1',
  name: 'iPhone 13',
  description: 'Apple smartphone',
  sku: 'IPH13',
  category: 'Phones',
  brand: 'Apple',
  model: 'iPhone 13',
  barcode: null,
  tags: null,
  warrantyDefault: null,
  supplier: null,
  visibility: 'public',
  costPrice: 750000,
  imageUrl: null,
  imageUrls: null,
  currency: 'TZS',
  sellingPrice: 850000,
  isActive: true,
  sortOrder: 0,
  externalId: null,
  variants: [PRODUCT_VARIANT],
  totalStock: 2,
  variantCount: 1,
  inventorySummary: {
    available: 2,
    reserved: 0,
    sold: 0,
    imeiTrackedVariants: 1,
  },
  health: {
    productId: 'prod-1',
    score: 92,
    issues: [],
    warnings: [],
  },
  createdAt: '2026-06-01T10:00:00.000Z',
  updatedAt: '2026-06-12T10:00:00.000Z',
};

export const PRODUCT_AUDIT_HISTORY = [
  {
    id: 'audit-1',
    productId: 'prod-1',
    variantId: 'var-1',
    action: 'inventory_item_created',
    createdAt: '2026-06-10T10:00:00.000Z',
  },
  {
    id: 'audit-2',
    productId: 'prod-1',
    variantId: null,
    action: 'product_updated',
    createdAt: '2026-06-12T10:00:00.000Z',
  },
];

const INVENTORY_ITEMS_BASE = [
  {
    id: 'item-1',
    productId: 'prod-1',
    variantId: 'var-1',
    branchId: 'default',
    imei: '352901234567890',
    serialNumber: 'SN-001',
    status: 'available',
    costPrice: 750000,
    sellingPrice: 850000,
    createdAt: '2026-06-10T10:00:00.000Z',
    updatedAt: '2026-06-10T10:00:00.000Z',
  },
  {
    id: 'item-2',
    productId: 'prod-1',
    variantId: 'var-1',
    branchId: 'default',
    imei: '352901234567891',
    serialNumber: null,
    status: 'available',
    costPrice: 750000,
    sellingPrice: 850000,
    createdAt: '2026-06-11T10:00:00.000Z',
    updatedAt: '2026-06-11T10:00:00.000Z',
  },
  {
    id: 'item-3',
    productId: 'prod-1',
    variantId: 'var-1',
    branchId: 'default',
    imei: '352901234567892',
    serialNumber: null,
    status: 'reserved',
    costPrice: 750000,
    sellingPrice: 850000,
    createdAt: '2026-06-11T11:00:00.000Z',
    updatedAt: '2026-06-11T11:00:00.000Z',
  },
  {
    id: 'item-4',
    productId: 'prod-1',
    variantId: 'var-1',
    branchId: 'default',
    imei: '352901234567893',
    serialNumber: null,
    status: 'sold',
    costPrice: 750000,
    sellingPrice: 850000,
    createdAt: '2026-06-11T12:00:00.000Z',
    updatedAt: '2026-06-11T12:00:00.000Z',
  },
];

type InventoryItem = (typeof INVENTORY_ITEMS_BASE)[number];

let inventoryItems: InventoryItem[] = structuredClone(INVENTORY_ITEMS_BASE);

function resetInventoryItems(): void {
  inventoryItems = structuredClone(INVENTORY_ITEMS_BASE);
}

function filterInventoryItems(url: URL): InventoryItem[] {
  let items = inventoryItems;
  const status = url.searchParams.get('status');
  if (status) {
    items = items.filter((item) => item.status === status);
  }
  const variantId = url.searchParams.get('variantId');
  if (variantId) {
    items = items.filter((item) => item.variantId === variantId);
  }
  const q = url.searchParams.get('q')?.trim() ?? '';
  if (q) {
    items = items.filter(
      (item) =>
        item.imei?.includes(q) ||
        (item.serialNumber != null && item.serialNumber.includes(q)),
    );
  }
  return items;
}

/** Mocks for /products page: list, import wizard, catalog stats, health summary. */
export async function installProductsMocks(page: Page): Promise<void> {
  resetInventoryItems();
  await installDashboardMocks(page);

  await page.route('**/api/products/import/template', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        csv: 'product name,sku,price\nTest Phone,TP-1,100000',
      }),
    });
  });

  await page.route('**/api/products/import/preview', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        headers: ['product name', 'sku', 'price'],
        columnMapping: { name: 'product name', sku: 'sku', sellingPrice: 'price' },
        rows: [{ rowNumber: 2, status: 'valid', errors: [], warnings: [] }],
        summary: { total: 1, valid: 1, warning: 0, error: 0 },
      }),
    });
  });

  await page.route('**/api/products/import/execute', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        batchId: 'batch-mock-1',
        createdCount: 1,
        updatedCount: 0,
        skippedCount: 0,
      }),
    });
  });

  await page.route('**/api/products/import/history', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'batch-mock-1',
          fileName: 'catalog.csv',
          importType: 'products_variants',
          mode: 'create_update',
          status: 'completed',
          totalRows: 10,
          createdCount: 8,
          updatedCount: 2,
          skippedCount: 0,
          createdAt: '2026-06-12T10:00:00.000Z',
          completedAt: '2026-06-12T10:05:00.000Z',
        },
      ]),
    });
  });

  await page.route('**/api/products/import/*/rollback', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ rolledBack: 3, warnings: [] }),
    });
  });

  await page.route('**/api/products/catalog/stats**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(CATALOG_STATS),
    });
  });

  await page.route('**/api/products/health/summary**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(HEALTH_SUMMARY),
    });
  });

  await page.route('**/api/products**', async route => {
    const url = route.request().url();
    const pathname = new URL(url).pathname;

    if (pathname.includes('/import/') || pathname.includes('/catalog/stats') || pathname.includes('/health/summary') || pathname.includes('/sync/')) {
      await route.fallback();
      return;
    }

    if (route.request().method() === 'GET' && /^\/api\/products\/?$/.test(pathname)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(PRODUCT_LIST),
      });
      return;
    }

    await route.fallback();
  });

  await page.route(/\/api\/products\/prod-1\/inventory-items\/bulk-paste$/, async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ created: 3, skipped: 0, preview: [] }),
      });
      return;
    }
    await route.fallback();
  });

  await page.route(/\/api\/products\/prod-1\/inventory-items\/[^/]+$/, async (route) => {
    if (route.request().method() === 'PATCH') {
      const itemId = new URL(route.request().url()).pathname.split('/').pop() ?? '';
      const payload = route.request().postDataJSON() as { status?: InventoryItem['status'] };
      const item = inventoryItems.find((row) => row.id === itemId);
      if (item && payload.status) {
        item.status = payload.status;
        item.updatedAt = new Date().toISOString();
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(PRODUCT_DETAIL),
      });
      return;
    }
    await route.fallback();
  });

  await page.route(/\/api\/products\/prod-1\/inventory-items/, async (route) => {
    if (route.request().method() === 'GET') {
      const url = new URL(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(filterInventoryItems(url)),
      });
      return;
    }
    await route.fallback();
  });

  await page.route(/\/api\/products\/prod-1\/history$/, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(PRODUCT_AUDIT_HISTORY),
      });
      return;
    }
    await route.fallback();
  });

  await page.route(/\/api\/products\/prod-1\/variants\/generate$/, async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          created: ['IPH13-128GB-WHITE', 'IPH13-256GB-BLACK'],
          count: 2,
        }),
      });
      return;
    }
    await route.fallback();
  });

  await page.route(/\/api\/products\/prod-1\/preview-message/, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ text: 'iPhone 13 — 128GB Black — TZS 850,000' }),
      });
      return;
    }
    await route.fallback();
  });

  await page.route(/\/api\/products\/prod-1\/send$/, async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, messageId: 'msg-mock-1' }),
      });
      return;
    }
    await route.fallback();
  });

  await page.route('**/api/products/sync/inauzwa/status**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        configured: false,
        database: false,
        api: false,
        branchId: null,
        vendorId: null,
        currency: 'TZS',
        defaultApiUrl: null,
        defaultSupabaseUrl: null,
        hasDefaultSupabaseAnonKey: false,
        lastSyncAt: null,
        lastSyncError: null,
        hasSupabaseConfig: false,
        preferences: { refreshBeforeSend: false, autoSyncEnabled: false },
      }),
    });
  });

  await page.route(/\/api\/products\/prod-1$/, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(PRODUCT_DETAIL),
      });
      return;
    }
    await route.fallback();
  });
}
