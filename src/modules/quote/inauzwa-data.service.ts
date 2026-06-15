import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { InauzwaSyncPreferencesService } from '../products/inauzwa-sync-preferences.service';
import { normalizeInauzwaApiUrl } from '../products/inauzwa-auth.service';

export interface InauzwaCustomerRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  loyaltyLevel: string | null;
  totalSpent: number | null;
}

export interface InauzwaProformaSummary {
  id: string;
  proformaNumber: string;
  status: string;
  total: number;
  validUntil: string | null;
  customerName: string | null;
}

export interface InauzwaSaleSummary {
  id: string;
  saleNumber: string | null;
  total: number;
  createdAt: string;
  paymentStatus: string | null;
}

@Injectable()
export class InauzwaDataService {
  constructor(private readonly inauzwaPrefs: InauzwaSyncPreferencesService) {}

  async searchCustomers(query: string, limit = 20): Promise<InauzwaCustomerRow[]> {
    const prefs = await this.inauzwaPrefs.get();
    if (!prefs.syncCustomers) return [];

    const creds = await this.inauzwaPrefs.resolveCredentials();
    const branchId = await this.inauzwaPrefs.resolveEffectiveBranchId();
    const q = query.trim();
    if (!q) return [];

    if (creds.apiUrl && creds.apiToken) {
      const apiBase = normalizeInauzwaApiUrl(creds.apiUrl);
      const url = new URL(`${apiBase}/customers`);
      url.searchParams.set('search', q);
      url.searchParams.set('limit', String(limit));
      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${creds.apiToken}`,
          ...(branchId ? { 'X-Current-Branch-Id': branchId } : {}),
        },
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { customers?: Array<Record<string, unknown>>; data?: Array<Record<string, unknown>> };
      const rows = data.customers ?? data.data ?? [];
      return rows.slice(0, limit).map(mapCustomerApiRow);
    }

    if (creds.databaseUrl && branchId) {
      const pool = new Pool({ connectionString: creds.databaseUrl, max: 1 });
      try {
        const like = `%${q}%`;
        const result = await pool.query(
          `SELECT id, name, phone, email, whatsapp, loyalty_level, total_spent
           FROM lats_customers
           WHERE branch_id = $1 AND is_active = true
             AND (name ILIKE $2 OR phone ILIKE $2 OR whatsapp ILIKE $2 OR email ILIKE $2)
           ORDER BY last_activity_date DESC NULLS LAST
           LIMIT $3`,
          [branchId, like, limit],
        );
        return result.rows.map(mapCustomerDbRow);
      } finally {
        await pool.end();
      }
    }

    return [];
  }

  async listProformasForCustomer(customerId: string, limit = 10): Promise<InauzwaProformaSummary[]> {
    const prefs = await this.inauzwaPrefs.get();
    if (!prefs.syncProformas || !customerId) return [];

    const creds = await this.inauzwaPrefs.resolveCredentials();
    if (!creds.databaseUrl) return [];

    const branchId = await this.inauzwaPrefs.resolveEffectiveBranchId();
    const pool = new Pool({ connectionString: creds.databaseUrl, max: 1 });
    try {
      const result = await pool.query(
        `SELECT id, proforma_number, status, total, valid_until, customer_name
         FROM lats_proforma_invoices
         WHERE customer_id = $1
           ${branchId ? 'AND branch_id = $3' : ''}
         ORDER BY created_at DESC
         LIMIT $2`,
        branchId ? [customerId, limit, branchId] : [customerId, limit],
      );
      return result.rows.map((r) => ({
        id: r.id,
        proformaNumber: r.proforma_number,
        status: r.status,
        total: Number(r.total),
        validUntil: r.valid_until ? new Date(r.valid_until).toISOString() : null,
        customerName: r.customer_name,
      }));
    } finally {
      await pool.end();
    }
  }

  async listRecentSalesForCustomer(customerId: string, limit = 5): Promise<InauzwaSaleSummary[]> {
    const prefs = await this.inauzwaPrefs.get();
    if (!prefs.syncRecentSales || !customerId) return [];

    const creds = await this.inauzwaPrefs.resolveCredentials();
    if (creds.apiUrl && creds.apiToken) {
      const apiBase = normalizeInauzwaApiUrl(creds.apiUrl);
      const res = await fetch(`${apiBase}/customers/${customerId}/recent-sales`, {
        headers: { Authorization: `Bearer ${creds.apiToken}` },
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { sales?: Array<Record<string, unknown>> };
      return (data.sales ?? []).slice(0, limit).map(mapSaleApiRow);
    }

    if (creds.databaseUrl) {
      const pool = new Pool({ connectionString: creds.databaseUrl, max: 1 });
      try {
        const result = await pool.query(
          `SELECT id, sale_number, total_amount, created_at, payment_status
           FROM lats_sales
           WHERE customer_id = $1
           ORDER BY created_at DESC
           LIMIT $2`,
          [customerId, limit],
        );
        return result.rows.map((r) => ({
          id: r.id,
          saleNumber: r.sale_number,
          total: Number(r.total_amount),
          createdAt: new Date(r.created_at).toISOString(),
          paymentStatus: r.payment_status,
        }));
      } finally {
        await pool.end();
      }
    }

    return [];
  }
}

function mapCustomerDbRow(r: Record<string, unknown>): InauzwaCustomerRow {
  return {
    id: String(r.id),
    name: String(r.name ?? ''),
    phone: r.phone ? String(r.phone) : null,
    email: r.email ? String(r.email) : null,
    whatsapp: r.whatsapp ? String(r.whatsapp) : null,
    loyaltyLevel: r.loyalty_level ? String(r.loyalty_level) : null,
    totalSpent: r.total_spent != null ? Number(r.total_spent) : null,
  };
}

function mapCustomerApiRow(r: Record<string, unknown>): InauzwaCustomerRow {
  return {
    id: String(r.id),
    name: String(r.name ?? ''),
    phone: r.phone ? String(r.phone) : null,
    email: r.email ? String(r.email) : null,
    whatsapp: r.whatsapp ? String(r.whatsapp) : null,
    loyaltyLevel: r.loyaltyLevel ? String(r.loyaltyLevel) : null,
    totalSpent: r.totalSpent != null ? Number(r.totalSpent) : null,
  };
}

function mapSaleApiRow(r: Record<string, unknown>): InauzwaSaleSummary {
  return {
    id: String(r.id),
    saleNumber: r.saleNumber ? String(r.saleNumber) : r.sale_number ? String(r.sale_number) : null,
    total: Number(r.total ?? r.totalAmount ?? 0),
    createdAt: String(r.createdAt ?? r.created_at ?? new Date().toISOString()),
    paymentStatus: r.paymentStatus ? String(r.paymentStatus) : null,
  };
}
