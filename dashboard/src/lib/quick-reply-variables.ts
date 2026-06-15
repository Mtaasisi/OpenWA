import type { Conversation, FollowupConversation, QuickReplyVariables } from '../services/api';
import { resolveCustomerName } from './inbox-customer-display';

const PLACEHOLDER_RE = /\{(\w+)\}/g;

export function renderQuickReplyTemplate(
  body: string,
  variables: QuickReplyVariables,
): string {
  return body.replace(PLACEHOLDER_RE, (_, key: string) => {
    const k = key as keyof QuickReplyVariables;
    return variables[k] ?? `{${key}}`;
  });
}

export function buildQuickReplyVariables(opts: {
  conversation?: Conversation;
  followupConv?: FollowupConversation | null;
  branchName?: string | null;
  staffName?: string | null;
  paymentNumber?: string | null;
  pickupLocation?: string | null;
  warranty?: string | null;
  deliveryFee?: string | null;
}): QuickReplyVariables {
  const customerName = resolveCustomerName(
    opts.conversation?.chatId ?? opts.followupConv?.chatId ?? '',
    opts.followupConv?.customerName,
    opts.conversation?.customerName,
  ) ?? undefined;

  const productName = opts.followupConv?.productInterest ?? undefined;
  const price =
    opts.followupConv?.budget != null ? String(opts.followupConv.budget) : undefined;

  return {
    customer_name: customerName ?? undefined,
    product_name: productName,
    price,
    staff_name: opts.staffName ?? undefined,
    branch_name: opts.branchName ?? undefined,
    payment_number: opts.paymentNumber ?? undefined,
    pickup_location: opts.pickupLocation ?? undefined,
    warranty: opts.warranty ?? undefined,
    delivery_fee: opts.deliveryFee ?? undefined,
  };
}

/** Variables for follow-up template preview API (`{customer_name}`, …). */
export function followupTemplateVariablesRecord(
  variables: QuickReplyVariables,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(variables)) {
    if (value != null && String(value).trim() !== '') {
      out[key] = String(value);
    }
  }
  return out;
}
