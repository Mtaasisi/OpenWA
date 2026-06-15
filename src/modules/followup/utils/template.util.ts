export interface TemplateVariables {
  customer_name?: string;
  product_name?: string;
  price?: string;
  quote_amount?: string;
  balance?: string;
  lower_price?: string;
  staff_name?: string;
  branch_name?: string;
  branch_location?: string;
  payment_number?: string;
  pickup_location?: string;
  pickup_date?: string;
  repair_id?: string;
  warranty?: string;
  delivery_fee?: string;
  [key: string]: string | undefined;
}

const PLACEHOLDER_RE = /\{(\w+)\}/g;

export function renderTemplate(body: string, variables: TemplateVariables): string {
  return body.replace(PLACEHOLDER_RE, (_, key: string) => variables[key] ?? `{${key}}`);
}

export function isWithin24HourWindow(lastCustomerMessageAt: Date | null): boolean {
  if (!lastCustomerMessageAt) return false;
  const windowMs = 24 * 60 * 60 * 1000;
  return Date.now() - lastCustomerMessageAt.getTime() < windowMs;
}

export function canAutoSendTemplate(
  requiresApproval: boolean,
  templateStatus: string,
  lastCustomerMessageAt: Date | null,
): boolean {
  if (requiresApproval) {
    return templateStatus === 'approved';
  }
  return isWithin24HourWindow(lastCustomerMessageAt);
}
