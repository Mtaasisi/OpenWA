import { Injectable, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pool } from 'pg';
import { Product } from './entities/product.entity';
import { ProductVariant, VariantType } from './entities/product-variant.entity';
import { isNeonPoolerDatabaseUrl } from '../../common/utils/database-url.util';
import { InauzwaSyncPreferencesService } from './inauzwa-sync-preferences.service';
import { InventoryItemService } from './inventory-item.service';
import type { InauzwaSyncPreferencesDto } from './inauzwa-sync-preferences.service';
import type { TestInauzwaConnectionDto } from './dto/product.dto';
import { EventsGateway } from '../events/events.gateway';

export interface InauzwaSyncOptions {
  branchId?: string;
  vendorId?: string;
  mode?: 'merge' | 'replace';
  activeOnly?: boolean;
}

export interface InauzwaSyncResult {
  productsCreated: number;
  productsUpdated: number;
  variantsCreated: number;
  variantsUpdated: number;
  productsDeactivated: number;
  source: 'database' | 'api' | 'supabase';
}

export interface InauzwaSyncStatus {
  configured: boolean;
  database: boolean;
  api: boolean;
  branchId: string | null;
  vendorId: string | null;
  currency: string;
  defaultApiUrl: string | null;
  defaultSupabaseUrl: string | null;
  hasDefaultSupabaseAnonKey: boolean;
  hasSupabaseConfig: boolean;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  preferences: InauzwaSyncPreferencesDto;
}

export interface InauzwaBranchOption {
  id: string;
  name: string;
  vendorId?: string | null;
  productCount?: number;
}

type InauzwaProductRow = {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  image_url: string | null;
  image_urls?: string[];
  selling_price: string | number | null;
  is_active: boolean;
  category_name: string | null;
};

type InauzwaVariantRow = {
  id: string;
  product_id: string;
  name: string;
  sku: string | null;
  selling_price: string | number | null;
  quantity: number;
  is_active: boolean;
  is_parent: boolean;
  variant_type: string | null;
  parent_variant_id: string | null;
  imei: string | null;
  serial_number: string | null;
  variant_attributes: unknown;
};

@Injectable()
export class InauzwaSyncService {
  private pool: Pool | null = null;
  private poolDatabaseUrl: string | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly preferences: InauzwaSyncPreferencesService,
    @InjectRepository(Product, 'data')
    private readonly productRepo: Repository<Product>,
    @InjectRepository(ProductVariant, 'data')
    private readonly variantRepo: Repository<ProductVariant>,
    private readonly inventoryService: InventoryItemService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async isConfigured(): Promise<boolean> {
    const creds = await this.preferences.resolveCredentials();
    return creds.source !== null;
  }

  /** True when quickSync can run without missing branch/vendor configuration. */
  async canQuickSync(): Promise<boolean> {
    const creds = await this.preferences.resolveCredentials();
    if (creds.source === null) return false;

    const branchId = await this.preferences.resolveEffectiveBranchId();
    if (!branchId) return false;

    if (creds.source === 'database' || creds.source === 'supabase') {
      const vendorId = await this.preferences.resolveEffectiveVendorId();
      if (!vendorId) return false;
    }
    return true;
  }

  resetConnectionPool(): void {
    if (this.pool) {
      void this.pool.end().catch(() => undefined);
    }
    this.pool = null;
    this.poolDatabaseUrl = null;
  }

  async getStatus(): Promise<InauzwaSyncStatus> {
    const creds = await this.preferences.resolveCredentials();
    await this.preferences.ensureLoginUserProfile(creds);
    const preferences = await this.preferences.toDto();
    const envBranch = this.configService.get<string>('inauzwa.branchId')?.trim() || null;
    const envVendor = this.configService.get<string>('inauzwa.vendorId')?.trim() || null;
    return {
      configured: creds.source !== null,
      database: creds.source === 'database' || creds.source === 'supabase',
      api: creds.source === 'api',
      branchId: preferences.branchId || envBranch,
      vendorId: preferences.vendorId || envVendor,
      currency: creds.currency,
      defaultApiUrl: this.configService.get<string>('inauzwa.apiUrl')?.trim() || null,
      defaultSupabaseUrl: this.configService.get<string>('inauzwa.supabaseUrl')?.trim() || null,
      hasDefaultSupabaseAnonKey: Boolean(
        this.configService.get<string>('inauzwa.supabaseAnonKey')?.trim(),
      ),
      hasSupabaseConfig: !!(
        this.configService.get<string>('inauzwa.supabaseUrl')?.trim() &&
        this.configService.get<string>('inauzwa.supabaseAnonKey')?.trim()
      ),
      lastSyncAt: preferences.lastSyncAt,
      lastSyncError: preferences.lastSyncError,
      preferences,
    };
  }

  async testConnection(
    dto: TestInauzwaConnectionDto,
  ): Promise<{ ok: boolean; source: 'database' | 'api'; branchCount?: number }> {
    const saved = await this.preferences.resolveCredentials();
    const mode =
      dto.mode ??
      (dto.databaseUrl?.trim() ? 'database' : dto.apiUrl?.trim() ? 'api' : saved.source);
    if (mode === 'database') {
      const url = dto.databaseUrl?.trim() || saved.databaseUrl;
      if (!url) {
        throw new BadRequestException('Database URL is required');
      }
      const pool = this.createPool(url);
      try {
        await pool.query('SELECT 1');
        const branches = await pool.query<{ n: number }>(
          'SELECT COUNT(*)::int AS n FROM public.store_locations',
        );
        return {
          ok: true,
          source: 'database',
          branchCount: branches.rows[0]?.n ?? 0,
        };
      } finally {
        await pool.end();
      }
    }

    const apiUrl = (dto.apiUrl?.trim() || saved.apiUrl)?.replace(/\/$/, '');
    const token = dto.apiToken?.trim() || saved.apiToken;
    if (!apiUrl || !token) {
      throw new BadRequestException('API URL and token are required');
    }
    const res = await fetch(`${apiUrl}/products?limit=1&offset=0`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new BadRequestException(`INAUZWA API error: HTTP ${res.status}`);
    }
    return { ok: true, source: 'api' };
  }

  async quickSync(): Promise<InauzwaSyncResult> {
    return this.sync({ mode: 'merge', activeOnly: true });
  }

  async listBranches(): Promise<InauzwaBranchOption[]> {
    const creds = await this.preferences.resolveCredentials();

    if (creds.source === 'supabase' && creds.supabaseUrl && creds.supabaseAnonKey && creds.apiToken) {
      let url = `${creds.supabaseUrl}/rest/v1/store_locations?select=id,name,vendor_id&order=name.asc&limit=200`;
      const res = await fetch(url, {
        headers: {
          apikey: creds.supabaseAnonKey,
          Authorization: `Bearer ${creds.apiToken}`,
          Accept: 'application/json',
        },
      });
      if (!res.ok) return [];
      const rows = (await res.json()) as Array<{
        id: string;
        name?: string | null;
        vendor_id?: string | null;
      }>;
      return rows.map((r) => ({
        id: String(r.id),
        name: r.name?.trim() || 'Branch',
        vendorId: r.vendor_id ? String(r.vendor_id) : null,
      }));
    }

    if (creds.source !== 'database' || !creds.databaseUrl) {
      return [];
    }
    const pool = this.getPool(creds.databaseUrl);
    const result = await pool.query<{
      id: string;
      name: string;
      vendor_id: string | null;
      product_count: number;
    }>(
      `SELECT
         sl.id::text AS id,
         COALESCE(sl.name, 'Branch') AS name,
         sl.vendor_id::text AS vendor_id,
         (SELECT COUNT(*)::int FROM public.lats_products p WHERE p.branch_id = sl.id) AS product_count
       FROM public.store_locations sl
       ORDER BY product_count DESC, name ASC
       LIMIT 200`,
    );
    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      vendorId: row.vendor_id,
      productCount: row.product_count,
    }));
  }

  async sync(options: InauzwaSyncOptions = {}): Promise<InauzwaSyncResult> {
    const creds = await this.preferences.resolveCredentials();
    if (creds.source === null) {
      throw new ServiceUnavailableException(
        'INAUZWA sync is not configured. Connect your inventory on the Products page or set INAUZWA_* in .env',
      );
    }

    const branchId = await this.preferences.resolveEffectiveBranchId(options.branchId);
    if (!branchId) {
      throw new BadRequestException(
        'branchId is required. Pick a branch on the Products page or set INAUZWA_BRANCH_ID in .env',
      );
    }

    let vendorId =
      (await this.preferences.resolveEffectiveVendorId(options.vendorId)) || undefined;
    if (creds.source === 'database' && creds.databaseUrl) {
      vendorId = await this.resolveVendorIdForBranch(
        branchId,
        vendorId,
        creds.databaseUrl,
      );
    }
    if (creds.source === 'supabase' && !vendorId) {
      throw new BadRequestException(
        'vendorId is required for Supabase sync. Log in to INAUZWA or set INAUZWA_VENDOR_ID.',
      );
    }
    const activeOnly = options.activeOnly !== false;
    const mode = options.mode ?? 'merge';
    const currency = creds.currency;

    try {
      const { products, variants, source } =
        creds.source === 'database'
          ? await this.fetchFromDatabase(branchId, vendorId, activeOnly, creds.databaseUrl!)
          : creds.source === 'supabase'
            ? await this.fetchFromSupabase(
                branchId,
                vendorId,
                activeOnly,
                creds.supabaseUrl!,
                creds.supabaseAnonKey!,
                creds.apiToken!,
              )
            : await this.fetchFromApi(activeOnly, creds.apiUrl!, creds.apiToken!);

      const result: InauzwaSyncResult = {
        productsCreated: 0,
        productsUpdated: 0,
        variantsCreated: 0,
        variantsUpdated: 0,
        productsDeactivated: 0,
        source,
      };

      const syncedProductExternalIds: string[] = [];
      const variantIdMap = new Map<string, string>();

      for (const row of products) {
        syncedProductExternalIds.push(row.id);
        const saved = await this.upsertProduct(row, currency);
        if (saved.created) result.productsCreated += 1;
        else result.productsUpdated += 1;
      }

      const topLevel = variants.filter(
        (v) => !v.parent_variant_id && v.variant_type !== 'imei_child',
      );
      const children = variants.filter(
        (v) => v.parent_variant_id || v.variant_type === 'imei_child',
      );

      for (const row of topLevel) {
        const product = await this.productRepo.findOne({ where: { externalId: row.product_id } });
        if (!product) continue;
        const { variant, created } = await this.upsertVariant(product.id, row, null, currency);
        variantIdMap.set(row.id, variant.id);
        if (created) result.variantsCreated += 1;
        else result.variantsUpdated += 1;
      }

      for (const row of children) {
        const product = await this.productRepo.findOne({ where: { externalId: row.product_id } });
        if (!product) continue;
        const parentInternalId = row.parent_variant_id
          ? variantIdMap.get(row.parent_variant_id) ?? null
          : null;
        if (row.parent_variant_id && !parentInternalId) continue;

        const variantType = (row.variant_type || '').toLowerCase();
        if (variantType === 'imei_child' && parentInternalId) {
          const { created } = await this.inventoryService.syncInauzwaItem({
            productId: product.id,
            variantId: parentInternalId,
            branchId,
            externalId: row.id,
            imei: row.imei,
            serialNumber: row.serial_number,
            sellingPrice: this.toNumber(row.selling_price),
            isActive: row.is_active !== false,
            attributes: this.buildAttributes(row) as Record<string, unknown>,
          });
          if (created) result.variantsCreated += 1;
          else result.variantsUpdated += 1;
          continue;
        }

        const { created } = await this.upsertVariant(product.id, row, parentInternalId, currency);
        if (created) result.variantsCreated += 1;
        else result.variantsUpdated += 1;
      }

      if (mode === 'replace' && syncedProductExternalIds.length > 0) {
        const deactivate = await this.productRepo
          .createQueryBuilder()
          .update(Product)
          .set({ isActive: false })
          .where('externalId IS NOT NULL')
          .andWhere('externalId NOT IN (:...ids)', { ids: syncedProductExternalIds })
          .execute();
        result.productsDeactivated = deactivate.affected ?? 0;
      }

      await this.preferences.recordSyncBranchContext(branchId, vendorId);
      await this.preferences.recordSyncSuccess(result);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.preferences.recordSyncError(msg);
      this.eventsGateway.emitSyncFailed({
        error: msg,
        branchId: options.branchId ?? null,
      });
      throw err;
    }
  }

  private async upsertProduct(
    row: InauzwaProductRow,
    currency: string,
  ): Promise<{ product: Product; created: boolean }> {
    let product = await this.productRepo.findOne({ where: { externalId: row.id } });
    const created = !product;
    if (!product) {
      product = this.productRepo.create({ externalId: row.id });
    }
    product.name = row.name?.trim() || 'Unnamed product';
    product.description = row.description;
    product.sku = row.sku;
    product.category = row.category_name;
    const gallery = (row.image_urls ?? [])
      .map((url) => url?.trim())
      .filter((url): url is string => Boolean(url));
    product.imageUrls = gallery.length > 0 ? [...new Set(gallery)] : null;
    product.imageUrl = product.imageUrls?.[0] ?? row.image_url;
    product.sellingPrice = this.toNumber(row.selling_price);
    product.currency = currency;
    product.isActive = row.is_active !== false;
    await this.productRepo.save(product);
    return { product, created };
  }

  private validateImeiMapping(row: InauzwaVariantRow, parentVariantId: string | null): void {
    const variantType = (row.variant_type || '').toLowerCase();
    if (variantType !== 'imei_child') return;
    if (!row.parent_variant_id) {
      throw new BadRequestException(`IMEI variant ${row.id} is missing parent_variant_id`);
    }
    if (!parentVariantId) {
      throw new BadRequestException(`IMEI variant ${row.id} references unknown parent ${row.parent_variant_id}`);
    }
    const imei = row.imei?.trim();
    if (!imei || !/^\d{14,16}$/.test(imei)) {
      throw new BadRequestException(`IMEI variant ${row.id} has invalid IMEI value`);
    }
  }

  private async upsertVariant(
    productId: string,
    row: InauzwaVariantRow,
    parentVariantId: string | null,
    currency: string,
  ): Promise<{ variant: ProductVariant; created: boolean }> {
    this.validateImeiMapping(row, parentVariantId);
    let variant = await this.variantRepo.findOne({ where: { externalId: row.id } });
    const created = !variant;
    if (!variant) {
      variant = this.variantRepo.create({ externalId: row.id, productId });
    }

    const variantType = this.mapVariantType(row);
    const attrs = this.buildAttributes(row);

    variant.productId = productId;
    variant.name = this.variantDisplayName(row);
    variant.sku = row.sku;
    variant.sellingPrice = this.toNumber(row.selling_price);
    variant.quantity =
      variantType === 'imei_child'
        ? Math.max(0, row.quantity ?? 0) || (row.is_active ? 1 : 0)
        : row.quantity ?? 0;
    variant.variantType = variantType === 'imei_child' ? 'standard' : variantType;
    variant.isParent = row.is_parent || variantType === 'parent';
    variant.trackInventoryItems =
      variant.isParent || variantType === 'parent' || variantType === 'imei_child';
    if (variant.trackInventoryItems && variantType !== 'imei_child') {
      variant.variantType = 'standard';
      variant.isParent = false;
    }
    variant.parentVariantId = parentVariantId;
    variant.attributes = attrs;
    variant.isActive = row.is_active !== false;

    await this.variantRepo.save(variant);
    return { variant, created };
  }

  private mapVariantType(row: InauzwaVariantRow): VariantType {
    const t = (row.variant_type || '').toLowerCase();
    if (t === 'imei_child') return 'imei_child';
    if (t === 'parent' || row.is_parent) return 'parent';
    return 'standard';
  }

  private variantDisplayName(row: InauzwaVariantRow): string {
    const imei = row.imei?.trim();
    if (imei) return imei;
    const serial = row.serial_number?.trim();
    if (serial) return serial;
    return row.name?.trim() || 'Variant';
  }

  private buildAttributes(row: InauzwaVariantRow): Record<string, string | number | boolean | null> | null {
    const attrs: Record<string, string | number | boolean | null> = {};
    if (row.imei?.trim()) attrs.imei = row.imei.trim();
    if (row.serial_number?.trim()) attrs.serial_number = row.serial_number.trim();

    const raw = row.variant_attributes;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        if (v === null || v === undefined) continue;
        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
          attrs[k] = v;
        }
      }
    } else if (typeof raw === 'string' && raw.trim()) {
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
            attrs[k] = v;
          }
        }
      } catch {
        // ignore invalid JSON
      }
    }

    return Object.keys(attrs).length > 0 ? attrs : null;
  }

  private async resolveVendorIdForBranch(
    branchId: string,
    preferredVendorId: string | undefined,
    databaseUrl: string,
  ): Promise<string | undefined> {
    const pool = this.getPool(databaseUrl);

    const countForVendor = async (vendorId?: string): Promise<number> => {
      const params: string[] = [branchId];
      const vendorFilter = vendorId ? 'AND p.vendor_id = $2::uuid' : '';
      if (vendorId) params.push(vendorId);
      const result = await pool.query<{ n: number }>(
        `SELECT COUNT(*)::int AS n
         FROM public.lats_products p
         WHERE p.branch_id = $1::uuid
           ${vendorFilter}`,
        params,
      );
      return result.rows[0]?.n ?? 0;
    };

    const location = await pool.query<{ vendor_id: string | null }>(
      `SELECT vendor_id::text AS vendor_id
       FROM public.store_locations
       WHERE id = $1::uuid
       LIMIT 1`,
      [branchId],
    );
    const branchVendor = location.rows[0]?.vendor_id?.trim() || undefined;

    const candidates = [preferredVendorId, branchVendor].filter(
      (value, index, list): value is string =>
        !!value?.trim() && list.indexOf(value) === index,
    );

    for (const candidate of candidates) {
      if ((await countForVendor(candidate)) > 0) return candidate;
    }

    if ((await countForVendor(undefined)) > 0) return undefined;

    const dominant = await pool.query<{ vendor_id: string }>(
      `SELECT vendor_id::text AS vendor_id
       FROM public.lats_products
       WHERE branch_id = $1::uuid
         AND vendor_id IS NOT NULL
       GROUP BY vendor_id
       ORDER BY COUNT(*) DESC
       LIMIT 1`,
      [branchId],
    );
    return dominant.rows[0]?.vendor_id?.trim() || branchVendor || preferredVendorId;
  }

  private async fetchFromDatabase(
    branchId: string,
    vendorId: string | undefined,
    activeOnly: boolean,
    databaseUrl: string,
  ): Promise<{ products: InauzwaProductRow[]; variants: InauzwaVariantRow[]; source: 'database' }> {
    const pool = this.getPool(databaseUrl);
    const vendorFilter = vendorId ? 'AND p.vendor_id = $2' : '';
    const vendorFilterVariants = vendorId ? 'AND v.vendor_id = $2' : '';
    const params: string[] = [branchId];
    if (vendorId) params.push(vendorId);

    const activeProduct = activeOnly ? 'AND p.is_active = true' : '';
    const activeVariant = activeOnly ? 'AND v.is_active = true' : '';

    const productsResult = await pool.query<InauzwaProductRow>(
      `SELECT
        p.id::text as id,
        p.name,
        p.description,
        p.sku,
        p.image_url,
        p.selling_price,
        COALESCE(p.is_active, true) as is_active,
        c.name as category_name
      FROM public.lats_products p
      LEFT JOIN public.lats_categories c ON p.category_id = c.id
      WHERE p.branch_id = $1::uuid
        ${vendorFilter}
        ${activeProduct}
      ORDER BY p.name`,
      params,
    );

    const imageMap = await this.fetchProductImageMapFromDatabase(pool, branchId, vendorId);
    const products = productsResult.rows.map((row) => ({
      ...row,
      image_urls: imageMap.get(row.id) ?? undefined,
    }));

    const variantsResult = await pool.query<InauzwaVariantRow>(
      `SELECT
        v.id::text as id,
        v.product_id::text as product_id,
        v.name,
        v.sku,
        v.selling_price,
        COALESCE(v.quantity, 0) as quantity,
        COALESCE(v.is_active, true) as is_active,
        COALESCE(v.is_parent, false) as is_parent,
        v.variant_type,
        v.parent_variant_id::text as parent_variant_id,
        v.imei,
        v.serial_number,
        v.variant_attributes
      FROM public.lats_product_variants v
      WHERE v.branch_id = $1::uuid
        ${vendorFilterVariants}
        ${activeVariant}
      ORDER BY v.product_id, v.parent_variant_id NULLS FIRST, v.name`,
      params,
    );

    return {
      products,
      variants: variantsResult.rows,
      source: 'database',
    };
  }

  private async fetchProductImageMapFromDatabase(
    pool: Pool,
    branchId: string,
    vendorId: string | undefined,
  ): Promise<Map<string, string[]>> {
    const vendorFilter = vendorId ? 'AND pi.vendor_id = $2::uuid' : '';
    const params: string[] = [branchId];
    if (vendorId) params.push(vendorId);

    const result = await pool.query<{ product_id: string; image_url: string }>(
      `SELECT pi.product_id::text as product_id, pi.image_url
       FROM public.product_images pi
       WHERE pi.branch_id = $1::uuid
         AND pi.image_url IS NOT NULL
         AND TRIM(pi.image_url) <> ''
         ${vendorFilter}
       ORDER BY pi.product_id, pi.is_primary DESC, pi.created_at ASC`,
      params,
    );

    const map = new Map<string, string[]>();
    for (const row of result.rows) {
      const url = row.image_url.trim();
      if (!url) continue;
      const list = map.get(row.product_id) ?? [];
      if (!list.includes(url)) list.push(url);
      map.set(row.product_id, list);
    }
    return map;
  }

  private async fetchProductImageMapFromSupabase(
    supabaseUrl: string,
    headers: Record<string, string>,
    branchId: string,
    vendorId: string | undefined,
  ): Promise<Map<string, string[]>> {
    const imgParams = new URLSearchParams({
      select: 'product_id,image_url,is_primary,created_at',
      branch_id: `eq.${branchId}`,
      order: 'product_id.asc,is_primary.desc,created_at.asc',
      limit: '10000',
    });
    if (vendorId) imgParams.set('vendor_id', `eq.${vendorId}`);

    const imgRes = await fetch(`${supabaseUrl}/rest/v1/product_images?${imgParams}`, { headers });
    if (!imgRes.ok) return new Map();

    const rows = (await imgRes.json()) as Array<{ product_id: string; image_url?: string | null }>;
    const map = new Map<string, string[]>();
    for (const row of rows) {
      const url = row.image_url?.trim();
      if (!url) continue;
      const productId = String(row.product_id);
      const list = map.get(productId) ?? [];
      if (!list.includes(url)) list.push(url);
      map.set(productId, list);
    }
    return map;
  }

  private async fetchFromApi(
    activeOnly: boolean,
    apiUrlRaw: string,
    token: string,
  ): Promise<{ products: InauzwaProductRow[]; variants: InauzwaVariantRow[]; source: 'api' }> {
    const apiUrl = apiUrlRaw.replace(/\/$/, '');
    const limit = 500;
    let offset = 0;
    const allProducts: InauzwaProductRow[] = [];

    for (;;) {
      const res = await fetch(`${apiUrl}/products?limit=${limit}&offset=${offset}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
      if (!res.ok) {
        throw new BadRequestException(`INAUZWA API error: HTTP ${res.status}`);
      }
      const body = (await res.json()) as { data?: unknown[] };
      const batch = (body.data ?? []) as Array<Record<string, unknown>>;
      if (batch.length === 0) break;

      for (const p of batch) {
        if (activeOnly && p.is_active === false) continue;
        allProducts.push({
          id: String(p.id),
          name: String(p.name ?? ''),
          description: (p.description as string) ?? null,
          sku: (p.sku as string) ?? null,
          image_url: (p.image_url as string) ?? null,
          selling_price: (p.selling_price as number) ?? null,
          is_active: p.is_active !== false,
          category_name: (p.category_name as string) ?? null,
        });
      }
      if (batch.length < limit) break;
      offset += limit;
    }

    const variants: InauzwaVariantRow[] = [];
    for (const p of allProducts) {
      const res = await fetch(`${apiUrl}/products/${p.id}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      if (!res.ok) continue;
      const body = (await res.json()) as { data?: Record<string, unknown> };
      const detail = body.data ?? (body as unknown as Record<string, unknown>);
      const list = (detail.variants as Array<Record<string, unknown>>) ?? [];
      for (const v of list) {
        variants.push(this.apiVariantToRow(v, p.id));
      }
      const children = (detail.imei_children as Array<Record<string, unknown>>) ?? [];
      for (const v of children) {
        variants.push(this.apiVariantToRow(v, p.id));
      }
    }

    return { products: allProducts, variants, source: 'api' };
  }

  private async fetchFromSupabase(
    branchId: string,
    vendorId: string | undefined,
    activeOnly: boolean,
    supabaseUrl: string,
    anonKey: string,
    accessToken: string,
  ): Promise<{ products: InauzwaProductRow[]; variants: InauzwaVariantRow[]; source: 'supabase' }> {
    const headers = {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    };

    const productParams = new URLSearchParams({
      select: 'id,name,description,sku,image_url,selling_price,is_active,category_id',
      branch_id: `eq.${branchId}`,
      order: 'name.asc',
      limit: '1000',
    });
    if (vendorId) productParams.set('vendor_id', `eq.${vendorId}`);
    if (activeOnly) productParams.set('is_active', 'eq.true');

    const productRes = await fetch(`${supabaseUrl}/rest/v1/lats_products?${productParams}`, {
      headers,
    });
    if (!productRes.ok) {
      throw new BadRequestException(`Supabase products query failed: HTTP ${productRes.status}`);
    }
    const rawProducts = (await productRes.json()) as Array<Record<string, unknown>>;

    const categoryIds = [
      ...new Set(rawProducts.map((p) => p.category_id).filter(Boolean).map(String)),
    ];
    const categoryMap = new Map<string, string>();
    if (categoryIds.length > 0) {
      const catRes = await fetch(
        `${supabaseUrl}/rest/v1/lats_categories?id=in.(${categoryIds.join(',')})&select=id,name`,
        { headers },
      );
      if (catRes.ok) {
        const cats = (await catRes.json()) as Array<{ id: string; name?: string | null }>;
        for (const c of cats) {
          categoryMap.set(String(c.id), c.name?.trim() || '');
        }
      }
    }

    const imageMap = await this.fetchProductImageMapFromSupabase(
      supabaseUrl,
      headers,
      branchId,
      vendorId,
    );

    const products: InauzwaProductRow[] = rawProducts.map((p) => ({
      id: String(p.id),
      name: String(p.name ?? ''),
      description: (p.description as string) ?? null,
      sku: (p.sku as string) ?? null,
      image_url: (p.image_url as string) ?? null,
      image_urls: imageMap.get(String(p.id)) ?? undefined,
      selling_price: (p.selling_price as string | number) ?? null,
      is_active: p.is_active !== false,
      category_name: p.category_id ? categoryMap.get(String(p.category_id)) ?? null : null,
    }));

    const variantParams = new URLSearchParams({
      select:
        'id,product_id,name,sku,selling_price,quantity,is_active,is_parent,variant_type,parent_variant_id,imei,serial_number,variant_attributes',
      branch_id: `eq.${branchId}`,
      order: 'product_id.asc,parent_variant_id.asc,name.asc',
      limit: '5000',
    });
    if (vendorId) variantParams.set('vendor_id', `eq.${vendorId}`);
    if (activeOnly) variantParams.set('is_active', 'eq.true');

    const variantRes = await fetch(`${supabaseUrl}/rest/v1/lats_product_variants?${variantParams}`, {
      headers,
    });
    if (!variantRes.ok) {
      throw new BadRequestException(`Supabase variants query failed: HTTP ${variantRes.status}`);
    }
    const rawVariants = (await variantRes.json()) as Array<Record<string, unknown>>;
    const variants: InauzwaVariantRow[] = rawVariants.map((v) => ({
      id: String(v.id),
      product_id: String(v.product_id),
      name: String(v.name ?? ''),
      sku: (v.sku as string) ?? null,
      selling_price: (v.selling_price as string | number) ?? null,
      quantity: Number(v.quantity ?? 0),
      is_active: v.is_active !== false,
      is_parent: Boolean(v.is_parent),
      variant_type: (v.variant_type as string) ?? null,
      parent_variant_id: v.parent_variant_id ? String(v.parent_variant_id) : null,
      imei: (v.imei as string) ?? null,
      serial_number: (v.serial_number as string) ?? null,
      variant_attributes: v.variant_attributes ?? null,
    }));

    return { products, variants, source: 'supabase' };
  }

  private apiVariantToRow(v: Record<string, unknown>, productId: string): InauzwaVariantRow {
    return {
      id: String(v.id),
      product_id: String(v.product_id ?? productId),
      name: String(v.name ?? ''),
      sku: (v.sku as string) ?? null,
      selling_price: (v.selling_price as number) ?? null,
      quantity: Number(v.quantity ?? 0),
      is_active: v.is_active !== false,
      is_parent: Boolean(v.is_parent),
      variant_type: (v.variant_type as string) ?? null,
      parent_variant_id: v.parent_variant_id ? String(v.parent_variant_id) : null,
      imei: (v.imei as string) ?? null,
      serial_number: (v.serial_number as string) ?? null,
      variant_attributes: v.variant_attributes ?? v.attributes ?? null,
    };
  }

  private createPool(url: string): Pool {
    const readOnly = process.env.INAUZWA_DB_READ_ONLY !== 'false';
    const neonPooler = isNeonPoolerDatabaseUrl(url);
    return new Pool({
      connectionString: url,
      ssl: url.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
      max: 3,
      // Neon pooler rejects startup `options` (e.g. default_transaction_read_only).
      ...(readOnly && !neonPooler ? { options: '-c default_transaction_read_only=on' } : {}),
    });
  }

  private getPool(databaseUrl: string): Pool {
    if (this.pool && this.poolDatabaseUrl !== databaseUrl) {
      this.resetConnectionPool();
    }
    if (!this.pool) {
      this.pool = this.createPool(databaseUrl);
      this.poolDatabaseUrl = databaseUrl;
    }
    return this.pool;
  }

  private toNumber(value: string | number | null | undefined): number | null {
    if (value == null || value === '') return null;
    const n = typeof value === 'number' ? value : parseFloat(String(value));
    return Number.isFinite(n) ? n : null;
  }
}
