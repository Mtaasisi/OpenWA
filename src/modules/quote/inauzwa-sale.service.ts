import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { Quote } from './entities/quote.entity';
import { QuoteItem } from './entities/quote-item.entity';
import { InauzwaSyncPreferencesService } from '../products/inauzwa-sync-preferences.service';
import { normalizeInauzwaApiUrl } from '../products/inauzwa-auth.service';

export interface CheckoutFromQuoteResult {
  saleId: string;
  saleNumber?: string;
}

@Injectable()
export class InauzwaSaleService {
  private readonly logger = new Logger(InauzwaSaleService.name);

  constructor(private readonly inauzwaPrefs: InauzwaSyncPreferencesService) {}

  async checkoutFromQuote(
    quote: Quote & { items: QuoteItem[] },
    options: { paymentPending?: boolean },
  ): Promise<CheckoutFromQuoteResult> {
    const creds = await this.inauzwaPrefs.resolveCredentials();
    if (!creds.apiUrl || !creds.apiToken) {
      throw new BadRequestException(
        'INAUZWA API login required to push sales. Enable in Settings or provide a manual sale ID.',
      );
    }

    const branchId = quote.branchId ?? (await this.inauzwaPrefs.resolveEffectiveBranchId());
    if (!branchId) {
      throw new BadRequestException('Branch is required for INAUZWA checkout');
    }

    const cart = quote.items.map((item) => {
      const meta = item.metadata ?? {};
      const externalProductId = meta.externalProductId as string | undefined;
      const externalVariantId = meta.externalVariantId as string | undefined;
      const inventoryItemIds = meta.inventoryItemIds as string[] | undefined;

      if (!externalProductId) {
        throw new BadRequestException(
          `Item "${item.itemName}" has no INAUZWA product link. Re-add from catalog or sync products.`,
        );
      }

      return {
        productId: externalProductId,
        variantId: externalVariantId ?? null,
        productName: item.itemName,
        variantName: (meta.variantName as string | undefined) ?? null,
        quantity: Math.round(item.quantity),
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        inventoryItemIds: inventoryItemIds?.length ? inventoryItemIds : undefined,
      };
    });

    const totalPaid = options.paymentPending ? 0 : quote.totalAmount;
    const paymentLines =
      options.paymentPending || totalPaid <= 0
        ? []
        : [{ method: 'cash' as const, amount: totalPaid }];

    const apiBase = normalizeInauzwaApiUrl(creds.apiUrl);
    const body = {
      customerId: quote.customerId ?? null,
      customerName: quote.customerName ?? null,
      customerPhone: quote.customerPhone ?? null,
      notes: `[openwa-quote:${quote.id}][lead-source:${quote.leadSource ?? 'whatsapp'}] ${quote.notes ?? ''}`.trim(),
      subtotal: quote.subtotal,
      discount: quote.discountAmount,
      tax: quote.taxAmount,
      total: quote.totalAmount,
      totalPaid,
      paymentLines,
      cart,
      clientSaleId: `openwa-quote-${quote.id}`,
    };

    const res = await fetch(`${apiBase}/pos/checkout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.apiToken}`,
        'Content-Type': 'application/json',
        'X-Current-Branch-Id': branchId,
      },
      body: JSON.stringify(body),
    });

    const payload = (await res.json().catch(() => ({}))) as {
      saleId?: string;
      id?: string;
      saleNumber?: string;
      message?: string;
      error?: string;
    };

    if (!res.ok) {
      const msg = payload.message || payload.error || res.statusText;
      this.logger.warn(`INAUZWA checkout failed: ${msg}`);
      throw new BadRequestException(`INAUZWA checkout failed: ${msg}`);
    }

    const saleId = payload.saleId || payload.id;
    if (!saleId) {
      throw new BadRequestException('INAUZWA checkout did not return a sale id');
    }

    return { saleId, saleNumber: payload.saleNumber };
  }

  async mirrorProformaFromQuote(quote: Quote & { items: QuoteItem[] }): Promise<string | null> {
    const prefs = await this.inauzwaPrefs.get();
    if (!prefs.syncProformas) return null;

    const creds = await this.inauzwaPrefs.resolveCredentials();
    if (!creds.databaseUrl) return null;

    const branchId = quote.branchId ?? (await this.inauzwaPrefs.resolveEffectiveBranchId());
    const vendorId = (await this.inauzwaPrefs.resolveEffectiveVendorId()) ?? null;
    if (!branchId || !vendorId) return null;

    const pool = new Pool({ connectionString: creds.databaseUrl, max: 1 });
    try {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const numRes = await client.query<{ n: string }>(
          `SELECT COUNT(*)::text AS n FROM lats_proforma_invoices WHERE branch_id = $1`,
          [branchId],
        );
        const seq = Number(numRes.rows[0]?.n ?? 0) + 1;
        const proformaNumber = `PF-${String(seq).padStart(3, '0')}`;

        const header = await client.query<{ id: string }>(
          `INSERT INTO lats_proforma_invoices (
            vendor_id, branch_id, proforma_number, customer_id, customer_name, customer_phone,
            status, subtotal, tax, discount, total, notes, valid_until, created_by
          ) VALUES ($1,$2,$3,$4,$5,$6,'draft',$7,$8,$9,$10,$11,$12,$13)
          RETURNING id`,
          [
            vendorId,
            branchId,
            proformaNumber,
            quote.customerId,
            quote.customerName,
            quote.customerPhone,
            quote.subtotal,
            quote.taxAmount,
            quote.discountAmount,
            quote.totalAmount,
            `[openwa:${quote.quoteNumber}] ${quote.notes ?? ''}`.trim(),
            quote.validUntil,
            null,
          ],
        );
        const proformaId = header.rows[0].id;

        let order = 0;
        for (const item of quote.items) {
          await client.query(
            `INSERT INTO lats_proforma_invoice_items (
              proforma_invoice_id, product_id, variant_id, product_name, variant_label,
              quantity, unit_price, line_total, sort_order
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [
              proformaId,
              (item.metadata?.externalProductId as string | undefined) ?? null,
              (item.metadata?.externalVariantId as string | undefined) ?? null,
              item.itemName,
              (item.metadata?.variantName as string | undefined) ?? null,
              item.quantity,
              item.unitPrice,
              item.totalPrice,
              order++,
            ],
          );
        }

        await client.query('COMMIT');
        return proformaId;
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    } finally {
      await pool.end();
    }
  }
}
